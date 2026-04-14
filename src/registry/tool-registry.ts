import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Fuse from "fuse.js";
import { log } from "../logger.js";

interface ModelDescEntry {
  responseModel?: Record<string, string>;
  bodyModel?: Record<string, string>;
  paramDescriptions?: Record<string, string>;
}

interface CatalogEntry {
  name: string;
  description: string;
  handlerName: string;
  params?: Record<string, string[]>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const catalogPath = join(__dirname, "../../src/tool-catalog.json");
const catalog: CatalogEntry[] = JSON.parse(
  readFileSync(catalogPath, "utf-8"),
);

const modelDescPath = join(__dirname, "../../src/model-descriptions.json");
const modelDescriptions: Record<string, ModelDescEntry> = JSON.parse(
  readFileSync(modelDescPath, "utf-8"),
);

const catalogMap = new Map<string, CatalogEntry>();

interface SearchEntry extends CatalogEntry {
  searchableName: string;
}

const searchEntries: SearchEntry[] = catalog.map((entry) => {
  catalogMap.set(entry.name, entry);
  return {
    ...entry,
    searchableName: entry.name.replace(/_/g, " "),
  };
});

const fuse = new Fuse(searchEntries, {
  keys: [
    { name: "searchableName", weight: 0.5 },
    { name: "description", weight: 0.5 },
  ],
  threshold: 0.5,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
});

// Lazy-loaded handlers module
let handlersModule: Record<string, any> | null = null;

async function getHandlers(): Promise<Record<string, any>> {
  if (!handlersModule) {
    const started = performance.now();
    handlersModule = (await import("../api/handlers.js")) as Record<
      string,
      any
    >;
    log.debug("api/handlers modulu yuklendi", {
      ms: Math.round(performance.now() - started),
    });
  }
  return handlersModule;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mcpText(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function mcpError(message: string) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify({ error: message }) },
    ],
    isError: true as const,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function searchTools(query: string, limit = 10) {
  const results = fuse.search(query, { limit });

  const items = results.map((r) => ({
    name: r.item.name,
    description: r.item.description || "(açıklama yok)",
    params: r.item.params
      ? Object.fromEntries(
          Object.entries(r.item.params).map(([k, v]) => [k, v]),
        )
      : undefined,
  }));

  return mcpText(items);
}

export async function getToolDetails(toolName: string) {
  const entry = catalogMap.get(toolName);
  if (!entry) return mcpError(`Tool '${toolName}' bulunamadı`);

  const modelDesc = modelDescriptions[toolName];

  const details: Record<string, unknown> = {
    name: entry.name,
    description: entry.description || "(açıklama yok)",
    params: entry.params ?? "Bu tool parametre almaz.",
  };

  // Parametre açıklamaları (query/path param descriptions)
  if (modelDesc?.paramDescriptions) {
    details.paramDescriptions = modelDesc.paramDescriptions;
  }

  // Body model açıklamaları (POST/PUT gönderilecek alan açıklamaları)
  if (modelDesc?.bodyModel) {
    details.bodyModel = modelDesc.bodyModel;
  }

  // Response model açıklamaları (API'den dönecek alanların ne anlama geldiği)
  if (modelDesc?.responseModel) {
    details.responseModel = modelDesc.responseModel;
  }

  return mcpText(details);
}

export async function callTool(
  toolName: string,
  params?: Record<string, unknown>,
) {
  const entry = catalogMap.get(toolName);
  if (!entry) return mcpError(`Tool '${toolName}' bulunamadı`);

  const handlers = await getHandlers();
  const handler = handlers[entry.handlerName];
  if (typeof handler !== "function") {
    return mcpError(`Handler '${entry.handlerName}' bulunamadı`);
  }

  try {
    return await handler(params ?? {});
  } catch (err: any) {
    return mcpError(`API hatası: ${err.message}`);
  }
}

export async function getModelFields(toolName: string) {
  // 1. Tool adına göre controller'ı bul (Örn: "StokHareketleri_GrupluListeGet" -> "StokHareketleri")
  const [controller] = toolName.split("_");
  if (!controller) {
    return mcpError(`Tool adı geçerli değil: '${toolName}'`);
  }

  // 2. OpenAPI JSON yükle
  const openApiPath = join(__dirname, "../../src/apiSchema/openapi.json");
  let openApiDoc: any;
  try {
    openApiDoc = JSON.parse(readFileSync(openApiPath, "utf-8"));
  } catch (err: any) {
    return mcpError(`openapi.json okunamadı: ${err.message}`);
  }

  // 3. Model şemasını bul (Aaro.Moduller.StokHareketleriListeModel veya Aaro.Moduller.CariHareketleriListe.ListeModel)
  const schemas = openApiDoc?.components?.schemas || {};
  const possibleNames = [
    `Aaro.Moduller.${controller}ListeModel`,
    `Aaro.Moduller.${controller}Liste.ListeModel`,
    `Aaro.Moduller.${controller}.ListeModel`
  ];

  let modelName = possibleNames.find(name => schemas[name]);

  // Eğer doğrudan eşleşme bulamazsak, controller adını içeren ve ListeModel ile biten bir key arayalım
  if (!modelName) {
    modelName = Object.keys(schemas).find(
      key => key.includes(controller) && (key.endsWith("ListeModel") || key.endsWith("Liste.ListeModel"))
    );
  }

  const schema = modelName ? schemas[modelName] : undefined;

  if (!schema || !schema.properties) {
    return mcpError(`Model '${controller}' için ${possibleNames.join(" veya ")} OpenAPI şemalarında bulunamadı veya 'properties' içermiyor.`);
  }

  // 4. Alanları grupla
  const gruplar: Record<string, string[]> = {
    string: [],
    tarih_sayi: [],
    id: []
  };
  
  const degerler: Record<string, string[]> = {
    SUM_AVG_MIN_MAX: [],
    MIN_MAX_COUNT: []
  };

  for (const [propName, propDef] of Object.entries(schema.properties)) {
    const p: any = propDef;
    const type = p.type;
    const format = p.format;

    // ID kontrolü
    if (propName.match(/ID$/i) || propName.match(/Id$/i)) {
      gruplar.id.push(propName);
      continue; // ID alanları degerler'de toplamak genellikle anlamsızdır
    }

    if (type === "string") {
      if (format === "date-time") {
        gruplar.tarih_sayi.push(propName);
        degerler.MIN_MAX_COUNT.push(propName);
      } else {
        gruplar.string.push(propName);
        degerler.MIN_MAX_COUNT.push(propName);
      }
    } else if (type === "number" || type === "integer") {
      gruplar.tarih_sayi.push(propName);
      degerler.SUM_AVG_MIN_MAX.push(propName);
    }
  }

  return mcpText({ gruplar, degerler });
}

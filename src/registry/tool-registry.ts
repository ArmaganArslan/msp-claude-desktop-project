import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Fuse from "fuse.js";

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
    handlersModule = (await import("../api/handlers.js")) as Record<
      string,
      any
    >;
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

  return mcpText({
    name: entry.name,
    description: entry.description || "(açıklama yok)",
    params: entry.params ?? "Bu tool parametre almaz.",
  });
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

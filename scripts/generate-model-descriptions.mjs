/**
 * OpenAPI → model-descriptions.json
 *
 * openapi.json'dan her operationId için response ve body model
 * property description'larını çıkarır. tool-catalog.json'daki tool
 * adı formatına (Account_OturumBilgisiGetirPost) dönüştürür.
 *
 * Kullanım:  node scripts/generate-model-descriptions.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const openapiPath = join(__dirname, "../src/apiSchema/openapi.json");
const outputPath = join(__dirname, "../src/model-descriptions.json");

const spec = JSON.parse(readFileSync(openapiPath, "utf-8"));
const schemas = spec.components?.schemas ?? {};

// ─── $ref → schema çözümleyici ──────────────────────────────────────────────
function resolveRef(ref) {
  // "#/components/schemas/Aaro.KayitSonuc_AaroMVC.Controllers..." → schema adı
  const name = ref.replace("#/components/schemas/", "");
  return schemas[name];
}

// ─── Bir schema objesinden { alan: açıklama } map'i çıkar ───────────────────
function extractFieldDescriptions(schema, depth = 0) {
  if (!schema || depth > 3) return null;

  // $ref ise çöz
  if (schema.$ref) {
    return extractFieldDescriptions(resolveRef(schema.$ref), depth);
  }

  // allOf / oneOf / anyOf
  if (schema.allOf) {
    let merged = {};
    for (const sub of schema.allOf) {
      const d = extractFieldDescriptions(sub, depth);
      if (d) Object.assign(merged, d);
    }
    return Object.keys(merged).length ? merged : null;
  }

  // array → element'ine bak
  if (schema.type === "array" && schema.items) {
    return extractFieldDescriptions(schema.items, depth + 1);
  }

  // object → property description'larını topla
  if (schema.properties) {
    const result = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      // doğrudan description varsa al
      if (prop.description) {
        result[key] = prop.description;
      }
      // $ref ise çözüp description'ı al
      else if (prop.$ref) {
        const resolved = resolveRef(prop.$ref);
        if (resolved?.description) {
          result[key] = resolved.description;
        }
      }
    }
    return Object.keys(result).length ? result : null;
  }

  return null;
}

// ─── Response schema'dan "Model" içindeki açıklamaları çıkar ────────────────
function extractResponseModelDescriptions(responseSchema) {
  if (!responseSchema) return null;

  const resolved = responseSchema.$ref
    ? resolveRef(responseSchema.$ref)
    : responseSchema;
  if (!resolved?.properties) return null;

  // Response genellikle { Model: {...}, Mesajlar, Sonuc, Detay } yapısında.
  // Biz sadece "Model" alanının alt property'lerini istiyoruz.
  const modelProp = resolved.properties.Model;
  if (!modelProp) return null;

  return extractFieldDescriptions(modelProp, 0);
}

// ─── Body schema'dan açıklamaları çıkar ─────────────────────────────────────
function extractBodyDescriptions(bodySchema) {
  if (!bodySchema) return null;
  return extractFieldDescriptions(bodySchema, 0);
}

// ─── HTTP metod → tool adı suffix ───────────────────────────────────────────
const methodSuffix = {
  get: "Get",
  post: "Post",
  put: "Put",
  delete: "Delete",
  patch: "Patch",
};

// ─── Ana döngü: tüm path'leri gez ──────────────────────────────────────────
const catalog = {};
let totalTools = 0;
let withModelDesc = 0;

for (const [pathStr, pathObj] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(pathObj)) {
    if (!operation.operationId) continue;

    const opId = operation.operationId; // e.g. "Cari_Get"
    const suffix = methodSuffix[method] || "";
    const toolName = opId + suffix; // e.g. "Cari_GetGet"
    totalTools++;

    const entry = {};

    // ─ Response model descriptions ─
    const res200 = operation.responses?.["200"];
    if (res200?.content) {
      const jsonSchema =
        res200.content["application/json"]?.schema ??
        res200.content["text/json"]?.schema;
      if (jsonSchema) {
        const descs = extractResponseModelDescriptions(jsonSchema);
        if (descs && Object.keys(descs).length > 0) {
          entry.responseModel = descs;
        }
      }
    }

    // ─ Body (request) model descriptions ─
    if (operation.requestBody?.content) {
      const jsonSchema =
        operation.requestBody.content["application/json"]?.schema ??
        operation.requestBody.content["text/json"]?.schema;
      if (jsonSchema) {
        const descs = extractBodyDescriptions(jsonSchema);
        if (descs && Object.keys(descs).length > 0) {
          entry.bodyModel = descs;
        }
      }
    }

    // Eski swagger 2.0 body parametresi formatı
    if (operation.parameters) {
      const bodyParam = operation.parameters.find((p) => p.in === "body");
      if (bodyParam?.schema) {
        const descs = extractBodyDescriptions(bodyParam.schema);
        if (descs && Object.keys(descs).length > 0) {
          entry.bodyModel = descs;
        }
      }

      // Query param descriptions
      const queryDescs = {};
      for (const p of operation.parameters) {
        if (p.in === "query" && p.description) {
          queryDescs[p.name] = p.description;
        }
      }
      if (Object.keys(queryDescs).length > 0) {
        entry.paramDescriptions = queryDescs;
      }
    }

    if (Object.keys(entry).length > 0) {
      catalog[toolName] = entry;
      withModelDesc++;
    }
  }
}

writeFileSync(outputPath, JSON.stringify(catalog, null, 2), "utf-8");

console.log(`✅ model-descriptions.json oluşturuldu`);
console.log(`   Toplam tool: ${totalTools}`);
console.log(`   Model açıklaması olan: ${withModelDesc}`);
console.log(`   Çıktı: ${outputPath}`);

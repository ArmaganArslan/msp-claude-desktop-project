import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createErpClient } from "../erp/client.js";
import {
  SwaggerDoc,
  SwaggerOperation,
  SwaggerParameter,
  SwaggerSchema,
  findOperation,
} from "./loader.js";
import type { EndpointConfig } from "./types.js";
import { logRequest, logResponse, logError } from "../logger.js";

function swaggerParamToZod(param: SwaggerParameter): z.ZodTypeAny {
  const type = param.type?.toLowerCase() ?? "string";
  const format = param.format?.toLowerCase() ?? "";
  const desc = param.description ?? param.name;

  let schema: z.ZodTypeAny;

  if (type === "integer" || type === "number") {
    let numSchema = z.number();

    if (type === "integer" || format === "int32" || format === "int64") {
      numSchema = numSchema.int();
    }

    if (param.minimum !== undefined) {
      numSchema = numSchema.min(param.minimum);
    }

    if (param.maximum !== undefined) {
      numSchema = numSchema.max(param.maximum);
    }

    schema = numSchema;
  } else if (type === "boolean") {
    schema = z.boolean();
  } else {
    if (param.enum && param.enum.length > 0) {
      const strEnums = param.enum.map(String) as [string, ...string[]];
      schema = z.enum(strEnums);
    } else {
      schema = z.string();
    }
  }

  schema = schema.describe(
    `${desc}${param.required ? " (zorunlu)" : " (opsiyonel)"}`,
  );

  if (!param.required) {
    schema = schema.optional();
  }

  return schema;
}

function getBodyParameter(
  operation: SwaggerOperation,
): SwaggerParameter | undefined {
  return (operation.parameters ?? []).find((p) => p.in === "body");
}

function resolveRef(doc: SwaggerDoc, ref: string): SwaggerSchema | null {
  if (!ref.startsWith("#/definitions/")) return null;

  const key = ref.replace("#/definitions/", "");
  const definition = doc.definitions?.[key];

  return definition ?? null;
}

function schemaToZod(
  doc: SwaggerDoc,
  schema?: SwaggerSchema,
  fallbackName = "body",
): z.ZodTypeAny {
  if (!schema) {
    return z
      .string()
      .describe(`${fallbackName} (fallback string body)`)
      .optional();
  }

  if (schema.$ref) {
    const resolved = resolveRef(doc, schema.$ref);
    if (!resolved) {
      return z
        .string()
        .describe(`${fallbackName} ($ref çözülemedi, fallback string body)`);
    }
    return schemaToZod(doc, resolved, fallbackName);
  }

  const type = schema.type?.toLowerCase();

  if (!type && schema.properties) {
    const shape: Record<string, z.ZodTypeAny> = {};
    const requiredSet = new Set(schema.required ?? []);

    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      let propZod = schemaToZod(doc, propSchema, propName);

      if (!requiredSet.has(propName)) {
        propZod = propZod.optional();
      }

      shape[propName] = propZod.describe(
        `${propSchema.description ?? propName}${requiredSet.has(propName) ? " (zorunlu)" : " (opsiyonel)"}`,
      );
    }

    return z.object(shape);
  }

  if (type === "object") {
    const shape: Record<string, z.ZodTypeAny> = {};
    const requiredSet = new Set(schema.required ?? []);

    for (const [propName, propSchema] of Object.entries(
      schema.properties ?? {},
    )) {
      let propZod = schemaToZod(doc, propSchema, propName);

      if (!requiredSet.has(propName)) {
        propZod = propZod.optional();
      }

      shape[propName] = propZod.describe(
        `${propSchema.description ?? propName}${requiredSet.has(propName) ? " (zorunlu)" : " (opsiyonel)"}`,
      );
    }

    return z.object(shape);
  }

  if (type === "array") {
    const itemSchema = schema.items
      ? schemaToZod(doc, schema.items, `${fallbackName}_item`)
      : z.any();

    return z.array(itemSchema);
  }

  if (type === "integer" || type === "number") {
    let numSchema = z.number();

    if (type === "integer") {
      numSchema = numSchema.int();
    }

    return numSchema;
  }

  if (type === "boolean") {
    return z.boolean();
  }

  if (schema.enum && schema.enum.length > 0) {
    const strEnums = schema.enum.map(String) as [string, ...string[]];
    return z.enum(strEnums);
  }

  return z.string();
}

function buildZodShape(
  doc: SwaggerDoc,
  operation: SwaggerOperation,
  method: string,
): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {
    token: z
      .string()
      .optional()
      .describe(
        "Bearer token. Girilmezse .env'deki ERP_BEARER_TOKEN kullanılır.",
      ),
  };

  const params = operation.parameters ?? [];

  for (const param of params) {
    if (param.in !== "query" && param.in !== "path") continue;

    const safeKey = param.name;
    try {
      shape[safeKey] = swaggerParamToZod(param);
    } catch {
      shape[safeKey] = z
        .string()
        .optional()
        .describe(param.description ?? safeKey);
    }
  }

  if (method === "put" || method === "post") {
    const bodyParam = getBodyParameter(operation);

    if (bodyParam?.schema) {
      try {
        let bodyZod = schemaToZod(doc, bodyParam.schema, bodyParam.name);

        if (!bodyParam.required) {
          bodyZod = bodyZod.optional();
        }

        shape[bodyParam.name] = bodyZod.describe(
          `${bodyParam.description ?? bodyParam.name}${bodyParam.required ? " (zorunlu)" : " (opsiyonel)"}`,
        );
      } catch {
        shape[bodyParam.name] = z
          .string()
          .describe(
            `${bodyParam.name} için fallback JSON string body. Örnek: '{"Adi":"Yeni Ad"}'`,
          );
      }
    }
  }

  return shape;
}

function buildPathParams(path: string, input: Record<string, unknown>): string {
  return path.replace(/{(.*?)}/g, (_, key) => {
    const value = input[key];

    if (value === undefined || value === null || value === "") {
      throw new Error(`Zorunlu path parametresi eksik: ${key}`);
    }

    return encodeURIComponent(String(value));
  });
}

function buildRequestParams(
  input: Record<string, unknown>,
  path: string,
  bodyParamName?: string,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};

  const pathParamNames = Array.from(path.matchAll(/{(.*?)}/g)).map(
    (match) => match[1],
  );

  for (const [key, value] of Object.entries(input)) {
    if (key === "token") continue;
    if (bodyParamName && key === bodyParamName) continue;
    if (pathParamNames.includes(key)) continue;
    if (value === undefined || value === null || value === "") continue;

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      params[key] = value;
    }
  }

  return params;
}

export function registerSwaggerTools(
  server: McpServer,
  doc: SwaggerDoc,
  configs: EndpointConfig[],
): void {
  let basariSayisi = 0;
  let hataSayisi = 0;

  for (const config of configs) {
    const operation = findOperation(doc, config.path, config.method);

    if (!operation) {
      process.stderr.write(
        `⚠️  Bulunamadı: ${config.method.toUpperCase()} ${config.path} (swagger'da yok, atlanıyor)\n`,
      );
      hataSayisi++;
      continue;
    }

    const toolDescription =
      config.description ||
      operation.summary ||
      operation.description ||
      `${config.path} endpoint'ini sorgular.`;

    const zodShape = buildZodShape(doc, operation, config.method);
    const endpointPath = config.path;
    const bodyParam = getBodyParameter(operation);
    const bodyParamName = bodyParam?.name;

    server.tool(config.toolName, toolDescription, zodShape, async (input) => {
      const startTime = Date.now();

      try {
        const token = typeof input.token === "string" ? input.token : undefined;
        const client = createErpClient(token);

        const resolvedPath = buildPathParams(
          endpointPath,
          input as Record<string, unknown>,
        );

        const params = buildRequestParams(
          input as Record<string, unknown>,
          endpointPath,
          bodyParamName,
        );

        const rawBody =
          bodyParamName !== undefined
            ? (input as Record<string, unknown>)[bodyParamName]
            : undefined;

        logRequest(
          config.toolName,
          config.method.toUpperCase(),
          resolvedPath,
          Object.keys(params).length > 0 ? params : undefined,
          rawBody,
        );

        let response;

        if (config.method === "put" || config.method === "post") {
          if (bodyParamName) {
            if (rawBody === undefined) {
              throw new Error(
                `${config.method.toUpperCase()} isteği için '${bodyParamName}' parametresi zorunludur.`,
              );
            }

            let parsedBody: unknown = rawBody;

            if (typeof rawBody === "string") {
              try {
                parsedBody = JSON.parse(rawBody);
              } catch {
                parsedBody = rawBody;
              }
            }

            if (config.method === "post") {
              response = await client.post(resolvedPath, parsedBody, {
                params,
              });
            } else {
              response = await client.put(resolvedPath, parsedBody, { params });
            }
          } else {
            if (config.method === "post") {
              response = await client.post(resolvedPath, null, { params });
            } else {
              response = await client.put(resolvedPath, null, { params });
            }
          }
        } else if (config.method === "delete") {
          response = await client.delete(resolvedPath, { params });
        } else {
          response = await client.get(resolvedPath, { params });
        }

        const data = response.data;

        const kayitSayisi = Array.isArray(data?.sonuc)
          ? data.sonuc.length
          : Array.isArray(data)
            ? data.length
            : "?";

        logResponse(
          resolvedPath,
          response.status ?? 200,
          kayitSayisi,
          Date.now() - startTime,
        );

        return {
          content: [
            {
              type: "text" as const,
              text:
                `✅ ${resolvedPath} başarıyla sorgulandı.\n` +
                `📊 Dönen kayıt sayısı: ${kayitSayisi}\n\n` +
                JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        const mesaj =
          error?.response?.data?.message ||
          error?.response?.data ||
          error?.message ||
          "Bilinmeyen hata";

        const statusKod = error?.response?.status ?? "N/A";

        logError(
          endpointPath,
          statusKod,
          typeof mesaj === "string" ? mesaj : JSON.stringify(mesaj),
          Date.now() - startTime,
        );

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                `❌ ${endpointPath} sorgulanamadı.\n` +
                `HTTP Durum: ${statusKod}\n` +
                `Hata: ${JSON.stringify(mesaj, null, 2)}`,
            },
          ],
        };
      }
    });

    process.stderr.write(
      `✅ Tool kaydedildi: ${config.toolName} ← ${config.method.toUpperCase()} ${endpointPath}\n`,
    );

    basariSayisi++;
  }

  process.stderr.write(
    `\n📋 Tool kayıt özeti: ${basariSayisi} başarılı, ${hataSayisi} başarısız.\n`,
  );
}

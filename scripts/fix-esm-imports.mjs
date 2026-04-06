import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const API_DIR = resolve('src/api');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith('.ts')) files.push(full);
  }
  return files;
}

// 1) Relative import'lara .js uzantısı ekle
function fixExtensions(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  content = content.replace(
    /from\s+['"](\.\.?\/[^'"]+)['"]/g,
    (match, importPath) => {
      if (importPath.endsWith('.js') || importPath.endsWith('.json')) return match;
      const absPath = resolve(dirname(filePath), importPath);
      try {
        if (statSync(absPath).isDirectory()) {
          return match.replace(importPath, `${importPath}/index.js`);
        }
      } catch {}
      return match.replace(importPath, `${importPath}.js`);
    }
  );
  writeFileSync(filePath, content);
}

// 2) http-client.ts'e eksik NonReadonly tipini inject et
function fixNonReadonly(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  if (content.includes('NonReadonly') && !content.includes('type NonReadonly')) {
    const typedef = `
type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B;
type WritableKeys<T> = { [P in keyof T]-?: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P> }[keyof T];
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
type Writable<T> = Pick<T, WritableKeys<T>>;
type NonReadonly<T> = [T] extends [UnionToIntersection<T>]
  ? { [P in keyof Writable<T>]: T[P] extends object ? NonReadonly<NonNullable<T[P]>> : T[P] }
  : DistributeReadOnlyOverUnions<T>;
type DistributeReadOnlyOverUnions<T> = T extends any ? NonReadonly<T> : never;
`;
    content = content.replace(
      /^(\/\*\*[\s\S]*?\*\/\n)/,
      `$1\n${typedef}\n`
    );
    writeFileSync(filePath, content);
  }
}

// 3) Zod schema ile handler tipleri arasındaki casing uyumsuzluğunu düzelt
//    OpenAPI spec'ten gelen PascalCase path param isimleri → camelCase
function fixZodParamCasing(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  const original = content;

  content = content.replace(/\bBelgeID\b/g, 'belgeID');
  content = content.replace(/\bNotID\b/g, 'notID');

  if (content !== original) {
    writeFileSync(filePath, content);
    console.log(`  Fixed param casing in ${filePath}`);
  }
}

// 4) tool-schemas.zod.ts'den schema field isimlerini cikar
function buildSchemaFieldMap() {
  const zodPath = resolve(API_DIR, 'tool-schemas.zod.ts');
  const content = readFileSync(zodPath, 'utf-8');
  const fieldMap = {};

  const schemaRegex = /export const (\w+)\s*=\s*zod\.object\(\{/g;
  let match;

  while ((match = schemaRegex.exec(content)) !== null) {
    const schemaName = match[1];
    const startBrace = match.index + match[0].length - 1;
    let depth = 1;
    let i = startBrace + 1;
    const fields = [];
    let inString = null;

    while (i < content.length && depth > 0) {
      const ch = content[i];

      if (ch === '\\' && inString) {
        i += 2;
        continue;
      }

      if (inString) {
        if (ch === inString) inString = null;
        i++;
        continue;
      }

      if (ch === "'") {
        inString = "'";
        i++;
        continue;
      }

      if (ch === '"') {
        if (depth === 1) {
          const end = content.indexOf('"', i + 1);
          if (end > -1) {
            const fieldName = content.slice(i + 1, end);
            const afterQuote = content.slice(end + 1, end + 5).trimStart();
            if (afterQuote.startsWith(':')) {
              fields.push(fieldName);
            }
            i = end + 1;
            continue;
          }
        }
        inString = '"';
        i++;
        continue;
      }

      if (ch === '{') depth++;
      else if (ch === '}') depth--;

      i++;
    }

    if (fields.length > 0) {
      fieldMap[schemaName] = fields;
    }
  }

  return fieldMap;
}

// 5) server.ts'den tool catalog'u cikar -> src/tool-catalog.json
function extractToolCatalog() {
  const fieldMap = buildSchemaFieldMap();
  console.log(`  Schema fields extracted: ${Object.keys(fieldMap).length} schemas`);

  const serverTsPath = resolve(API_DIR, 'server.ts');
  const content = readFileSync(serverTsPath, 'utf-8');

  const blocks = content.split(/server\.tool\(\s*\n/);
  blocks.shift();

  const catalog = [];

  for (const block of blocks) {
    const closing = block.match(/^([\s\S]*?)\n\);/);
    if (!closing) continue;

    const body = closing[1];

    const nameMatch = body.match(/^\s*'([^']+)'/);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    const afterName = body.slice(nameMatch.index + nameMatch[0].length);
    const descMatch = afterName.match(/,\s*\n\s*'((?:[^'\\]|\\.)*)'/);
    let description = '';
    if (descMatch) {
      description = descMatch[1]
        .replace(/\\'/g, "'")
        .replace(/\\\//g, '/')
        .replace(/\\"/g, '"')
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n');
    }

    const handlerMatch = body.match(/(\w+Handler)\s*$/m);
    const handlerName = handlerMatch ? handlerMatch[1] : name + 'Handler';

    const schemaKeys = {};
    const pp = body.match(/pathParams:\s*(\w+)/);
    if (pp) schemaKeys.pathParams = pp[1];
    const qp = body.match(/queryParams:\s*(\w+)/);
    if (qp) schemaKeys.queryParams = qp[1];
    const bp = body.match(/bodyParams:\s*(\w+)/);
    if (bp) schemaKeys.bodyParams = bp[1];

    // Resolve field names from the schema field map
    const params = {};
    for (const [category, schemaName] of Object.entries(schemaKeys)) {
      params[category] = fieldMap[schemaName] || [];
    }

    catalog.push({
      name,
      description,
      handlerName,
      ...(Object.keys(params).length > 0 ? { params } : {}),
    });
  }

  writeFileSync(
    resolve('src/tool-catalog.json'),
    JSON.stringify(catalog, null, 2)
  );

  console.log(`Tool catalog: ${catalog.length} tools -> src/tool-catalog.json`);
}

// --- Run ---

// Fix extensions in all generated .ts files
for (const f of walk(API_DIR)) {
  fixExtensions(f);
}

// Inject NonReadonly type into http-client.ts
fixNonReadonly(resolve(API_DIR, 'http-client.ts'));

// Fix casing mismatch in Zod schemas
fixZodParamCasing(resolve(API_DIR, 'tool-schemas.zod.ts'));

// Extract tool catalog from server.ts
extractToolCatalog();

console.log('ESM imports, param casing, and tool catalog fixed.');
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

// --- Run ---

// Fix extensions in all generated .ts files
for (const f of walk(API_DIR)) {
  fixExtensions(f);
}

// Inject NonReadonly type into http-client.ts
fixNonReadonly(resolve(API_DIR, 'http-client.ts'));

// Fix casing mismatch in Zod schemas
fixZodParamCasing(resolve(API_DIR, 'tool-schemas.zod.ts'));

console.log('ESM imports and param casing fixed.');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openapiPath = path.resolve(__dirname, '../src/apiSchema/openapi.json');
const outputPath = path.resolve(__dirname, '../src/apiSchema/openapi-with-tags.json');

function injectTagDescriptions() {
    try {
        const fileContent = fs.readFileSync(openapiPath, 'utf8');
        const openapi = JSON.parse(fileContent);

        if (!openapi.tags || openapi.tags.length === 0) {
            console.log('  openapi.json dosyasında tag tanımları bulunamadı.');
            // Kopyaliyoruz ki orval sorunsuz calissin
            fs.writeFileSync(outputPath, fileContent, 'utf8');
            return;
        }

        // Tag isimlerinden description'lara bir harita olustur
        const tagsMap = {};
        for (const tag of openapi.tags) {
            if (tag.name && tag.description) {
                tagsMap[tag.name] = tag.description;
            }
        }

        // Path'leri ve operasyonlari gez
        if (openapi.paths) {
            for (const [pathKey, pathItem] of Object.entries(openapi.paths)) {
                for (const [method, operation] of Object.entries(pathItem)) {
                    // Operasyonun tag'leri varsa ve ilk tag mevcutsa
                    if (operation.tags && operation.tags.length > 0) {
                        const tagName = operation.tags[0];
                        const tagDesc = tagsMap[tagName];

                        if (tagDesc) {
                            const injectionMarker = `[Kategori/Controller: ${tagName}]`;

                            // Eger daha once eklenmemisse
                            if (!operation.description || !operation.description.includes(injectionMarker)) {
                                const originalDesc = operation.summary || operation.description || '(endpoint aciklamasi yok)';
                                
                                // Tag aciklamasini, orjinal aciklamanin ustune ekle
                                const newDesc = `${injectionMarker}\n\n${tagDesc}\n\n[Endpoint İşlevi]:\n${originalDesc}`.trim();
                                operation.description = newDesc;
                                // Orval mcp client 'summary' alanina oncelik verebilir, burayi da guncelledigimizden emin olalim
                                operation.summary = newDesc;
                            }
                        }
                    }
                }
            }
        }

        fs.writeFileSync(outputPath, JSON.stringify(openapi, null, 2), 'utf8');
        console.log(`✅ Zenginleştirilmiş OpenAPI şeması oluşturuldu: src/apiSchema/openapi-with-tags.json`);

    } catch (error) {
        console.error('❌ Tag description injection sırasında hata:', error.message);
        process.exit(1);
    }
}

injectTagDescriptions();

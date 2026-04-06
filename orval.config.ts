import { defineConfig } from 'orval';

export default defineConfig({
  aaro: {
    input: {
      target: './src/api/schema/v1.json',
      validation: false, // Validation uyarılarını kapat
    },
    output: {
      mode: 'tags-split',
      target: './src/api/endpoints',
      schemas: './src/api/models',
      client: 'axios',
      mock: false,
      override: {
        mutator: {
          path: './src/api/axios.ts',
          name: 'customInstance',
        },
        useNamedParameters: true,
        useDates: true,
        // Duplicate schema isimlerini çözmek için
        operationName: (operation, route, verb) => {
          return `${operation.operationId || route.replace(/\//g, '_')}${verb.charAt(0).toUpperCase() + verb.slice(1)}`;
        },
      },
      allParamsOptional: true,
      urlEncodeParameters: true,
    },
    // hooks: {
    //   afterAllFilesWrite: 'prettier --write ',
    // },
  },
  // Zod konfigürasyonu
  aaroZod: {
    input: {
      target: './src/api/schema/v1.json',
      validation: false,
    },
    output: {
      mode: 'tags-split',
      client: 'zod',
      target: './src/api/endpoints',
      fileExtension: '.zod.ts', // Dosya ismi çakışmasını önler
      // schemas tanımlanmıyor çünkü zaten aaro config'de var
    },
    // hooks: {
    //   afterAllFilesWrite: 'prettier --write ',
    // },
  },
});
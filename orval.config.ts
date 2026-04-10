import { defineConfig } from 'orval';

export default defineConfig({
  aaroApi: {
    input: {
      target: './src/apiSchema/openapi-with-tags.json',
    },
    output: {
      mode: 'single',
      client: 'mcp',
      baseUrl: 'https://erp.aaro.com.tr',
      target: 'src/api/handlers.ts',
      schemas: 'src/api/http-schemas',
      override: {
        // Duplicate schema isimlerini çözmek için
        operationName: (operation, route, verb) => {
          return `${operation.operationId || route.replace(/\//g, '_')}${verb.charAt(0).toUpperCase() + verb.slice(1)}`;
        },
      },
      clean: true,
      tsconfig: './tsconfig.json',
    },
  },
});

// npx swagger2openapi src/apiSchema/v1.json -o src/apiSchema/openapi.json
// npm run generate
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: {
      target: './src/api/schema/openapi.json',
    },
    output: {
      mode: 'single',
      client: 'mcp',
      baseUrl: 'https://erp.aaro.com.tr',
      target: 'src/api/handlers.ts',
      schemas: 'src/api/http-schemas',
    },
  },
});
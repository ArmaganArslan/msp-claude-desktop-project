export interface EndpointConfig {
  // API endpoint'inin path bilgisini tutar.
  path: string;

  // HTTP method bilgisini tutar.
  method: "get" | "delete" | "put" | "post";

  // MCP server'da oluşturulacak tool'un adı.
  toolName: string;

  // Tool açıklaması (description).
  description?: string;
}

import axios, { AxiosInstance } from "axios";

const ERP_BASE_URL = process.env.ERP_BASE_URL || "https://erp.aaro.com.tr";

/**
 * Token ile ERP API istemcisi oluşturur.
 * Her tool çağrısında token parametre olarak geçilebilir
 * ya da .env'deki varsayılan token kullanılır.
 */
export function createErpClient(token?: string): AxiosInstance {
  const bearerToken = token || process.env.ERP_BEARER_TOKEN;

  if (!bearerToken) {
    throw new Error(
      "ERP_BEARER_TOKEN bulunamadı. " +
      "Lütfen .env dosyasında ERP_BEARER_TOKEN=tokeniniz şeklinde tanımlayın. " +
      `Mevcut değer: '${process.env.ERP_BEARER_TOKEN ?? "undefined"}'`
    );
  }

  return axios.create({
    baseURL: ERP_BASE_URL,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 30000,
  });
}

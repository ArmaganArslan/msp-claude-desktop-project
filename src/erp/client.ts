import { AxiosInstance } from "axios";
import axiosInstance from "../api/axios.js";

/**
 * ERP API istemcisini döndürür.
 * Not: Token artık src/api/axios.ts içindeki interceptor tarafından yönetiliyor.
 * Özel bir token geçilirse (custom tool'dan), o token header'a eklenebilir.
 */
export function createErpClient(token?: string): AxiosInstance {
  if (token) {
    // Eğer özel bir token geçilirse, varsayılan token yerine bunu kullanabilmesi için
    // geçici bir header override yapılabilir.
    // Ancak axiosInstance singleton olduğu için dikkatli olunmalı.
    // Buradaki çözüm, manuel token geçilirse sadece o istek için geçerli olacak şekilde tools içinde yönetmektir.
    // Veya basitçe:
    axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  return axiosInstance;
}

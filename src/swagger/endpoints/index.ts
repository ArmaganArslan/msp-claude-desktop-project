import { CARI_ENDPOINTS } from "./cari.js";
import { STOK_ENDPOINTS } from "./stok.js";
import { BANKAHESAP_ENDPOINTS } from "./bankahesap.js";

import type { EndpointConfig } from "../types.js";

export const WHITELISTED_ENDPOINTS: EndpointConfig[] = [
  ...CARI_ENDPOINTS,
  ...STOK_ENDPOINTS,
  ...BANKAHESAP_ENDPOINTS,
];

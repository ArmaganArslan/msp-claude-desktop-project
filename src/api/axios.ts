import type { AxiosError, AxiosResponse, AxiosRequestConfig } from 'axios';

import axios from 'axios';

// ----------------------------------------------------------------------

// Rate Limiter: sliding window, max 5 req / 1 sn
class RateLimiter {
  private timestamps: number[] = [];

  constructor(private maxRequests: number, private windowMs: number) { }

  async throttle(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 1;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.throttle();
    }

    this.timestamps.push(Date.now());
    return undefined;
  }
}

const rateLimiter = new RateLimiter(5, 1000);

// ----------------------------------------------------------------------

const axiosInstance = axios.create({
  baseURL: process.env.ERP_BASE_URL || 'https://erp.aaro.com.tr',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Optional: Add token (if using auth)
 *
 axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
*
*/

axiosInstance.interceptors.request.use(async (config) => {
  const token = process.env.ERP_BEARER_TOKEN;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  await rateLimiter.throttle();
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message || error?.message || 'Something went wrong!';
    // Use process.stderr to avoid breaking MCP protocol
    process.stderr.write(`Axios error: ${message}\n`);
    return Promise.reject(new Error(message));
  }
);

export default axiosInstance;

// ----------------------------------------------------------------------

// Orval mutator - Orval bu fonksiyonu kullanacak
export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const source = axios.CancelToken.source();
  const promise = axiosInstance({
    ...config,
    cancelToken: source.token,
  }).then(({ data }: AxiosResponse<T>) => data);

  // @ts-expect-error - cancel property for react-query
  promise.cancel = () => {
    source.cancel('Query was cancelled');
  };

  return promise;
};

// ----------------------------------------------------------------------

export const fetcher = async <T = unknown>(
  args: string | [string, AxiosRequestConfig]
): Promise<T> => {
  try {
    const [url, config] = Array.isArray(args) ? args : [args, {}];

    const res = await axiosInstance.get<T>(url, config);

    return res.data;
  } catch (error) {
    console.error('Fetcher failed:', error);
    throw error;
  }
};

// Error type for Orval
export type ErrorType<Error> = AxiosError<Error>;
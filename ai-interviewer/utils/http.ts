export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions<TBody = any> {
  method?: HttpMethod;
  path: string; // path after base URL, e.g. /webhook/generate-interview-link
  body?: TBody;
  headers?: Record<string, string>;
}

import { Platform } from 'react-native';
import { API_BASE_URL, CORS_PROXY_URL } from './env';

const isWeb = Platform.OS === 'web';

const buildUrl = (path: string): string => {
  const base = API_BASE_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${p}`;
  if (isWeb && CORS_PROXY_URL) {
    const proxy = CORS_PROXY_URL.replace(/\/$/, '');
    return `${proxy}/${encodeURIComponent(url)}`;
  }
  return url;
};

export async function httpRequest<TResponse = any, TBody = any>(options: RequestOptions<TBody>): Promise<TResponse> {
  const { method = 'POST', path, body, headers } = options;
  const url = buildUrl(path);
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as TResponse;
  }
  return (await response.text()) as unknown as TResponse;
}



import { API_BASE_URL } from './env';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions<TBody = any> {
  method?: HttpMethod;
  path: string;
  body?: TBody;
  headers?: Record<string, string>;
}

export async function httpRequest<TResponse = any, TBody = any>(options: RequestOptions<TBody>): Promise<TResponse> {
  const { method = 'POST', path, body, headers } = options;
  const base = API_BASE_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${p}`;

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

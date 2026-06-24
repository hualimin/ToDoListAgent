export interface ApiClientOptions {
  baseURL: string
  token: string
}

export interface ApiClient {
  get<T = unknown>(path: string): Promise<T>
  post<T = unknown>(path: string, body: unknown): Promise<T>
  put<T = unknown>(path: string, body: unknown): Promise<T>
  del<T = unknown>(path: string): Promise<T>
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  async function request<T>(path: string, init: RequestInit): Promise<T> {
    const resp = await fetch(opts.baseURL.replace(/\/$/, '') + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.token}`,
        ...(init.headers ?? {}),
      },
    })
    if (!resp.ok) throw new Error(`API ${resp.status}: ${path}`)
    if (resp.status === 204) return undefined as T
    return (await resp.json()) as T
  }
  return {
    get: (p) => request(p, { method: 'GET' }),
    post: (p, body) => request(p, { method: 'POST', body: JSON.stringify(body) }),
    put: (p, body) => request(p, { method: 'PUT', body: JSON.stringify(body) }),
    del: (p) => request(p, { method: 'DELETE' }),
  }
}

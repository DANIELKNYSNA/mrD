type Primitive = string | number | boolean | null | undefined

type Params = { [key: string]: Primitive }

type Serializer = 'formData' | 'json' | 'raw'

interface RequestOptions {
  /** Abort in-flight requests, e.g. when a newer search supersedes an older one. */
  signal?: AbortSignal
}

interface PostOptions extends RequestOptions {
  parameters?: Params
  serializer: Serializer
}

interface PutOptions extends RequestOptions {
  parameters?: Params
  serializer: Serializer
  data: { [key: string]: Primitive | Primitive[] }
}

export interface IApiClient {
  get<T>(url: string, parameters?: Params, options?: RequestOptions): Promise<T>
  post<T>(url: string, data: { [key: string]: Primitive }, options?: PostOptions): Promise<T>
  put<T>(url: string, options: PutOptions): Promise<T>
  delete<T>(url: string, parameters?: Params, options?: RequestOptions): Promise<T>
}

/** Thrown for any non-2xx response. Mirrors the server's `{ error: { code, message } }` envelope. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Empty string = same origin, which goes through the Vite dev proxy.
const getApiBaseUrl = (): string => import.meta.env.VITE_API_BASE_URL ?? ''

export default class ApiClient implements IApiClient {
  protected serviceName: string = ''

  async get<T>(url: string, parameters?: Params, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', url, { parameters, signal: options?.signal })
  }

  async post<T>(url: string, data: { [key: string]: Primitive }, options?: PostOptions): Promise<T> {
    const serializer = options?.serializer ?? 'json'
    return this.request<T>('POST', url, {
      parameters: options?.parameters,
      signal: options?.signal,
      ...this.serialize(data, serializer),
    })
  }

  async put<T>(url: string, options: PutOptions): Promise<T> {
    const { parameters, serializer, data, signal } = options
    return this.request<T>('PUT', url, { parameters, signal, ...this.serialize(data, serializer) })
  }

  async delete<T>(url: string, parameters?: Params, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', url, { parameters, signal: options?.signal })
  }

  private serialize(data: object, serializer: Serializer): { body: BodyInit; headers: HeadersInit } {
    if (serializer === 'formData') {
      const form = new FormData()
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== null) form.append(key, String(value))
      }
      // No Content-Type: the browser sets multipart/form-data with the correct boundary.
      return { body: form, headers: {} }
    }
    if (serializer === 'raw') {
      return { body: data as BodyInit, headers: { 'Content-Type': 'application/octet-stream' } }
    }
    return { body: JSON.stringify(data), headers: { 'Content-Type': 'application/json;charset=utf-8' } }
  }

  private async request<T>(
    method: string,
    url: string,
    init: { parameters?: Params; signal?: AbortSignal; body?: BodyInit; headers?: HeadersInit },
  ): Promise<T> {
    const response = await fetch(this.createUrl(url, init.parameters), {
      method,
      body: init.body,
      signal: init.signal,
      headers: { Accept: 'application/json', ...init.headers },
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const error = payload?.error
      throw new ApiError(
        response.status,
        error?.code ?? 'HTTP_ERROR',
        error?.message ?? `Request failed with status ${response.status}`,
        error?.details,
      )
    }

    return payload as T
  }

  private createUrl(url: string, parameters?: Params): string {
    const path = `${getApiBaseUrl()}${this.serviceName}${url}`
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(parameters ?? {})) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
    }
    const qs = query.toString()
    return qs ? `${path}?${qs}` : path
  }
}

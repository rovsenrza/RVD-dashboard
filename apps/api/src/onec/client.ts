/**
 * Read-only OData v3 client for the 1С publication (Basic auth).
 * Transient failures (network, timeout, 429, 5xx) are retried with backoff;
 * a 4xx is the caller's mistake and is thrown at once. The password never
 * reaches a log line: requests are logged by path and query only.
 */

export interface RequestLog {
  path: string
  status: number | 'error'
  ms: number
  attempt: number
}

export interface ODataClientOptions {
  baseUrl: string
  user: string
  password: string
  timeoutMs?: number
  /** Extra attempts after the first one */
  retries?: number
  fetch?: typeof fetch
  log?: (entry: RequestLog) => void
  sleep?: (ms: number) => Promise<void>
}

export interface ListOptions {
  select?: string[]
  filter?: string
  orderby?: string
  top?: number
  skip?: number
}

export interface Page<T> {
  rows: T[]
  /** Total matching rows when the server was asked to count */
  count: number | null
}

export class ODataError extends Error {
  readonly path: string
  readonly status: number | null

  constructor(message: string, path: string, status: number | null) {
    super(message)
    this.name = 'ODataError'
    this.path = path
    this.status = status
  }
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `guid'…'` literal for `$filter`; refuses anything that is not a GUID. */
export function guid(id: string): string {
  if (!GUID.test(id)) throw new Error(`Not a GUID: ${id}`)
  return `guid'${id}'`
}

/** `'…'` string literal for `$filter`, quotes doubled. */
export function str(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

const RETRIABLE = new Set([408, 425, 429, 500, 502, 503, 504])

export class ODataClient {
  private readonly opts: ODataClientOptions
  private readonly auth: string
  private readonly doFetch: typeof fetch
  private readonly timeoutMs: number
  private readonly retries: number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(opts: ODataClientOptions) {
    this.opts = opts
    this.auth = `Basic ${Buffer.from(`${opts.user}:${opts.password}`).toString('base64')}`
    this.doFetch = opts.fetch ?? fetch
    this.timeoutMs = opts.timeoutMs ?? 30_000
    this.retries = opts.retries ?? 3
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  /** One page of an entity set, with the total when `count` is true. */
  async page<T>(entity: string, options: ListOptions & { count?: boolean } = {}): Promise<Page<T>> {
    const query = [
      '$format=json',
      options.select && `$select=${options.select.map(encodeURIComponent).join(',')}`,
      options.filter && `$filter=${encodeURIComponent(options.filter)}`,
      options.orderby && `$orderby=${encodeURIComponent(options.orderby)}`,
      options.top !== undefined && `$top=${options.top}`,
      options.skip !== undefined && `$skip=${options.skip}`,
      options.count && '$inlinecount=allpages',
    ].filter(Boolean)
    const body = await this.getJson<{ value?: T[]; 'odata.count'?: string }>(
      `${encodeURIComponent(entity)}?${query.join('&')}`,
    )
    const count = body['odata.count'] === undefined ? null : Number(body['odata.count'])
    return { rows: body.value ?? [], count }
  }

  /** Every row of an entity set, page by page, so a big set never sits in one response. */
  async *pages<T>(
    entity: string,
    options: ListOptions & { pageSize?: number } = {},
  ): AsyncGenerator<T[]> {
    const pageSize = options.pageSize ?? 1000
    for (let skip = options.skip ?? 0; ; skip += pageSize) {
      const { rows } = await this.page<T>(entity, { ...options, top: pageSize, skip })
      if (rows.length > 0) yield rows
      if (rows.length < pageSize) return
    }
  }

  async all<T>(entity: string, options: ListOptions & { pageSize?: number } = {}): Promise<T[]> {
    const out: T[] = []
    for await (const rows of this.pages<T>(entity, options)) out.push(...rows)
    return out
  }

  private async getJson<T>(path: string): Promise<T> {
    const url = `${this.opts.baseUrl.replace(/\/+$/, '')}/${path}`
    let lastError: unknown
    for (let attempt = 1; attempt <= this.retries + 1; attempt++) {
      const started = Date.now()
      try {
        const res = await this.doFetch(url, {
          headers: { Authorization: this.auth, Accept: 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
        })
        this.opts.log?.({ path, status: res.status, ms: Date.now() - started, attempt })
        if (res.ok) {
          // 1С may prefix the body with a byte-order mark.
          const text = (await res.text()).replace(/^﻿/, '')
          return JSON.parse(text) as T
        }
        const error = new ODataError(`1С answered ${res.status}`, path, res.status)
        if (!RETRIABLE.has(res.status)) throw error
        lastError = error
      } catch (error) {
        if (error instanceof ODataError && !RETRIABLE.has(error.status ?? 0)) throw error
        if (!(error instanceof ODataError)) {
          this.opts.log?.({ path, status: 'error', ms: Date.now() - started, attempt })
          lastError = error
        }
      }
      if (attempt <= this.retries) await this.sleep(200 * 2 ** (attempt - 1))
    }
    throw lastError instanceof ODataError
      ? lastError
      : new ODataError(`1С did not answer: ${String(lastError)}`, path, null)
  }
}

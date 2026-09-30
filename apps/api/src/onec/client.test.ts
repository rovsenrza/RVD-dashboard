// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ODataClient, ODataError, guid, str } from './client.ts'

const json = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

function client(
  fetch: typeof globalThis.fetch,
  extra: Partial<ConstructorParameters<typeof ODataClient>[0]> = {},
) {
  return new ODataClient({
    baseUrl: 'https://1c.example/odata/',
    user: 'odata.user',
    password: 'secret',
    fetch,
    sleep: async () => {},
    ...extra,
  })
}

describe('ODataClient', () => {
  it('sends Basic auth and builds the query with encoded Cyrillic', async () => {
    const fetch = vi.fn(async () => json({ value: [{ a: 1 }], 'odata.count': '4076' }))
    const page = await client(fetch).page('Catalog_Изделия', {
      select: ['Code', 'Клиент_Key'],
      filter: `Клиент_Key eq ${guid('9c77a686-8198-11f1-9412-edc920ad26ed')}`,
      top: 50,
      count: true,
    })
    expect(page).toEqual({ rows: [{ a: 1 }], count: 4076 })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url.startsWith('https://1c.example/odata/Catalog_%D0%98')).toBe(true)
    expect(url).toContain('$select=Code,%D0%9A%D0%BB%D0%B8%D0%B5%D0%BD%D1%82_Key')
    expect(url).toContain('$top=50')
    expect(url).toContain('$inlinecount=allpages')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('odata.user:secret').toString('base64')}`,
    )
  })

  it('strips a byte-order mark before parsing', async () => {
    const fetch = vi.fn(async () => json('﻿{"value":[{"a":1}]}'))
    expect((await client(fetch).page('X')).rows).toEqual([{ a: 1 }])
  })

  it('walks every page and stops on the short one', async () => {
    const fetch = vi.fn(async (url: string | URL | Request) => {
      const skip = Number(/\$skip=(\d+)/.exec(String(url))?.[1])
      return json({ value: skip === 0 ? [1, 2] : skip === 2 ? [3, 4] : [5] })
    })
    const rows = await client(fetch).all<number>('X', { pageSize: 2 })
    expect(rows).toEqual([1, 2, 3, 4, 5])
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('retries a 503 and a network error, then succeeds', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(json({ value: [7] }))
    const log = vi.fn()
    expect((await client(fetch, { log }).page('X')).rows).toEqual([7])
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(log.mock.calls.map(([e]) => e.status)).toEqual([503, 'error', 200])
  })

  it('does not retry a 4xx', async () => {
    const fetch = vi.fn(async () => json({}, 401))
    await expect(client(fetch).page('X')).rejects.toMatchObject({ name: 'ODataError', status: 401 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('gives up after the retries and says so', async () => {
    const fetch = vi.fn(async () => json({}, 500))
    await expect(client(fetch, { retries: 2 }).page('X')).rejects.toBeInstanceOf(ODataError)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('never puts the password in a log line', async () => {
    const log = vi.fn()
    await client(async () => json({ value: [] }), { log }).page('X')
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret')
  })
})

describe('filter literals', () => {
  it('accepts a GUID and refuses anything else', () => {
    expect(guid('9C77A686-8198-11F1-9412-EDC920AD26ED')).toBe(
      "guid'9C77A686-8198-11F1-9412-EDC920AD26ED'",
    )
    expect(() => guid("x' or 1 eq 1")).toThrow()
  })

  it('doubles quotes in strings', () => {
    expect(str("O'Brien")).toBe("'O''Brien'")
  })
})

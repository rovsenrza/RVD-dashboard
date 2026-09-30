// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'

describe('health', () => {
  it('answers ok', async () => {
    const app = buildApp({ logLevel: 'silent' })
    const res = await app.inject('/health')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok' })
  })
})

describe('loadConfig', () => {
  const env = { ODATA_URL: 'https://1c.example/odata', ODATA_USER: 'u', ODATA_PASSWORD: 'p' }

  it('fills the defaults', () => {
    expect(loadConfig(env)).toMatchObject({
      PORT: 3001,
      LOG_LEVEL: 'info',
      ODATA_TIMEOUT_MS: 30000,
    })
  })

  it('names every missing value', () => {
    expect(() => loadConfig({})).toThrow(/ODATA_URL.*ODATA_USER.*ODATA_PASSWORD/)
  })
})

import { createHmac, timingSafeEqual } from 'node:crypto'

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
const sign = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest()

/** A compact HS256 JWT; `payload` should carry `exp` (seconds). */
export function signJwt(payload: object, secret: string): string {
  const head = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`
  return `${head}.${sign(head, secret).toString('base64url')}`
}

/** The claims of a token signed with `secret` and not yet expired; null for anything else. */
export function verifyJwt<T extends { exp: number }>(
  token: string,
  secret: string,
  now = Date.now(),
): T | null {
  const [header, body, signature] = token.split('.')
  if (!header || !body || !signature) return null
  const expected = sign(`${header}.${body}`, secret)
  const given = Buffer.from(signature, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    if (JSON.parse(Buffer.from(header, 'base64url').toString()).alg !== 'HS256') return null
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString()) as T
    return typeof claims.exp === 'number' && claims.exp * 1000 > now ? claims : null
  } catch {
    return null
  }
}

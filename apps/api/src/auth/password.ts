import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const COST = { N: 16_384, r: 8, p: 1 }
const KEY_LENGTH = 64

const derive = (password: string, salt: Buffer, length: number, cost: typeof COST) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, length, cost, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  )

/** «scrypt$N$r$p$salt$key»: the cost travels with the hash, so it can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, KEY_LENGTH, COST)
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64'), key.toString('base64')].join(
    '$',
  )
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, N, r, p, salt, key] = stored.split('$')
  if (algo !== 'scrypt' || !salt || !key) return false
  const expected = Buffer.from(key, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

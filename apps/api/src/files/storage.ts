import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { dirname, join } from 'node:path'

/** Where file bytes live. On disk for now; S3 or the like slots in here once the server is known (question 8). */
export interface FileStore {
  put: (key: string, data: Buffer) => Promise<void>
  get: (key: string) => Promise<Buffer | null>
  remove: (key: string) => Promise<void>
}

/** Files under `dir`, spread over 256 folders so none grows too large. */
export function diskStore(dir: string): FileStore {
  const path = (key: string) => join(dir, key.slice(0, 2), key)
  return {
    put: async (key, data) => {
      await mkdir(dirname(path(key)), { recursive: true })
      await writeFile(path(key), data)
    },
    get: async (key) => readFile(path(key)).catch(() => null),
    remove: async (key) => rm(path(key), { force: true }),
  }
}

/** Files in memory: tests, and a server started without FILES_DIR for a quick look. */
export function memoryStore(): FileStore {
  const files = new Map<string, Buffer>()
  return {
    put: async (key, data) => void files.set(key, data),
    get: async (key) => files.get(key) ?? null,
    remove: async (key) => void files.delete(key),
  }
}

export type Verdict = 'clean' | 'infected'

/** Checks an upload before it is kept; an error means «could not check», and the upload is refused. */
export type Scanner = (data: Buffer) => Promise<Verdict>

/** Without ClamAV only the standard EICAR test file is caught — enough to show the refusal works. */
export const eicarOnly: Scanner = async (data) =>
  data.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE') ? 'infected' : 'clean'

/** ClamAV over its clamd socket (INSTREAM), the way the production server will check uploads. */
export function clamav(host: string, port = 3310, timeoutMs = 15_000): Scanner {
  return (data) =>
    new Promise((resolve, reject) => {
      const socket = createConnection({ host, port })
      let answer = ''
      socket.setTimeout(timeoutMs, () => socket.destroy(new Error('ClamAV did not answer')))
      socket.on('error', reject)
      socket.on('data', (chunk) => (answer += chunk.toString()))
      socket.on('end', () =>
        /\bOK\b/.test(answer)
          ? resolve('clean')
          : /FOUND/.test(answer)
            ? resolve('infected')
            : reject(new Error(`ClamAV: ${answer.trim()}`)),
      )
      socket.on('connect', () => {
        socket.write('zINSTREAM\0')
        for (let i = 0; i < data.length; i += 64 * 1024) {
          const chunk = data.subarray(i, i + 64 * 1024)
          const size = Buffer.alloc(4)
          size.writeUInt32BE(chunk.length)
          socket.write(size)
          socket.write(chunk)
        }
        socket.end(Buffer.alloc(4))
      })
    })
}

export type FileVariant = 'file' | 'preview'

/**
 * Links to files that carry their own permission (an <img> sends no token):
 * an HMAC of the file, the variant and the hour the link stops working.
 * Hours are whole, so a list fetched twice gives the same links and the
 * browser's cache holds.
 */
export function fileLinks(secret: string | undefined, publicPath: string) {
  const key = secret ?? randomBytes(32).toString('hex')
  const sign = (id: string, variant: FileVariant, exp: number) =>
    createHmac('sha256', key).update(`${id}:${variant}:${exp}`).digest('base64url')
  const HOUR = 3600
  return {
    link: (id: string, variant: FileVariant, now = Date.now()) => {
      const exp = (Math.ceil(now / 1000 / HOUR) + 1) * HOUR
      return `${publicPath}/attachments/${id}/${variant}?exp=${exp}&sig=${sign(id, variant, exp)}`
    },
    valid: (id: string, variant: FileVariant, exp: unknown, sig: unknown, now = Date.now()) => {
      const e = Number(exp)
      if (!Number.isInteger(e) || e * 1000 < now || typeof sig !== 'string') return false
      const want = Buffer.from(sign(id, variant, e))
      const got = Buffer.from(sig)
      return want.length === got.length && timingSafeEqual(want, got)
    },
  }
}

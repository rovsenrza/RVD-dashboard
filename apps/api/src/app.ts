import Fastify, { type FastifyInstance } from 'fastify'

export interface AppOptions {
  logLevel?: string
}

/** The HTTP app without a listener, so tests can drive it with `inject`. */
export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: { level: options.logLevel ?? 'info' } })

  app.get('/health', async () => ({ status: 'ok', uptime: Math.round(process.uptime()) }))

  return app
}

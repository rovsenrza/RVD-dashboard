import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'

const config = loadConfig()
const app = buildApp({ logLevel: config.LOG_LEVEL })

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}

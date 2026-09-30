import { loadConfig } from '../config.ts'
import { migrate } from './migrate.ts'
import { createPool } from './pool.ts'

const db = createPool(loadConfig().DATABASE_URL)
const applied = await migrate(db)
console.log(applied.length ? `applied: ${applied.join(', ')}` : 'schema is up to date')
await db.end()

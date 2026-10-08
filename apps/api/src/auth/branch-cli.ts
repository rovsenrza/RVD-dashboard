import { parseArgs } from 'node:util'
import { loadConfig } from '../config.ts'
import { migrate } from '../db/migrate.ts'
import { createPool } from '../db/pool.ts'
import { addBranch } from './service.ts'

/**
 * Makes one more 1С client a branch of a client company, or renames a branch:
 *   npm run branch:add -w @rvd/api -- --company <Клиент_Key of any branch of the company> \
 *     --client <Клиент_Key> --name "Участок Север"
 * A large customer is several clients in 1С, one per site (customer, 2026-10-08); the
 * company's people see every branch unless the administrator binds them to some.
 */
const { values } = parseArgs({
  options: {
    company: { type: 'string' },
    client: { type: 'string' },
    name: { type: 'string' },
  },
})
const missing = ['company', 'client', 'name'].filter((key) => !values[key as keyof typeof values])
if (missing.length) throw new Error(`Не хватает: ${missing.map((m) => `--${m}`).join(', ')}`)

const db = createPool(loadConfig().DATABASE_URL)
await migrate(db)
const companyId = await addBranch(db, {
  companyKey: values.company!,
  clientKey: values.client!,
  name: values.name!,
})
console.log(`branch ${values.client} «${values.name}» → company ${companyId}`)
await db.end()

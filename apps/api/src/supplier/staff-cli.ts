import { parseArgs } from 'node:util'
import { loadConfig } from '../config.ts'
import { migrate } from '../db/migrate.ts'
import { createPool } from '../db/pool.ts'
import { addStaff } from './supplier.ts'

/**
 * Adds one of the supplier's staff — the master account (customer, 2026-10-22):
 *   npm run staff:add -w @rvd/api -- --name "Иванов Иван" --email ivanov@vgiz.ru
 * Nobody knows the password it is given: the person sets their own through
 * «Забыли пароль?» on the sign-in page. More staff are added in the section itself.
 */
const { values } = parseArgs({
  options: { name: { type: 'string' }, email: { type: 'string' } },
})
if (!values.name || !values.email) throw new Error('Нужны --name и --email')

const db = createPool(loadConfig().DATABASE_URL)
await migrate(db)
const id = await addStaff(db, { name: values.name, email: values.email })
console.log(
  `added ${values.email} as supplier staff ${id}; the password is set through «Забыли пароль?»`,
)
await db.end()

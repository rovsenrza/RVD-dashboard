import { parseArgs } from 'node:util'
import { passwordProblem, USER_ROLES, type UserRole } from '@rvd/contracts'
import { loadConfig } from '../config.ts'
import { migrate } from '../db/migrate.ts'
import { createPool } from '../db/pool.ts'
import { addUser } from './service.ts'

/**
 * Adds a cabinet user, and their company when it is new:
 *   npm run user:add -w @rvd/api -- --company "ООО Ромашка" --client <Клиент_Key> \
 *     --name "Иванов Иван" --email ivanov@example.ru --password … --role admin [--branch <Клиент_Key> …]
 * The company is the supplier's client: --client is its Клиент_Key in 1С, its first branch
 * (more come with `npm run branch:add`). --branch binds the person to some of the company's
 * branches; without it they see all of them.
 */
const { values } = parseArgs({
  options: {
    company: { type: 'string' },
    client: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    password: { type: 'string' },
    role: { type: 'string', default: 'admin' },
    branch: { type: 'string', multiple: true },
  },
})
const missing = ['company', 'client', 'name', 'email', 'password'].filter(
  (key) => !values[key as keyof typeof values],
)
if (missing.length) throw new Error(`Не хватает: ${missing.map((m) => `--${m}`).join(', ')}`)
if (!USER_ROLES.includes(values.role as UserRole))
  throw new Error(`--role — одна из: ${USER_ROLES.join(', ')}`)
const weak = passwordProblem(values.password!)
if (weak) throw new Error(weak)

const db = createPool(loadConfig().DATABASE_URL)
await migrate(db)
const id = await addUser(db, {
  company: values.company!,
  clientKey: values.client!,
  name: values.name!,
  email: values.email!,
  password: values.password!,
  role: values.role as UserRole,
  branchKeys: values.branch,
})
console.log(`added ${values.email} (${values.role}) as ${id}`)
await db.end()

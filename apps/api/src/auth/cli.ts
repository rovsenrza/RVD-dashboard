import { parseArgs } from 'node:util'
import type { UserRole } from '@rvd/contracts'
import { loadConfig } from '../config.ts'
import { migrate } from '../db/migrate.ts'
import { createPool } from '../db/pool.ts'
import { addUser } from './service.ts'

/**
 * Adds a cabinet user, and their company when it is new:
 *   npm run user:add -w @rvd/api -- --company "ООО Ромашка" --client <Клиент_Key> \
 *     --name "Иванов Иван" --email ivanov@example.ru --password … --role admin
 * The company is the supplier's client: --client is its Клиент_Key in 1С.
 */
const ROLES: UserRole[] = ['mechanic', 'engineer', 'manager', 'admin']
const { values } = parseArgs({
  options: {
    company: { type: 'string' },
    client: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    password: { type: 'string' },
    role: { type: 'string', default: 'admin' },
  },
})
const missing = ['company', 'client', 'name', 'email', 'password'].filter(
  (key) => !values[key as keyof typeof values],
)
if (missing.length) throw new Error(`Не хватает: ${missing.map((m) => `--${m}`).join(', ')}`)
if (!ROLES.includes(values.role as UserRole))
  throw new Error(`--role — одна из: ${ROLES.join(', ')}`)
if (values.password!.length < 10) throw new Error('Пароль — не короче 10 символов')

const db = createPool(loadConfig().DATABASE_URL)
await migrate(db)
const id = await addUser(db, {
  company: values.company!,
  clientKey: values.client!,
  name: values.name!,
  email: values.email!,
  password: values.password!,
  role: values.role as UserRole,
})
console.log(`added ${values.email} (${values.role}) as ${id}`)
await db.end()

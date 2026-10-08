import { DEFAULT_RULES, type Equipment } from '@rvd/contracts'
import pg from 'pg'
import { buildApp } from '../app.ts'
import { addBranch, addUser } from '../auth/service.ts'
import { migrate } from '../db/migrate.ts'
import { createPool } from '../db/pool.ts'
import { memoryStore } from '../files/storage.ts'
import { storeCache } from '../sync/store.ts'
import { machine, product } from './rows.ts'

/**
 * The API for the browser end-to-end run (Д28, `npm run test:e2e`): a database of its
 * own (`rvd_e2e` next to DATABASE_URL's), wiped and seeded on every start with one
 * company's small fleet and a second company of two branches (two 1С clients), real
 * sign-in, files in memory. No 1С and no sync.
 */
const base = process.env.DATABASE_URL ?? 'postgres://rvd:rvd@127.0.0.1:5433/rvd'
const url = new URL(base)
const admin = new pg.Client({ connectionString: base })
await admin.connect()
await admin.query('drop database if exists rvd_e2e with (force)')
await admin.query('create database rvd_e2e')
await admin.end()
url.pathname = '/rvd_e2e'
const db = createPool(url.toString())
await migrate(db)

const today = new Date()
const ago = (days: number) =>
  new Date(today.getTime() - days * 86_400_000).toLocaleDateString('sv-SE')
const fleet: Equipment[] = [
  machine('e1', { garageNumber: 'НТ08', brand: 'БелАЗ', type: 'Самосвал' }),
  machine('e2', { garageNumber: 'ЕХ20', brand: 'Komatsu', type: 'Экскаватор' }),
]
await storeCache(
  db,
  {
    products: [
      // Fine, near its end, and overdue: every status the screens colour.
      product({
        id: 'h1',
        serialNumber: '4101',
        equipmentId: 'e1',
        shippedAt: ago(40),
        lifecycle: 'shipped',
      }),
      product({
        id: 'h2',
        serialNumber: '4102',
        equipmentId: 'e1',
        shippedAt: ago(350),
        lifecycle: 'shipped',
      }),
      product({
        id: 'h3',
        serialNumber: '4103',
        equipmentId: 'e2',
        shippedAt: ago(400),
        lifecycle: 'shipped',
      }),
      product({ id: 'h4', serialNumber: '4104', shippedAt: ago(5), lifecycle: 'shipped' }),
    ]
      .map((p) => ({ product: { ...p, type: '2SC ду10 рукав' }, clientId: 'k-e2e' }))
      // A second company that is two clients in 1С, one per site: its branches.
      .concat(
        [
          ['s1', '5101', 'k-site-a'],
          ['s2', '5102', 'k-site-a'],
          ['s3', '5201', 'k-site-b'],
        ].map(([id, serialNumber, clientId]) => ({
          product: product({ id, serialNumber, shippedAt: ago(30), branchId: clientId }),
          clientId,
        })),
      ),
    equipment: fleet.map((e) => ({ equipment: e, clientId: 'k-e2e' })),
  },
  1,
)
await addUser(db, {
  company: 'АО Участки',
  clientKey: 'k-site-a',
  name: 'Админ Участков',
  email: 'sites@e2e.test',
  password: 'e2e-password-1',
  role: 'admin',
})
await addBranch(db, { companyKey: 'k-site-a', clientKey: 'k-site-b', name: 'Участок Б' })
await addBranch(db, { companyKey: 'k-site-a', clientKey: 'k-site-a', name: 'Участок А' })
const company = { company: 'ООО Проверка', clientKey: 'k-e2e' }
await addUser(db, {
  ...company,
  name: 'Админ Проверки',
  email: 'admin@e2e.test',
  password: 'e2e-password-1',
  role: 'admin',
})
await addUser(db, {
  ...company,
  name: 'Механик Проверки',
  email: 'mechanic@e2e.test',
  password: 'e2e-password-1',
  role: 'mechanic',
})

const app = buildApp({
  logLevel: 'warn',
  db,
  clock: () => ({ today: today.toLocaleDateString('sv-SE'), rules: DEFAULT_RULES }),
  auth: { secret: 'an-e2e-secret-that-is-long-enough-1234567890' },
  files: { store: memoryStore() },
})
await app.listen({ port: Number(process.env.PORT ?? 3021), host: '127.0.0.1' })
console.log('e2e API ready')

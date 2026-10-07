/**
 * Д27: how the API holds up at the reference deployment's scale (~170 000
 * hoses, ~780 client companies). Fills a schema of its own — never the cache's
 * — with synthetic hoses and machines, then times the requests the cabinet
 * makes most, as one large client and across all clients:
 *
 *   npm run perf -w @rvd/api -- [--hoses 200000] [--explain] [--keep]
 *
 * `--explain` prints the plan of every query of the slowest request, `--keep`
 * leaves the data for another run (seeding takes a while).
 */
import { parseArgs } from 'node:util'
import { DEFAULT_RULES, ProductListQuery, type Equipment, type Product } from '@rvd/contracts'
import { loadConfig } from '../config.ts'
import { dashboardSummary } from '../dashboard/query.ts'
import { migrate } from '../db/migrate.ts'
import { createPool, type Db } from '../db/pool.ts'
import { equipmentProducts, getEquipment, listEquipment } from '../equipment/query.ts'
import { listProducts, type Clock } from '../products/query.ts'
import { listNotifications } from '../notifications/query.ts'
import { listReplacements } from '../replacements/query.ts'
import { companyModels, companyReport } from '../reports/query.ts'
import { storeCache, type StoredEquipment, type StoredProduct } from '../sync/store.ts'

const SCHEMA = 'perf_bench'
const { values } = parseArgs({
  options: {
    hoses: { type: 'string', default: '200000' },
    explain: { type: 'boolean', default: false },
    keep: { type: 'boolean', default: false },
  },
})
const HOSES = Number(values.hoses)
const CLIENTS = 780
const BIG = 'client-big'
const BIG_SHARE = 0.1 // one large client holds a tenth of all hoses
const clock: Clock = { today: '2026-10-04', rules: DEFAULT_RULES }

// A fixed seed: every run measures the same data.
let seed = 42
const rand = () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
  return seed / 2_147_483_648
}
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]
const iso = (d: Date) => d.toISOString().slice(0, 10)
const daysBefore = (n: number) => iso(new Date(Date.parse(clock.today) - n * 86_400_000))
const daysAfter = (date: string, n: number) => iso(new Date(Date.parse(date) + n * 86_400_000))

const TYPES = [
  '2SC ду10 рукав',
  '4SH ду25 рукав',
  '2SN ду06 рукав',
  'РВД в сборе',
  '1SN ду16 рукав',
]
const PLACES = ['Ковш', 'Стрела', 'Гидромотор хода', 'Насос', 'Рукоять', null]
const LIFE = [365, 540, 730, 1095]

function seedData(): { products: StoredProduct[]; equipment: StoredEquipment[] } {
  const clientOf = (i: number) =>
    i < HOSES * BIG_SHARE ? BIG : `client-${1 + Math.floor(rand() * (CLIENTS - 1))}`
  const machinesOf = new Map<string, string[]>()
  const equipment: StoredEquipment[] = []
  const machineFor = (client: string) => {
    const list = machinesOf.get(client) ?? []
    // About seven hoses to a machine: a new one every so often, else one the client has.
    if (!list.length || rand() < 0.14) {
      const id = `eq-${equipment.length + 1}`
      list.push(id)
      machinesOf.set(client, list)
      const machine: Equipment = {
        id,
        branchId: 'b1',
        type: pick(['Экскаватор', 'Самосвал', 'Бурстанок', 'Погрузчик']),
        brand: pick(['Камаз', 'Урал', 'ATLAS COPCO', 'Sunward']),
        model: '',
        garageNumber: String(100 + equipment.length),
        factoryNumber: null,
        inventoryNumber: null,
        department: null,
        hoseCount: 0,
        lastRepairDate: null,
        nextPlannedReplacement: null,
        statusBreakdown: { ok: 0, warn: 0, replace: 0, no_warranty: 0 },
      }
      equipment.push({ equipment: machine, clientId: client })
      return id
    }
    return pick(list)
  }

  const products: StoredProduct[] = []
  for (let i = 0; i < HOSES; i++) {
    const client = clientOf(i)
    const roll = rand()
    const lifecycle: Product['lifecycle'] =
      roll < 0.1
        ? 'written_off'
        : roll < 0.7
          ? 'shipped'
          : roll < 0.9
            ? 'in_operation'
            : roll < 0.95
              ? 'in_stock'
              : 'manufacturing'
    const made = lifecycle === 'manufacturing' || lifecycle === 'in_stock'
    const shippedAt = made ? null : daysBefore(Math.floor(rand() * 1100))
    const installedAt =
      lifecycle === 'in_operation' && shippedAt
        ? daysAfter(shippedAt, Math.floor(rand() * 20))
        : null
    const onMachine = !made && rand() < 0.85
    const catalog = `${String(Math.floor(rand() * 16_000)).padStart(5, '0')}-${String(Math.floor(rand() * 1000)).padStart(5, '0')}`
    products.push({
      clientId: client,
      product: {
        id: `p-${i + 1}`,
        serialNumber: String(1000 + i),
        clientNumber: rand() < 0.2 ? `K-${i}` : null,
        catalogNumberId: `cat-${catalog}`,
        catalogNumber: catalog,
        nomenclatureNumber: null,
        type: pick(TYPES),
        manufacturer: '',
        specs: '',
        diameter: 10,
        braidCount: 2,
        composition: [],
        manufacturedAt: shippedAt,
        shippedAt,
        installedAt,
        warrantyDays: 180,
        serviceLifeDays: pick(LIFE),
        status: 'ok',
        lifecycle,
        replacedProductId: null,
        equipmentId: onMachine ? machineFor(client) : null,
        installPlace: onMachine ? pick(PLACES) : null,
        branchId: 'b1',
      },
    })
  }
  return { products, equipment }
}

/** Every query a request runs, so its plans can be printed. */
function recording(db: Db) {
  const ran: { text: string; params: unknown[] }[] = []
  const proxy = new Proxy(db, {
    get(target, key, receiver) {
      if (key !== 'query') return Reflect.get(target, key, receiver)
      return (text: string, params: unknown[] = []) => {
        ran.push({ text, params })
        return target.query(text, params)
      }
    },
  })
  return { db: proxy as Db, ran }
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

const config = loadConfig()
const db = createPool(config.DATABASE_URL, SCHEMA)
await db.query(`create schema if not exists ${SCHEMA}`)
await migrate(db)
const { rows } = await db.query<{ n: string }>('select count(*) as n from products')
if (Number(rows[0].n) !== HOSES) {
  const started = Date.now()
  const data = seedData()
  await storeCache(db, data, 0)
  await db.query('analyze')
  console.log(
    `seeded ${HOSES} hoses, ${data.equipment.length} machines, ${CLIENTS} clients in ${((Date.now() - started) / 1000).toFixed(1)} s`,
  )
}

const bigMachine = (
  await db.query<{ id: string }>(
    `select e.id from equipment e join products p on p.equipment_id = e.id
      where e.client_id = $1 group by e.id order by count(*) desc limit 1`,
    [BIG],
  )
).rows[0].id
const page = (q: Record<string, unknown>) =>
  ProductListQuery.parse({ limit: 10, archive: '0', ...q })

const cases: [string, (db: Db) => Promise<unknown>][] = [
  ['registry · page 1', (d) => listProducts(d, page({ client: BIG }), clock)],
  ['registry · page 200', (d) => listProducts(d, page({ client: BIG, page: 200 }), clock)],
  [
    'registry · sorted by status',
    (d) => listProducts(d, page({ client: BIG, sort: 'status', dir: 'desc' }), clock),
  ],
  [
    'registry · «требуют замены»',
    (d) => listProducts(d, page({ client: BIG, status: 'replace' }), clock),
  ],
  ['registry · search «0275»', (d) => listProducts(d, page({ client: BIG, q: '0275' }), clock)],
  [
    'registry · all hoses (lookups)',
    (d) => listProducts(d, page({ client: BIG, limit: 5000 }), clock),
  ],
  ['dashboard', (d) => dashboardSummary(d, clock, BIG)],
  ['machines', (d) => listEquipment(d, clock, BIG)],
  ['machine card', (d) => getEquipment(d, bigMachine, clock, BIG)],
  ['machine hoses', (d) => equipmentProducts(d, bigMachine, clock, BIG)],
  ['replacements', (d) => listReplacements(d, { client: BIG })],
  [
    'notifications',
    (d) =>
      listNotifications(d, clock.today, {
        userId: null,
        client: BIG,
        leadDays: [30, 14, 7],
        kinds: {
          overdue: true,
          planned_replacement: true,
          warranty_end: true,
          request_status: true,
        },
      }),
  ],
  [
    'report · registry (whole client)',
    (d) =>
      companyReport(d, 'registry', clock, {
        client: BIG,
        companyName: 'Крупный клиент',
        from: null,
        to: null,
      }),
  ],
  [
    'report · machines',
    (d) =>
      companyReport(d, 'equipment', clock, {
        client: BIG,
        companyName: 'Крупный клиент',
        from: null,
        to: null,
      }),
  ],
  ['model comparison', (d) => companyModels(d, clock, BIG)],
  ['registry · small client', (d) => listProducts(d, page({ client: 'client-7' }), clock)],
  ['dashboard · all clients', (d) => dashboardSummary(d, clock)],
]

console.log(
  `\n${HOSES} hoses, one client with ${HOSES * BIG_SHARE}; median of 7 runs after a warm-up\n`,
)
const timings: { name: string; ms: number; run: (db: Db) => Promise<unknown> }[] = []
for (const [name, run] of cases) {
  await run(db)
  const runs: number[] = []
  for (let i = 0; i < 7; i++) {
    const t = performance.now()
    await run(db)
    runs.push(performance.now() - t)
  }
  const ms = median(runs)
  timings.push({ name, ms, run })
  console.log(`${name.padEnd(34)} ${ms.toFixed(1).padStart(8)} ms`)
}

if (values.explain) {
  const slowest = [...timings].sort((a, b) => b.ms - a.ms)[0]
  const { db: rec, ran } = recording(db)
  await slowest.run(rec)
  console.log(`\nplans of «${slowest.name}»:`)
  for (const q of ran) {
    const plan = await db.query<{ 'QUERY PLAN': string }>(
      `explain (analyze, buffers) ${q.text}`,
      q.params,
    )
    console.log('\n' + plan.rows.map((r) => r['QUERY PLAN']).join('\n'))
  }
}

if (!values.keep) await db.query(`drop schema ${SCHEMA} cascade`)
await db.end()

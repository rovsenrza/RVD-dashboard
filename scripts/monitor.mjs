// Outside check of the live cabinet (Д31): the page, the API and its database, how fresh the 1С
// data is, and the certificate. Prints one line per problem and exits 1 when there is any; when
// all is well, prints one summary line. .github/workflows/monitor.yml runs it on a schedule.
//   node scripts/monitor.mjs [https://clientrvd.vgiz.ru]
import tls from 'node:tls'

const url = new URL(process.argv[2] ?? process.env.CABINET_URL ?? 'https://clientrvd.vgiz.ru')
const STALE_MINUTES = 60 // the sync checks 1С every 10 minutes
const CERT_MIN_DAYS = 14 // Caddy renews 30 days before the end
const TIMEOUT_MS = 20_000

const problems = []
const minutesSince = (iso) => (Date.now() - Date.parse(iso)) / 60_000
const msk = (iso) =>
  `${new Date(iso).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' })} МСК`
const reason = (error) => error.cause?.code ?? error.cause?.message ?? error.message

async function get(path) {
  const res = await fetch(new URL(path, url), { signal: AbortSignal.timeout(TIMEOUT_MS) })
  return { status: res.status, text: await res.text() }
}

function certificateDays() {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: url.hostname, port: 443, servername: url.hostname, timeout: TIMEOUT_MS },
      () => {
        const { valid_to } = socket.getPeerCertificate()
        socket.end()
        resolve((Date.parse(valid_to) - Date.now()) / 86_400_000)
      },
    )
    socket.on('error', reject)
    socket.on('timeout', () => socket.destroy(new Error('timeout')))
  })
}

try {
  const page = await get('/')
  if (page.status !== 200 || !page.text.includes('<title>РВД Кабинет'))
    problems.push(`Главная страница отвечает ${page.status}`)
} catch (error) {
  problems.push(`Главная страница не открывается: ${reason(error)}`)
}

let health = null
try {
  const res = await get('/api/health')
  try {
    health = JSON.parse(res.text)
  } catch {
    health = null
  }
  if (res.status !== 200 || health?.db !== 'ok') {
    problems.push(
      `API отвечает ${res.status}${health?.db === 'down' ? ': база данных недоступна' : ''}`,
    )
    health = null
  }
} catch (error) {
  problems.push(`API не отвечает: ${reason(error)}`)
}
if (health?.onecUnavailableSince && minutesSince(health.onecUnavailableSince) > STALE_MINUTES)
  problems.push(`1С недоступна с ${msk(health.onecUnavailableSince)}, кабинет показывает кэш`)
if (health && !health.syncedAt) problems.push('Синхронизация с 1С ещё ни разу не прошла')
else if (health && minutesSince(health.syncedAt) > STALE_MINUTES)
  problems.push(`Данные 1С не обновлялись с ${msk(health.syncedAt)}`)

let days = null
try {
  days = await certificateDays()
  if (days < CERT_MIN_DAYS) problems.push(`Сертификат HTTPS истекает через ${Math.floor(days)} дн.`)
} catch (error) {
  problems.push(`HTTPS не работает: ${reason(error)}`)
}

if (problems.length) {
  console.log(problems.map((problem) => `- ${problem}`).join('\n'))
  process.exit(1)
}
console.log(
  `${url.host} в порядке: данные 1С на ${msk(health.syncedAt)}, сертификат ещё ${Math.floor(days)} дн.`,
)

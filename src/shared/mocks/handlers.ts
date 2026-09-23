import { http, HttpResponse } from 'msw'
import {
  applyInstallation,
  applySettings,
  audit,
  branchSummaries,
  catalogNumbers,
  dashboardSummary,
  diff,
  equipment,
  installationView,
  products,
  record,
  releaseDocuments,
  replacements,
  requests,
  settings,
  settingsView,
  users,
  userView,
} from './data'

const api = (path: string) => `*/api${path}`

/** Branch scope the BFF will take from the token; here it rides the query string. */
const branchOf = (request: Request) => new URL(request.url).searchParams.get('branch')

const inBranch = <T extends { branchId: string }>(rows: T[], branch: string | null) =>
  branch ? rows.filter((r) => r.branchId === branch) : rows

export const handlers = [
  http.get(api('/dashboard/summary'), ({ request }) =>
    HttpResponse.json(dashboardSummary(branchOf(request))),
  ),
  http.get(api('/products'), ({ request }) =>
    HttpResponse.json(inBranch(products, branchOf(request))),
  ),
  http.get(api('/products/:id'), ({ params }) => {
    const p = products.find((x) => x.id === params.id)
    return p ? HttpResponse.json(p) : new HttpResponse(null, { status: 404 })
  }),
  http.patch(api('/products/:id'), async ({ params, request }) => {
    const p = products.find((x) => x.id === params.id)
    if (!p) return new HttpResponse(null, { status: 404 })
    const patch = (await request.json()) as Parameters<typeof applyInstallation>[1]
    const before = installationView(p)
    applyInstallation(p, patch)
    const changes = diff(before, installationView(p))
    if (changes.length)
      record({
        action: 'installation.update',
        target: { kind: 'product', id: p.id, label: `EHS ${p.serialNumber}` },
        changes,
      })
    return HttpResponse.json(p)
  }),
  http.get(api('/products/:id/documents'), ({ params }) =>
    HttpResponse.json(releaseDocuments.filter((d) => d.productId === params.id)),
  ),
  http.get(api('/equipment'), ({ request }) =>
    HttpResponse.json(inBranch(equipment, branchOf(request))),
  ),
  http.get(api('/equipment/:id'), ({ params }) => {
    const e = equipment.find((x) => x.id === params.id)
    return e ? HttpResponse.json(e) : new HttpResponse(null, { status: 404 })
  }),
  http.get(api('/equipment/:id/products'), ({ params }) =>
    HttpResponse.json(
      products.filter((p) => p.equipmentId === params.id && p.lifecycle !== 'written_off'),
    ),
  ),
  http.get(api('/catalog-numbers'), () => HttpResponse.json(catalogNumbers)),
  http.get(api('/replacements'), ({ request }) => {
    const branch = branchOf(request)
    if (!branch) return HttpResponse.json(replacements)
    // A replacement carries no branch of its own — it belongs to the branch of
    // the equipment it happened on.
    const ours = new Set(equipment.filter((e) => e.branchId === branch).map((e) => e.id))
    return HttpResponse.json(replacements.filter((r) => ours.has(r.equipmentId)))
  }),
  http.get(api('/requests'), ({ request }) =>
    HttpResponse.json(inBranch(requests, branchOf(request))),
  ),
  http.post(api('/requests'), async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const created = {
      id: `req-${requests.length + 1}`,
      number: `СВЦБ-${String(5200 + requests.length).padStart(5, '0')}`,
      status: 'new',
      shipmentStatus: 'not_shipped',
      createdAt: new Date().toISOString().slice(0, 10),
      ...body,
    }
    requests.unshift(created as (typeof requests)[number])
    record({
      action: 'request.create',
      target: { kind: 'request', id: created.id, label: created.number },
      changes: [
        {
          field: 'Тип',
          before: null,
          after: body.kind === 'manufacture' ? 'Изготовление' : 'Замена',
        },
        { field: 'Количество', before: null, after: String(body.quantity ?? '') || null },
      ],
    })
    return HttpResponse.json(created, { status: 201 })
  }),

  // Administration: company-wide, not narrowed by branch.
  http.get(api('/admin/users'), () => HttpResponse.json(users)),
  http.post(api('/admin/users'), async ({ request }) => {
    const body = (await request.json()) as Omit<
      (typeof users)[number],
      'id' | 'active' | 'lastLoginAt'
    >
    if (users.some((u) => u.email.toLowerCase() === body.email.toLowerCase()))
      return HttpResponse.json({ message: 'Пользователь с такой почтой уже есть' }, { status: 409 })
    const created = { ...body, id: `u-${users.length + 1}`, active: true, lastLoginAt: null }
    users.push(created)
    record({
      action: 'user.create',
      target: { kind: 'user', id: created.id, label: created.name },
      changes: diff({}, userView(created)),
    })
    return HttpResponse.json(created, { status: 201 })
  }),
  http.patch(api('/admin/users/:id'), async ({ params, request }) => {
    const user = users.find((u) => u.id === params.id)
    if (!user) return new HttpResponse(null, { status: 404 })
    const patch = (await request.json()) as Partial<(typeof users)[number]>
    if (
      patch.email &&
      users.some((u) => u.id !== user.id && u.email.toLowerCase() === patch.email!.toLowerCase())
    )
      return HttpResponse.json({ message: 'Пользователь с такой почтой уже есть' }, { status: 409 })
    const before = userView(user)
    Object.assign(user, patch)
    const changes = diff(before, userView(user))
    const onlyAccess = changes.length === 1 && changes[0].field === 'Доступ'
    if (changes.length)
      record({
        action: onlyAccess ? (user.active ? 'user.activate' : 'user.deactivate') : 'user.update',
        target: { kind: 'user', id: user.id, label: user.name },
        changes,
      })
    return HttpResponse.json(user)
  }),
  http.post(api('/admin/users/:id/reset-password'), ({ params }) => {
    const user = users.find((u) => u.id === params.id)
    if (!user) return new HttpResponse(null, { status: 404 })
    record({
      action: 'user.password',
      target: { kind: 'user', id: user.id, label: user.name },
      changes: [],
    })
    return HttpResponse.json({ sentTo: user.email })
  }),
  http.get(api('/admin/branches'), () => HttpResponse.json(branchSummaries())),
  http.get(api('/admin/settings'), () => HttpResponse.json(settings)),
  http.patch(api('/admin/settings'), async ({ request }) => {
    const before = settingsView(settings)
    applySettings((await request.json()) as Partial<typeof settings>)
    const changes = diff(before, settingsView(settings))
    if (changes.length)
      record({
        action: 'settings.update',
        target: { kind: 'settings', id: null, label: 'Настройки компании' },
        changes,
      })
    return HttpResponse.json(settings)
  }),
  http.get(api('/admin/audit'), () => HttpResponse.json(audit)),
]

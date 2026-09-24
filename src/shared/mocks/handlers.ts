import { http, HttpResponse } from 'msw'
import {
  attachmentsOf,
  claimAttachments,
  deleteAttachment,
  storedFile,
  storeUpload,
  type AttachmentOwner,
} from './attachments'
import {
  applyInstallation,
  applySettings,
  audit,
  branchSummaries,
  catalogNumbers,
  currentAuthor,
  dashboardSummary,
  diff,
  equipment,
  filesChange,
  installationView,
  modelStats,
  products,
  record,
  recordReplacement,
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

/** Journals come newest first, as the BFF will return them. */
const newestFirst = <T extends { date: string }>(rows: T[]) =>
  [...rows].sort((a, b) => b.date.localeCompare(a.date))

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
  http.get(api('/analytics/models'), ({ request }) =>
    HttpResponse.json(modelStats(branchOf(request))),
  ),
  http.get(api('/replacements'), ({ request }) => {
    const branch = branchOf(request)
    if (!branch) return HttpResponse.json(newestFirst(replacements))
    // A replacement carries no branch of its own — it belongs to the branch of
    // the equipment it happened on.
    const ours = new Set(equipment.filter((e) => e.branchId === branch).map((e) => e.id))
    return HttpResponse.json(newestFirst(replacements.filter((r) => ours.has(r.equipmentId))))
  }),
  http.get(api('/products/:id/attachments'), ({ params }) =>
    HttpResponse.json(attachmentsOf({ kind: 'product', id: params.id as string })),
  ),

  // Files (Д25). A hose takes files directly; a request or a replacement claims
  // drafts uploaded while its form was open, by id, when it is created.
  http.post(api('/attachments'), async ({ request }) => {
    const form = await request.formData()
    const file = form.get('file')
    // A form entry is text or a file; `instanceof File` breaks across realms (jsdom in tests).
    if (!file || typeof file === 'string')
      return HttpResponse.json({ message: 'Файл не передан' }, { status: 400 })
    const productId = form.get('productId')
    const product = productId ? products.find((p) => p.id === productId) : null
    if (productId && !product) return new HttpResponse(null, { status: 404 })
    const owner: AttachmentOwner | null = product ? { kind: 'product', id: product.id } : null
    const result = await storeUpload(file, owner, currentAuthor())
    if ('message' in result) return HttpResponse.json(result, { status: 422 })
    if (product)
      record({
        action: 'attachment.create',
        target: { kind: 'product', id: product.id, label: `EHS ${product.serialNumber}` },
        changes: filesChange([result]),
      })
    return HttpResponse.json(result, { status: 201 })
  }),
  http.get(api('/attachments/:id/file'), ({ params }) => {
    const stored = storedFile(params.id as string)
    return stored
      ? new HttpResponse(stored.blob, {
          headers: {
            'Content-Type': stored.meta.mimeType,
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(stored.meta.fileName)}`,
          },
        })
      : new HttpResponse(null, { status: 404 })
  }),
  http.delete(api('/attachments/:id'), ({ params }) => {
    const stored = storedFile(params.id as string)
    if (!stored) return new HttpResponse(null, { status: 404 })
    const product =
      stored.owner?.kind === 'product' ? products.find((p) => p.id === stored.owner!.id) : null
    // Files of a request or a replacement went to 1С with it; they stay as evidence.
    if (!product)
      return HttpResponse.json(
        { message: 'Файлы заявок и замен уходят в 1С вместе с ними и не удаляются' },
        { status: 409 },
      )
    deleteAttachment(stored.meta.id)
    record({
      action: 'attachment.delete',
      target: { kind: 'product', id: product.id, label: `EHS ${product.serialNumber}` },
      changes: [{ field: 'Файлы', before: stored.meta.fileName, after: null }],
    })
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(api('/replacements'), async ({ request }) => {
    const result = recordReplacement(
      (await request.json()) as Parameters<typeof recordReplacement>[0],
    )
    return 'error' in result
      ? HttpResponse.json({ message: result.error }, { status: 409 })
      : HttpResponse.json(result, { status: 201 })
  }),
  http.get(api('/products/:id/replacements'), ({ params }) =>
    HttpResponse.json(
      newestFirst(
        replacements.filter((r) => r.oldProductId === params.id || r.newProductId === params.id),
      ),
    ),
  ),
  http.get(api('/equipment/:id/replacements'), ({ params }) =>
    HttpResponse.json(newestFirst(replacements.filter((r) => r.equipmentId === params.id))),
  ),
  http.get(api('/requests'), ({ request }) =>
    HttpResponse.json(inBranch(requests, branchOf(request))),
  ),
  http.post(api('/requests'), async ({ request }) => {
    const { attachmentIds, ...body } = (await request.json()) as Record<string, unknown> & {
      attachmentIds?: string[]
    }
    const id = `req-${requests.length + 1}`
    const created = {
      id,
      number: `СВЦБ-${String(5200 + requests.length).padStart(5, '0')}`,
      status: 'new',
      shipmentStatus: 'not_shipped',
      createdAt: new Date().toISOString().slice(0, 10),
      ...body,
      attachments: claimAttachments(attachmentIds, { kind: 'request', id }),
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
        ...filesChange(created.attachments),
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

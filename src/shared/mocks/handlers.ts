import { http, HttpResponse, passthrough } from 'msw'
import { LIVE, LIVE_ROUTES } from '@/shared/api/live'
import type { InstallationPatch, NewRequest, NewSupportMessage } from '@/shared/api/queries'
import type { PasswordChange, PasswordDelivery, SyncStatus, UserCreated } from '@/entities/types'
import { ProductListQuery } from '@/entities/product/list'
import { settingsProblem } from '@/entities/settings'
import { equipmentProblem, equipmentView } from '@/entities/equipment'
import { EMAIL_TAKEN, passwordProblem } from '@/entities/user'
import {
  attachmentsOf,
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
  lifecycleRecords,
  replacements,
  requests,
  settings,
  settingsView,
  users,
  userView,
} from './data'
import { productPage } from './productList'
import { buildReport } from './reports'
import { createRequest } from './requests'
import { sendSupportMessage } from './support'
import { markRead, notificationsFor, prefs, prefsView } from './notifications'
import {
  addComment,
  commentProblem,
  comments,
  commentsOf,
  deleteComment,
  documentationFile,
  documentationOf,
  editComment,
  productLifetime,
} from './productCard'

const api = (path: string) => `*/api${path}`

/** Branch scope the BFF will take from the token; here it rides the query string. */
const branchOf = (request: Request) => new URL(request.url).searchParams.get('branch')

/** Journals come newest first, as the BFF will return them. */
const newestFirst = <T extends { date: string }>(rows: T[]) =>
  [...rows].sort((a, b) => b.date.localeCompare(a.date))

const inBranch = <T extends { branchId: string }>(rows: T[], branch: string | null) =>
  branch ? rows.filter((r) => r.branchId === branch) : rows

/** The demo's 1С answers; the last check was a few minutes ago. */
let syncedAt = new Date(Date.now() - 4 * 60_000)
const syncStatus = (): SyncStatus => ({
  syncedAt: syncedAt.toISOString(),
  unavailableSince: null,
  running: false,
})

// Hybrid mode: what the real API serves goes to it, ahead of any mock below.
const live = LIVE
  ? LIVE_ROUTES.map(([method, path]) => http[method](api(path), () => passthrough()))
  : []

export const handlers = [
  ...live,
  http.get(api('/dashboard/summary'), ({ request }) =>
    HttpResponse.json(dashboardSummary(branchOf(request))),
  ),
  // How fresh the data is (Д26); «Обновить сейчас» just moves the time on.
  http.get(api('/sync'), () => HttpResponse.json(syncStatus())),
  http.post(api('/sync'), () => {
    syncedAt = new Date()
    return HttpResponse.json(syncStatus(), { status: 202 })
  }),
  // The registry pages on the server; the mock answers the same query the same way.
  http.get(api('/products'), ({ request }) => {
    const query = ProductListQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!query.success) return HttpResponse.json({ error: 'Bad query' }, { status: 400 })
    return HttpResponse.json(productPage(products, query.data))
  }),
  http.get(api('/products/:id'), ({ params }) => {
    const p = products.find((x) => x.id === params.id)
    return p ? HttpResponse.json(p) : new HttpResponse(null, { status: 404 })
  }),
  http.patch(api('/products/:id'), async ({ params, request }) => {
    const p = products.find((x) => x.id === params.id)
    if (!p) return new HttpResponse(null, { status: 404 })
    const patch = (await request.json()) as InstallationPatch
    // The installation date is the supplier's (1С): the customer asks the specialist instead.
    if ('installedAt' in patch)
      return HttpResponse.json(
        { message: 'Дату установки исправляет специалист — напишите ему из карточки изделия' },
        { status: 400 },
      )
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
  http.post(api('/support/messages'), async ({ request }) => {
    const result = sendSupportMessage((await request.json()) as NewSupportMessage)
    return 'error' in result
      ? HttpResponse.json({ message: result.error }, { status: 400 })
      : HttpResponse.json(result, { status: 201 })
  }),
  http.get(api('/products/:id/lifetime'), ({ params }) => {
    const p = products.find((x) => x.id === params.id)
    return p ? HttpResponse.json(productLifetime(p)) : new HttpResponse(null, { status: 404 })
  }),
  http.get(api('/products/:id/documentation'), ({ params }) => {
    const p = products.find((x) => x.id === params.id)
    return p ? HttpResponse.json(documentationOf(p)) : new HttpResponse(null, { status: 404 })
  }),
  http.get(api('/documentation/:id/file'), ({ params }) => {
    const file = documentationFile(params.id as string)
    return file
      ? new HttpResponse(file, { headers: { 'Content-Type': 'application/pdf' } })
      : new HttpResponse(null, { status: 404 })
  }),

  // Comments (Д11): the cabinet's own notes, never sent to 1С.
  http.get(api('/products/:id/comments'), ({ params }) =>
    HttpResponse.json(commentsOf(params.id as string)),
  ),
  http.post(api('/products/:id/comments'), async ({ params, request }) => {
    const p = products.find((x) => x.id === params.id)
    if (!p) return new HttpResponse(null, { status: 404 })
    const { text } = (await request.json()) as { text?: unknown }
    const problem = commentProblem(text)
    if (problem) return HttpResponse.json({ message: problem }, { status: 422 })
    return HttpResponse.json(addComment(p, text as string), { status: 201 })
  }),
  http.patch(api('/comments/:id'), async ({ params, request }) => {
    const c = comments.find((x) => x.id === params.id)
    if (!c) return new HttpResponse(null, { status: 404 })
    const { text } = (await request.json()) as { text?: unknown }
    const problem = commentProblem(text)
    if (problem) return HttpResponse.json({ message: problem }, { status: 422 })
    const saved = editComment(c, text as string)
    return saved === 'forbidden'
      ? HttpResponse.json({ message: 'Изменить можно только свой комментарий' }, { status: 403 })
      : HttpResponse.json(saved)
  }),
  http.delete(api('/comments/:id'), ({ params }) => {
    const c = comments.find((x) => x.id === params.id)
    if (!c) return new HttpResponse(null, { status: 404 })
    deleteComment(c)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api('/products/:id/history'), ({ params }) =>
    HttpResponse.json(lifecycleRecords.filter((r) => r.productId === params.id)),
  ),
  http.get(api('/equipment'), ({ request }) =>
    HttpResponse.json(inBranch(equipment, branchOf(request))),
  ),
  http.get(api('/equipment/:id'), ({ params }) => {
    const e = equipment.find((x) => x.id === params.id)
    return e ? HttpResponse.json(e) : new HttpResponse(null, { status: 404 })
  }),
  // A machine's department and factory number: the customer's, by the API's rule.
  http.patch(api('/equipment/:id'), async ({ params, request }) => {
    const e = equipment.find((x) => x.id === params.id)
    if (!e) return new HttpResponse(null, { status: 404 })
    const patch = (await request.json()) as Record<string, unknown>
    const problem = equipmentProblem(patch)
    if (problem) return HttpResponse.json({ message: problem }, { status: 400 })
    const before = equipmentView(e)
    const text = (v: unknown, was: string | null) =>
      v === undefined ? was : typeof v === 'string' && v.trim() ? v.trim() : null
    e.department = text(patch.department, e.department)
    e.factoryNumber = text(patch.factoryNumber, e.factoryNumber)
    const changes = diff(before, equipmentView(e))
    if (changes.length)
      record({
        action: 'equipment.update',
        target: { kind: 'equipment', id: e.id, label: e.garageNumber },
        changes,
      })
    return HttpResponse.json(e)
  }),
  http.get(api('/equipment/:id/products'), ({ params }) =>
    HttpResponse.json(
      products.filter((p) => p.equipmentId === params.id && p.lifecycle !== 'written_off'),
    ),
  ),
  http.get(api('/catalog-numbers'), () => HttpResponse.json(catalogNumbers)),
  // Notifications (Д19): what the daily scheduler wrote for this user, in the branch scope.
  http.get(api('/notifications'), ({ request }) =>
    HttpResponse.json(notificationsFor(branchOf(request))),
  ),
  http.post(api('/notifications/read'), async ({ request }) => {
    const { ids } = (await request.json()) as { ids?: string[] }
    markRead(ids, branchOf(request))
    return HttpResponse.json({
      unread: notificationsFor(branchOf(request)).filter((n) => !n.read).length,
    })
  }),
  http.get(api('/me/notification-prefs'), () => HttpResponse.json(prefsView())),
  http.patch(api('/me/notification-prefs'), async ({ request }) => {
    const patch = (await request.json()) as Partial<typeof prefs>
    if (patch.kinds) Object.assign(prefs.kinds, patch.kinds)
    if (typeof patch.email === 'boolean') prefs.email = patch.email
    return HttpResponse.json(prefsView())
  }),

  http.get(api('/reports/:id'), ({ params, request }) => {
    const q = new URL(request.url).searchParams
    const report = buildReport(params.id as Parameters<typeof buildReport>[0], {
      branch: q.get('branch'),
      from: q.get('from'),
      to: q.get('to'),
    })
    return report ? HttpResponse.json(report) : new HttpResponse(null, { status: 404 })
  }),
  http.get(api('/analytics/models'), ({ request }) =>
    HttpResponse.json(modelStats(branchOf(request))),
  ),
  http.get(api('/replacements'), ({ request }) => {
    const branch = branchOf(request)
    if (!branch) return HttpResponse.json(newestFirst(replacements))
    // A replacement carries no branch of its own — it belongs to the branch of
    // the equipment it happened on.
    const ours = new Set<string | null>(
      equipment.filter((e) => e.branchId === branch).map((e) => e.id),
    )
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
    const result = createRequest((await request.json()) as NewRequest)
    return 'error' in result
      ? HttpResponse.json({ message: result.error }, { status: 400 })
      : HttpResponse.json(result, { status: 201 })
  }),

  // Administration: company-wide, not narrowed by branch.
  http.get(api('/admin/users'), () => HttpResponse.json(users)),
  http.post(api('/admin/users'), async ({ request }) => {
    const body = (await request.json()) as Omit<
      (typeof users)[number],
      'id' | 'active' | 'lastLoginAt'
    >
    if (users.some((u) => u.email.toLowerCase() === body.email.toLowerCase()))
      return HttpResponse.json({ message: EMAIL_TAKEN }, { status: 409 })
    const created = { ...body, id: `u-${users.length + 1}`, active: true, lastLoginAt: null }
    users.push(created)
    record({
      action: 'user.create',
      target: { kind: 'user', id: created.id, label: created.name },
      changes: diff({}, userView(created)),
    })
    // The demo shows the cabinet with mail: the invitation goes to the new user's address.
    const answer: UserCreated = {
      user: created,
      delivery: { kind: 'email', sentTo: created.email },
    }
    return HttpResponse.json(answer, { status: 201 })
  }),
  http.patch(api('/admin/users/:id'), async ({ params, request }) => {
    const user = users.find((u) => u.id === params.id)
    if (!user) return new HttpResponse(null, { status: 404 })
    const patch = (await request.json()) as Partial<(typeof users)[number]>
    if (
      patch.email &&
      users.some((u) => u.id !== user.id && u.email.toLowerCase() === patch.email!.toLowerCase())
    )
      return HttpResponse.json({ message: EMAIL_TAKEN }, { status: 409 })
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
    const delivery: PasswordDelivery = { kind: 'email', sentTo: user.email }
    return HttpResponse.json(delivery)
  }),
  // An invitation link (with mail): the demo answers for any token but «expired».
  http.get(api('/auth/invite'), ({ request }) => {
    const token = new URL(request.url).searchParams.get('token')
    return !token || token === 'expired'
      ? HttpResponse.json(
          {
            message:
              'Ссылка недействительна или устарела — попросите администратора прислать новую',
          },
          { status: 404 },
        )
      : HttpResponse.json({
          name: users[1]?.name ?? users[0].name,
          email: users[1]?.email ?? users[0].email,
        })
  }),
  http.post(api('/auth/invite'), async ({ request }) => {
    const { password } = (await request.json()) as { password?: string }
    const problem = passwordProblem(password ?? '')
    return problem
      ? HttpResponse.json({ message: problem }, { status: 400 })
      : HttpResponse.json({}, { status: 200 })
  }),
  // One's own password: the demo checks the new one by the real rule and keeps nothing.
  http.post(api('/auth/password'), async ({ request }) => {
    const { current, next } = (await request.json()) as PasswordChange
    if (!current) return HttpResponse.json({ message: 'Введите текущий пароль' }, { status: 400 })
    const problem =
      passwordProblem(next) ?? (next === current ? 'Новый пароль совпадает с текущим' : null)
    if (problem) return HttpResponse.json({ message: problem }, { status: 400 })
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(api('/admin/branches'), () => HttpResponse.json(branchSummaries())),
  http.get(api('/admin/settings'), () => HttpResponse.json(settings)),
  http.patch(api('/admin/settings'), async ({ request }) => {
    const patch = (await request.json()) as Partial<typeof settings>
    const problem = settingsProblem(patch)
    if (problem) return HttpResponse.json({ message: problem }, { status: 422 })
    const before = settingsView(settings)
    applySettings(patch)
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

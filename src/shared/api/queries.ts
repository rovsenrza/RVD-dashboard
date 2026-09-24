import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Attachment,
  ProductComment,
  ProductLifetime,
  Report,
  ReportId,
  AuditEntry,
  ModelStats,
  BranchSummary,
  CabinetSettings,
  CabinetUser,
  CatalogNumber,
  DashboardSummary,
  Equipment,
  Product,
  ReleaseDocument,
  Replacement,
  ServiceRequest,
} from '@/entities/types'
import { useSession } from '@/app/session'
import { api } from './client'

/**
 * Branch scope travels as a query parameter, the way the BFF will receive it
 * once auth lands — so the mock and the real API narrow data the same way.
 */
const useScope = () => useSession().branch?.id ?? null

const scoped = (path: string, branch: string | null) =>
  branch ? `${path}?branch=${encodeURIComponent(branch)}` : path

export const keys = {
  dashboard: (branch: string | null) => ['dashboard', branch] as const,
  products: (branch: string | null) => ['products', branch] as const,
  product: (id: string) => ['products', id] as const,
  productDocuments: (id: string) => ['products', id, 'documents'] as const,
  productAttachments: (id: string) => ['products', id, 'attachments'] as const,
  productLifetime: (id: string) => ['products', id, 'lifetime'] as const,
  productDocumentation: (id: string) => ['products', id, 'documentation'] as const,
  productComments: (id: string) => ['products', id, 'comments'] as const,
  equipment: (branch: string | null) => ['equipment', branch] as const,
  equipmentItem: (id: string) => ['equipment', id] as const,
  equipmentProducts: (id: string) => ['equipment', id, 'products'] as const,
  catalogNumbers: ['catalog-numbers'] as const,
  replacements: (branch: string | null) => ['replacements', branch] as const,
  productReplacements: (id: string) => ['replacements', 'product', id] as const,
  equipmentReplacements: (id: string) => ['replacements', 'equipment', id] as const,
  requests: (branch: string | null) => ['requests', branch] as const,
  users: ['admin', 'users'] as const,
  branches: ['admin', 'branches'] as const,
  settings: ['admin', 'settings'] as const,
  audit: ['admin', 'audit'] as const,
  modelStats: (branch: string | null) => ['analytics', 'models', branch] as const,
  report: (id: ReportId, branch: string | null, from?: string, to?: string) =>
    ['reports', id, branch, from, to] as const,
}

export const useDashboard = () => {
  const branch = useScope()
  return useQuery({
    queryKey: keys.dashboard(branch),
    queryFn: () => api.get<DashboardSummary>(scoped('/dashboard/summary', branch)),
  })
}

export const useProducts = () => {
  const branch = useScope()
  return useQuery({
    queryKey: keys.products(branch),
    queryFn: () => api.get<Product[]>(scoped('/products', branch)),
  })
}

export const useProduct = (id: string) =>
  useQuery({ queryKey: keys.product(id), queryFn: () => api.get<Product>(`/products/${id}`) })

export const useProductDocuments = (id: string) =>
  useQuery({
    queryKey: keys.productDocuments(id),
    queryFn: () => api.get<ReleaseDocument[]>(`/products/${id}/documents`),
  })

export const useEquipment = () => {
  const branch = useScope()
  return useQuery({
    queryKey: keys.equipment(branch),
    queryFn: () => api.get<Equipment[]>(scoped('/equipment', branch)),
  })
}

export const useEquipmentItem = (id: string) =>
  useQuery({
    queryKey: keys.equipmentItem(id),
    queryFn: () => api.get<Equipment>(`/equipment/${id}`),
  })

export const useEquipmentProducts = (id: string) =>
  useQuery({
    queryKey: keys.equipmentProducts(id),
    queryFn: () => api.get<Product[]>(`/equipment/${id}/products`),
    enabled: !!id,
  })

export const useCatalogNumbers = () =>
  useQuery({
    queryKey: keys.catalogNumbers,
    queryFn: () => api.get<CatalogNumber[]>('/catalog-numbers'),
  })

export const useReplacements = () => {
  const branch = useScope()
  return useQuery({
    queryKey: keys.replacements(branch),
    queryFn: () => api.get<Replacement[]>(scoped('/replacements', branch)),
  })
}

export const useRequests = () => {
  const branch = useScope()
  return useQuery({
    queryKey: keys.requests(branch),
    queryFn: () => api.get<ServiceRequest[]>(scoped('/requests', branch)),
  })
}

/** The installation facts a customer may record; everything derived is recomputed server-side. */
export type InstallationPatch = Partial<
  Pick<Product, 'equipmentId' | 'installPlace' | 'installedAt' | 'clientNumber'>
>

export const useUpdateProduct = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: InstallationPatch) => api.patch<Product>(`/products/${id}`, patch),
    onSuccess: (updated) => {
      qc.setQueryData(keys.product(id), updated)
      // Counts, status bars and the dashboard all derive from installation facts.
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['equipment'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
      qc.invalidateQueries({ queryKey: keys.audit })
    },
  })
}

/** Fields the client sends; 1С (and the mock) assigns number, statuses and date. */
export type NewRequest = Omit<
  ServiceRequest,
  'id' | 'number' | 'status' | 'shipmentStatus' | 'createdAt' | 'attachments'
> & {
  /** Drafts uploaded while the form was open; the server binds them to the request. */
  attachmentIds: string[]
}

export const useCreateRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NewRequest) => api.post<ServiceRequest>('/requests', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] })
      qc.invalidateQueries({ queryKey: keys.audit })
    },
  })
}

// Administration — company-wide, so never narrowed by the branch scope.

export const useUsers = () =>
  useQuery({ queryKey: keys.users, queryFn: () => api.get<CabinetUser[]>('/admin/users') })

/** What the administrator edits; id, activity and last login belong to the server. */
export type UserDraft = Pick<CabinetUser, 'name' | 'email' | 'role' | 'branchIds'>

export const useSaveUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: Partial<UserDraft & Pick<CabinetUser, 'active'>> & { id?: string }) =>
      id
        ? api.patch<CabinetUser>(`/admin/users/${id}`, patch)
        : api.post<CabinetUser>('/admin/users', patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.users })
      qc.invalidateQueries({ queryKey: keys.branches })
      qc.invalidateQueries({ queryKey: keys.audit })
    },
  })
}

export const useResetPassword = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ sentTo: string }>(`/admin/users/${id}/reset-password`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.audit }),
  })
}

export const useBranchSummaries = () =>
  useQuery({ queryKey: keys.branches, queryFn: () => api.get<BranchSummary[]>('/admin/branches') })

export const useSettings = () =>
  useQuery({ queryKey: keys.settings, queryFn: () => api.get<CabinetSettings>('/admin/settings') })

export const useSaveSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<CabinetSettings>) =>
      api.patch<CabinetSettings>('/admin/settings', patch),
    onSuccess: (saved) => {
      qc.setQueryData(keys.settings, saved)
      // The «Внимание» threshold re-derives every hose status and what is built on it.
      for (const key of ['products', 'equipment', 'dashboard', 'analytics'])
        qc.invalidateQueries({ queryKey: [key] })
      qc.invalidateQueries({ queryKey: keys.audit })
    },
  })
}

/** The action log, newest first. Filtering is client-side on mocks; the BFF will page it. */
export const useAudit = () =>
  useQuery({ queryKey: keys.audit, queryFn: () => api.get<AuditEntry[]>('/admin/audit') })

/** Swaps this hose took part in — as the one taken off or the one put on. */
export const useProductReplacements = (id: string) =>
  useQuery({
    queryKey: keys.productReplacements(id),
    queryFn: () => api.get<Replacement[]>(`/products/${id}/replacements`),
  })

export const useEquipmentReplacements = (id: string) =>
  useQuery({
    queryKey: keys.equipmentReplacements(id),
    queryFn: () => api.get<Replacement[]>(`/equipment/${id}/replacements`),
  })

/** What the mechanic records; the server fills numbers, machine, author and the 1С side. */
export interface NewReplacement {
  oldProductId: string
  newProductId: string | null
  date: string
  reason: string
  operatingHours: number | null
  usageUnit: Replacement['usageUnit']
  comment: string | null
  attachmentIds: string[]
}

export const useCreateReplacement = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NewReplacement) => api.post<Replacement>('/replacements', body),
    onSuccess: () => {
      // The old hose is written off, the new one installed: everything built on them moves.
      for (const key of ['replacements', 'products', 'equipment', 'dashboard', 'analytics'])
        qc.invalidateQueries({ queryKey: [key] })
      qc.invalidateQueries({ queryKey: keys.audit })
    },
  })
}

/** Machine models compared (Д15): computed by the server over the whole fleet, never in the browser. */
export const useModelStats = () => {
  const branch = useScope()
  return useQuery({
    queryKey: keys.modelStats(branch),
    queryFn: () => api.get<ModelStats[]>(scoped('/analytics/models', branch)),
  })
}

// Files (Д25) ────────────────────────────────────────────────────────────────

export const useProductAttachments = (id: string) =>
  useQuery({
    queryKey: keys.productAttachments(id),
    queryFn: () => api.get<Attachment[]>(`/products/${id}/attachments`),
  })

/**
 * Uploads one file: straight onto a hose when `productId` is given, otherwise
 * as a draft that the request or replacement being filled in claims on submit.
 */
export const useUploadAttachment = (productId?: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file, file.name)
      if (productId) form.append('productId', productId)
      return api.upload<Attachment>('/attachments', form)
    },
    // Awaited, so the pending tile gives way to the stored file without a gap.
    onSuccess: () =>
      productId &&
      Promise.all([
        qc.invalidateQueries({ queryKey: keys.productAttachments(productId) }),
        qc.invalidateQueries({ queryKey: keys.audit }),
      ]),
  })
}

/** Only a hose's own files can go; those of requests and replacements left with them for 1С. */
export const useDeleteAttachment = (productId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/attachments/${id}`),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: keys.productAttachments(productId) }),
        qc.invalidateQueries({ queryKey: keys.audit }),
      ]),
  })
}

/** The file itself, by the URL the server gave for it — for downloads. */
export const fetchAttachment = (a: Attachment) => api.file(a.url)

// Reports (Д21) ──────────────────────────────────────────────────────────────

/**
 * One report over the whole scope, built by the server. The branch is passed
 * explicitly: the print view opens in its own tab, outside this session's switcher.
 */
export const useReport = (
  id: ReportId | null,
  { branch, from, to }: { branch: string | null; from?: string; to?: string },
) =>
  useQuery({
    queryKey: keys.report(id!, branch, from, to),
    enabled: id !== null,
    queryFn: () => {
      const q = new URLSearchParams()
      if (branch) q.set('branch', branch)
      if (from && to) {
        q.set('from', from)
        q.set('to', to)
      }
      const qs = q.toString()
      return api.get<Report>(`/reports/${id}${qs ? `?${qs}` : ''}`)
    },
  })

// Hose card (Д11) ────────────────────────────────────────────────────────────

/** Phases of service life; null for a hose that was never installed. */
export const useProductLifetime = (id: string) =>
  useQuery({
    queryKey: keys.productLifetime(id),
    queryFn: () => api.get<ProductLifetime | null>(`/products/${id}/lifetime`),
  })

/** Technical documentation from 1С (БСП files) for the hose's catalogue number. */
export const useProductDocumentation = (id: string) =>
  useQuery({
    queryKey: keys.productDocumentation(id),
    queryFn: () => api.get<Attachment[]>(`/products/${id}/documentation`),
  })

export const useProductComments = (id: string) =>
  useQuery({
    queryKey: keys.productComments(id),
    queryFn: () => api.get<ProductComment[]>(`/products/${id}/comments`),
  })

/** Add, edit or delete a note on a hose; every change also lands in the action log. */
export const useCommentMutations = (productId: string) => {
  const qc = useQueryClient()
  const onSuccess = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.productComments(productId) }),
      qc.invalidateQueries({ queryKey: keys.audit }),
    ])
  return {
    add: useMutation({
      mutationFn: (text: string) =>
        api.post<ProductComment>(`/products/${productId}/comments`, { text }),
      onSuccess,
    }),
    edit: useMutation({
      mutationFn: ({ id, text }: { id: string; text: string }) =>
        api.patch<ProductComment>(`/comments/${id}`, { text }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/comments/${id}`),
      onSuccess,
    }),
  }
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
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
  'id' | 'number' | 'status' | 'shipmentStatus' | 'createdAt'
>

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

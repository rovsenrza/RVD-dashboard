import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
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
  requests: (branch: string | null) => ['requests', branch] as const,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  })
}

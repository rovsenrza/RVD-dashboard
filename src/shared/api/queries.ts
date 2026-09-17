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
import { api } from './client'

export const keys = {
  dashboard: ['dashboard'] as const,
  products: ['products'] as const,
  product: (id: string) => ['products', id] as const,
  productDocuments: (id: string) => ['products', id, 'documents'] as const,
  equipment: ['equipment'] as const,
  equipmentItem: (id: string) => ['equipment', id] as const,
  equipmentProducts: (id: string) => ['equipment', id, 'products'] as const,
  catalogNumbers: ['catalog-numbers'] as const,
  replacements: ['replacements'] as const,
  requests: ['requests'] as const,
}

export const useDashboard = () =>
  useQuery({
    queryKey: keys.dashboard,
    queryFn: () => api.get<DashboardSummary>('/dashboard/summary'),
  })

export const useProducts = () =>
  useQuery({ queryKey: keys.products, queryFn: () => api.get<Product[]>('/products') })

export const useProduct = (id: string) =>
  useQuery({ queryKey: keys.product(id), queryFn: () => api.get<Product>(`/products/${id}`) })

export const useProductDocuments = (id: string) =>
  useQuery({
    queryKey: keys.productDocuments(id),
    queryFn: () => api.get<ReleaseDocument[]>(`/products/${id}/documents`),
  })

export const useEquipment = () =>
  useQuery({ queryKey: keys.equipment, queryFn: () => api.get<Equipment[]>('/equipment') })

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

export const useReplacements = () =>
  useQuery({ queryKey: keys.replacements, queryFn: () => api.get<Replacement[]>('/replacements') })

export const useRequests = () =>
  useQuery({ queryKey: keys.requests, queryFn: () => api.get<ServiceRequest[]>('/requests') })

/** Fields the client sends; 1С (and the mock) assigns number, statuses and date. */
export type NewRequest = Omit<
  ServiceRequest,
  'id' | 'number' | 'status' | 'shipmentStatus' | 'createdAt'
>

export const useCreateRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NewRequest) => api.post<ServiceRequest>('/requests', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.requests }),
  })
}

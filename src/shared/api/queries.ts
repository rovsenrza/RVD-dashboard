import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  DashboardSummary,
  Equipment,
  Product,
  Replacement,
  ServiceRequest,
} from '@/entities/types'
import { api } from './client'

export const keys = {
  dashboard: ['dashboard'] as const,
  products: ['products'] as const,
  product: (id: string) => ['products', id] as const,
  equipment: ['equipment'] as const,
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

export const useEquipment = () =>
  useQuery({ queryKey: keys.equipment, queryFn: () => api.get<Equipment[]>('/equipment') })

export const useReplacements = () =>
  useQuery({ queryKey: keys.replacements, queryFn: () => api.get<Replacement[]>('/replacements') })

export const useRequests = () =>
  useQuery({ queryKey: keys.requests, queryFn: () => api.get<ServiceRequest[]>('/requests') })

export const useCreateRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<ServiceRequest, 'id' | 'status' | 'createdAt'>) =>
      api.post<ServiceRequest>('/requests', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.requests }),
  })
}

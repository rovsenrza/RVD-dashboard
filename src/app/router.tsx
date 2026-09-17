import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './layout/Layout'
import { RequireAuth } from './RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { ProductPage } from '@/features/products/ProductPage'
import { EquipmentPage } from '@/features/equipment/EquipmentPage'
import { EquipmentDetailPage } from '@/features/equipment/EquipmentDetailPage'
import { ReplacementsPage } from '@/features/replacements/ReplacementsPage'
import { RequestsPage } from '@/features/requests/RequestsPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/:id', element: <ProductPage /> },
      { path: 'equipment', element: <EquipmentPage /> },
      { path: 'equipment/:id', element: <EquipmentDetailPage /> },
      { path: 'replacements', element: <ReplacementsPage /> },
      { path: 'requests', element: <RequestsPage /> },
    ],
  },
])

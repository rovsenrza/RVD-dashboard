import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './layout/Layout'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ProductsPage } from '@/features/products/ProductsPage'
import { ProductPage } from '@/features/products/ProductPage'
import { EquipmentPage } from '@/features/equipment/EquipmentPage'
import { ReplacementsPage } from '@/features/replacements/ReplacementsPage'
import { RequestsPage } from '@/features/requests/RequestsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/:id', element: <ProductPage /> },
      { path: 'equipment', element: <EquipmentPage /> },
      { path: 'replacements', element: <ReplacementsPage /> },
      { path: 'requests', element: <RequestsPage /> },
    ],
  },
])

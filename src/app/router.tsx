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
import { AdminPage } from '@/features/admin/AdminPage'
import { ComparePage } from '@/features/compare/ComparePage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { ReportPrintPage } from '@/features/reports/ReportPrintPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Paper: outside the app shell, so nothing but the report reaches the printer.
  {
    path: '/reports/print',
    element: (
      <RequireAuth>
        <ReportPrintPage />
      </RequireAuth>
    ),
  },
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
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'compare', element: <ComparePage /> },
      { path: 'admin', element: <AdminPage /> },
      // Component catalogue; `import.meta.env.DEV` is false in production builds,
      // so the route and its chunk are dropped there entirely.
      ...(import.meta.env.DEV
        ? [
            {
              path: 'dev/ui',
              lazy: async () => ({ Component: (await import('@/features/dev/UiPage')).UiPage }),
            },
          ]
        : []),
    ],
  },
])

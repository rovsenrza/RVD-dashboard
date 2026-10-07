import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './layout/Layout'
import { RequireAuth } from './RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'

/**
 * Each screen is its own chunk, loaded with its route: the sign-in page and
 * the first screen do not wait for charts, scanners and spreadsheets they
 * never show. The router keeps the current screen up until the next has loaded.
 */
const page =
  <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  async () => ({ Component: (await load())[name] })

// While the first screen's chunk loads: nothing, it is there in a moment.
const blank = <></>

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // An invitation or reset link from a letter (with mail): outside the shell, like sign-in.
  {
    path: '/invite',
    hydrateFallbackElement: blank,
    lazy: page(() => import('@/features/auth/InvitePage'), 'InvitePage'),
  },
  // Paper: outside the app shell, so nothing but the report reaches the printer.
  {
    path: '/reports/print',
    element: <RequireAuth />,
    hydrateFallbackElement: blank,
    children: [
      {
        index: true,
        lazy: page(() => import('@/features/reports/ReportPrintPage'), 'ReportPrintPage'),
      },
    ],
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    hydrateFallbackElement: blank,
    children: [
      {
        index: true,
        lazy: page(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage'),
      },
      {
        path: 'products',
        lazy: page(() => import('@/features/products/ProductsPage'), 'ProductsPage'),
      },
      {
        path: 'products/:id',
        lazy: page(() => import('@/features/products/ProductPage'), 'ProductPage'),
      },
      {
        path: 'equipment',
        lazy: page(() => import('@/features/equipment/EquipmentPage'), 'EquipmentPage'),
      },
      {
        path: 'equipment/:id',
        lazy: page(() => import('@/features/equipment/EquipmentDetailPage'), 'EquipmentDetailPage'),
      },
      {
        path: 'replacements',
        lazy: page(() => import('@/features/replacements/ReplacementsPage'), 'ReplacementsPage'),
      },
      {
        path: 'requests',
        lazy: page(() => import('@/features/requests/RequestsPage'), 'RequestsPage'),
      },
      {
        path: 'notifications',
        lazy: page(() => import('@/features/notifications/NotificationsPage'), 'NotificationsPage'),
      },
      {
        path: 'reports',
        lazy: page(() => import('@/features/reports/ReportsPage'), 'ReportsPage'),
      },
      {
        path: 'compare',
        lazy: page(() => import('@/features/compare/ComparePage'), 'ComparePage'),
      },
      { path: 'admin', lazy: page(() => import('@/features/admin/AdminPage'), 'AdminPage') },
      // Component catalogue; `import.meta.env.DEV` is false in production builds,
      // so the route and its chunk are dropped there entirely.
      ...(import.meta.env.DEV
        ? [{ path: 'dev/ui', lazy: page(() => import('@/features/dev/UiPage'), 'UiPage') }]
        : []),
    ],
  },
])

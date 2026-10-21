import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Providers } from './app/providers'
import { router } from './app/router'
import './index.css'

async function enableMocking() {
  // The hosted demo should remain usable even if Vercel build variables are
  // missing. Set VITE_USE_MOCKS=false explicitly when switching to a real API.
  if (import.meta.env.VITE_USE_MOCKS === 'false') return
  const { worker } = await import('./shared/mocks/browser')
  return worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  )
})

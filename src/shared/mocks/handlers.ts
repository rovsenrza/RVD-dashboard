import { http, HttpResponse } from 'msw'
import { dashboardSummary, equipment, products, replacements, requests } from './data'

const api = (path: string) => `*/api${path}`

export const handlers = [
  http.get(api('/dashboard/summary'), () => HttpResponse.json(dashboardSummary())),
  http.get(api('/products'), () => HttpResponse.json(products)),
  http.get(api('/products/:id'), ({ params }) => {
    const p = products.find((x) => x.id === params.id)
    return p ? HttpResponse.json(p) : new HttpResponse(null, { status: 404 })
  }),
  http.get(api('/equipment'), () => HttpResponse.json(equipment)),
  http.get(api('/replacements'), () => HttpResponse.json(replacements)),
  http.get(api('/requests'), () => HttpResponse.json(requests)),
  http.post(api('/requests'), async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const created = {
      id: `req-${requests.length + 1}`,
      status: 'new',
      createdAt: new Date().toISOString().slice(0, 10),
      ...body,
    }
    requests.unshift(created as (typeof requests)[number])
    return HttpResponse.json(created, { status: 201 })
  }),
]

import { useSearchParams } from 'react-router-dom'
import {
  useProductComments,
  useProductDocuments,
  useProductReplacements,
} from '@/shared/api/queries'
import { Card, Tabs } from '@/shared/ui'
import { ProductReplacements } from '@/features/replacements/components/ProductReplacements'
import { ProductComments } from './ProductComments'
import { ProductLifecycle } from './ProductLifecycle'

const TABS = ['lifecycle', 'replacements', 'comments'] as const
type Tab = (typeof TABS)[number]

/**
 * What happened to the hose, in one sheet: the 1С history, the swaps it took
 * part in, the specialists' notes. The tab rides in the URL (`?tab=comments`),
 * so a notification or a colleague's link opens the right one.
 */
export function ProductActivity({ productId }: { productId: string }) {
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.find((t) => t === params.get('tab')) ?? 'lifecycle'
  const docs = useProductDocuments(productId)
  const swaps = useProductReplacements(productId)
  const comments = useProductComments(productId)

  const choose = (next: Tab) => {
    if (next === 'lifecycle') params.delete('tab')
    else params.set('tab', next)
    setParams(params, { replace: true })
  }

  return (
    <Card padded={false}>
      <Tabs
        items={[
          { key: 'lifecycle', label: 'История ЖЦ', count: docs.data?.length },
          { key: 'replacements', label: 'Замены', count: swaps.data?.length },
          { key: 'comments', label: 'Комментарии', count: comments.data?.length },
        ]}
        value={tab}
        onChange={choose}
        className="overflow-x-auto px-5 pt-4"
      />
      <div role="tabpanel" className="p-5">
        {tab === 'lifecycle' && <ProductLifecycle productId={productId} />}
        {tab === 'replacements' && <ProductReplacements productId={productId} />}
        {tab === 'comments' && <ProductComments productId={productId} />}
      </div>
    </Card>
  )
}

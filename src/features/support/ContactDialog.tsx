import { useMemo, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import { SUPPORT_TOPIC_LABEL } from '@/entities/support'
import type { Product, SupportTopic } from '@/entities/types'
import { ApiError } from '@/shared/api/client'
import { useEquipment, useProducts, useSendSupportMessage } from '@/shared/api/queries'
import { formatDate } from '@/shared/lib/utils'
import { Button, DatePicker, Dialog, Field, Select, Textarea, useToast } from '@/shared/ui'
import { ProductPicker, ProductRow } from '@/features/products/components/ProductPicker'
import { productLabel } from '@/features/products/productLookup'

/** What the dialog opens with: a hose card asks about its own hose and date. */
export interface ContactPreset {
  topic?: SupportTopic
  product?: Product
}

const TOPICS = Object.entries(SUPPORT_TOPIC_LABEL).map(([value, label]) => ({ value, label }))

const PLACEHOLDER: Record<SupportTopic, string> = {
  install_date: 'Например: рукав поставили после ремонта техники',
  product: 'Что случилось с изделием или что нужно узнать',
  request: 'Номер заявки и вопрос по ней',
  other: 'Ваш вопрос',
}

/**
 * «Связаться со специалистом»: a message to the supplier's specialist. The
 * customer cannot change an installation date (the supplier keeps it in 1С),
 * so a wrong date is corrected here — the hose and the right date travel with
 * the message.
 */
export function ContactDialog({
  preset,
  onClose,
}: {
  preset?: ContactPreset
  onClose: () => void
}) {
  const toast = useToast()
  const send = useSendSupportMessage()
  const products = useProducts()
  const equipment = useEquipment()

  const [topic, setTopic] = useState<SupportTopic | ''>(preset?.topic ?? '')
  const [product, setProduct] = useState<Product | undefined>(preset?.product)
  const [miss, setMiss] = useState<string>()
  const [date, setDate] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()

  const locked = !!preset?.product
  const aboutHose = topic === 'install_date' || topic === 'product'
  const labelOf = (p: Product) => productLabel(p, equipment.data)
  // A date can only be wrong on a hose that is still in service.
  const candidates = useMemo(
    () =>
      (products.data ?? []).filter(
        (p) => topic !== 'install_date' || p.lifecycle !== 'written_off',
      ),
    [products.data, topic],
  )

  const current = product?.installedAt ?? product?.shippedAt ?? null
  const ready =
    topic !== '' &&
    (topic === 'install_date' ? !!product && !!date : text.trim() !== '') &&
    !send.isPending

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    setError(undefined)
    send.mutate(
      {
        topic,
        productId: aboutHose ? (product?.id ?? null) : null,
        installedAt: topic === 'install_date' ? date : null,
        text: text.trim(),
      },
      {
        onSuccess: () => {
          toast('Сообщение отправлено специалисту')
          onClose()
        },
        onError: (err) =>
          err instanceof ApiError && err.status === 400
            ? setError(err.message)
            : toast('Не удалось отправить, попробуйте ещё раз', 'error'),
      },
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Связаться со специалистом"
      description="Сообщение получит специалист поставщика вместе с вашим именем и компанией."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Отмена
          </Button>
          <Button size="sm" type="submit" form="contact-form" disabled={!ready}>
            {send.isPending ? 'Отправляем…' : 'Отправить'}
          </Button>
        </>
      }
    >
      <form id="contact-form" onSubmit={submit} className="grid gap-4">
        <Field label="Тема">
          {(id) => (
            <Select
              id={id}
              required
              value={topic}
              placeholder="Выберите тему"
              onChange={(e) => {
                setTopic(e.target.value as SupportTopic)
                setError(undefined)
              }}
              options={TOPICS}
            />
          )}
        </Field>

        {aboutHose &&
          (product ? (
            <div>
              <span className="mb-1.5 block text-ui font-medium">Изделие</span>
              <ProductRow
                label={labelOf(product)}
                removeLabel="Выбрать другое изделие"
                onRemove={
                  locked
                    ? undefined
                    : () => {
                        setProduct(undefined)
                        setDate('')
                      }
                }
              />
            </div>
          ) : (
            <Field
              label={topic === 'install_date' ? 'Изделие' : 'Изделие, если вопрос о нём'}
              hint="EHS, ваш номер или выберите из подсказки"
              error={miss}
            >
              {(id) => (
                <ProductPicker
                  id={id}
                  candidates={candidates}
                  labelOf={labelOf}
                  required={topic === 'install_date'}
                  invalid={!!miss}
                  placeholder="Например: 48703"
                  onPick={setProduct}
                  onMiss={setMiss}
                />
              )}
            </Field>
          ))}

        {topic === 'install_date' && product && (
          <Field
            label="Верная дата установки"
            hint={
              current
                ? `Сейчас: ${formatDate(current)}${product.installedAt ? '' : ' — по дате отгрузки'}`
                : undefined
            }
          >
            {(id) => (
              <DatePicker
                id={id}
                required
                value={date}
                min={product.shippedAt ?? undefined}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={setDate}
              />
            )}
          </Field>
        )}

        {topic !== '' && (
          <Field label={topic === 'install_date' ? 'Комментарий' : 'Сообщение'}>
            {(id) => (
              <Textarea
                id={id}
                required={topic !== 'install_date'}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={PLACEHOLDER[topic]}
              />
            )}
          </Field>
        )}

        {error && (
          <p role="alert" className="text-label text-status-replace-ink">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}

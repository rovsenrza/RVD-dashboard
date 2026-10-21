import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { MessageSquareText, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { ProductComment } from '@/entities/types'
import { COMMENT_MAX } from '@/entities/comment'
import { ROLE_LABEL } from '@/entities/user'
import { initials, useSession } from '@/app/session'
import { ApiError } from '@/shared/api/client'
import { useCommentMutations, useProductComments } from '@/shared/api/queries'
import { formatDateTime } from '@/shared/lib/utils'
import { Button, EmptyState, Menu, QueryState, Skeleton, Textarea, useToast } from '@/shared/ui'

/** Ctrl/⌘+Enter sends, as in every messenger the mechanics already use. */
const sendKey = (e: KeyboardEvent, send: () => void) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    send()
  }
}

/**
 * «Комментарии» (Д11): specialists' notes on this hose — inspections,
 * agreements, what to check next time. Kept in the cabinet, not in 1С.
 * Authors edit their own; an administrator may remove any.
 */
export function ProductComments({ productId }: { productId: string }) {
  const { user } = useSession()
  const query = useProductComments(productId)
  const { add, edit, remove } = useCommentMutations(productId)
  const toast = useToast()
  const [draft, setDraft] = useState('')

  const fail = (err: unknown) =>
    toast(
      err instanceof ApiError && err.status < 500 && err.status !== 404
        ? err.message
        : 'Не удалось сохранить комментарий, попробуйте ещё раз',
      'error',
    )

  // Tell the person, then let the row stay open with their text.
  const rethrow = (err: unknown) => {
    fail(err)
    throw err
  }

  const send = (e?: FormEvent) => {
    e?.preventDefault()
    if (!draft.trim() || add.isPending) return
    add.mutate(draft, { onSuccess: () => setDraft(''), onError: fail })
  }

  return (
    <div>
      <form onSubmit={send}>
        <label htmlFor={`comment-${productId}`} className="sr-only">
          Новый комментарий
        </label>
        <Textarea
          id={`comment-${productId}`}
          value={draft}
          maxLength={COMMENT_MAX}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => sendKey(e, send)}
          placeholder="Что заметили, о чём договорились, что проверить в следующий раз"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-label text-ink-muted">
            Видят все пользователи кабинета вашей компании
            {draft.length > COMMENT_MAX - 200 && ` · осталось ${COMMENT_MAX - draft.length} зн.`}
          </p>
          <Button size="sm" type="submit" disabled={!draft.trim() || add.isPending}>
            {add.isPending ? 'Сохраняем…' : 'Добавить'}
          </Button>
        </div>
      </form>

      <QueryState
        query={query}
        skeleton={
          <div className="mt-6 grid gap-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        }
      >
        {(list) =>
          list.length ? (
            <ol className="mt-5 divide-y divide-line">
              {list.map((c) => (
                <Comment
                  key={c.id}
                  comment={c}
                  own={c.author.id === user.id}
                  canDelete={c.author.id === user.id || user.role === 'admin'}
                  onSave={(text) => edit.mutateAsync({ id: c.id, text }).catch(rethrow)}
                  onDelete={() => remove.mutateAsync(c.id).catch(rethrow)}
                />
              ))}
            </ol>
          ) : (
            <EmptyState
              inset
              icon={MessageSquareText}
              title="Комментариев пока нет"
              description="Заметки механиков и инженеров об этом рукаве: осмотры, договорённости, что проверить."
            />
          )
        }
      </QueryState>
    </div>
  )
}

function Comment({
  comment: c,
  own,
  canDelete,
  onSave,
  onDelete,
}: {
  comment: ProductComment
  own: boolean
  canDelete: boolean
  onSave: (text: string) => Promise<unknown>
  onDelete: () => Promise<unknown>
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>, done: () => void) => {
    setBusy(true)
    try {
      await action()
      done()
    } catch {
      // Already reported by a toast; keep the text where it was.
    } finally {
      setBusy(false)
    }
  }
  const save = () =>
    editing?.trim() && !busy
      ? run(
          () => onSave(editing),
          () => setEditing(null),
        )
      : undefined

  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-3 py-4 first:pt-0 last:pb-0">
      <span
        className="grid size-8 place-items-center rounded-full bg-field text-caption font-medium text-ink-secondary"
        aria-hidden
      >
        {initials(c.author.name)}
      </span>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-ui">
            <span className="font-medium">{c.author.name}</span>
            <span className="text-ink-muted"> · {ROLE_LABEL[c.author.role]}</span>
            <span className="block text-label text-ink-muted tabular">
              {formatDateTime(c.createdAt)}
              {c.editedAt && ' · изменён'}
            </span>
          </p>
          {(own || canDelete) && editing === null && !confirming && (
            <Menu
              trigger={() => (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  icon={MoreHorizontal}
                  aria-label="Действия с комментарием"
                  className="-mt-1 -mr-1.5"
                />
              )}
              items={[
                ...(own
                  ? [{ label: 'Изменить', icon: Pencil, onSelect: () => setEditing(c.text) }]
                  : []),
                {
                  label: 'Удалить',
                  icon: Trash2,
                  danger: true,
                  onSelect: () => setConfirming(true),
                },
              ]}
            />
          )}
        </div>

        {editing !== null ? (
          <div className="mt-2">
            <Textarea
              aria-label="Текст комментария"
              value={editing}
              maxLength={COMMENT_MAX}
              autoFocus
              onChange={(e) => setEditing(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditing(null)
                sendKey(e, save)
              }}
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
                Отмена
              </Button>
              <Button size="sm" onClick={save} disabled={!editing.trim() || busy}>
                {busy ? 'Сохраняем…' : 'Сохранить'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 text-sm break-words whitespace-pre-wrap">{c.text}</p>
        )}

        {confirming && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-field py-2 pr-2 pl-3">
            <span className="mr-auto text-ui">Удалить комментарий? Его перестанут видеть все.</span>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => run(onDelete, () => setConfirming(false))}
            >
              {busy ? 'Удаляем…' : 'Удалить'}
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}

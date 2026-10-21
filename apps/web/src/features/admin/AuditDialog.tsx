import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { AuditEntry } from '@/entities/types'
import { AUDIT_ACTION_LABEL } from '@/entities/audit'
import { formatDateTime } from '@/shared/lib/utils'
import { Dialog, EmptyValue } from '@/shared/ui'

/** One log line in full: the object, and each changed field as it was and as it became. */
export function AuditDialog({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const productLink = entry.target.kind === 'product' && entry.target.id
  return (
    <Dialog
      open
      onClose={onClose}
      title={AUDIT_ACTION_LABEL[entry.action]}
      description={`${entry.actor.name} · ${formatDateTime(entry.at)}`}
    >
      <div className="grid gap-4">
        <div className="text-ui">
          <span className="text-ink-muted">Объект: </span>
          {productLink ? (
            <Link
              to={`/products/${entry.target.id}`}
              onClick={onClose}
              className="font-medium text-brand-deep hover:underline"
            >
              {entry.target.label}
            </Link>
          ) : (
            <span className="font-medium">{entry.target.label}</span>
          )}
        </div>

        {entry.changes.length ? (
          <div className="grid grid-cols-[auto_1fr_auto_1fr] items-baseline gap-x-3 gap-y-2 text-ui">
            <div className="text-caption font-medium tracking-wide text-ink-muted uppercase">
              Поле
            </div>
            <div className="text-caption font-medium tracking-wide text-ink-muted uppercase">
              Было
            </div>
            <div />
            <div className="text-caption font-medium tracking-wide text-ink-muted uppercase">
              Стало
            </div>
            {entry.changes.map((c) => (
              <Fragment key={c.field}>
                <div className="text-ink-muted">{c.field}</div>
                <div className="min-w-0 text-ink-secondary tabular">
                  {c.before ?? <EmptyValue />}
                </div>
                <ArrowRight size={13} strokeWidth={1.75} className="text-ink-faint" aria-hidden />
                <div className="min-w-0 font-medium tabular">{c.after ?? <EmptyValue />}</div>
              </Fragment>
            ))}
          </div>
        ) : (
          <p className="text-ui text-ink-muted">Действие без изменения полей.</p>
        )}
      </div>
    </Dialog>
  )
}

import type { AuditAction, AuditChange, AuditEntry, AuditTargetKind } from '@rvd/contracts'
import type { Identity } from '../auth/service.ts'
import type { Db } from '../db/pool.ts'

/** What a route says it did; who and when come from the request and the clock. */
export type AuditNote = Pick<AuditEntry, 'action' | 'target' | 'changes'>

/** One line in the company's action log, by the signed-in person. */
export async function recordAudit(db: Db, actor: Identity, note: AuditNote): Promise<void> {
  await db.query(
    `insert into audit_log
       (company_id, actor_id, actor_name, action, target_kind, target_id, target_label, changes)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      actor.companyId,
      actor.userId,
      actor.name,
      note.action,
      note.target.kind,
      note.target.id,
      note.target.label,
      JSON.stringify(note.changes),
    ],
  )
}

interface Row {
  id: string
  at: Date
  actor_id: string
  actor_name: string
  action: AuditAction
  target_kind: AuditTargetKind
  target_id: string | null
  target_label: string
  changes: AuditChange[]
}

/** The company's log, newest first; the tab filters it in the browser. */
export async function listAudit(db: Db, companyId: string): Promise<AuditEntry[]> {
  const { rows } = await db.query<Row>(
    `select id::text, at, actor_id, actor_name, action, target_kind, target_id, target_label, changes
     from audit_log where company_id = $1 order by at desc, id desc`,
    [companyId],
  )
  return rows.map((r) => ({
    id: r.id,
    at: r.at.toISOString(),
    actor: { id: r.actor_id, name: r.actor_name },
    action: r.action,
    target: { kind: r.target_kind, id: r.target_id, label: r.target_label },
    changes: r.changes,
  }))
}

/** «EHS 000123» for each hose a request names, in its order, for the log. */
export async function hoseLabels(db: Db, ids: (string | null)[]): Promise<string[]> {
  const wanted = ids.filter((id): id is string => id !== null)
  if (!wanted.length) return []
  const { rows } = await db.query<{ id: string; serial_number: string }>(
    'select id, serial_number from products where id = any($1)',
    [wanted],
  )
  const serial = new Map(rows.map((r) => [r.id, r.serial_number]))
  return wanted.flatMap((id) => (serial.has(id) ? [`EHS ${serial.get(id)}`] : []))
}

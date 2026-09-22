import { useMemo, useState } from 'react'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { UserPlus } from 'lucide-react'
import type { CabinetUser } from '@/entities/types'
import { ROLE_LABEL } from '@/entities/user'
import { useSession } from '@/app/session'
import { useUsers } from '@/shared/api/queries'
import { formatDate } from '@/shared/lib/utils'
import {
  Badge,
  Button,
  DataTable,
  QueryState,
  SearchInput,
  TableSkeleton,
  valueOr,
} from '@/shared/ui'
import { UserDialog } from './UserDialog'

const col = createColumnHelper<CabinetUser>()

export function UsersTab() {
  const users = useUsers()
  const { branches, user: me } = useSession()
  const [q, setQ] = useState('')
  // undefined — closed, null — a new user, otherwise the one being edited.
  const [editing, setEditing] = useState<CabinetUser | null | undefined>(undefined)

  const columns = useMemo(() => {
    const branchName = new Map(branches.map((b) => [b.id, b.name]))
    return [
      col.accessor('name', {
        header: 'Пользователь',
        cell: (c) => (
          <span className="font-medium">
            {c.getValue()}
            {c.row.original.id === me.id && (
              <span className="ml-1.5 font-normal text-ink-muted">· вы</span>
            )}
          </span>
        ),
      }),
      col.accessor('email', {
        header: 'Почта',
        cell: (c) => <span className="text-ink-secondary">{c.getValue()}</span>,
      }),
      col.accessor((u) => ROLE_LABEL[u.role], { id: 'role', header: 'Роль' }),
      col.accessor(
        (u) =>
          u.branchIds.length
            ? u.branchIds.map((id) => branchName.get(id) ?? id).join(', ')
            : 'Все филиалы',
        { id: 'scope', header: 'Филиалы' },
      ),
      col.accessor('active', {
        header: 'Доступ',
        meta: { mobile: 'aside' },
        cell: (c) =>
          c.getValue() ? (
            <Badge tone="ok" dot>
              Активен
            </Badge>
          ) : (
            <Badge tone="none" dot>
              Отключён
            </Badge>
          ),
      }),
      col.accessor('lastLoginAt', {
        header: 'Последний вход',
        cell: (c) => valueOr(formatDate(c.getValue())),
      }),
    ] as ColumnDef<CabinetUser, unknown>[]
  }, [branches, me.id])

  return (
    <>
      <QueryState query={users} skeleton={<TableSkeleton />}>
        {(list) => (
          <DataTable
            data={list}
            columns={columns}
            globalFilter={q}
            onRowClick={setEditing}
            stickyFirstColumn
            toolbar={
              <Button size="sm" icon={UserPlus} onClick={() => setEditing(null)}>
                Добавить пользователя
              </Button>
            }
            search={
              <SearchInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Имя, почта, роль"
                aria-label="Поиск пользователей"
              />
            }
          />
        )}
      </QueryState>
      {editing !== undefined && <UserDialog user={editing} onClose={() => setEditing(undefined)} />}
    </>
  )
}

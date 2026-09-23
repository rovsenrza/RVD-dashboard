import { useSearchParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useSession } from '@/app/session'
import { Card, EmptyState, PageHeader, Tabs } from '@/shared/ui'
import { AuditTab } from './AuditTab'
import { BranchesTab } from './BranchesTab'
import { ImportTab } from './import/ImportTab'
import { SettingsTab } from './SettingsTab'
import { UsersTab } from './UsersTab'

type Tab = 'users' | 'branches' | 'settings' | 'import' | 'audit'
const TABS: { key: Tab; label: string }[] = [
  { key: 'users', label: 'Пользователи' },
  { key: 'branches', label: 'Филиалы' },
  { key: 'settings', label: 'Настройки' },
  { key: 'import', label: 'Импорт' },
  { key: 'audit', label: 'Журнал' },
]

export function AdminPage() {
  const { user } = useSession()
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.key === params.get('tab'))?.key ?? 'users'

  return (
    <>
      <PageHeader
        title="Администрирование"
        description="Кто работает в кабинете, филиалы компании, общие настройки и журнал действий"
      />
      {user.role !== 'admin' ? (
        <Card>
          <EmptyState
            inset
            icon={ShieldCheck}
            title="Раздел для администратора"
            description="Пользователей и настройки кабинета ведёт администратор компании. В демо роль меняется в меню пользователя."
          />
        </Card>
      ) : (
        <>
          <Tabs
            className="mb-5"
            items={TABS}
            value={tab}
            onChange={(next) => setParams(next === 'users' ? {} : { tab: next }, { replace: true })}
          />
          {tab === 'users' && <UsersTab />}
          {tab === 'branches' && <BranchesTab />}
          {tab === 'settings' && <SettingsTab />}
          {tab === 'import' && <ImportTab />}
          {tab === 'audit' && <AuditTab />}
        </>
      )}
    </>
  )
}

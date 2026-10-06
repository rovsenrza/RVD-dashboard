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
const LIVE_TABS = new Set<Tab>(['users', 'settings', 'audit'])

export function AdminPage() {
  const { user, demo } = useSession()
  const [params, setParams] = useSearchParams()
  // A live cabinet keeps its users, settings and journal on the server; branches and import
  // still run on the demo's data there, so they join as the server takes each over.
  const tabs = demo ? TABS : TABS.filter((t) => LIVE_TABS.has(t.key))
  const tab = tabs.find((t) => t.key === params.get('tab'))?.key ?? 'users'

  return (
    <>
      <PageHeader
        title="Администрирование"
        description={
          demo
            ? 'Кто работает в кабинете, филиалы компании, общие настройки и журнал действий'
            : 'Кто работает в кабинете, общие настройки и журнал действий'
        }
      />
      {user.role !== 'admin' ? (
        <Card>
          <EmptyState
            inset
            icon={ShieldCheck}
            title="Раздел для администратора"
            description={`Пользователей и настройки кабинета ведёт администратор компании.${
              demo ? ' В демо роль меняется в меню пользователя.' : ''
            }`}
          />
        </Card>
      ) : (
        <>
          {tabs.length > 1 && (
            <Tabs
              className="mb-5"
              items={tabs}
              value={tab}
              onChange={(next) =>
                setParams(next === 'users' ? {} : { tab: next }, { replace: true })
              }
            />
          )}
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

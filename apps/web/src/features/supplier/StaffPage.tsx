import { PageHeader } from '@/shared/ui'
import { UsersTab } from '@/features/admin/UsersTab'

/**
 * The supplier's own staff (customer, 2026-10-22): the people of this section, with
 * addresses of the supplier's domains. Each sets a password through «Забыли пароль?».
 */
export function StaffPage() {
  return (
    <>
      <PageHeader
        title="Сотрудники поставщика"
        description="Кто работает в этом разделе. Почта — только @vgiz.ru или @snabsv.ru; пароль сотрудник задаёт сам через «Забыли пароль?»"
      />
      <UsersTab />
    </>
  )
}

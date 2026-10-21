import type { OnecClient, SupplierCompany, SupplierMailbox } from '@/entities/types'

/*
 * The supplier's section in the demo (customer, 2026-10-22): a few client companies made of
 * 1С clients, more clients to register, and the supplier branches' mailboxes.
 */

const FILIALS = [
  { id: 'f-kem', name: 'Кемеровский филиал' },
  { id: 'f-nkz', name: 'Новокузнецкий филиал' },
  { id: 'f-krs', name: 'Красноярский филиал' },
]

export const onecClients: OnecClient[] = [
  {
    id: 'k-1',
    name: 'ООО «Рога и копыта»',
    inn: '4205123456',
    filialId: 'f-kem',
    companyId: 'c-1',
  },
  {
    id: 'k-2',
    name: 'ООО «Рога и копыта», Северный участок',
    inn: '4205123456',
    filialId: 'f-kem',
    companyId: 'c-1',
  },
  {
    id: 'k-3',
    name: 'АО «Разрез Восточный»',
    inn: '4214000111',
    filialId: 'f-nkz',
    companyId: 'c-2',
  },
  { id: 'k-4', name: 'ООО «СибАвтоТранс»', inn: '2465009876', filialId: 'f-krs', companyId: 'c-3' },
  { id: 'k-5', name: 'ООО «Карьер-Сервис»', inn: '4217055501', filialId: 'f-nkz', companyId: null },
  { id: 'k-6', name: 'ИП Смирнов А. В.', inn: '420500777123', filialId: null, companyId: null },
  {
    id: 'k-7',
    name: 'ООО «Шахта Глубокая»',
    inn: '4211002233',
    filialId: 'f-kem',
    companyId: null,
  },
]

export const supplierCompanies: SupplierCompany[] = [
  {
    id: 'c-1',
    name: 'ООО «Рога и копыта»',
    active: true,
    branches: [
      { id: 'k-1', name: 'Главный филиал' },
      { id: 'k-2', name: 'Северный филиал' },
    ],
    users: [
      { id: 'u-1', name: 'Иванов Иван', email: 'ivanov@roga.ru', role: 'admin', active: true },
      { id: 'u-2', name: 'Петров Пётр', email: 'petrov@roga.ru', role: 'engineer', active: true },
      {
        id: 'u-3',
        name: 'Сидоров Семён',
        email: 'sidorov@roga.ru',
        role: 'mechanic',
        active: false,
      },
    ],
  },
  {
    id: 'c-2',
    name: 'АО «Разрез Восточный»',
    active: true,
    branches: [{ id: 'k-3', name: 'АО «Разрез Восточный»' }],
    users: [
      {
        id: 'u-4',
        name: 'Кузнецова Анна',
        email: 'kuznetsova@vostok.ru',
        role: 'admin',
        active: true,
      },
    ],
  },
  {
    id: 'c-3',
    name: 'ООО «СибАвтоТранс»',
    active: false,
    branches: [{ id: 'k-4', name: 'ООО «СибАвтоТранс»' }],
    users: [{ id: 'u-5', name: 'Орлов Олег', email: 'orlov@sat.ru', role: 'admin', active: true }],
  },
]

export const mailboxes: SupplierMailbox[] = [
  {
    filialId: '',
    name: 'Общий ящик',
    requestsEmail: 'zakaz@vgiz.ru',
    supportEmail: 'help@vgiz.ru',
  },
  ...FILIALS.map((f, i) => ({
    filialId: f.id,
    name: f.name,
    requestsEmail: i === 0 ? 'kem@vgiz.ru' : null,
    supportEmail: null,
  })),
]

let next = 100

/** Registers a company in the demo; a client already taken is refused as the server does. */
export function createCompany(input: {
  name: string
  clientKeys: string[]
  admin: { name: string; email: string }
}): SupplierCompany | string {
  if (!input.name.trim()) return 'Укажите название компании'
  if (!input.clientKeys.length) return 'Выберите клиента 1С'
  const picked = input.clientKeys.map((k) => onecClients.find((c) => c.id === k))
  const taken = picked.find((c) => !c || c.companyId)
  if (taken) return `${taken.name} — уже филиал другой компании`
  const id = `c-${next++}`
  const company: SupplierCompany = {
    id,
    name: input.name.trim(),
    active: true,
    branches: picked.map((c) => ({ id: c!.id, name: c!.name })),
    users: [
      {
        id: `u-${next++}`,
        name: input.admin.name.trim(),
        email: input.admin.email.trim(),
        role: 'admin',
        active: true,
      },
    ],
  }
  for (const c of picked) c!.companyId = id
  supplierCompanies.push(company)
  supplierCompanies.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  return company
}

export function addBranch(companyId: string, clientKey: string): string | null {
  const company = supplierCompanies.find((c) => c.id === companyId)
  const client = onecClients.find((c) => c.id === clientKey)
  if (!company || !client) return 'Клиент не найден в 1С'
  if (client.companyId) return `${client.name} — уже филиал другой компании`
  client.companyId = companyId
  company.branches.push({ id: client.id, name: client.name })
  return null
}

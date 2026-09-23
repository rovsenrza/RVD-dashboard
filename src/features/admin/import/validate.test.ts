import type { Branch, CabinetUser, Equipment, Product } from '@/entities/types'
import { checkInstallations, checkUsers, type CheckedRow, type ImportCheck } from './validate'

const branches = [
  { id: 'b-main', companyId: 'c', name: 'Главный филиал' },
  { id: 'b-north', companyId: 'c', name: 'Северный филиал' },
] as Branch[]
const existing = [{ email: 'ivanov@roga-kopyta.ru' }] as CabinetUser[]

const rowsOf = <T>(r: ImportCheck<T>): CheckedRow<T>[] => {
  if ('error' in r) throw new Error(r.error)
  return r.rows
}

describe('user import', () => {
  it('finds columns by header, whatever their order and the «*» marks', () => {
    const [row] = rowsOf(
      checkUsers(
        [
          ['Роль*', 'Почта*', 'ФИО*', 'Филиалы'],
          ['Механик', 'Petrov@Example.ru', 'Петров Пётр', 'Северный филиал'],
        ],
        existing,
        branches,
      ),
    )
    expect(row.errors).toEqual([])
    expect(row.value).toEqual({
      name: 'Петров Пётр',
      email: 'petrov@example.ru',
      role: 'mechanic',
      branchIds: ['b-north'],
    })
  })

  it('reads an empty or «Все» branch cell as the whole company', () => {
    const rows = rowsOf(
      checkUsers(
        [
          ['ФИО', 'Почта', 'Роль', 'Филиалы'],
          ['А', 'a@x.ru', 'Инженер', ''],
          ['Б', 'b@x.ru', 'руководитель', 'Все филиалы'],
        ],
        existing,
        branches,
      ),
    )
    expect(rows.map((r) => r.value?.branchIds)).toEqual([[], []])
  })

  it('explains every problem in the row, line numbers as in Excel', () => {
    const rows = rowsOf(
      checkUsers(
        [
          ['ФИО', 'Почта', 'Роль', 'Филиалы'],
          ['А', 'ivanov@roga-kopyta.ru', 'Механик', ''],
          ['Б', 'new@x.ru', 'Директор', 'Южный'],
          ['В', 'new@x.ru', 'Инженер', ''],
          ['', '', '', ''],
          ['Г', 'not-an-email', 'Инженер', ''],
        ],
        existing,
        branches,
      ),
    )
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4, 6])
    expect(rows[0].errors).toEqual([
      'почта уже есть в кабинете',
      'механику нужен ровно один филиал',
    ])
    expect(rows[1].errors).toEqual([
      'роль — одна из: Механик, Инженер, Руководитель, Администратор',
      'филиал «Южный» не найден',
    ])
    expect(rows[2].errors).toEqual(['почта повторяется: строка 3'])
    expect(rows[3].errors).toEqual(['почта указана с ошибкой'])
    expect(rows.every((r) => r.value === null)).toBe(true)
  })

  it('refuses a file without the required columns', () => {
    expect(checkUsers([['ФИО', 'Телефон']], existing, branches)).toEqual({
      error: 'Нет колонок: «Почта», «Роль». Возьмите шаблон.',
    })
  })
})

describe('installation import', () => {
  const products = [
    { id: 'p1', serialNumber: '48703' },
    { id: 'p2', serialNumber: '48704' },
  ] as Product[]
  const equipment = [{ id: 'e1', garageNumber: 'НТ04' }] as Equipment[]
  const header = ['EHS №', 'Гаражный №', 'Место установки', 'Дата установки', 'Внутренний №']
  const today = new Date(2026, 8, 23)

  it('accepts a date cell or дд.мм.гггг text and builds the installation patch', () => {
    const rows = rowsOf(
      checkInstallations(
        [
          header,
          [48703, 'нт04', 'ковш', new Date(2026, 8, 1), 'К-1'],
          ['EHS 48704', 'НТ04', 'Рукоять', '15.09.2026', ''],
        ],
        products,
        equipment,
        today,
      ),
    )
    expect(rows.map((r) => r.value)).toEqual([
      {
        productId: 'p1',
        label: 'EHS 48703',
        patch: {
          equipmentId: 'e1',
          installPlace: 'Ковш',
          installedAt: '2026-09-01',
          clientNumber: 'К-1',
        },
      },
      {
        productId: 'p2',
        label: 'EHS 48704',
        patch: { equipmentId: 'e1', installPlace: 'Рукоять', installedAt: '2026-09-15' },
      },
    ])
  })

  it('names unknown hoses and machines, bad places and dates, and repeats', () => {
    const rows = rowsOf(
      checkInstallations(
        [
          header,
          ['49999', 'ЕХ99', 'Кабина', '31.02.2026', ''],
          ['48703', 'НТ04', 'Ковш', '01.10.2026', ''],
          ['48703', 'НТ04', 'Ковш', '01.09.2026', ''],
        ],
        products,
        equipment,
        today,
      ),
    )
    expect(rows[0].errors).toEqual([
      'изделие EHS 49999 не найдено',
      'техника ЕХ99 не найдена',
      'место — одно из: Стрела, левый контур; Рукоять; Ковш; Гидромотор хода; Насос, напор',
      'дата — в формате дд.мм.гггг',
    ])
    expect(rows[1].errors).toEqual(['дата установки в будущем'])
    expect(rows[2].errors).toEqual(['изделие повторяется: строка 3'])
  })
})

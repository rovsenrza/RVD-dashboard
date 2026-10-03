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
  const header = ['EHS №', 'Гаражный №', 'Место установки', 'Внутренний №']

  it('builds the installation patch: machine, place and internal number', () => {
    const rows = rowsOf(
      checkInstallations(
        [header, [48703, 'нт04', 'ковш', 'К-1'], ['EHS 48704', 'НТ04', 'Рукоять', '']],
        products,
        equipment,
      ),
    )
    expect(rows.map((r) => r.value)).toEqual([
      {
        productId: 'p1',
        label: 'EHS 48703',
        patch: { equipmentId: 'e1', installPlace: 'Ковш', clientNumber: 'К-1' },
      },
      {
        productId: 'p2',
        label: 'EHS 48704',
        patch: { equipmentId: 'e1', installPlace: 'Рукоять' },
      },
    ])
  })

  it('never takes an installation date — it is the supplier’s, even from an old template', () => {
    const rows = rowsOf(
      checkInstallations(
        [
          ['EHS №', 'Гаражный №', 'Место установки', 'Дата установки'],
          ['48703', 'НТ04', 'Ковш', '01.09.2026'],
        ],
        products,
        equipment,
      ),
    )
    expect(rows[0].errors).toEqual([])
    expect(rows[0].value?.patch).not.toHaveProperty('installedAt')
  })

  it('names unknown hoses and machines, bad places, and repeats', () => {
    const rows = rowsOf(
      checkInstallations(
        [
          header,
          ['49999', 'ЕХ99', 'Кабина', ''],
          ['48703', 'НТ04', 'Ковш', ''],
          ['48703', 'НТ04', 'Ковш', ''],
        ],
        products,
        equipment,
      ),
    )
    expect(rows[0].errors).toEqual([
      'изделие EHS 49999 не найдено',
      'техника ЕХ99 не найдена',
      'место — одно из: Стрела, левый контур; Рукоять; Ковш; Гидромотор хода; Насос, напор',
    ])
    expect(rows[1].errors).toEqual([])
    expect(rows[2].errors).toEqual(['изделие повторяется: строка 3'])
  })
})

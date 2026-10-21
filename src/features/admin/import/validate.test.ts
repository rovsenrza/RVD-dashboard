import type { Branch, CabinetUser } from '@/entities/types'
import { checkUsers, type CheckedRow, type ImportCheck } from './validate'

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

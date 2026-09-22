import { fireEvent, render, screen } from '@testing-library/react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from './DataTable'
import { DescriptionList } from './DescriptionList'

interface Row {
  n: number
}
const rows: Row[] = Array.from({ length: 100 }, (_, i) => ({ n: i + 1 }))
const columns: ColumnDef<Row, unknown>[] = [{ accessorKey: 'n', header: '№' }]

const jump = (page: string) => {
  const field = screen.getByLabelText('Перейти на страницу, всего 10')
  fireEvent.change(field, { target: { value: page } })
  fireEvent.keyDown(field, { key: 'Enter' })
}

describe('DataTable page jump', () => {
  it('goes straight to the typed page', () => {
    render(<DataTable data={rows} columns={columns} pageSize={10} />)
    jump('7')
    expect(screen.getByText(/Показано 61–70 из 100/)).toBeInTheDocument()
  })

  it('lands on the last or first page when the number is out of range', () => {
    render(<DataTable data={rows} columns={columns} pageSize={10} />)
    jump('999')
    expect(screen.getByText(/Показано 91–100 из 100/)).toBeInTheDocument()
    jump('0')
    expect(screen.getByText(/Показано 1–10 из 100/)).toBeInTheDocument()
  })

  it('is not offered for a short table', () => {
    render(<DataTable data={rows.slice(0, 30)} columns={columns} pageSize={10} />)
    expect(screen.queryByLabelText(/Перейти на страницу/)).not.toBeInTheDocument()
  })
})

describe('DescriptionList', () => {
  it('pairs terms with values and renders missing values as the empty dash', () => {
    render(
      <DescriptionList
        items={[
          ['Гаражный №', 'НТ04'],
          ['Инвентарный №', null],
        ]}
      />,
    )
    expect(screen.getByText('Гаражный №').tagName).toBe('DT')
    expect(screen.getByText('НТ04').tagName).toBe('DD')
    expect(screen.getByText('Инвентарный №').nextElementSibling?.textContent).toBe('—')
  })
})

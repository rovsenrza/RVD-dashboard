import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SessionProvider } from '@/app/session'
import { ApiError, api } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'
import { ChangePasswordDialog } from './ChangePasswordDialog'

const post = vi.spyOn(api, 'post')

function open(onClose = vi.fn()) {
  render(
    <ToastProvider>
      <SessionProvider>
        <ChangePasswordDialog onClose={onClose} />
      </SessionProvider>
    </ToastProvider>,
  )
  const type = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  const send = () => fireEvent.click(screen.getByRole('button', { name: 'Сменить пароль' }))
  return { onClose, type, send }
}

describe('changing one’s password', () => {
  // Braces matter: a function returned from beforeEach is run as its cleanup.
  beforeEach(() => {
    post.mockReset()
  })

  it('checks the new password by the shared rule before asking the server', () => {
    const { type, send } = open()
    type('Текущий пароль', 'старый-пароль-1')
    type('Новый пароль', 'коротко')
    type('Повторите новый пароль', 'коротко')
    send()
    expect(screen.getByText('Пароль — не короче 10 символов')).toBeInTheDocument()

    type('Новый пароль', 'новый-пароль-1')
    type('Повторите новый пароль', 'новый-пароль-2')
    send()
    expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })

  it('puts a wrong current password under its own field', async () => {
    post.mockRejectedValueOnce(new ApiError(400, 'Текущий пароль не подходит'))
    const { type, send, onClose } = open()
    type('Текущий пароль', 'не-тот-пароль')
    type('Новый пароль', 'новый-пароль-1')
    type('Повторите новый пароль', 'новый-пароль-1')
    send()
    expect(await screen.findByText('Текущий пароль не подходит')).toBeInTheDocument()
    expect(screen.getByLabelText('Текущий пароль')).toHaveAttribute('aria-invalid', 'true')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sends the pair and closes with a confirmation', async () => {
    post.mockResolvedValueOnce(undefined)
    const { type, send, onClose } = open()
    type('Текущий пароль', 'старый-пароль-1')
    type('Новый пароль', 'новый-пароль-1')
    type('Повторите новый пароль', 'новый-пароль-1')
    send()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(post).toHaveBeenCalledWith('/auth/password', {
      current: 'старый-пароль-1',
      next: 'новый-пароль-1',
    })
    expect(screen.getByText('Пароль изменён')).toBeInTheDocument()
  })
})

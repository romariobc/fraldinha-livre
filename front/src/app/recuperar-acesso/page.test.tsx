import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { sendPasswordResetEmail } from 'firebase/auth'
import RecoverAccessPage from './page'
vi.mock('@/lib/firebase', () => ({ auth: {} }))
vi.mock('firebase/auth', () => ({ sendPasswordResetEmail: vi.fn() }))
describe('recuperação de acesso', () => {
  beforeEach(() => vi.resetAllMocks())
  it.each([false, true])('confirma sem enumerar conta (ausente=%s)', async absent => {
    if (absent) vi.mocked(sendPasswordResetEmail).mockRejectedValue({ code: 'auth/user-not-found' })
    else vi.mocked(sendPasswordResetEmail).mockResolvedValue(undefined)
    render(<RecoverAccessPage />)
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'qa@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar instruções' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Se houver uma conta')
  })
  it('permite retry após falha de rede', async () => {
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
    render(<RecoverAccessPage />)
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'qa@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar instruções' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Enviar instruções' }))
    await screen.findByRole('status')
  })
})

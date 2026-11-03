import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OrderCancellationDialog } from '../OrderCancellationDialog'

describe('OrderCancellationDialog', () => {
  it('exige motivo e envia texto normalizado antes de fechar', async () => {
    const user = userEvent.setup(), onConfirm = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()
    render(<OrderCancellationDialog onConfirm={onConfirm} onClose={onClose} />)
    const button = screen.getByRole('button', { name: 'Confirmar cancelamento' })
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText('Motivo do cancelamento'), '   Sem estoque   ')
    await user.click(button)
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith('Sem estoque')
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })
  it('falha preserva motivo, mostra erro e permite tentar novamente sem falso sucesso', async () => {
    const user = userEvent.setup(), onConfirm = vi.fn().mockRejectedValueOnce(new Error('conflict')).mockResolvedValue(undefined), onClose = vi.fn()
    render(<OrderCancellationDialog onConfirm={onConfirm} onClose={onClose} />)
    await user.type(screen.getByLabelText('Motivo do cancelamento'), 'Produto indisponível')
    await user.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível cancelar')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Motivo do cancelamento')).toHaveValue('Produto indisponível')
    await user.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })
  it('impede envio duplicado durante a requisição', async () => {
    const user = userEvent.setup()
    let resolve!: () => void
    const onConfirm = vi.fn(() => new Promise<void>((r) => { resolve = r }))
    render(<OrderCancellationDialog onConfirm={onConfirm} onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Motivo do cancelamento'), 'Sem estoque')
    await user.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))
    expect(screen.getByRole('button', { name: 'Cancelando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeDisabled()
    expect(onConfirm).toHaveBeenCalledOnce()
    resolve()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancelando…' })).not.toBeInTheDocument())
  })
})

/// <reference types="vitest/globals" />
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import ChatUI from '../ChatUI'

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from '@/lib/api-client'

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response
}

describe('ChatUI', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockClear()
  })

  it('envia mensagem de texto e mostra a resposta do assistente', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      jsonResponse({ type: 'text', content: 'qual tamanho você procura?' }),
    )
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'quero uma fralda')
    await user.click(screen.getByLabelText('Enviar'))

    expect(screen.getByText('quero uma fralda')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('qual tamanho você procura?')).toBeInTheDocument())

    const [, init] = vi.mocked(apiFetch).mock.calls[0]
    const body = JSON.parse(init!.body as string)
    expect(body.messages).toEqual([{ role: 'user', content: 'quero uma fralda' }])
  })

  it('mostra a acao select_product como mensagem informativa (M6 ainda nao intercepta)', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      jsonResponse({ type: 'action', action: 'select_product', productId: 'p1', quantity: 2 }),
    )
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'quero 2 do p1')
    await user.click(screen.getByLabelText('Enviar'))

    await waitFor(() => expect(screen.getByText(/produto selecionado: p1/i)).toBeInTheDocument())
  })

  it('em caso de erro de rede, mostra mensagem de erro com retry sem perder o historico', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network fail'))
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'oi')
    await user.click(screen.getByLabelText('Enviar'))

    await waitFor(() => expect(screen.getByText(/não foi possível falar com o assistente/i)).toBeInTheDocument())
    expect(screen.getByText('oi')).toBeInTheDocument()
  })

  it('em caso de resposta HTTP nao-ok (500), mostra erro e o botao de retry chama apiFetch de novo', async () => {
    vi.mocked(apiFetch).mockResolvedValue(jsonResponse({ error: 'internal' }, 500))
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'oi')
    await user.click(screen.getByLabelText('Enviar'))
    await waitFor(() => expect(screen.getByText(/não foi possível falar com o assistente/i)).toBeInTheDocument())

    vi.mocked(apiFetch).mockResolvedValue(jsonResponse({ type: 'text', content: 'ola de novo' }))
    await user.click(screen.getByText(/tentar de novo/i))

    await waitFor(() => expect(screen.getByText('ola de novo')).toBeInTheDocument())
    expect(vi.mocked(apiFetch).mock.calls).toHaveLength(2)
  })
})

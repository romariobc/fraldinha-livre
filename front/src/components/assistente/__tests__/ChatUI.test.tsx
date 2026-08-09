/// <reference types="vitest/globals" />
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import ChatUI from '../ChatUI'
import { PRODUCTS } from '@/lib/products'

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from '@/lib/api-client'

let mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }))
import { useAuth } from '@/contexts/auth-context'

vi.mock('@/contexts/cart-context', () => ({ useCart: vi.fn() }))
import { useCart } from '@/contexts/cart-context'

vi.mock('@/contexts/products-context', () => ({ useProducts: vi.fn() }))
import { useProducts } from '@/contexts/products-context'

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response
}

const COMPLETE_PROFILE = {
  role: 'comprador' as const,
  name: 'Test User',
  email: 'test@example.com',
  cpf: '11144477735',
  phone: '11999999999',
  address: {
    logradouro: 'Rua A',
    numero: '123',
    bairro: 'Bairro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01234-567',
  },
}

describe('ChatUI', () => {
  let mockAddItem: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.mocked(apiFetch).mockClear()
    mockPush = vi.fn()
    mockAddItem = vi.fn()

    vi.mocked(useAuth).mockReturnValue({
      user: { uid: 'user-1', email: 'test@example.com', displayName: 'Test User' },
      profile: COMPLETE_PROFILE,
      role: 'comprador',
      loading: false,
      signInGoogle: vi.fn(),
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOutUser: vi.fn(),
      updateProfile: vi.fn(),
    })
    vi.mocked(useCart).mockReturnValue({
      items: [],
      itemCount: 0,
      subtotal: 0,
      bySupplier: new Map(),
      addItem: mockAddItem,
      removeItem: vi.fn(),
      updateQty: vi.fn(),
      clear: vi.fn(),
    })
    vi.mocked(useProducts).mockReturnValue({ products: PRODUCTS, loading: false, error: null })
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
    expect(body.messages).toEqual([
      { role: 'assistant', content: 'Olá! Sou seu assistente de compras. Como posso ajudar você hoje?' },
      { role: 'user', content: 'quero uma fralda' }
    ])
  })

  it('acao select_product com produto real e perfil completo: adiciona ao carrinho e vai pro checkout', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      jsonResponse({ type: 'action', action: 'select_product', productId: 'p1', quantity: 2 }),
    )
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'quero 2 do p1')
    await user.click(screen.getByLabelText('Enviar'))

    await waitFor(() =>
      expect(mockAddItem).toHaveBeenCalledWith({
        productId: 'p1',
        productName: 'Supersec Pants P',
        supplierId: 'sup-001',
        supplierName: 'Distribuidora Sul',
        unitPrice: 1800,
        quantity: 2,
        unit: 'un',
      }),
    )
    expect(mockPush).toHaveBeenCalledWith('/checkout')
  })

  it('acao select_product com perfil incompleto: redireciona pro perfil, nao adiciona ao carrinho', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: 'user-1', email: 'test@example.com', displayName: 'Test User' },
      profile: { ...COMPLETE_PROFILE, cpf: '' },
      role: 'comprador',
      loading: false,
      signInGoogle: vi.fn(),
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOutUser: vi.fn(),
      updateProfile: vi.fn(),
    })
    vi.mocked(apiFetch).mockResolvedValue(
      jsonResponse({ type: 'action', action: 'select_product', productId: 'p1', quantity: 1 }),
    )
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'quero o p1')
    await user.click(screen.getByLabelText('Enviar'))

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/minha-conta?tab=perfil&returnTo=/assistente'),
    )
    expect(mockAddItem).not.toHaveBeenCalled()
  })

  it('acao select_product com productId inexistente no catalogo local: mensagem informativa, sem carrinho nem redirect', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      jsonResponse({ type: 'action', action: 'select_product', productId: 'produto-fantasma', quantity: 1 }),
    )
    const user = userEvent.setup()
    render(<ChatUI />)

    await user.type(screen.getByPlaceholderText(/preciso de fralda/i), 'quero o fantasma')
    await user.click(screen.getByLabelText('Enviar'))

    await waitFor(() => expect(screen.getByText(/não encontrei esse produto/i)).toBeInTheDocument())
    expect(mockAddItem).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
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

  it('retry apos falha com foto anexada reenvia a MESMA foto (nao envia sem imagem silenciosamente)', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('network fail'))
    const user = userEvent.setup()
    const { container } = render(<ChatUI />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['bytes-da-foto'], 'fralda.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByAltText('Foto anexada')).toBeInTheDocument())

    await user.click(screen.getByLabelText('Enviar'))
    await waitFor(() =>
      expect(screen.getByText(/não foi possível falar com o assistente/i)).toBeInTheDocument(),
    )

    const firstBody = JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]!.body as string)
    expect(firstBody.image).toMatch(/^data:image\/jpeg;base64,/)

    vi.mocked(apiFetch).mockResolvedValue(jsonResponse({ type: 'text', content: 'recebi a foto' }))
    await user.click(screen.getByText(/tentar de novo/i))

    await waitFor(() => expect(screen.getByText('recebi a foto')).toBeInTheDocument())
    const retryBody = JSON.parse(vi.mocked(apiFetch).mock.calls[1][1]!.body as string)
    expect(retryBody.image).toBe(firstBody.image)
  })

  it('foto em formato nao suportado (HEIC do iPhone): avisa claro e nao anexa', async () => {
    const { container } = render(<ChatUI />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const heic = new File(['bytes'], 'IMG_0001.HEIC', { type: 'image/heic' })
    fireEvent.change(fileInput, { target: { files: [heic] } })

    await waitFor(() => expect(screen.getByText(/formato que não consigo ler/i)).toBeInTheDocument())
    expect(screen.queryByAltText('Foto anexada')).not.toBeInTheDocument()
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled()
  })

  it('Enter com envio em andamento nao dispara request concorrente', async () => {
    let resolveFirst: (value: Response) => void = () => {}
    vi.mocked(apiFetch).mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFirst = resolve
      }),
    )
    const user = userEvent.setup()
    render(<ChatUI />)

    const input = screen.getByPlaceholderText(/preciso de fralda/i)
    await user.type(input, 'primeira{Enter}')
    await waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1))

    await user.type(input, 'segunda{Enter}')
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1)

    resolveFirst(jsonResponse({ type: 'text', content: 'resposta da primeira' }))
    await waitFor(() => expect(screen.getByText('resposta da primeira')).toBeInTheDocument())
  })
})

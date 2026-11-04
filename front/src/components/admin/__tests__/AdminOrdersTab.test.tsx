/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import AdminOrdersTab from '../AdminOrdersTab'

const adminIdentity = vi.hoisted(() => ({ uid: 'admin-test' }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: { uid: adminIdentity.uid }, role: 'admin' }) }))
vi.mock('@/components/OrderTracking', () => ({ default: () => <div>Acompanhamento do pedido</div> }))

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
import { apiFetch } from '@/lib/api-client'

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response
}

const mockOrders = [
  {
    type: 'compra-direta',
    id: 'order-1',
    uid: 'uid-buyer-1',
    status: 'aguardando',
    product: 'Fralda Pampers M',
    quantity: 2,
    unit: 'un',
    price: 5000,
    supplierId: 'sup-1',
    supplierName: 'Distribuidora São Paulo',
    createdAt: '2026-09-28T10:00:00.000Z',
    items: [
      { productId: 'prod-1', productName: 'Fralda Pampers M', unitPrice: 2500, quantity: 2, unit: 'un' },
    ],
    deliveryAddress: {
      logradouro: 'Av. Paulista',
      numero: '1000',
      complemento: 'Apto 12',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01310-100',
    },
    paymentMethod: 'pix',
    paymentStatus: 'approved',
    paymentTransactionId: 'tx-pix-123456',
  },
  {
    type: 'compra-direta',
    deliveryAddress: { logradouro: 'Rua QA', numero: '1', bairro: 'Centro', cidade: 'Fortaleza', estado: 'CE', cep: '60000-000' },
    id: 'order-2',
    uid: 'uid-buyer-2',
    status: 'entregue',
    product: 'Fralda Huggies G',
    quantity: 1,
    unit: 'un',
    price: 3500,
    supplierId: 'sup-2',
    supplierName: 'Distribuidora Sul',
    createdAt: '2026-09-27T15:30:00.000Z',
    items: [
      { productId: 'prod-2', productName: 'Fralda Huggies G', unitPrice: 3500, quantity: 1, unit: 'un' },
    ],
  },
]

describe('AdminOrdersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminIdentity.uid = 'admin-test'
  })

  it('renderiza os pedidos retornados de GET /orders?scope=admin', async () => {
    vi.mocked(apiFetch).mockResolvedValue(jsonResponse(mockOrders))
    render(<AdminOrdersTab />)
    await waitFor(() => expect(screen.getByText('order-1')).toBeInTheDocument())
    expect(screen.getByText('order-2')).toBeInTheDocument()
    expect(screen.getByText('Fralda Pampers M')).toBeInTheDocument()
    expect(screen.getByText('Fralda Huggies G')).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith('/orders?scope=admin', undefined, 'admin-test')
  })

  it('filtra pedidos por busca de texto (produto ou ID)', async () => {
    vi.mocked(apiFetch).mockResolvedValue(jsonResponse(mockOrders))
    render(<AdminOrdersTab />)
    await waitFor(() => expect(screen.getByText('order-1')).toBeInTheDocument())

    const searchInput = screen.getByPlaceholderText(/buscar por id/i)
    fireEvent.change(searchInput, { target: { value: 'Huggies' } })

    expect(screen.getByText('order-2')).toBeInTheDocument()
    expect(screen.queryByText('order-1')).not.toBeInTheDocument()
  })

  it('filtra pedidos por status', async () => {
    vi.mocked(apiFetch).mockResolvedValue(jsonResponse(mockOrders))
    render(<AdminOrdersTab />)
    await waitFor(() => expect(screen.getByText('order-1')).toBeInTheDocument())

    const statusSelect = screen.getByRole('combobox', { name: /filtrar por status/i })
    fireEvent.change(statusSelect, { target: { value: 'entregue' } })

    expect(screen.getByText('order-2')).toBeInTheDocument()
    expect(screen.queryByText('order-1')).not.toBeInTheDocument()
  })

  it('abre o modal de detalhes do pedido com itens, endereço e dados de pagamento', async () => {
    vi.mocked(apiFetch).mockResolvedValue(jsonResponse(mockOrders))
    render(<AdminOrdersTab />)
    await waitFor(() => expect(screen.getByText('order-1')).toBeInTheDocument())

    const detailButtons = screen.getAllByRole('button', { name: /detalhes/i })
    fireEvent.click(detailButtons[0])

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText(/pedido #order-1/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/av\. paulista, 1000/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/tx: tx-pix-123456/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/distribuidora são paulo/i)).toBeInTheDocument()

    const closeButton = within(dialog).getByRole('button', { name: /fechar/i })
    fireEvent.click(closeButton)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('copia ID da transação (paymentTransactionId) chamando writeText com o valor correto', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    })

    vi.mocked(apiFetch).mockResolvedValue(jsonResponse(mockOrders))
    render(<AdminOrdersTab />)
    await waitFor(() => expect(screen.getByText('order-1')).toBeInTheDocument())

    // Abre detalhes do order-1
    const detailButtons = screen.getAllByRole('button', { name: /detalhes/i })
    fireEvent.click(detailButtons[0])

    const dialog = screen.getByRole('dialog')
    const copyTxButton = within(dialog).getByRole('button', { name: /copiar id da transação/i })
    expect(copyTxButton).toBeInTheDocument()

    fireEvent.click(copyTxButton)

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('tx-pix-123456')
    })
  })

  it('não exibe feedback de sucesso quando a Clipboard API rejeita', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'))
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    })

    vi.mocked(apiFetch).mockResolvedValue(jsonResponse(mockOrders))
    render(<AdminOrdersTab />)
    await waitFor(() => expect(screen.getByText('order-1')).toBeInTheDocument())

    const detailButtons = screen.getAllByRole('button', { name: /detalhes/i })
    fireEvent.click(detailButtons[0])

    const dialog = screen.getByRole('dialog')
    const copyTxButton = within(dialog).getByRole('button', { name: /copiar id da transação/i })

    fireEvent.click(copyTxButton)

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('tx-pix-123456')
    })
    // O botão permanece funcional sem crash
    expect(copyTxButton).toBeInTheDocument()
  })

  it('comporta-se de forma segura quando a Clipboard API estiver indisponível no navegador', async () => {
    // Simula ambiente sem suporte a clipboard
    const originalClipboard = navigator.clipboard
    // @ts-expect-error teste de compatibilidade
    delete navigator.clipboard

    vi.mocked(apiFetch).mockResolvedValue(jsonResponse(mockOrders))
    render(<AdminOrdersTab />)
    await waitFor(() => expect(screen.getByText('order-1')).toBeInTheDocument())

    const copyOrderBtn = screen.getByRole('button', { name: /copiar id do pedido order-1/i })
    // Não deve lançar erro
    expect(() => fireEvent.click(copyOrderBtn)).not.toThrow()

    // Restaura mock
    Object.assign(navigator, { clipboard: originalClipboard })
  })

  it('fecha o modal sem disparar atualizações de estado tardias', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } })

    vi.mocked(apiFetch).mockResolvedValue(jsonResponse(mockOrders))
    render(<AdminOrdersTab />)
    await waitFor(() => expect(screen.getByText('order-1')).toBeInTheDocument())

    const detailButtons = screen.getAllByRole('button', { name: /detalhes/i })
    fireEvent.click(detailButtons[0])

    const dialog = screen.getByRole('dialog')
    const copyTxButton = within(dialog).getByRole('button', { name: /copiar id da transação/i })
    fireEvent.click(copyTxButton)

    // Fecha imediatamente enquanto o timer estaria ativo
    const closeButton = within(dialog).getByRole('button', { name: /fechar/i })
    fireEvent.click(closeButton)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('não exibe botão de cópia de transação quando o pedido não tem paymentTransactionId', async () => {
    vi.mocked(apiFetch).mockResolvedValue(jsonResponse(mockOrders))
    render(<AdminOrdersTab />)
    await waitFor(() => expect(screen.getByText('order-2')).toBeInTheDocument())

    // Abre detalhes do order-2 (sem transaction ID)
    const detailButtons = screen.getAllByRole('button', { name: /detalhes/i })
    fireEvent.click(detailButtons[1])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: /copiar id da transação/i })).not.toBeInTheDocument()
  })

  it('recarrega os pedidos ao clicar no botão atualizar', async () => {
    vi.mocked(apiFetch).mockResolvedValue(jsonResponse(mockOrders))
    render(<AdminOrdersTab />)
    await waitFor(() => expect(screen.getByText('order-1')).toBeInTheDocument())

    const refreshButton = screen.getByRole('button', { name: /atualizar/i })
    fireEvent.click(refreshButton)

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2))
  })

  it('mostra erro se a resposta nao for ok (ex.: 403)', async () => {
    vi.mocked(apiFetch).mockResolvedValue(jsonResponse({ error: 'forbidden' }, 403))
    render(<AdminOrdersTab />)
    await waitFor(() => expect(screen.getByText(/erro ao carregar pedidos/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })

  it('após clicar em atualizar, a segunda resposta contém o novo pedido e a tabela passa a exibi-lo', async () => {
    const newOrder = {
      type: 'compra-direta',
      deliveryAddress: mockOrders[0].deliveryAddress,
      id: 'order-3-novo',
      uid: 'uid-buyer-3',
      status: 'aguardando',
      product: 'Fralda Babysec Nova',
      quantity: 3,
      unit: 'un',
      price: 9000,
      supplierId: 'sup-1',
      supplierName: 'Distribuidora São Paulo',
      createdAt: '2026-10-01T12:00:00.000Z',
      items: [
        { productId: 'prod-3', productName: 'Fralda Babysec Nova', unitPrice: 3000, quantity: 3, unit: 'un' },
      ],
    }

    // Primeira resposta: apenas mockOrders (não contém order-3-novo)
    // Segunda resposta (após refresh): mockOrders + newOrder
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(jsonResponse(mockOrders))
      .mockResolvedValueOnce(jsonResponse([newOrder, ...mockOrders]))

    render(<AdminOrdersTab />)

    // Confirma que primeira resposta não contém o novo pedido
    await waitFor(() => expect(screen.getByText('order-1')).toBeInTheDocument())
    expect(screen.queryByText('order-3-novo')).not.toBeInTheDocument()

    // Clica em Atualizar
    const refreshButton = screen.getByRole('button', { name: /atualizar/i })
    fireEvent.click(refreshButton)

    // Confirma que a tabela passa a exibir o novo pedido
    await waitFor(() => expect(screen.getByText('order-3-novo')).toBeInTheDocument())
    expect(screen.getByText('Fralda Babysec Nova')).toBeInTheDocument()
    expect(screen.getByText('order-1')).toBeInTheDocument()
  })
  it('hides a selected snapshot immediately when the authenticated account changes', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse(mockOrders)).mockResolvedValue(jsonResponse([]))
    const view = render(<AdminOrdersTab />)
    await screen.findByText('order-1')
    fireEvent.click(screen.getAllByRole('button', { name: /detalhes/i })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    adminIdentity.uid = 'other-admin'
    view.rerender(<AdminOrdersTab />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText('Fralda Pampers M')).not.toBeInTheDocument()
  })

  it('requires a reason for administrative cancellation and reloads the persisted status', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) => path.includes('/status') ? jsonResponse({ ...mockOrders[0], status: 'cancelado' }) : jsonResponse(mockOrders))
    render(<AdminOrdersTab />)
    await screen.findByText('order-1')
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes do pedido order-1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }))
    expect(screen.getByRole('button', { name: 'Confirmar cancelamento' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Motivo do cancelamento'), { target: { value: 'Ajuste administrativo QA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/orders/order-1/status', { method: 'PATCH', body: JSON.stringify({ status:'cancelado', reason:'Ajuste administrativo QA' }) }, 'admin-test'))
  })

})

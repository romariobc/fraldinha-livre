import type { OrderRepository } from '@/lib/ports/order-repository'
import { OrderNotFoundError, OrderCancelNotAllowedError } from '@/lib/ports/order-repository'
import type { Order, CreateOrderRequest } from '@contracts'
import { OrderSchema } from '@contracts'
import { INITIAL_ORDERS, type Order as AccountMockOrder } from '@/lib/account-mock'
import { getOrderItems } from '@/lib/order-items'

const MOCK_UID = 'mock-uid-ana' // usuário mock único — sem isolamento multi-usuário (isso é do servidor)

function toContractOrder(order: AccountMockOrder): Order {
  const mapped = {
    id: order.id,
    uid: MOCK_UID,
    type: 'compra-direta' as const,
    status: order.status,
    product: order.product,
    quantity: order.quantity,
    unit: order.unit,
    price: order.price,
    supplierId: order.supplierId,
    supplierName: order.supplierName,
    deliveryAddress: order.deliveryAddress,
    createdAt: order.createdAt,
    items: getOrderItems(order),
  }
  // Valida contra o schema Zod — se o mapeamento estiver errado, falha aqui, não em produção.
  return OrderSchema.parse(mapped)
}

export class MockOrderRepository implements OrderRepository {
  private orders: Order[]
  private now: () => string
  private idFactory: () => string
  private supplierId?: string

  constructor(options: { now: () => string; idFactory: () => string; seed?: Order[]; supplierId?: string }) {
    this.now = options.now
    this.idFactory = options.idFactory
    this.orders = options.seed ?? INITIAL_ORDERS.map(toContractOrder)
    this.supplierId = options.supplierId
  }

  async list(): Promise<Order[]> {
    return [...this.orders]
  }

  async listForSupplier(): Promise<Order[]> {
    return this.orders.filter((o) => o.supplierId === this.supplierId)
  }

  async create(req: CreateOrderRequest): Promise<Order> {
    const order: Order = OrderSchema.parse({
      id: this.idFactory(),
      uid: MOCK_UID,
      type: 'compra-direta',
      status: 'aguardando',
      product: req.product,
      quantity: req.quantity,
      unit: req.unit,
      price: req.price,
      supplierId: req.supplierId,
      supplierName: req.supplierName,
      deliveryAddress: req.deliveryAddress,
      createdAt: this.now(),
      items: req.items,
    })
    this.orders.push(order)
    return order
  }

  async cancel(orderId: string): Promise<Order> {
    const order = this.orders.find((o) => o.id === orderId)
    if (!order) throw new OrderNotFoundError(orderId)
    if (order.status !== 'aguardando') throw new OrderCancelNotAllowedError(orderId, order.status)
    order.status = 'cancelado'
    return order
  }
}

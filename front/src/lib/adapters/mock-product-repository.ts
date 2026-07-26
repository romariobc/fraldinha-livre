import type { ProductRepository } from '@/lib/ports/product-repository'
import { ProductNotFoundError, ProductForbiddenError } from '@/lib/ports/product-repository'
import type { Product, CreateProductRequest, UpdateProductRequest } from '@contracts'
import { ProductSchema } from '@contracts'
import { PRODUCTS as STATIC_PRODUCTS } from '@/lib/products'

function toContractProduct(p: (typeof STATIC_PRODUCTS)[number]): Product {
  const mapped = {
    id: p.id,
    name: p.name,
    brand: p.brand,
    size: p.size,
    quantity: p.quantity,
    priceCents: p.priceInCents,
    supplierId: p.supplierId,
    slug: p.slug,
    categoria: p.categoria,
    descricao: p.descricao,
    atributos: p.atributos,
    badge: p.badge,
    active: true,
  }
  // Valida contra o schema Zod — mesmo padrao de toContractOrder em mock-order-repository.ts.
  return ProductSchema.parse(mapped)
}

export class MockProductRepository implements ProductRepository {
  private products: Product[]
  private supplierId: string
  private idFactory: () => string

  constructor(options: { supplierId: string; idFactory: () => string; seed?: Product[] }) {
    this.supplierId = options.supplierId
    this.idFactory = options.idFactory
    this.products = options.seed ?? STATIC_PRODUCTS.map(toContractProduct)
  }

  async list(): Promise<Product[]> {
    return this.products.filter((p) => p.active)
  }

  async listForSupplier(): Promise<Product[]> {
    return this.products.filter((p) => p.supplierId === this.supplierId)
  }

  async create(req: CreateProductRequest): Promise<Product> {
    const product: Product = ProductSchema.parse({
      id: this.idFactory(),
      supplierId: this.supplierId,
      active: true,
      name: req.name,
      brand: req.brand,
      size: req.size,
      quantity: req.quantity,
      priceCents: req.priceCents,
      slug: req.slug,
      categoria: req.categoria,
      descricao: req.descricao,
      atributos: req.atributos,
      badge: req.badge,
    })
    this.products.push(product)
    return product
  }

  async update(id: string, req: UpdateProductRequest): Promise<Product> {
    const product = this.products.find((p) => p.id === id)
    if (!product) throw new ProductNotFoundError(id)
    if (product.supplierId !== this.supplierId) throw new ProductForbiddenError(id)
    Object.assign(product, req)
    return product
  }

  async remove(id: string): Promise<void> {
    const index = this.products.findIndex((p) => p.id === id)
    if (index === -1) throw new ProductNotFoundError(id)
    if (this.products[index].supplierId !== this.supplierId) throw new ProductForbiddenError(id)
    this.products.splice(index, 1)
  }
}

import { apiFetch, ApiError } from '@/lib/api-client'
import type { ProductRepository } from '@/lib/ports/product-repository'
import { ProductNotFoundError, ProductForbiddenError } from '@/lib/ports/product-repository'
import type { Product, CreateProductRequest, UpdateProductRequest } from '@contracts'
import { ProductSchema, ProductListSchema } from '@contracts'

export class HttpProductRepository implements ProductRepository {
  async list(): Promise<Product[]> {
    try {
      const res = await apiFetch('/products')
      const json = await res.json()
      return ProductListSchema.parse(json)
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(`Failed to list products: HTTP ${error.status}`, { cause: error })
      }
      throw error
    }
  }

  async listForSupplier(): Promise<Product[]> {
    try {
      const res = await apiFetch('/products?scope=fornecedor')
      const json = await res.json()
      return ProductListSchema.parse(json)
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(`Failed to list supplier products: HTTP ${error.status}`, { cause: error })
      }
      throw error
    }
  }

  async create(req: CreateProductRequest): Promise<Product> {
    try {
      const res = await apiFetch('/products', { method: 'POST', body: JSON.stringify(req) })
      const json = await res.json()
      return ProductSchema.parse(json)
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(`Failed to create product: HTTP ${error.status}`, { cause: error })
      }
      throw error
    }
  }

  async update(id: string, req: UpdateProductRequest): Promise<Product> {
    try {
      const res = await apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(req) })
      const json = await res.json()
      return ProductSchema.parse(json)
    } catch (error) {
      if (error instanceof ApiError) {
        const opts = { requestId: error.requestId, cause: error }
        if (error.code === 'PRODUCT_NOT_FOUND') throw new ProductNotFoundError(id, opts)
        if (error.code === 'FORBIDDEN') throw new ProductForbiddenError(id, opts)
        throw new Error(`Failed to update product: HTTP ${error.status}`, { cause: error })
      }
      throw error
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await apiFetch(`/products/${id}`, { method: 'DELETE' })
    } catch (error) {
      if (error instanceof ApiError) {
        const opts = { requestId: error.requestId, cause: error }
        if (error.code === 'PRODUCT_NOT_FOUND') throw new ProductNotFoundError(id, opts)
        if (error.code === 'FORBIDDEN') throw new ProductForbiddenError(id, opts)
        throw new Error(`Failed to remove product: HTTP ${error.status}`, { cause: error })
      }
      throw error
    }
  }
}

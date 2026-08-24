/// <reference types="vitest/globals" />

import { describe, it, expect } from 'vitest'
import { PRODUCTS, getProductBySlug, type Size } from './products-fixture'

describe('products', () => {
  describe('PRODUCTS array', () => {
    it('should have 24 products', () => {
      expect(PRODUCTS).toHaveLength(24)
    })

    it('all products should have non-empty slugs', () => {
      PRODUCTS.forEach((product) => {
        expect(product.slug).toBeTruthy()
        expect(typeof product.slug).toBe('string')
        expect(product.slug.length).toBeGreaterThan(0)
      })
    })

    it('all slugs should be unique', () => {
      const slugs = PRODUCTS.map((p) => p.slug)
      const uniqueSlugs = new Set(slugs)
      expect(uniqueSlugs.size).toBe(PRODUCTS.length)
    })

    it('all products should have categoria', () => {
      PRODUCTS.forEach((product) => {
        expect(product.categoria).toBe('fraldas-descartaveis')
      })
    })

    it('all products should have non-empty descricao', () => {
      PRODUCTS.forEach((product) => {
        expect(product.descricao).toBeTruthy()
        expect(typeof product.descricao).toBe('string')
        expect(product.descricao.length).toBeGreaterThan(0)
      })
    })

    it('all products should have complete atributos', () => {
      PRODUCTS.forEach((product) => {
        expect(product.atributos).toBeDefined()
        expect(product.atributos.faixaPeso).toBeTruthy()
        expect(product.atributos.genero).toBe('unissex')
        expect(product.atributos.absorcao).toBeTruthy()
        expect(product.atributos.tecnologia).toBeTruthy()
      })
    })

    it('faixaPeso should match size correctly', () => {
      const sizeToFaixaPeso: Record<Size, string> = {
        RN: 'ate 4 kg',
        P: '3–6 kg',
        M: '5–9 kg',
        G: '9–12,5 kg',
        GG: '12–15 kg',
        XXG: 'acima de 14 kg',
      }

      PRODUCTS.forEach((product) => {
        expect(product.atributos.faixaPeso).toBe(sizeToFaixaPeso[product.size])
      })
    })

    it('should have at least one product per size', () => {
      const sizes: Size[] = ['RN', 'P', 'M', 'G', 'GG', 'XXG']
      sizes.forEach((size) => {
        const productsOfSize = PRODUCTS.filter((p) => p.size === size)
        expect(productsOfSize.length).toBeGreaterThan(0)
      })
    })
  })

  describe('getProductBySlug', () => {
    it('should return product for valid slug', () => {
      const product = getProductBySlug('pampers-supersec-pants-p')
      expect(product).toBeDefined()
      expect(product?.id).toBe('p1')
      expect(product?.name).toBe('Supersec Pants')
      expect(product?.brand).toBe('Pampers')
    })

    it('should return undefined for non-existent slug', () => {
      const product = getProductBySlug('non-existent-slug')
      expect(product).toBeUndefined()
    })

    it('should find all products by their slug', () => {
      PRODUCTS.forEach((product) => {
        const found = getProductBySlug(product.slug)
        expect(found).toBeDefined()
        expect(found?.id).toBe(product.id)
      })
    })

    it('should be case-sensitive', () => {
      const product = getProductBySlug('PAMPERS-SUPERSEC-PANTS-P')
      expect(product).toBeUndefined()
    })
  })
})

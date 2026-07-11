'use client'

import { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react'
import type { CartItem } from '@/lib/domain/cart'
import { cartSubtotal, groupBySupplier } from '@/lib/domain/cart'
import type { Money } from '@/lib/domain/money'

const CART_STORAGE_KEY = 'fl.cart.v1'

interface CartContextValue {
  items: CartItem[]
  itemCount: number
  subtotal: Money
  bySupplier: Map<string, CartItem[]>
  addItem(item: CartItem): void
  removeItem(productId: string, supplierId: string): void
  updateQty(productId: string, supplierId: string, quantity: number): void
  clear(): void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  // Inicia SEMPRE vazio para casar com o HTML do servidor (SSR): evita mismatch
  // de hidratacao. Os itens do localStorage entram depois do mount, via effect.
  const [items, setItems] = useState<CartItem[]>([])

  // Pula a primeira execucao do effect de persistencia — senao ele gravaria []
  // por cima do localStorage ANTES da hidratacao rodar (perda de dados).
  const skipFirstPersist = useRef(true)

  // Hidrata do localStorage uma vez, apos o mount (client-only).
  // O setState aqui e o caso legitimo de hidratacao de estado externo pos-mount:
  // iniciar [] no SSR e so entao aplicar o localStorage evita mismatch de hidratacao.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CART_STORAGE_KEY)
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratacao SSR-safe de estado externo (localStorage)
        setItems(JSON.parse(stored) as CartItem[])
      }
    } catch (error) {
      // Falha silenciosa: localStorage indisponivel ou JSON corrompido
      console.error('Failed to hydrate cart from localStorage:', error)
    }
  }, [])

  // Persiste no localStorage a cada mudanca de items (menos na primeira passada).
  useEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false
      return
    }
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    } catch (error) {
      // Falha silenciosa: localStorage indisponivel ou cheio
      console.error('Failed to persist cart to localStorage:', error)
    }
  }, [items])

  const itemCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }, [items])

  const subtotal = useMemo(() => {
    return cartSubtotal(items)
  }, [items])

  const bySupplier = useMemo(() => {
    return groupBySupplier(items)
  }, [items])

  const addItem = (newItem: CartItem) => {
    setItems((prevItems) => {
      // Check if item with same productId and supplierId already exists
      const existingIndex = prevItems.findIndex(
        (item) => item.productId === newItem.productId && item.supplierId === newItem.supplierId
      )

      if (existingIndex !== -1) {
        // Merge: sum quantities
        const existing = prevItems[existingIndex]
        const updated = { ...existing, quantity: existing.quantity + newItem.quantity }
        return [...prevItems.slice(0, existingIndex), updated, ...prevItems.slice(existingIndex + 1)]
      }

      // New item: add it
      return [...prevItems, newItem]
    })
  }

  const removeItem = (productId: string, supplierId: string) => {
    setItems((prevItems) =>
      prevItems.filter((item) => !(item.productId === productId && item.supplierId === supplierId))
    )
  }

  const updateQty = (productId: string, supplierId: string, quantity: number) => {
    // Guard: quantity must be integer >= 1
    if (!Number.isInteger(quantity)) {
      // Non-integer: ignore silently
      return
    }

    if (quantity <= 0) {
      // Remove item if quantity <= 0
      removeItem(productId, supplierId)
      return
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.productId === productId && item.supplierId === supplierId
          ? { ...item, quantity }
          : item
      )
    )
  }

  const clear = () => {
    setItems([])
  }

  const value: CartContextValue = {
    items,
    itemCount,
    subtotal,
    bySupplier,
    addItem,
    removeItem,
    updateQty,
    clear,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart deve ser usado dentro de CartProvider')
  }
  return context
}

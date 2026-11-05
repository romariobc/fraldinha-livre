'use client'

import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, ReactNode } from 'react'
import type { CartItem } from '@/lib/domain/cart'
import { cartSubtotal, groupBySupplier } from '@/lib/domain/cart'
import { CART_KEY, emptyCart, readCart, writeCart, acknowledgeCart, validCartItems, type CartSnapshot } from '@/lib/cart-storage'

interface CartContextValue {
  items: CartItem[]
  itemCount: number
  subtotal: number
  bySupplier: Map<string, CartItem[]>
  addItem(item: CartItem): void
  removeItem(productId: string, supplierId: string): void
  updateQty(productId: string, supplierId: string, quantity: number): void
  clear(): void
}
interface CheckoutCartValue extends CartContextValue {
  ready: boolean
  storageError: string | null
  acknowledgePurchase(receipt: string, lines: { productId: string; supplierId: string; quantity: number }[]): void
}
const CartContext = createContext<CheckoutCartValue | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CartSnapshot>(emptyCart)
  const current = useRef(snapshot)
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const publish = useCallback((next: CartSnapshot) => { current.current = next; setSnapshot(next) }, [])
  useEffect(() => {
    const hydrate = () => {
      try { publish(readCart(window.localStorage)); setStorageError(null) }
      catch { setStorageError('Não foi possível ler sua sacola salva. Confira o armazenamento do navegador.') }
      setReady(true)
    }
    hydrate()
    const changed = (event: StorageEvent) => { if (!event.key || event.key === CART_KEY || event.key === 'fl.cart.v1') hydrate() }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [publish])
  const commit = useCallback((change: (previous: CartSnapshot) => CartSnapshot, required = false) => {
    let previous = current.current
    try { previous = readCart(window.localStorage) } catch { if (required) throw new Error('Não foi possível recuperar a sacola salva.') }
    const next = change(previous)
    try { writeCart(window.localStorage, next); setStorageError(null) }
    catch {
      setStorageError('Não foi possível salvar sua sacola. A compra precisa de armazenamento disponível para recuperação.')
      if (required) throw new Error('Não foi possível salvar a confirmação na sacola. Recupere esta mesma tentativa.')
    }
    publish(next)
  }, [publish])
  const addItem = useCallback((item: CartItem) => {
    if (!validCartItems([item])) return
    commit(previous => {
      const found = previous.items.find(line => line.productId === item.productId && line.supplierId === item.supplierId)
      const items = found ? previous.items.map(line => line === found ? { ...line, quantity: line.quantity + item.quantity } : line) : [...previous.items, item]
      return validCartItems(items) ? { ...previous, items } : previous
    })
  }, [commit])
  const removeItem = useCallback((productId: string, supplierId: string) => commit(previous => ({ ...previous,
    items: previous.items.filter(line => line.productId !== productId || line.supplierId !== supplierId),
  })), [commit])
  const updateQty = useCallback((productId: string, supplierId: string, quantity: number) => {
    if (!Number.isSafeInteger(quantity)) return
    commit(previous => {
      const items = previous.items.map(item => item.productId === productId && item.supplierId === supplierId ? { ...item, quantity } : item)
        .filter(item => item.quantity > 0)
      return validCartItems(items) ? { ...previous, items } : previous
    })
  }, [commit])
  const clear = useCallback(() => commit(previous => ({ ...previous, items: [] })), [commit])
  const acknowledgePurchase = useCallback((receipt: string, lines: { productId: string; supplierId: string; quantity: number }[]) => {
    commit(previous => acknowledgeCart(previous, receipt, lines), true)
  }, [commit])
  const { items } = snapshot
  const subtotal = useMemo(() => cartSubtotal(items), [items])
  const bySupplier = useMemo(() => groupBySupplier(items), [items])
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])
  return <CartContext.Provider value={{ items, itemCount, subtotal, bySupplier, addItem, removeItem, updateQty, clear,
    ready, storageError, acknowledgePurchase }}>{children}</CartContext.Provider>
}
// Keep the original API for catalog/header consumers.
export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart deve ser usado dentro de CartProvider')
  return context
}
export function useCheckoutCart(): CheckoutCartValue {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCheckoutCart deve ser usado dentro de CartProvider')
  return context
}

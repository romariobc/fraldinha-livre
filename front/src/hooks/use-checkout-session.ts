'use client'

import { useEffect, useRef, useState } from 'react'
import { HttpOrderRepository } from '@/lib/adapters/http-order-repository'
import { useCheckoutCart } from '@/contexts/cart-context'
import { useOrders } from '@/contexts/orders-context'
import { browserCheckoutLock, discardAttempt, loadAttempt, submitCheckout, type CheckoutInput, type CheckoutAttempt } from '@/lib/checkout-attempt'

export function useCheckoutSession(userId: string | undefined) {
  const [attempt, setAttempt] = useState<CheckoutAttempt | null>(null)
  const [loadedUser, setLoadedUser] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const busy = useRef(false)
  const activeUser = useRef(userId)
  const { acknowledgePurchase } = useCheckoutCart()
  const { recordConfirmedOrders, refreshOrders } = useOrders()

  useEffect(() => {
    activeUser.current = userId
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore user-scoped external storage after mount
      setAttempt(userId ? loadAttempt(window.localStorage, userId) : null)
      setError(null)
    } catch {
      setAttempt(null)
      setError('Não foi possível recuperar a tentativa salva. Não inicie outra compra antes de conferir seus pedidos.')
    }
    setLoadedUser(userId)
  }, [userId])

  async function submit(input: CheckoutInput) {
    if (busy.current || input.userId !== activeUser.current) return
    busy.current = true
    setSubmitting(true)
    setError(null)
    try {
      const result = await submitCheckout(input, {
        storage: window.localStorage, repo: new HttpOrderRepository(input.userId), lock: browserCheckoutLock,
        onUpdate: next => { if (activeUser.current === input.userId) setAttempt(next) },
        onConfirmed: group => {
          acknowledgePurchase(input.userId + ':' + group.order!.id,
            group.request.items.map(item => ({ ...item, supplierId: group.supplierId })))
          if (activeUser.current === input.userId) recordConfirmedOrders?.([group.order!])
        },
      })
      if (activeUser.current === input.userId && result.groups.some(group => group.status === 'unknown')) {
        await refreshOrders?.({ refreshSession: false })
      }
    } catch (cause) {
      if (activeUser.current === input.userId) setError(cause instanceof Error ? cause.message : 'Não foi possível recuperar a tentativa.')
    } finally {
      busy.current = false
      setSubmitting(false)
    }
  }
  async function restart() {
    if (!userId || busy.current) return
    try {
      await browserCheckoutLock(userId, async () => {
        const saved = loadAttempt(window.localStorage, userId)
        for (const group of saved?.groups ?? []) {
          if (group.status === 'confirmed') acknowledgePurchase(userId + ':' + group.order!.id,
            group.request.items.map(item => ({ ...item, supplierId: group.supplierId })))
        }
        discardAttempt(window.localStorage, userId)
      })
      setAttempt(null)
      setError(null)
      return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Recupere a tentativa antes de continuar.') }
    return false
  }
  return { attempt: loadedUser === userId ? attempt : null, ready: loadedUser === userId, error, submitting, submit, restart }
}

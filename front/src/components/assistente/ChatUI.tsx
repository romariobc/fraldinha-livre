'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Paperclip, RotateCcw } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { useCart } from '@/contexts/cart-context'
import { useAuth } from '@/contexts/auth-context'
import { useProducts } from '@/contexts/products-context'
import { STORE_SUPPLIERS } from '@/lib/suppliers'
import { isProfileComplete } from '@/lib/utils'
import type { CartItem } from '@/lib/domain/cart'
import type { ChatMessage, ChatResponse } from '@contracts'

export default function ChatUI() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const cart = useCart()
  const { profile } = useAuth()
  const { products, loading: productsLoading } = useProducts()

  async function sendToBackend(messagesForRequest: ChatMessage[], image: string | null) {
    setSending(true)
    setError(null)
    try {
      const res = await apiFetch('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ messages: messagesForRequest, image: image ?? undefined }),
      })
      if (!res.ok) {
        setError('Não foi possível falar com o assistente. Tente de novo.')
        return
      }
      const data = (await res.json()) as ChatResponse
      if (data.type === 'text') {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.content }])
        return
      }

      if (productsLoading) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Só um instante, ainda estou carregando o catálogo. Tenta de novo.' },
        ])
        return
      }

      const product = products.find((p) => p.id === data.productId)
      if (!product) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Não encontrei esse produto no catálogo agora. Pode tentar de novo?' },
        ])
        return
      }

      if (!isProfileComplete(profile)) {
        router.push('/minha-conta?tab=perfil&returnTo=/assistente')
        return
      }

      const supplier = STORE_SUPPLIERS.find((s) => s.id === product.supplierId)
      const cartItem: CartItem = {
        productId: product.id,
        productName: `${product.name} ${product.size}`,
        supplierId: product.supplierId,
        supplierName: supplier?.name || 'Fornecedor desconhecido',
        unitPrice: product.priceInCents,
        quantity: data.quantity,
        unit: 'un',
      }
      cart.addItem(cartItem)
      router.push('/checkout')
    } catch {
      setError('Não foi possível falar com o assistente. Tente de novo.')
    } finally {
      setSending(false)
    }
  }

  function handleSend() {
    if (!input.trim() && !pendingImage) return
    const userMessage: ChatMessage = { role: 'user', content: input.trim() || '(foto anexada)' }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    const image = pendingImage
    setPendingImage(null)
    void sendToBackend(nextMessages, image)
  }

  function handleRetry() {
    void sendToBackend(messages, null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPendingImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="rounded-card shadow-card bg-white flex flex-col h-[70vh] max-h-[640px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-brand-muted text-sm">
            Descreva o que você procura ou mande uma foto do produto.
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`max-w-[80%] rounded-card px-4 py-2 text-sm ${
              message.role === 'user'
                ? 'bg-primary-light text-brand-text ml-auto'
                : 'bg-brand-bg text-brand-text mr-auto'
            }`}
          >
            {message.content}
          </div>
        ))}
        {sending && <p className="text-brand-muted text-sm">Assistente está digitando...</p>}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <span>{error}</span>
            <button
              type="button"
              onClick={handleRetry}
              className="font-display font-semibold inline-flex items-center gap-1 text-primary-dark"
            >
              <RotateCcw className="size-4" /> tentar de novo
            </button>
          </div>
        )}
      </div>
      {pendingImage && (
        <div className="px-4 pb-2">
          <img src={pendingImage} alt="Foto anexada" className="h-16 rounded-card" />
        </div>
      )}
      <div className="flex items-center gap-2 border-t p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Anexar foto"
          className="text-brand-muted hover:text-primary-dark"
        >
          <Paperclip className="size-5" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Preciso de fralda tamanho M..."
          className="flex-1 rounded-card border px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          aria-label="Enviar"
          className="font-display bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-card p-2"
        >
          <Send className="size-5" />
        </button>
      </div>
    </div>
  )
}

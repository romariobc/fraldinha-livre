'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Paperclip, RotateCcw } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { useCart } from '@/contexts/cart-context'
import { useAuth } from '@/contexts/auth-context'
import { useProducts } from '@/contexts/products-context'
import { STORE_SUPPLIERS } from '@/lib/suppliers'
import { isProfileComplete } from '@/lib/utils'
import type { CartItem } from '@/lib/domain/cart'
import { SUPPORTED_CHAT_IMAGE_TYPES } from '@contracts'
import type { ChatMessage, ChatResponse } from '@contracts'

// Derivado da fonte unica do contrato — nao reescrever a lista aqui. Estreitar o
// `accept` do input tambem faz o Safari converter HEIC do iPhone em JPEG.
const SUPPORTED_IMAGE_TYPES = SUPPORTED_CHAT_IMAGE_TYPES.map((type) => `image/${type}`)

export default function ChatUI() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Olá! Sou seu assistente de compras. Como posso ajudar você hoje?' }
  ])
  const [input, setInput] = useState('')
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastSentImageRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const cart = useCart()
  const { profile } = useAuth()
  const { products, loading: productsLoading } = useProducts()

  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, sending])

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
    if (sending) return
    if (!input.trim() && !pendingImage) return
    const userMessage: ChatMessage = { role: 'user', content: input.trim() || '(foto anexada)' }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    const image = pendingImage
    lastSentImageRef.current = image
    setPendingImage(null)
    void sendToBackend(nextMessages, image)
  }

  function handleRetry() {
    if (sending) return
    void sendToBackend(messages, lastSentImageRef.current)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      setPendingImage(null)
      setImageError('Essa foto está num formato que não consigo ler. Use JPEG, PNG ou WebP.')
      return
    }
    setImageError(null)
    const reader = new FileReader()
    reader.onload = () => setPendingImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col bg-white h-[100dvh] -mx-4 -mt-8 -mb-8 sm:m-0 sm:h-[70vh] sm:max-h-[640px] sm:rounded-card sm:shadow-card sm:border">
      <div className="flex md:hidden items-center px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-sm font-semibold text-primary-dark">
          &larr; Voltar
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 sm:pb-4">
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
        {sending && (
          <div className="bg-brand-bg text-brand-text mr-auto max-w-[80%] rounded-card px-4 py-3 text-sm flex gap-1 items-center">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
          </div>
        )}
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
        <div ref={messagesEndRef} />
      </div>
      {pendingImage && (
        <div className="px-4 pb-2 fixed bottom-[72px] sm:static bg-white w-full z-10 pt-2">
          <img src={pendingImage} alt="Foto anexada" className="h-16 rounded-card shadow" />
        </div>
      )}
      {imageError && <p className="px-4 pb-2 text-sm text-red-600 fixed bottom-[72px] sm:static bg-white w-full z-10">{imageError}</p>}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="flex items-center gap-2 border-t p-3 bg-white fixed bottom-0 left-0 right-0 sm:static sm:mt-auto z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sm:shadow-none"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_IMAGE_TYPES.join(',')}
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
          type="submit"
          disabled={sending}
          aria-label="Enviar"
          className="font-display bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-card p-2"
        >
          <Send className="size-5" />
        </button>
      </form>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Product } from '@/lib/products'
import { Address, MOCK_USER } from '@/lib/account-mock'
import { STORE_SUPPLIERS } from '@/lib/suppliers'
import { formatPrice } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface BuyModalProps {
  product: Product | null
  open: boolean
  onClose: () => void
  onConfirm: (quantity: number, deliveryAddress: Address) => void
}

export default function BuyModal({ product, open, onClose, onConfirm }: BuyModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [useCustomAddress, setUseCustomAddress] = useState(false)
  const [customAddress, setCustomAddress] = useState<Address>({
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
  })

  if (!product) return null

  const supplier = STORE_SUPPLIERS.find(s => s.id === product.supplierId)
  const total = product.priceInCents * quantity

  const deliveryAddress = useCustomAddress ? customAddress : MOCK_USER.address

  // Validação: quantidade deve ser inteiro positivo
  const isQuantityValid = Number.isInteger(quantity) && quantity > 0

  // Validação: endereço customizado deve ter campos obrigatórios preenchidos
  const isAddressValid = !useCustomAddress || (
    customAddress.logradouro.trim() &&
    customAddress.numero.trim() &&
    customAddress.cep.trim() &&
    customAddress.cidade.trim() &&
    customAddress.estado.trim()
  )

  const isConfirmDisabled = !isQuantityValid || !isAddressValid

  function handleQuantityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value)
    if (!isNaN(val)) {
      setQuantity(val)
    } else if (e.target.value === '') {
      setQuantity(0)
    }
  }

  function handleConfirm() {
    if (!isConfirmDisabled) {
      onConfirm(Math.floor(quantity), deliveryAddress)
      setQuantity(1)
      setUseCustomAddress(false)
      setCustomAddress({
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        cep: '',
      })
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar compra</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Produto + Fornecedor */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="font-semibold text-sm text-brand-text">{product.name}</p>
            <p className="text-xs text-brand-muted">Tam. {product.size}</p>
            <p className="text-xs text-brand-muted">
              Fornecedor: <strong>{supplier?.name || 'Desconhecido'}</strong>
            </p>
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-sm font-semibold mb-2">Quantidade</label>
            <input
              type="number"
              value={quantity}
              onChange={handleQuantityChange}
              min="1"
              step="1"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            {!isQuantityValid && quantity !== 0 && (
              <p className="text-xs text-red-600 mt-1">Quantidade deve ser um número inteiro positivo</p>
            )}
          </div>

          {/* Endereço de entrega */}
          <div>
            <label className="block text-sm font-semibold mb-2">Endereço de entrega</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="address"
                  checked={!useCustomAddress}
                  onChange={() => setUseCustomAddress(false)}
                />
                <span className="text-sm">Usar endereço do cadastro</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="address"
                  checked={useCustomAddress}
                  onChange={() => setUseCustomAddress(true)}
                />
                <span className="text-sm">Outro endereço</span>
              </label>
            </div>

            {!useCustomAddress ? (
              <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-brand-muted">
                {MOCK_USER.address.logradouro}, {MOCK_USER.address.numero}
                {MOCK_USER.address.complemento && ` — ${MOCK_USER.address.complemento}`}
                <br />
                {MOCK_USER.address.bairro}, {MOCK_USER.address.cidade}/{MOCK_USER.address.estado}
                <br />
                {MOCK_USER.address.cep}
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  placeholder="Logradouro *"
                  value={customAddress.logradouro}
                  onChange={(e) => setCustomAddress({ ...customAddress, logradouro: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
                <input
                  type="text"
                  placeholder="Número *"
                  value={customAddress.numero}
                  onChange={(e) => setCustomAddress({ ...customAddress, numero: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
                <input
                  type="text"
                  placeholder="Complemento"
                  value={customAddress.complemento || ''}
                  onChange={(e) => setCustomAddress({ ...customAddress, complemento: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
                <input
                  type="text"
                  placeholder="Bairro"
                  value={customAddress.bairro}
                  onChange={(e) => setCustomAddress({ ...customAddress, bairro: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="CEP *"
                    value={customAddress.cep}
                    onChange={(e) => setCustomAddress({ ...customAddress, cep: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Cidade *"
                    value={customAddress.cidade}
                    onChange={(e) => setCustomAddress({ ...customAddress, cidade: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>
                <input
                  type="text"
                  placeholder="UF (ex: SP) *"
                  value={customAddress.estado}
                  onChange={(e) => setCustomAddress({ ...customAddress, estado: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
                {!isAddressValid && (
                  <p className="text-xs text-red-600">Preencha todos os campos obrigatórios (*)</p>
                )}
              </div>
            )}
          </div>

          {/* Frete a combinar */}
          <div className="text-xs text-brand-muted italic">
            Frete a combinar com o fornecedor
          </div>

          {/* Total */}
          <div className="bg-primary-light p-3 rounded-lg">
            <p className="text-xs text-brand-muted">Total</p>
            <p className="font-black text-lg text-brand-text">{formatPrice(total)}</p>
          </div>

          {/* Botões */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-slate-300 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              className="flex-1 py-2 px-4 bg-primary-dark text-white rounded-lg font-semibold text-sm hover:bg-primary-darker disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

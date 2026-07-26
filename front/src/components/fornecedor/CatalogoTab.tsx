'use client'

import { useState, useEffect, useMemo } from 'react'
import { Package2, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { ProductRepository } from '@/lib/ports/product-repository'
import { MockProductRepository } from '@/lib/adapters/mock-product-repository'
import { HttpProductRepository } from '@/lib/adapters/http-product-repository'
import type { Product, CreateProductRequest, UpdateProductRequest } from '@contracts'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

interface FormData {
  name: string
  brand: string
  size: string
  quantity: string
  priceReais: string
  categoria: string
  descricao: string
  faixaPeso: string
  genero: 'unissex'
  absorcao: string
  tecnologia: string
  badge: string
}

function getEmptyFormData(): FormData {
  return {
    name: '',
    brand: '',
    size: '',
    quantity: '',
    priceReais: '',
    categoria: '',
    descricao: '',
    faixaPeso: '',
    genero: 'unissex',
    absorcao: '',
    tecnologia: '',
    badge: '',
  }
}

export default function CatalogoTab() {
  const { user } = useAuth()
  const useBackend = process.env.NEXT_PUBLIC_USE_BACKEND === 'true'

  // Instanciar repositório direto no componente
  const repo: ProductRepository = useMemo(() => {
    if (useBackend) return new HttpProductRepository()
    return new MockProductRepository({
      supplierId: user?.uid ?? '',
      idFactory: () => crypto.randomUUID(),
    })
  }, [useBackend, user?.uid])

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(getEmptyFormData())
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Carregar produtos do fornecedor no mount
  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true)
        setError(null)
        const data = await repo.listForSupplier()
        setProducts(data)
      } catch (err) {
        console.error('Erro ao carregar produtos:', err)
        setError('Erro ao carregar produtos')
      } finally {
        setLoading(false)
      }
    }

    if (user?.uid) {
      loadProducts()
    }
  }, [repo, user?.uid])

  function validateForm(data: FormData): Record<string, string> {
    const errors: Record<string, string> = {}

    if (!data.name.trim()) errors.name = 'Nome é obrigatório'
    if (!data.brand.trim()) errors.brand = 'Marca é obrigatória'
    if (!data.size.trim()) errors.size = 'Tamanho é obrigatório'
    if (!data.quantity.trim()) errors.quantity = 'Quantidade é obrigatória'
    if (isNaN(Number(data.quantity))) errors.quantity = 'Quantidade deve ser um número'
    if (!data.priceReais.trim()) errors.priceReais = 'Preço é obrigatório'
    if (isNaN(Number(data.priceReais))) errors.priceReais = 'Preço deve ser um número'
    if (!data.categoria.trim()) errors.categoria = 'Categoria é obrigatória'
    if (!data.faixaPeso.trim()) errors.faixaPeso = 'Faixa de peso é obrigatória'
    if (!data.absorcao.trim()) errors.absorcao = 'Absorção é obrigatória'
    if (!data.tecnologia.trim()) errors.tecnologia = 'Tecnologia é obrigatória'

    return errors
  }

  async function handleSave() {
    const errors = validateForm(formData)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})
    setIsSaving(true)

    try {
      const priceCents = Math.round(Number(formData.priceReais) * 100)
      const slug = slugify(formData.name)

      if (isCreating) {
        const createReq: CreateProductRequest = {
          name: formData.name,
          brand: formData.brand,
          size: formData.size,
          quantity: Number(formData.quantity),
          priceCents,
          slug,
          categoria: formData.categoria,
          descricao: formData.descricao,
          atributos: {
            faixaPeso: formData.faixaPeso,
            genero: formData.genero,
            absorcao: formData.absorcao,
            tecnologia: formData.tecnologia,
          },
          badge: formData.badge || undefined,
        }
        const newProduct = await repo.create(createReq)
        setProducts([...products, newProduct])
        toast.success('Produto criado com sucesso!')
      } else if (editingProductId) {
        const updateReq: UpdateProductRequest = {
          name: formData.name,
          brand: formData.brand,
          size: formData.size,
          quantity: Number(formData.quantity),
          priceCents,
          slug,
          categoria: formData.categoria,
          descricao: formData.descricao,
          atributos: {
            faixaPeso: formData.faixaPeso,
            genero: formData.genero,
            absorcao: formData.absorcao,
            tecnologia: formData.tecnologia,
          },
          badge: formData.badge || undefined,
        }
        const updated = await repo.update(editingProductId, updateReq)
        setProducts(products.map((p) => (p.id === editingProductId ? updated : p)))
        toast.success('Produto atualizado com sucesso!')
      }

      setIsEditing(false)
      setIsCreating(false)
      setEditingProductId(null)
      setFormData(getEmptyFormData())
    } catch (err) {
      console.error('Erro ao salvar produto:', err)
      toast.error('Erro ao salvar produto')
    } finally {
      setIsSaving(false)
    }
  }

  function handleEditClick(product: Product) {
    setEditingProductId(product.id)
    setFormData({
      name: product.name,
      brand: product.brand,
      size: product.size,
      quantity: String(product.quantity),
      priceReais: String(product.priceCents / 100),
      categoria: product.categoria,
      descricao: product.descricao,
      faixaPeso: product.atributos.faixaPeso,
      genero: product.atributos.genero,
      absorcao: product.atributos.absorcao,
      tecnologia: product.atributos.tecnologia,
      badge: product.badge || '',
    })
    setFormErrors({})
    setIsEditing(true)
  }

  function handleCreateClick() {
    setIsCreating(true)
    setFormData(getEmptyFormData())
    setFormErrors({})
    setIsEditing(true)
  }

  function handleCancel() {
    setIsEditing(false)
    setIsCreating(false)
    setEditingProductId(null)
    setFormData(getEmptyFormData())
    setFormErrors({})
  }

  async function handleToggleActive(product: Product) {
    try {
      const updateReq: UpdateProductRequest = {
        active: !product.active,
      }
      const updated = await repo.update(product.id, updateReq)
      setProducts(products.map((p) => (p.id === product.id ? updated : p)))
      toast.success(product.active ? 'Produto despublicado' : 'Produto republicado')
    } catch (err) {
      console.error('Erro ao atualizar produto:', err)
      toast.error('Erro ao atualizar produto')
    }
  }

  function handleDeleteClick(productId: string) {
    setProductToDelete(productId)
    setDeleteDialogOpen(true)
  }

  async function handleConfirmDelete() {
    if (!productToDelete) return

    setIsDeleting(true)
    try {
      await repo.remove(productToDelete)
      setProducts(products.filter((p) => p.id !== productToDelete))
      toast.success('Produto excluído com sucesso!')
      setDeleteDialogOpen(false)
      setProductToDelete(null)
    } catch (err) {
      console.error('Erro ao excluir produto:', err)
      toast.error('Erro ao excluir produto')
    } finally {
      setIsDeleting(false)
    }
  }

  // Modo edição/criação
  if (isEditing) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-card shadow-card p-6 space-y-5">
          <h3 className="font-display font-bold text-lg text-brand-text">
            {isCreating ? 'Criar Produto' : 'Editar Produto'}
          </h3>

          {/* Nome */}
          <div>
            <label htmlFor="form-name" className="block text-sm font-semibold text-brand-text mb-2">Nome</label>
            <input
              id="form-name"
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
                if (formErrors.name) setFormErrors({ ...formErrors, name: '' })
              }}
              className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                formErrors.name ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
              }`}
            />
            {formErrors.name && <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>}
          </div>

          {/* Brand */}
          <div>
            <label htmlFor="form-brand" className="block text-sm font-semibold text-brand-text mb-2">Marca</label>
            <input
              id="form-brand"
              type="text"
              value={formData.brand}
              onChange={(e) => {
                setFormData({ ...formData, brand: e.target.value })
                if (formErrors.brand) setFormErrors({ ...formErrors, brand: '' })
              }}
              className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                formErrors.brand ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
              }`}
            />
            {formErrors.brand && <p className="text-xs text-red-600 mt-1">{formErrors.brand}</p>}
          </div>

          {/* Size */}
          <div>
            <label htmlFor="form-size" className="block text-sm font-semibold text-brand-text mb-2">Tamanho</label>
            <input
              id="form-size"
              type="text"
              value={formData.size}
              onChange={(e) => {
                setFormData({ ...formData, size: e.target.value })
                if (formErrors.size) setFormErrors({ ...formErrors, size: '' })
              }}
              className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                formErrors.size ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
              }`}
            />
            {formErrors.size && <p className="text-xs text-red-600 mt-1">{formErrors.size}</p>}
          </div>

          {/* Quantity + Price (2 colunas) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="form-quantity" className="block text-sm font-semibold text-brand-text mb-2">Quantidade</label>
              <input
                id="form-quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => {
                  setFormData({ ...formData, quantity: e.target.value })
                  if (formErrors.quantity) setFormErrors({ ...formErrors, quantity: '' })
                }}
                className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                  formErrors.quantity ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                }`}
              />
              {formErrors.quantity && <p className="text-xs text-red-600 mt-1">{formErrors.quantity}</p>}
            </div>
            <div>
              <label htmlFor="form-price" className="block text-sm font-semibold text-brand-text mb-2">Preço (R$)</label>
              <input
                id="form-price"
                type="number"
                value={formData.priceReais}
                onChange={(e) => {
                  setFormData({ ...formData, priceReais: e.target.value })
                  if (formErrors.priceReais) setFormErrors({ ...formErrors, priceReais: '' })
                }}
                step="0.01"
                className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                  formErrors.priceReais ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                }`}
              />
              {formErrors.priceReais && <p className="text-xs text-red-600 mt-1">{formErrors.priceReais}</p>}
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label htmlFor="form-categoria" className="block text-sm font-semibold text-brand-text mb-2">Categoria</label>
            <input
              id="form-categoria"
              type="text"
              value={formData.categoria}
              onChange={(e) => {
                setFormData({ ...formData, categoria: e.target.value })
                if (formErrors.categoria) setFormErrors({ ...formErrors, categoria: '' })
              }}
              className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                formErrors.categoria ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
              }`}
            />
            {formErrors.categoria && <p className="text-xs text-red-600 mt-1">{formErrors.categoria}</p>}
          </div>

          {/* Descrição */}
          <div>
            <label htmlFor="form-descricao" className="block text-sm font-semibold text-brand-text mb-2">Descrição</label>
            <textarea
              id="form-descricao"
              value={formData.descricao}
              onChange={(e) => {
                setFormData({ ...formData, descricao: e.target.value })
              }}
              rows={3}
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* Atributos */}
          <div>
            <h4 className="font-semibold text-sm text-brand-text mb-3">Atributos</h4>
            <div className="space-y-3">
              <div>
                <label htmlFor="form-faixaPeso" className="block text-sm font-semibold text-brand-text mb-2">Faixa de Peso</label>
                <input
                  id="form-faixaPeso"
                  type="text"
                  value={formData.faixaPeso}
                  onChange={(e) => {
                    setFormData({ ...formData, faixaPeso: e.target.value })
                    if (formErrors.faixaPeso) setFormErrors({ ...formErrors, faixaPeso: '' })
                  }}
                  className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                    formErrors.faixaPeso ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                  }`}
                />
                {formErrors.faixaPeso && <p className="text-xs text-red-600 mt-1">{formErrors.faixaPeso}</p>}
              </div>

              <div>
                <label htmlFor="form-absorcao" className="block text-sm font-semibold text-brand-text mb-2">Absorção</label>
                <input
                  id="form-absorcao"
                  type="text"
                  value={formData.absorcao}
                  onChange={(e) => {
                    setFormData({ ...formData, absorcao: e.target.value })
                    if (formErrors.absorcao) setFormErrors({ ...formErrors, absorcao: '' })
                  }}
                  className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                    formErrors.absorcao ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                  }`}
                />
                {formErrors.absorcao && <p className="text-xs text-red-600 mt-1">{formErrors.absorcao}</p>}
              </div>

              <div>
                <label htmlFor="form-tecnologia" className="block text-sm font-semibold text-brand-text mb-2">Tecnologia</label>
                <input
                  id="form-tecnologia"
                  type="text"
                  value={formData.tecnologia}
                  onChange={(e) => {
                    setFormData({ ...formData, tecnologia: e.target.value })
                    if (formErrors.tecnologia) setFormErrors({ ...formErrors, tecnologia: '' })
                  }}
                  className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                    formErrors.tecnologia ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                  }`}
                />
                {formErrors.tecnologia && <p className="text-xs text-red-600 mt-1">{formErrors.tecnologia}</p>}
              </div>
            </div>
          </div>

          {/* Badge (opcional) */}
          <div>
            <label htmlFor="form-badge" className="block text-sm font-semibold text-brand-text mb-2">Badge (opcional)</label>
            <input
              id="form-badge"
              type="text"
              value={formData.badge}
              onChange={(e) => {
                setFormData({ ...formData, badge: e.target.value })
              }}
              placeholder="Ex: Premium, Best Seller"
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-display font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl bg-primary text-white font-display font-bold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    )
  }

  // Modo visualização
  if (loading) {
    return (
      <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
        <div className="bg-white rounded-card shadow-card p-6 text-center">
          <p className="text-brand-muted">Carregando produtos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
        <div className="bg-white rounded-card shadow-card p-6 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
        <button
          onClick={handleCreateClick}
          className="w-full py-3 rounded-xl bg-primary text-white font-display font-bold text-sm hover:bg-primary-dark transition-colors"
        >
          + Criar Produto
        </button>

        {products.length === 0 ? (
          <div className="bg-white rounded-card shadow-card p-6 text-center">
            <p className="text-brand-muted">Nenhum produto ainda. Comece criando um!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-card shadow-card p-4">
                {/* Cabeçalho: ícone + nome + badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                      <Package2 size={16} className="text-primary-dark" />
                    </div>
                    <div>
                      <p className="font-display font-extrabold text-sm text-brand-text">
                        {product.name}
                      </p>
                      <p className="text-xs text-brand-muted mt-0.5">
                        {product.brand} · {product.size}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                      product.active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {product.active ? 'Ativo' : 'Despublicado'}
                  </div>
                </div>

                {/* Info linha: quantidade + preço */}
                <div className="flex items-center justify-between text-xs text-brand-muted mb-3 px-12">
                  <span>Qtd: {product.quantity}</span>
                  <span className="font-display font-bold text-sm text-brand-text">
                    {formatPrice(product.priceCents)}
                  </span>
                </div>

                {/* Botões de ação */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditClick(product)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-lg border-2 border-primary text-primary-dark font-semibold text-xs hover:bg-primary-light transition-colors"
                  >
                    <Edit2 size={14} />
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(product)}
                    className="flex-1 py-2 px-3 rounded-lg border-2 border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
                  >
                    {product.active ? 'Despublicar' : 'Republicar'}
                  </button>
                  <button
                    onClick={() => handleDeleteClick(product.id)}
                    className="py-2 px-3 rounded-lg border-2 border-red-200 text-red-600 font-semibold text-xs hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir produto</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Voltar</Button>} />
            <Button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

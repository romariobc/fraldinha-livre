'use client'

import * as React from 'react'
import {
  Package,
  Tag,
  ShieldCheck,
  Hash,
  Layers,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PRODUCTS as STATIC_PRODUCTS } from '@/lib/mock-data/products-mock'
import { formatPrice } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import type { ProductRepository } from '@/lib/ports/product-repository'
import { MockProductRepository } from '@/lib/adapters/mock-product-repository'
import { HttpProductRepository } from '@/lib/adapters/http-product-repository'
import type { Product, CreateProductRequest } from '@contracts'

export interface MasterCatalogItem {
  id: string
  name: string
  brand: string
  size: string
  slug: string
  categoria: string
  descricao: string
  priceInCents: number
  atributos: {
    faixaPeso: string
    genero: 'unissex'
    absorcao: string
    tecnologia: string
    erpId?: string
  }
  badge?: string
}

interface AddProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProductAdded?: (newProduct: Product) => void
  repo?: ProductRepository
  masterProducts?: MasterCatalogItem[]
}

export function AddProductDialog({
  open,
  onOpenChange,
  onProductAdded,
  repo: customRepo,
  masterProducts: customMasterProducts,
}: AddProductDialogProps) {
  const { user } = useAuth()
  const useBackend = process.env.NEXT_PUBLIC_USE_BACKEND === 'true'

  const repo = React.useMemo<ProductRepository>(() => {
    if (customRepo) return customRepo
    if (useBackend) return new HttpProductRepository()
    return new MockProductRepository({
      supplierId: user?.uid || 'mock-supplier',
      idFactory: () => crypto.randomUUID(),
    })
  }, [customRepo, useBackend, user?.uid])

  // Master products list
  const masterList: MasterCatalogItem[] = React.useMemo(() => {
    if (customMasterProducts && customMasterProducts.length > 0) {
      return customMasterProducts
    }
    return STATIC_PRODUCTS.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      size: p.size,
      slug: p.slug,
      categoria: p.categoria,
      descricao: p.descricao,
      priceInCents: p.priceInCents,
      atributos: {
        faixaPeso: p.atributos.faixaPeso,
        genero: 'unissex' as const,
        absorcao: p.atributos.absorcao,
        tecnologia: p.atributos.tecnologia,
      },
      badge: p.badge,
    }))
  }, [customMasterProducts])

  // Component state
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedMaster, setSelectedMaster] = React.useState<MasterCatalogItem | null>(null)
  const [customPriceReais, setCustomPriceReais] = React.useState('')
  const [stockQuantity, setStockQuantity] = React.useState('50')
  const [erpId, setErpId] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({})

  // Filtered master products based on query
  const filteredMasterItems = React.useMemo(() => {
    if (!searchQuery.trim()) return masterList
    const q = searchQuery.toLowerCase()
    return masterList.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.size.toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q)
    )
  }, [masterList, searchQuery])

  // Handle master selection
  const handleSelectMaster = (item: MasterCatalogItem) => {
    setSelectedMaster(item)
    // Pre-fill default suggested price from master in Reais
    setCustomPriceReais((item.priceInCents / 100).toFixed(2))
    setFormErrors({})
  }

  const resetFormState = React.useCallback(() => {
    setSelectedMaster(null)
    setSearchQuery('')
    setCustomPriceReais('')
    setStockQuantity('50')
    setErpId('')
    setFormErrors({})
    setIsSubmitting(false)
  }, [])

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetFormState()
    }
    onOpenChange(newOpen)
  }

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMaster) {
      toast.error('Selecione um produto do catálogo mestre.')
      return
    }

    const errors: Record<string, string> = {}
    const priceNum = Number(customPriceReais.replace(',', '.'))
    const stockNum = Number(stockQuantity)

    if (!customPriceReais.trim() || isNaN(priceNum) || priceNum <= 0) {
      errors.price = 'Informe um preço de venda válido maior que zero.'
    }

    if (!stockQuantity.trim() || isNaN(stockNum) || stockNum < 0) {
      errors.stock = 'Informe uma quantidade de estoque válida maior ou igual a zero.'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})
    setIsSubmitting(true)

    try {
      const priceCents = Math.round(priceNum * 100)

      const createReq: CreateProductRequest = {
        name: selectedMaster.name,
        brand: selectedMaster.brand,
        size: selectedMaster.size,
        slug: selectedMaster.slug,
        categoria: selectedMaster.categoria,
        descricao: selectedMaster.descricao,
        quantity: stockNum,
        priceCents,
        atributos: {
          faixaPeso: selectedMaster.atributos.faixaPeso,
          genero: selectedMaster.atributos.genero,
          absorcao: selectedMaster.atributos.absorcao,
          tecnologia: selectedMaster.atributos.tecnologia,
          erpId: erpId.trim() || undefined,
        },
        badge: selectedMaster.badge || undefined,
      }

      const createdProduct = await repo.create(createReq)

      toast.success(
        `"${selectedMaster.name} (${selectedMaster.brand} ${selectedMaster.size})" adicionado ao seu catálogo!`
      )

      if (onProductAdded) {
        onProductAdded(createdProduct)
      }

      resetFormState()
      onOpenChange(false)
    } catch (err) {
      console.error('Erro ao adicionar produto:', err)
      toast.error('Não foi possível vincular o produto. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Package className="size-5 text-primary-dark" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-display">
                Adicionar Produto ao Catálogo
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Vincule um produto do Catálogo Mestre oficial para comercializar na sua distribuidora.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Informative Guardrail Banner */}
        <div className="rounded-lg bg-blue-50/80 border border-blue-200/80 p-3 flex items-start gap-2.5 text-xs text-blue-900">
          <ShieldCheck className="size-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="font-semibold text-blue-950">Catálogo Mestre Padronizado:</strong>{' '}
            Para garantir a consistência das especificações técnicas no marketplace, selecione um produto existente. Você define seu <strong>preço de venda</strong>, <strong>estoque</strong> e <strong>código ERP interno</strong>.
          </p>
        </div>

        {!selectedMaster ? (
          /* STEP 1: Search and Select Master Product */
          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Buscar no Catálogo Mestre ({masterList.length} produtos homologados)
              </Label>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Command className="border-0">
                <CommandInput
                  placeholder="Digite o nome, marca, tamanho ou categoria..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  data-testid="master-search-input"
                />
                <CommandList className="max-h-72">
                  {filteredMasterItems.length === 0 ? (
                    <CommandEmpty className="py-8 text-center text-xs text-muted-foreground">
                      Nenhum produto encontrado para &quot;{searchQuery}&quot;.
                    </CommandEmpty>
                  ) : (
                    <CommandGroup heading="Produtos Disponíveis">
                      {filteredMasterItems.map((item) => (
                        <CommandItem
                          key={item.id}
                          onSelect={() => handleSelectMaster(item)}
                          onClick={() => handleSelectMaster(item)}
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/80 border-b border-border/40 last:border-0"
                          data-testid={`master-item-${item.id}`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary-dark shrink-0">
                              <Package className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-xs text-foreground truncate">
                                  {item.name}
                                </p>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                  {item.brand}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  Tam {item.size}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {item.atributos.faixaPeso} · {item.atributos.tecnologia}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 pl-3">
                            <span className="text-[10px] text-muted-foreground block">Sugerido</span>
                            <span className="font-bold text-xs text-primary-dark">
                              {formatPrice(item.priceInCents)}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </div>
          </div>
        ) : (
          /* STEP 2: Configure Price, Stock and ERP_ID for Selected Master */
          <form onSubmit={handleSubmit} noValidate className="space-y-4 py-1" data-testid="link-product-form">
            {/* Selected Master Product Preview Card */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    <Package className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      {selectedMaster.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Marca: <span className="font-semibold text-foreground">{selectedMaster.brand}</span> · Tamanho: <span className="font-semibold text-foreground">{selectedMaster.size}</span>
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setSelectedMaster(null)}
                  className="text-xs text-primary hover:text-primary-dark"
                >
                  <RefreshCw className="size-3 mr-1" />
                  Trocar
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-primary/20 text-[11px] text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Categoria: </span>
                  {selectedMaster.categoria}
                </div>
                <div>
                  <span className="font-medium text-foreground">Faixa de Peso: </span>
                  {selectedMaster.atributos.faixaPeso}
                </div>
                <div>
                  <span className="font-medium text-foreground">Absorção: </span>
                  {selectedMaster.atributos.absorcao}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground italic line-clamp-2">
                &ldquo;{selectedMaster.descricao}&rdquo;
              </p>
            </div>

            {/* Custom Settings: Price, Stock, ERP_ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Preço de Venda da Loja */}
              <div className="space-y-1.5">
                <Label htmlFor="custom-price" className="text-xs font-semibold flex items-center gap-1 text-foreground">
                  <Tag className="size-3.5 text-primary" />
                  Preço de Venda da Loja (R$) *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="custom-price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={customPriceReais}
                    onChange={(e) => {
                      setCustomPriceReais(e.target.value)
                      if (formErrors.price) setFormErrors((prev) => ({ ...prev, price: '' }))
                    }}
                    className={`pl-9 h-9 text-xs bg-card ${
                      formErrors.price ? 'border-destructive focus-visible:ring-destructive' : ''
                    }`}
                    data-testid="custom-price-input"
                  />
                </div>
                {formErrors.price ? (
                  <p className="text-[11px] text-destructive font-medium">{formErrors.price}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    Preço sugerido de mercado: {formatPrice(selectedMaster.priceInCents)}
                  </p>
                )}
              </div>

              {/* Estoque Disponível */}
              <div className="space-y-1.5">
                <Label htmlFor="stock-quantity" className="text-xs font-semibold flex items-center gap-1 text-foreground">
                  <Layers className="size-3.5 text-primary" />
                  Estoque Disponível (unidades) *
                </Label>
                <Input
                  id="stock-quantity"
                  type="number"
                  min="0"
                  placeholder="Quantidade em estoque"
                  value={stockQuantity}
                  onChange={(e) => {
                    setStockQuantity(e.target.value)
                    if (formErrors.stock) setFormErrors((prev) => ({ ...prev, stock: '' }))
                  }}
                  className={`h-9 text-xs bg-card ${
                    formErrors.stock ? 'border-destructive focus-visible:ring-destructive' : ''
                  }`}
                  data-testid="stock-quantity-input"
                />
                {formErrors.stock && (
                  <p className="text-[11px] text-destructive font-medium">{formErrors.stock}</p>
                )}
              </div>
            </div>

            {/* Código ERP / SKU Interno */}
            <div className="space-y-1.5">
              <Label htmlFor="erp-id" className="text-xs font-semibold flex items-center gap-1 text-foreground">
                <Hash className="size-3.5 text-primary" />
                Código ERP / SKU Interno (Opcional)
              </Label>
              <Input
                id="erp-id"
                type="text"
                placeholder="Ex: SKU-99482, ERP-FRALDA-01"
                value={erpId}
                onChange={(e) => setErpId(e.target.value)}
                className="h-9 text-xs bg-card"
                data-testid="erp-id-input"
              />
              <p className="text-[10px] text-muted-foreground">
                Identificador de controle interno no sistema ERP da sua empresa.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedMaster(null)}
                disabled={isSubmitting}
              >
                Voltar à Busca
              </Button>
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary-dark text-white"
                data-testid="submit-add-product-btn"
              >
                {isSubmitting ? 'Vinculando Produto...' : 'Adicionar ao Meu Catálogo'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

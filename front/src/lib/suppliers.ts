// src/lib/suppliers.ts

export interface StoreSupplier {
  id: string
  name: string
  rating: number
}

export const STORE_SUPPLIERS: StoreSupplier[] = [
  { id: 'sup-001', name: 'Distribuidora Sul', rating: 4 },
  { id: 'sup-002', name: 'Baby Stock SP', rating: 5 },
  { id: 'sup-003', name: 'Nacional Higiene', rating: 4 },
  { id: 'sup-004', name: 'Nordeste Baby', rating: 3 },
]

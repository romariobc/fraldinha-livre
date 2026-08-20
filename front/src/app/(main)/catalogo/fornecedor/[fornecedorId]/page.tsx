// src/app/(main)/catalogo/fornecedor/[fornecedorId]/page.tsx
'use client'

import { Suspense } from 'react'
import CatalogoView from '@/components/catalogo/CatalogoView'

export default function FornecedorCatalogoPage() {
  return (
    <Suspense fallback={null}>
      <CatalogoView />
    </Suspense>
  )
}

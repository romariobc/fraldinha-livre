'use client'

import * as React from 'react'
import { Settings, Sliders } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-black text-brand-text flex items-center gap-2.5">
          <Settings className="size-6 text-primary-dark" />
          Configurações da Loja
        </h1>
        <p className="text-sm text-brand-muted mt-1">
          Gerencie informações cadastrais, dados da distribuidora e políticas de entrega.
        </p>
      </div>

      <Card className="border-border shadow-xs bg-card">
        <CardHeader>
          <CardTitle>Preferências da Distribuidora</CardTitle>
          <CardDescription>Parâmetros operacionais e cadastrais</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
            <Sliders className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-base font-semibold text-foreground">Configurações em Carregamento</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              O formulário de configurações e políticas da distribuidora está sendo conectado.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

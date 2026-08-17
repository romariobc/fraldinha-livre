"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Store,
  ExternalLink,
  ShieldCheck,
  LogOut,
  User,
  ChevronRight,
  Sparkles,
} from "lucide-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/auth-context"

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/painel-fornecedor": {
    title: "Visão Geral",
    subtitle: "Acompanhamento em tempo real de métricas, vendas e status de entrega",
  },
  "/painel-fornecedor/pedidos": {
    title: "Gestão de Pedidos",
    subtitle: "Consulte, processe e despache os pedidos recebidos dos compradores",
  },
  "/painel-fornecedor/catalogo": {
    title: "Meu Catálogo",
    subtitle: "Gerencie disponibilidade, preços de venda e SKUs do seu catálogo",
  },
  "/painel-fornecedor/relatorios": {
    title: "Relatórios & Desempenho",
    subtitle: "Análise comparativa de entregas, cancelamentos e faturamento por período",
  },
  "/painel-fornecedor/configuracoes": {
    title: "Configurações da Loja",
    subtitle: "Políticas comerciais, dados cadastrais e preferências operacionais",
  },
}

export function SupplierHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOutUser } = useAuth()

  const currentRouteInfo = ROUTE_TITLES[pathname] || {
    title: "Painel da Distribuidora",
    subtitle: "Área de gestão exclusiva para fornecedores parceiros",
  }

  const userInitials = React.useMemo(() => {
    if (user?.displayName) {
      const parts = user.displayName.trim().split(" ")
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return user.displayName.slice(0, 2).toUpperCase()
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return "FO"
  }, [user])

  async function handleLogout() {
    try {
      await signOutUser()
      router.push("/login")
    } catch (error) {
      console.error("Erro ao fazer logout:", error)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 sm:px-6 backdrop-blur-md">
      {/* Esquerda: Trigger do Sidebar + Breadcrumb / Título */}
      <div className="flex items-center gap-3 md:gap-4">
        <SidebarTrigger className="shrink-0" />

        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <Link
            href="/painel-fornecedor"
            className="hover:text-primary-dark transition-colors flex items-center gap-1 text-slate-600"
          >
            <Store className="size-3.5 text-primary-dark" />
            Distribuidora
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <span className="font-semibold text-foreground truncate max-w-[200px]">
            {currentRouteInfo.title}
          </span>
        </div>

        <div className="sm:hidden flex items-center">
          <span className="text-sm font-bold text-foreground truncate">
            {currentRouteInfo.title}
          </span>
        </div>
      </div>

      {/* Direita: Badge Distribuidora + Link Loja + User Avatar & Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center gap-2">
          <Badge
            variant="outline"
            className="h-7 px-2.5 rounded-full border-primary/30 bg-primary-light/50 text-primary-dark text-xs font-semibold gap-1.5"
          >
            <ShieldCheck className="size-3.5 text-primary-dark" />
            Distribuidora Verificada
          </Badge>

          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-primary-dark hover:bg-primary-light"
            render={
              <Link href="/catalogo" target="_blank">
                <Store className="size-3.5" />
                <span>Ver Loja B2C</span>
                <ExternalLink className="size-3 opacity-60" />
              </Link>
            }
          />
        </div>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full p-0 ring-2 ring-primary/20 hover:ring-primary/50 transition-all"
                aria-label="Menu do Fornecedor"
              >
                <Avatar className="size-9 border border-border">
                  <AvatarFallback className="bg-primary-dark text-white text-xs font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            }
          />
          <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-56 p-1.5">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal px-2 py-1.5">
                <div className="flex flex-col space-y-1">
                  <p className="text-xs font-bold text-foreground truncate">
                    {user?.displayName || "Distribuidor Parceiro"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {user?.email}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary-dark mt-0.5">
                    <Sparkles className="size-3" /> Fornecedor Ativo
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                render={
                  <Link
                    href="/painel-fornecedor/configuracoes"
                    className="flex items-center gap-2 w-full text-xs font-medium cursor-pointer"
                  >
                    <User className="size-4 text-muted-foreground" />
                    <span>Configurações da Loja</span>
                  </Link>
                }
              />
              <DropdownMenuItem
                render={
                  <Link
                    href={`/catalogo?fornecedor=${user?.uid}`}
                    target="_blank"
                    className="flex items-center gap-2 w-full text-xs font-medium cursor-pointer"
                  >
                    <Store className="size-4 text-muted-foreground" />
                    <span>Meu Catálogo Público</span>
                  </Link>
                }
              />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-xs font-medium text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
              >
                <LogOut className="size-4 mr-2" />
                <span>Sair da Conta</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  BarChart3,
  Settings,
  Store,
  LogOut,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"

const NAV_ITEMS = [
  {
    title: "Visão Geral",
    href: "/painel-fornecedor",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: "Pedidos",
    href: "/painel-fornecedor/pedidos",
    icon: ShoppingBag,
    exact: false,
  },
  {
    title: "Meu Catálogo",
    href: "/painel-fornecedor/catalogo",
    icon: Package,
    exact: false,
  },
  {
    title: "Relatórios",
    href: "/painel-fornecedor/relatorios",
    icon: BarChart3,
    exact: false,
  },
  {
    title: "Configurações",
    href: "/painel-fornecedor/configuracoes",
    icon: Settings,
    exact: false,
  },
]

export function SupplierSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOutUser } = useAuth()

  async function handleLogout() {
    try {
      await signOutUser()
      router.push("/login")
    } catch (error) {
      console.error("Erro ao fazer logout:", error)
    }
  }

  const isLinkActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.exact) {
      return pathname === item.href
    }
    return pathname === item.href || pathname?.startsWith(`${item.href}/`)
  }

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border bg-sidebar">
      {/* Header com Marca B2B */}
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <Link href="/painel-fornecedor" className="flex items-center gap-2.5">
            <div className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-primary/10 p-1 flex items-center justify-center border border-primary/20">
              <Image
                src="/assets/img/cegonha.png"
                alt="Fraldinha Livre B2B"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-black text-sm text-sidebar-foreground tracking-tight flex items-center gap-1.5">
                Fraldinha Livre
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold uppercase bg-primary/15 text-primary-dark border-0">
                  B2B
                </Badge>
              </span>
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Store className="size-3 text-primary-dark" />
                Painel Fornecedor
              </span>
            </div>
          </Link>
        </div>
      </SidebarHeader>

      {/* Menu de Navegação */}
      <SidebarContent className="p-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-bold text-muted-foreground/80 tracking-wider">
            Navegação Principal
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-1">
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = isLinkActive(item)
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      className={cn(
                        "h-10 px-3 rounded-lg text-sm font-medium transition-all",
                        active
                          ? "bg-primary/10 text-primary-dark font-bold shadow-xs border-l-4 border-primary-dark rounded-l-none"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                      render={
                        <Link href={item.href} className="flex items-center gap-3 w-full">
                          <Icon className={cn("size-4.5", active ? "text-primary-dark" : "text-muted-foreground")} />
                          <span className="truncate">{item.title}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-bold text-muted-foreground/80 tracking-wider">
            Acesso Rápido
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-1">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-9 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                  render={
                    <Link
                      href={user?.uid ? `/catalogo/fornecedor/${user.uid}` : "/catalogo"}
                      target="_blank"
                      className="flex items-center gap-2.5 w-full"
                    >
                      <ExternalLink className="size-4 text-muted-foreground" />
                      <span>Ver Catálogo B2C</span>
                    </Link>
                  }
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer do Fornecedor */}
      <SidebarFooter className="p-3 border-t border-sidebar-border bg-sidebar-accent/30">
        <div className="rounded-xl border border-sidebar-border bg-card p-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary-dark font-bold text-sm shrink-0">
              <ShieldCheck className="size-5" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="truncate text-xs font-semibold text-foreground">
                {user?.displayName || user?.email?.split("@")[0] || "Distribuidora"}
              </span>
              <span className="truncate text-[10px] text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="size-3 shrink-0" />
                Verificado
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground truncate max-w-[130px]">
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10"
              title="Encerrar Sessão"
              aria-label="Encerrar Sessão"
            >
              <LogOut className="size-3.5" />
              <span className="text-[11px]">Sair</span>
            </button>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

/**
 * Valida um CPF brasileiro:
 * - Remove caracteres não dígitos
 * - Rejeita se não tiver exatamente 11 dígitos
 * - Rejeita sequências repetidas (ex: 11111111111)
 * - Valida os 2 dígitos verificadores com o algoritmo padrão
 */
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')

  // Deve ter exatamente 11 dígitos
  if (digits.length !== 11) return false

  // Rejeita sequências repetidas (00000000000, 11111111111, etc)
  if (/^(\d)\1{10}$/.test(digits)) return false

  // Validar primeiro dígito verificador
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i)
  }
  let remainder = sum % 11
  const firstDigit = remainder < 2 ? 0 : 11 - remainder
  if (parseInt(digits[9]) !== firstDigit) return false

  // Validar segundo dígito verificador
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i)
  }
  remainder = sum % 11
  const secondDigit = remainder < 2 ? 0 : 11 - remainder
  if (parseInt(digits[10]) !== secondDigit) return false

  return true
}

/**
 * Valida se um perfil está completo:
 * - CPF válido (via isValidCPF)
 * - Telefone preenchido (trim != '')
 * - Endereço com todos os campos obrigatórios: logradouro, numero, bairro, cidade, estado, cep (trim != '')
 */
export function isProfileComplete(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') return false

  const p = profile as Record<string, unknown>

  // CPF deve ser válido
  if (!p.cpf || typeof p.cpf !== 'string' || !isValidCPF(p.cpf)) return false

  // Telefone preenchido
  if (!p.phone || typeof p.phone !== 'string' || !p.phone.trim()) return false

  // Endereço com campos obrigatórios preenchidos
  if (!p.address || typeof p.address !== 'object') return false
  const addr = p.address as Record<string, unknown>
  if (!addr.logradouro || typeof addr.logradouro !== 'string' || !addr.logradouro.trim() ||
      !addr.numero || typeof addr.numero !== 'string' || !addr.numero.trim() ||
      !addr.bairro || typeof addr.bairro !== 'string' || !addr.bairro.trim() ||
      !addr.cidade || typeof addr.cidade !== 'string' || !addr.cidade.trim() ||
      !addr.estado || typeof addr.estado !== 'string' || !addr.estado.trim() ||
      !addr.cep || typeof addr.cep !== 'string' || !addr.cep.trim()) {
    return false
  }

  return true
}

/**
 * Sanitiza redirecionamentos: só aceita paths relativos começando com /
 * Rejeita //, :, ou qualquer coisa que pareça external/maliciosa
 * Se inválido, retorna '/minha-conta' como fallback
 */
export function safeRedirect(param: string | null): string {
  if (!param) return '/minha-conta'

  const trimmed = param.trim()

  // Deve começar com /
  if (!trimmed.startsWith('/')) return '/minha-conta'

  // Não pode começar com //
  if (trimmed.startsWith('//')) return '/minha-conta'

  // Não pode conter :
  if (trimmed.includes(':')) return '/minha-conta'

  return trimmed
}

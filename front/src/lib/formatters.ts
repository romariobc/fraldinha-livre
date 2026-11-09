export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `há ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days} dia${days !== 1 ? 's' : ''}`
}

export function maskCnpj(cnpj: string): string {
  const masked = cnpj.replace(
    /^(\d{2})\.(\d{3}\.\d{3}\/\d{4})-(\d{2})$/,
    (_, _a, mid) => `***.${mid}-**`
  )
  if (masked === cnpj) {
    return cnpj.slice(0, 3).replace(/./g, '*') + cnpj.slice(3, -2) + '**'
  }
  return masked
}

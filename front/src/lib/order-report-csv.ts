import type { OrderReport } from '@contracts'

function cell(value: string | number | null) {
  const text = value === null ? '' : String(value)
  const safe = /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(text) ? "'" + text : text
  return '"' + safe.replace(/"/g, '""') + '"'
}
/** Export the exact loaded snapshot, including all pages; no second request or recalculation. */
export function orderReportCSV(report: OrderReport): string {
  const header = ['id','criado_utc','dia_America_Fortaleza','estado','fornecedor_uid','comprador_uid','produto','valor_centavos_BRL','modalidade','periodo_inicio','periodo_fim','consulta_utc','filtro_busca','filtro_estado','filtro_fornecedor_uid']
  const rows = report.rows.map(row => [row.id, row.createdAt, row.day, row.status, row.supplierId, row.buyerId, row.product, row.priceCents, row.paymentMode, report.filters.from, report.filters.to, report.snapshotAt, report.filters.q, report.filters.status, report.filters.supplierId])
  return '\uFEFF' + [header, ...rows].map(row => row.map(cell).join(';')).join('\r\n') + '\r\n'
}

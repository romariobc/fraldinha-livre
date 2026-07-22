// back/scripts/generate-products-seed.ts
// Dados dos 24 produtos copiados de front/src/lib/products.ts
const PRODUCTS = [
  // Pampers (5)
  { id: 'p1', priceInCents: 1800, supplierId: 'sup-001' },
  { id: 'p2', priceInCents: 2200, supplierId: 'sup-001' },
  { id: 'p3', priceInCents: 2600, supplierId: 'sup-001' },
  { id: 'p4', priceInCents: 2400, supplierId: 'sup-002' },
  { id: 'p5', priceInCents: 3200, supplierId: 'sup-002' },
  // Huggies (5)
  { id: 'h1', priceInCents: 2000, supplierId: 'sup-002' },
  { id: 'h2', priceInCents: 2500, supplierId: 'sup-002' },
  { id: 'h3', priceInCents: 2900, supplierId: 'sup-003' },
  { id: 'h4', priceInCents: 3400, supplierId: 'sup-003' },
  { id: 'h5', priceInCents: 3800, supplierId: 'sup-003' },
  // MamyPoko (5)
  { id: 'm1', priceInCents: 1600, supplierId: 'sup-001' },
  { id: 'm2', priceInCents: 2000, supplierId: 'sup-004' },
  { id: 'm3', priceInCents: 2400, supplierId: 'sup-004' },
  { id: 'm4', priceInCents: 2800, supplierId: 'sup-004' },
  { id: 'm5', priceInCents: 3200, supplierId: 'sup-004' },
  // Turma da Mônica (5)
  { id: 't1', priceInCents: 1400, supplierId: 'sup-001' },
  { id: 't2', priceInCents: 1700, supplierId: 'sup-003' },
  { id: 't3', priceInCents: 2100, supplierId: 'sup-003' },
  { id: 't4', priceInCents: 2500, supplierId: 'sup-003' },
  { id: 't5', priceInCents: 2900, supplierId: 'sup-003' },
  // Cremer (4)
  { id: 'c1', priceInCents: 1300, supplierId: 'sup-001' },
  { id: 'c2', priceInCents: 1600, supplierId: 'sup-002' },
  { id: 'c3', priceInCents: 2000, supplierId: 'sup-002' },
  { id: 'c4', priceInCents: 2400, supplierId: 'sup-002' },
]

const rows = PRODUCTS.map(
  (p) => `INSERT INTO products (id, price_cents, supplier_id) VALUES ('${p.id}', ${p.priceInCents}, '${p.supplierId}');`
)

console.log(rows.join('\n'))

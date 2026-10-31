import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkContext, main, validateBoundaries } from './context.mjs'

test('pacotes, guias, controllers e fronteiras do projeto são navegáveis', () => {
  const result = checkContext()
  assert.equal(result.ok, true, result.errors.join('\n'))
})
test('bloqueia imports de bibliotecas que ocultavam implementações locais', () => {
  assert.equal(validateBoundaries('front/src/demo.tsx', "import { X } from 'recharts'").length, 1)
  assert.deepEqual(validateBoundaries('front/src/demo.tsx', "import { X } from '@/lib/compat/recharts'"), [])
})
test('separa consumo de dados demonstrativos de tipos e helpers', () => {
  assert.equal(validateBoundaries('front/src/demo.ts', "import type { Order } from '@/lib/account-mock'").length, 1)
  assert.deepEqual(validateBoundaries('front/src/demo.ts', "import { MOCK_USER } from '@/lib/account-mock'"), [])
})
test('provider com diretiva deslocada não atravessa a fronteira client/server', () => {
  assert.equal(validateBoundaries('front/src/contexts/demo.tsx', "import { createContext } from 'react'; 'use client';").length, 1)
  assert.deepEqual(validateBoundaries('front/src/contexts/demo.tsx', "'use client'; import { createContext } from 'react';"), [])
})
test('status seleciona um item e expõe controle de aprovação sem carregar todo o backlog', () => {
  const result = main(['status', 'MP-04'])
  assert.equal(result.feature.id, 'MP-04')
  assert.equal(typeof result.execution.autorizada_proxima_etapa, 'boolean')
  assert.ok(result.dependencies.some(item => item.id === 'MP-03'))
})

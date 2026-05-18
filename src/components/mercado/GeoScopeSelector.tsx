'use client'

import { useState } from 'react'
import type { GeoScope } from '@/lib/supplier-mock'

interface GeoScopeSelectorProps {
  value: GeoScope
  onChange: (scope: GeoScope) => void
}

type ScopeKey = 'neighborhood' | 'radius_5' | 'radius_10' | 'city' | 'national'

function scopeKey(scope: GeoScope): ScopeKey {
  if (scope.type === 'radius') return `radius_${scope.km}` as ScopeKey
  if (scope.type === 'city') return 'city'
  return scope.type as ScopeKey
}

const BUTTONS: Array<{ key: ScopeKey; label: string; scope: GeoScope }> = [
  { key: 'neighborhood', label: '📍 Apenas meu bairro', scope: { type: 'neighborhood' } },
  { key: 'radius_5',     label: '🔵 Raio 5km',          scope: { type: 'radius', km: 5 } },
  { key: 'radius_10',    label: '🔵 Raio 10km',         scope: { type: 'radius', km: 10 } },
  { key: 'city',         label: '🏙️ Outra cidade...',   scope: { type: 'city', city: '', state: '' } },
  { key: 'national',     label: '🇧🇷 Brasil inteiro',    scope: { type: 'national' } },
]

export default function GeoScopeSelector({ value, onChange }: GeoScopeSelectorProps) {
  const [cityInput, setCityInput] = useState('')
  const [stateInput, setStateInput] = useState('')

  const activeKey = scopeKey(value)

  function handleButtonClick(btn: (typeof BUTTONS)[number]) {
    if (btn.key === 'city') {
      onChange({ type: 'city', city: cityInput.trim(), state: stateInput.trim() })
    } else {
      onChange(btn.scope)
    }
  }

  function handleCitySearch() {
    if (cityInput.trim()) {
      onChange({ type: 'city', city: cityInput.trim(), state: stateInput.trim() })
    }
  }

  return (
    <div className="py-3 px-4 sm:px-8 lg:px-20 bg-white border-b-2 border-slate-200">
      <div className="text-[9px] font-bold text-brand-muted uppercase tracking-[.1em] mb-2">
        Mostrar pedidos de:
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        {BUTTONS.map((btn) => (
          <button
            key={btn.key}
            type="button"
            onClick={() => handleButtonClick(btn)}
            className={`text-[11px] font-bold px-3.5 py-1.5 rounded-lg border transition-colors ${
              activeKey === btn.key
                ? 'bg-primary-dark text-white border-primary-dark'
                : 'bg-white border-slate-200 text-brand-muted hover:border-primary/40'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>
      {activeKey === 'city' && (
        <div className="flex gap-2 mt-3 items-center flex-wrap">
          <input
            type="text"
            placeholder="Cidade..."
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCitySearch()}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:border-primary"
          />
          <input
            type="text"
            placeholder="UF"
            value={stateInput}
            maxLength={2}
            onChange={(e) => setStateInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleCitySearch()}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-16 focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={handleCitySearch}
            className="bg-primary-dark text-white text-xs font-bold px-3 py-1.5 rounded-lg"
          >
            Buscar
          </button>
        </div>
      )}
    </div>
  )
}

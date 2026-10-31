import type { Address } from '@/lib/domain/account'
import type { Dispatch, SetStateAction } from 'react'

interface Props {
useCustomAddress: boolean
setUseCustomAddress: Dispatch<SetStateAction<boolean>>
isAddressValid: boolean
defaultAddress: Address
customAddress: Address
setCustomAddress: Dispatch<SetStateAction<Address>>
onContinue(): void
}

export function CheckoutAddressStep({ useCustomAddress, setUseCustomAddress, isAddressValid, defaultAddress, customAddress, setCustomAddress, onContinue }: Props) {
 return (
          <div className="max-w-2xl mx-auto">
            <h1 className="font-display font-black text-2xl text-brand-text mb-8">
              Endereço de entrega
            </h1>

            <div className="bg-white rounded-card shadow-card p-6 space-y-6">
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="address"
                    checked={!useCustomAddress}
                    onChange={() => setUseCustomAddress(false)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold text-brand-text">
                    Usar endereço do cadastro
                  </span>
                </label>
                {!useCustomAddress && (
                  <div className="mt-3 ml-7 p-3 bg-slate-50 rounded text-xs text-brand-muted">
                    {!isAddressValid && <p>Seu cadastro não tem um endereço completo. Informe outro endereço para continuar.</p>}
                    <p>
                      {defaultAddress.logradouro}, {defaultAddress.numero}
                      {defaultAddress.complemento && ` — ${defaultAddress.complemento}`}
                    </p>
                    <p>
                      {defaultAddress.bairro}, {defaultAddress.cidade}/{defaultAddress.estado}
                    </p>
                    <p>{defaultAddress.cep}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="address"
                    checked={useCustomAddress}
                    onChange={() => setUseCustomAddress(true)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold text-brand-text">Outro endereço</span>
                </label>

                {useCustomAddress && (
                  <div className="mt-3 ml-7 space-y-3">
                    <input
                      type="text"
                      placeholder="Logradouro *"
                      value={customAddress.logradouro}
                      onChange={(e) =>
                        setCustomAddress({ ...customAddress, logradouro: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Número *"
                      value={customAddress.numero}
                      onChange={(e) =>
                        setCustomAddress({ ...customAddress, numero: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Complemento"
                      value={customAddress.complemento || ''}
                      onChange={(e) =>
                        setCustomAddress({ ...customAddress, complemento: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Bairro"
                      value={customAddress.bairro}
                      onChange={(e) =>
                        setCustomAddress({ ...customAddress, bairro: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="CEP *"
                        value={customAddress.cep}
                        onChange={(e) =>
                          setCustomAddress({ ...customAddress, cep: e.target.value })
                        }
                        className="px-3 py-2 border border-slate-300 rounded text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Cidade *"
                        value={customAddress.cidade}
                        onChange={(e) =>
                          setCustomAddress({ ...customAddress, cidade: e.target.value })
                        }
                        className="px-3 py-2 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="UF (ex: SP) *"
                      value={customAddress.estado}
                      onChange={(e) =>
                        setCustomAddress({
                          ...customAddress,
                          estado: e.target.value.toUpperCase(),
                        })
                      }
                      maxLength={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                    {!isAddressValid && (
                      <p className="text-xs text-red-600">
                        Preencha todos os campos obrigatórios (*)
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-6 flex gap-3">
                <button
                  disabled
                  className="flex-1 py-3 px-4 border border-slate-300 rounded-full font-display font-bold text-sm opacity-50 cursor-not-allowed"
                >
                  Voltar
                </button>
                <button
                  onClick={() => onContinue()}
                  disabled={!isAddressValid}
                  className="flex-1 py-3 px-4 bg-primary-dark text-white rounded-full font-display font-bold text-sm hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        )
}

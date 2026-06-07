// src/components/fornecedor/PerfilTab.tsx
import { Mail, Phone, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { MockSupplier, maskCnpj } from '@/lib/supplier-mock'

interface PerfilTabProps {
  supplier: MockSupplier
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={14} className="text-primary-dark" />
      </div>
      <div>
        <p className="text-xs text-brand-muted font-semibold mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-brand-text">{value}</p>
      </div>
    </div>
  )
}

export default function PerfilTab({ supplier }: PerfilTabProps) {
  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <div className="bg-white rounded-card shadow-card p-6 flex flex-col gap-1">

        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">
          Dados da empresa
        </p>
        <InfoRow icon={Building2} label="Razão social" value={supplier.name} />
        <div className="h-px bg-slate-100" />
        <InfoRow icon={Building2} label="CNPJ" value={maskCnpj(supplier.cnpj)} />
        <div className="h-px bg-slate-100" />
        <InfoRow icon={Mail}      label="E-mail"       value={supplier.email} />
        <div className="h-px bg-slate-100" />
        <InfoRow icon={Phone}     label="Telefone"     value={supplier.phone} />

        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">
            Marcas que trabalho
          </p>
          <div className="flex flex-wrap gap-2">
            {supplier.brands.map((b) => (
              <span
                key={b}
                className="bg-primary-light text-primary-dark text-xs font-bold px-3 py-1 rounded-full"
              >
                {b}
              </span>
            ))}
            <button
              type="button"
              onClick={() => toast.info('Gerenciamento de marcas em breve.')}
              className="border border-dashed border-slate-300 text-slate-400 text-xs font-bold px-3 py-1 rounded-full hover:border-primary/40 hover:text-primary transition-colors"
            >
              + adicionar
            </button>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">
            Área de cobertura
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {supplier.states.map((s) => (
              <span
                key={s}
                className="bg-primary-light text-primary-dark text-xs font-bold px-3 py-1 rounded-full"
              >
                {s}
              </span>
            ))}
            <button
              type="button"
              onClick={() => toast.info('Gerenciamento de estados em breve.')}
              className="border border-dashed border-slate-300 text-slate-400 text-xs font-bold px-3 py-1 rounded-full hover:border-primary/40 hover:text-primary transition-colors"
            >
              + estado
            </button>
          </div>
          {supplier.ceps && supplier.ceps.length > 0 && (
            <div className="bg-slate-50 rounded-xl px-3 py-2 text-xs text-brand-muted">
              <span className="font-bold text-brand-text">CEPs específicos: </span>
              {supplier.ceps.join(', ')}
              <button
                type="button"
                onClick={() => toast.info('Gerenciamento de CEPs em breve.')}
                className="ml-2 text-primary hover:underline"
              >
                + CEP
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => toast.info('Edição de perfil em breve.')}
        className="w-full py-3 rounded-xl border-2 border-primary text-primary-dark font-display font-bold text-sm hover:bg-primary-light transition-colors"
      >
        ✏️ Editar perfil
      </button>
    </div>
  )
}

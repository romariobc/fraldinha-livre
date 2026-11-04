'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RecoverAccessPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setSent(false)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setSent(true)
    } catch (err) {
      // Same acknowledgement for absent accounts, without exposing registration.
      if (typeof err === 'object' && err && 'code' in err && err.code === 'auth/user-not-found') setSent(true)
      else setError('Não foi possível solicitar a recuperação. Confira o e-mail e tente novamente.')
    } finally { setBusy(false) }
  }
  return <main className="container-fl mx-auto px-4 py-12 max-w-lg">
    <h1 className="font-display text-2xl font-bold mb-4">Recuperar acesso</h1>
    <p className="text-brand-muted mb-6">Informe o e-mail usado no cadastro. Para contas Google, use a recuperação de acesso da sua conta Google.</p>
    <form onSubmit={submit} className="space-y-4">
      <Label htmlFor="recovery-email">E-mail</Label>
      <Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
      <Button type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar instruções'}</Button>
    </form>
    {sent && <p role="status" className="mt-4">Se houver uma conta com este e-mail, você receberá as instruções de recuperação.</p>}
    {error && <p role="alert" className="text-red-700 mt-4">{error}</p>}
    <Link href="/login" className="inline-block mt-6 text-primary-dark underline">Voltar ao login</Link>
  </main>
}

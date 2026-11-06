import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { apiFetch } from '@/lib/api-client'
import type { AuthUser } from '@/contexts/auth-context'

// Each boundary can be retried after a lost response without recreating identity,
// resetting profile fields, or changing an administrative commercial decision.
export async function completeOnboarding(user: AuthUser, role: 'comprador' | 'fornecedor') {
  await apiFetch('/auth/claim', { method: 'POST', body: JSON.stringify({ role }) })
  if (!auth.currentUser || auth.currentUser.uid !== user.uid) throw new Error('Sessão alterada. Entre novamente.')
  await auth.currentUser.getIdToken(true)
  const ref = doc(db, 'users', user.uid)
  const existing = await getDoc(ref)
  if (existing.exists()) {
    if (existing.data().role !== role) throw new Error('O perfil existente tem outro papel. Entre novamente.')
  } else {
    await setDoc(ref, { role, name: user.displayName || 'Usuario', email: user.email || '', createdAt: new Date().toISOString() })
  }
  if (role === 'fornecedor') {
    await apiFetch('/auth/supplier-application', { method: 'POST' })
  }
}

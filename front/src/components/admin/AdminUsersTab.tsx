'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { UserProfile } from '@/contexts/auth-context'

interface UserRow extends UserProfile {
  uid: string
}

export default function AdminUsersTab() {
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then((snapshot) => {
        setUsers(snapshot.docs.map((d) => ({ uid: d.id, ...(d.data() as UserProfile) })))
      })
      .catch(() => setError('Erro ao carregar usuários.'))
  }, [])

  if (error) return <div className="text-red-600 py-8 text-center">{error}</div>
  if (!users) return <div className="text-brand-muted py-8 text-center">Carregando...</div>

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2">Nome</th>
          <th className="py-2">E-mail</th>
          <th className="py-2">Papel</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.uid} className="border-b">
            <td className="py-2">{u.name}</td>
            <td className="py-2">{u.email}</td>
            <td className="py-2">{u.role}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

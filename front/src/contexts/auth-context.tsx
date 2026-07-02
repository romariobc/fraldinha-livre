'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

export type UserRole = 'comprador' | 'fornecedor';

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Usuario logado: carregar role do Firestore
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
        });

        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists() && userDoc.data()?.role) {
            setRole(userDoc.data().role as UserRole);
          } else {
            setRole(null); // Sem papel => onboarding
          }
        } catch (error) {
          console.error('Erro ao carregar papel do Firestore:', error);
          setRole(null);
        }
      } else {
        // Usuario deslogado
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged dispara automaticamente apos o login
    } catch (error) {
      console.error('Erro ao fazer login com Google:', error);
      throw error;
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    role,
    loading,
    signInGoogle,
    signOutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}

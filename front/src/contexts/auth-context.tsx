'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateFirebaseAuthProfile,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

export type UserRole = 'comprador' | 'fornecedor';

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface UserProfile {
  role: UserRole;
  name: string;
  email: string;
  cpf?: string;
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  phone?: string;
  address?: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, name: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Retorno do signInWithRedirect (mobile/WebView) - onAuthStateChanged abaixo ja
    // restabelece a sessao; isto so captura erro de redirect que passaria em silencio.
    getRedirectResult(auth).catch((error) => {
      console.error('Erro ao concluir login via redirect:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Usuario logado: carregar perfil completo do Firestore
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
        });

        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            setProfile(data);
            setRole(data.role || null); // Sem papel => onboarding
          } else {
            setProfile(null);
            setRole(null); // Sem papel => onboarding
          }
        } catch (error) {
          console.error('Erro ao carregar perfil do Firestore:', error);
          setProfile(null);
          setRole(null);
        }
      } else {
        // Usuario deslogado
        setUser(null);
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInGoogle = async () => {
    // Popup e bloqueado/quebra em navegadores moveis e em WebViews de apps
    // (Instagram/WhatsApp) - nesses casos, signInWithRedirect e o unico caminho
    // confiavel. onAuthStateChanged (acima) restabelece a sessao nos dois casos.
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    try {
      if (isMobile) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error) {
      console.error('Erro ao fazer login com Google:', error);
      throw error;
    }
  };

  const signInEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged dispara automaticamente apos o login
    } catch (error) {
      console.error('Erro ao fazer login com e-mail/senha:', error);
      throw error;
    }
  };

  const signUpEmail = async (email: string, password: string, name: string) => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) {
        await updateFirebaseAuthProfile(credential.user, { displayName: name.trim() });
      }
      // Sem doc em users/{uid} ainda - onAuthStateChanged (acima) resolve role=null,
      // e a pagina /onboarding (ja existente, mesmo fluxo do login Google) grava o
      // papel escolhido. Nao duplicar essa decisao aqui.
    } catch (error) {
      console.error('Erro ao criar conta com e-mail/senha:', error);
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

  const updateProfile = async (patch: Partial<UserProfile>) => {
    if (!user) throw new Error('Usuario nao autenticado');

    // D-013: NUNCA gravar role via updateProfile
    const safePatch = { ...patch };
    delete safePatch.role;

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const dataToUpdate = {
        ...safePatch,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(userDocRef, dataToUpdate);

      // Atualizar estado local apos gravar
      setProfile((prev) => prev ? { ...prev, ...dataToUpdate } : null);
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    role,
    loading,
    signInGoogle,
    signInEmail,
    signUpEmail,
    signOutUser,
    updateProfile,
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

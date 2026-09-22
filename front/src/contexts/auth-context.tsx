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
import { apiFetch } from '@/lib/api-client';

export type UserRole = 'comprador' | 'fornecedor' | 'admin';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface SavedCard {
  id: string
  brand: string
  last4: string
  holderName: string
  expirationDate: string
}

export interface LastPurchase {
  productId: string
  productName: string
  quantity: number
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
  savedCards?: SavedCard[];
  lastPurchase?: LastPurchase;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  role: UserRole | null;
  claims: Record<string, unknown> | null;
  isAdmin: boolean;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, name: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  refreshClaims?: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cache em memória para evitar chamadas duplicadas de migração na mesma sessão
const migratedUsersCache = new Set<string>();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [claims, setClaims] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Retorno do signInWithRedirect (mobile/WebView)
    getRedirectResult(auth).catch((error) => {
      console.error('Erro ao concluir login via redirect:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Usuario logado: carregar claims e perfil completo
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
        });

        let tokenRole: UserRole | null = null;
        let tokenClaims: Record<string, unknown> | null = null;

        try {
          if (typeof fbUser.getIdTokenResult === 'function') {
            const tokenResult = await fbUser.getIdTokenResult();
            tokenClaims = (tokenResult.claims as Record<string, unknown>) || null;
            if (tokenClaims) {
              if (tokenClaims.role === 'admin' || tokenClaims.admin === true) {
                tokenRole = 'admin';
              } else if (tokenClaims.role === 'fornecedor' || tokenClaims.fornecedor === true) {
                tokenRole = 'fornecedor';
              } else if (tokenClaims.role === 'comprador' || tokenClaims.comprador === true) {
                tokenRole = 'comprador';
              }
            }
          }
        } catch (err) {
          console.error('Erro ao obter Custom Claims do token:', err);
        }

        setClaims(tokenClaims);

        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            setProfile(data);

            // MIGRATION LAZY (AUTH-001):
            // Se o usuário possui role legítimo no Firestore ('comprador' ou 'fornecedor'),
            // mas ainda não possui o Custom Claim correspondente no JWT, auto-migramos via POST /auth/claim.
            if (
              !tokenRole &&
              (data.role === 'comprador' || data.role === 'fornecedor') &&
              !migratedUsersCache.has(fbUser.uid)
            ) {
              migratedUsersCache.add(fbUser.uid);
              apiFetch('/auth/claim', {
                method: 'POST',
                body: JSON.stringify({ role: data.role }),
              })
                .then(async (res) => {
                  if (res.ok && typeof fbUser.getIdTokenResult === 'function') {
                    // Força renovação do token e atualiza estado local de claims/role
                    const tokenResult = await fbUser.getIdTokenResult(true);
                    const freshClaims = (tokenResult.claims as Record<string, unknown>) || null;
                    setClaims(freshClaims);
                    if (freshClaims?.role === 'comprador' || freshClaims?.role === 'fornecedor') {
                      setRole(freshClaims.role as UserRole);
                    }
                  }
                })
                .catch((err) => {
                  console.warn('[auth-context] Falha na auto-migração de Custom Claim:', err);
                });
            }

            setRole(tokenRole || data.role || null); // Custom claims tem precedencia
          } else {
            setProfile(null);
            setRole(tokenRole || null);
          }
        } catch (error) {
          console.error('Erro ao carregar perfil do Firestore:', error);
          setProfile(null);
          setRole(tokenRole || null);
        }
      } else {
        // Usuario deslogado
        setUser(null);
        setProfile(null);
        setRole(null);
        setClaims(null);
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

  const refreshClaims = async () => {
    if (auth.currentUser) {
      if (typeof auth.currentUser.getIdTokenResult === 'function') {
        const tokenResult = await auth.currentUser.getIdTokenResult(true);
        const tokenClaims = (tokenResult.claims as Record<string, unknown>) || null;
        let tokenRole: UserRole | null = null;
        if (tokenClaims) {
          if (tokenClaims.role === 'admin' || tokenClaims.admin === true) {
            tokenRole = 'admin';
          } else if (tokenClaims.role === 'fornecedor' || tokenClaims.fornecedor === true) {
            tokenRole = 'fornecedor';
          } else if (tokenClaims.role === 'comprador' || tokenClaims.comprador === true) {
            tokenRole = 'comprador';
          }
        }
        setClaims(tokenClaims);
        if (tokenRole) {
          setRole(tokenRole);
        }
      } else if (typeof auth.currentUser.getIdToken === 'function') {
        await auth.currentUser.getIdToken(true);
      }
    }
  };

  const isAdmin = Boolean(
    role === 'admin' ||
    claims?.admin === true ||
    (process.env.NEXT_PUBLIC_ADMIN_UID && user?.uid === process.env.NEXT_PUBLIC_ADMIN_UID)
  );

  const value: AuthContextType = {
    user,
    profile,
    role,
    claims,
    isAdmin,
    loading,
    signInGoogle,
    signInEmail,
    signUpEmail,
    signOutUser,
    updateProfile,
    refreshClaims,
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

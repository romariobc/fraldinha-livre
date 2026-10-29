import { beforeEach, describe, expect, it, vi } from 'vitest'
import { completeOnboarding } from '../complete-onboarding'
import { apiFetch } from '@/lib/api-client'
import { getDoc, setDoc } from 'firebase/firestore'
import { auth } from '@/lib/firebase'

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'test', getIdToken: vi.fn() } } }))
vi.mock('firebase/firestore', () => ({ doc: vi.fn(() => 'profile'), getDoc: vi.fn(), setDoc: vi.fn() }))
const user = { uid: 'test', email: 'qa@example.com', displayName: 'QA' }
describe('cadastro retomável entre Auth, Firestore e D1', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(apiFetch).mockResolvedValue(new Response('{}'))
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as Awaited<ReturnType<typeof getDoc>>)
    vi.mocked(setDoc).mockResolvedValue(undefined)
  })
  it('para antes do perfil e D1 se a claim falhar', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('claim unavailable'))
    await expect(completeOnboarding(user, 'fornecedor')).rejects.toThrow('claim unavailable')
    expect(setDoc).not.toHaveBeenCalled()
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })
  it('falha ao renovar token permite tentar novamente sem criar outra identidade', async () => {
    vi.mocked(auth.currentUser!.getIdToken).mockRejectedValueOnce(new Error('token unavailable'))
    await expect(completeOnboarding(user, 'fornecedor')).rejects.toThrow('token unavailable')
    expect(setDoc).not.toHaveBeenCalled()
    await completeOnboarding(user, 'fornecedor')
    expect(apiFetch).toHaveBeenLastCalledWith('/auth/supplier-application', { method: 'POST' })
  })
  it('falha no Firestore não cria habilitação; retry reusa claim e cria perfil', async () => {
    vi.mocked(setDoc).mockRejectedValueOnce(new Error('firestore unavailable'))
    await expect(completeOnboarding(user, 'fornecedor')).rejects.toThrow('firestore unavailable')
    expect(apiFetch).toHaveBeenCalledTimes(1)
    await completeOnboarding(user, 'fornecedor')
    expect(apiFetch).toHaveBeenLastCalledWith('/auth/supplier-application', { method: 'POST' })
  })
  it('falha no D1 depois do perfil é retomável sem sobrescrever dados existentes', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(new Response('{}')).mockRejectedValueOnce(new Error('D1 unavailable'))
    await expect(completeOnboarding(user, 'fornecedor')).rejects.toThrow('D1 unavailable')
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ role: 'fornecedor', name: 'Preservado' }) } as Awaited<ReturnType<typeof getDoc>>)
    await completeOnboarding(user, 'fornecedor')
    expect(setDoc).toHaveBeenCalledTimes(1)
    expect(apiFetch).toHaveBeenLastCalledWith('/auth/supplier-application', { method: 'POST' })
  })
  it('perfil divergente não é sobrescrito; comprador não solicita habilitação', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ role: 'comprador' }) } as Awaited<ReturnType<typeof getDoc>>)
    await expect(completeOnboarding(user, 'fornecedor')).rejects.toThrow('outro papel')
    expect(setDoc).not.toHaveBeenCalled()
    await completeOnboarding(user, 'comprador')
    expect(apiFetch).not.toHaveBeenCalledWith('/auth/supplier-application', expect.anything())
  })
})

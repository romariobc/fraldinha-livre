import { importPKCS8, SignJWT } from 'jose'

export interface ServiceAccountCredentials {
  clientEmail: string
  privateKey: string
  projectId: string
}

export type ProvisionClaimsFn = (uid: string, claims: Record<string, unknown>) => Promise<void>
export type LookupClaimsFn = (uid: string) => Promise<{ customAttributes?: Record<string, unknown> } | null>

/**
 * Obtém token OAuth2 de curta duração da Google para a Service Account informada.
 * Utiliza o algoritmo RS256 e Web Crypto API (compatível com Cloudflare Workers).
 */
export async function getGoogleAccessToken(
  clientEmail: string,
  privateKeyPem: string,
): Promise<string> {
  const normalizedKey = privateKeyPem.replace(/\\n/g, '\n')
  const privateKey = await importPKCS8(normalizedKey, 'RS256')

  const now = Math.floor(Date.now() / 1000)
  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/identitytoolkit',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey)

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text()
    throw new Error(`Google OAuth2 token error (${tokenRes.status}): ${errorText}`)
  }

  const data = (await tokenRes.json()) as { access_token: string }
  return data.access_token
}

/**
 * Grava Custom Claims no usuário do Firebase Authentication via Google Identity Toolkit REST API.
 */
export async function setCustomClaimsViaGoogleApi(
  uid: string,
  claims: Record<string, unknown>,
  credentials: ServiceAccountCredentials,
): Promise<void> {
  const accessToken = await getGoogleAccessToken(
    credentials.clientEmail,
    credentials.privateKey,
  )

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${credentials.projectId}/accounts:update`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        localId: uid,
        customAttributes: JSON.stringify(claims),
      }),
    },
  )

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Identity Toolkit accounts:update failed (${res.status}): ${errorText}`)
  }
}

/**
 * Consulta os atributos e claims customizados de um usuário no Firebase Auth via Identity Toolkit REST API.
 */
export async function lookupUserViaGoogleApi(
  uid: string,
  credentials: ServiceAccountCredentials,
): Promise<{ customAttributes?: Record<string, unknown> } | null> {
  const accessToken = await getGoogleAccessToken(
    credentials.clientEmail,
    credentials.privateKey,
  )

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${credentials.projectId}/accounts:lookup`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        localId: [uid],
      }),
    },
  )

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Identity Toolkit accounts:lookup failed (${res.status}): ${errorText}`)
  }

  const data = (await res.json()) as { users?: Array<{ customAttributes?: string }> }
  if (!data.users || data.users.length === 0) return null
  const customAttributesStr = data.users[0].customAttributes
  return {
    customAttributes: customAttributesStr ? JSON.parse(customAttributesStr) : undefined,
  }
}

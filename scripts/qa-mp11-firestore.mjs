import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, setDoc, updateDoc } from 'firebase/firestore'

const projectId = 'demo-fraldinha-mp11'
const endpoint = new URL('http://' + (process.env.FIRESTORE_EMULATOR_HOST || ''))
assert(['localhost', '127.0.0.1'].includes(endpoint.hostname) && endpoint.port,
  'Use o emulador Firestore em loopback')

const apps = []
function client(name, mockUserToken) {
  const app = initializeApp({ projectId }, name)
  apps.push(app)
  const db = getFirestore(app)
  connectFirestoreEmulator(db, endpoint.hostname, Number(endpoint.port),
    mockUserToken ? { mockUserToken } : {})
  return db
}

async function denied(operation) {
  await assert.rejects(operation, { code: 'permission-denied' })
}

try {
  const fixture = client('fixture-owner', 'owner')
  const profile = { role: 'comprador', name: 'Comprador QA', email: 'buyer@example.test' }
  await setDoc(doc(fixture, 'users', 'buyer'), profile)
  await setDoc(doc(fixture, 'users', 'other'), profile)

  for (const [name, claims] of [['role', { role: 'admin' }], ['boolean', { admin: true }]]) {
    const db = client(name, { sub: 'admin-' + name, ...claims })
    assert.equal((await getDocs(collection(db, 'users'))).size, 2)
    await denied(updateDoc(doc(db, 'users', 'buyer'), { name: 'Alteração indevida' }))
  }

  const oldUid = client('legacy', { sub: 'KOQclmb5eshfkufioK03ayRh6Fi2' })
  await denied(getDocs(collection(oldUid, 'users')))
  const conflict = client('conflict', { sub: 'conflict', role: 'comprador', admin: true })
  await denied(getDoc(doc(conflict, 'users', 'other')))
  const buyer = client('buyer', { sub: 'buyer', role: 'comprador' })
  assert.equal((await getDoc(doc(buyer, 'users', 'buyer'))).data().name, profile.name)
  await updateDoc(doc(buyer, 'users', 'buyer'), { name: 'Perfil atualizado' })
  await denied(updateDoc(doc(buyer, 'users', 'buyer'), { role: 'admin' }))
  await denied(getDoc(doc(buyer, 'users', 'other')))
  await denied(getDoc(doc(client('guest'), 'users', 'buyer')))
  console.log('Firestore emulator: 11 claims, ownership and privilege assertions passed')
} finally {
  await Promise.all(apps.map(deleteApp))
}

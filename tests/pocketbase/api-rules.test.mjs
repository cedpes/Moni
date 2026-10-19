// Test d'isolation entre deux comptes contre un PocketBase local.
// Voir tests/pocketbase/README.md. NE PAS lancer contre la base de production.
import PocketBase from 'pocketbase'
const URL = process.env.PB_TEST_URL ?? 'http://127.0.0.1:8099'
const ADMIN_EMAIL = process.env.PB_TEST_ADMIN ?? 'admin@test.local'
const ADMIN_PASS = process.env.PB_TEST_ADMIN_PASSWORD ?? 'Adm1nPassw0rd!'

let ok = 0, ko = 0
const expect = (name, cond) => { cond ? ok++ : ko++; console.log(`${cond ? 'OK ' : 'ÉCHEC'}  ${name}`) }
const denied = async (name, fn) => {
  try { const r = await fn(); expect(name + ' → refusé', Array.isArray(r) ? r.length === 0 : false) }
  catch { expect(name + ' → refusé', true) }
}
const allowed = async (name, fn) => {
  try { const r = await fn(); expect(name + ' → autorisé', true); return r }
  catch (e) { expect(name + ' → autorisé (' + (e?.response?.message ?? e) + ')', false) }
}

const admin = new PocketBase(URL)
await admin.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASS)
for (const e of ['a@test.local', 'b@test.local']) {
  await admin.collection('users').create({ email: e, password: 'Passw0rd!123', passwordConfirm: 'Passw0rd!123', display_name: e })
}

// Parcours d'onboarding (identique à register/page.tsx, sauf la création du compte)
async function onboard(email) {
  const pb = new PocketBase(URL)
  await pb.collection('users').authWithPassword(email, 'Passw0rd!123')
  const uid = pb.authStore.record.id
  const ws = await pb.collection('workspaces').create({ name: 'Mon budget', owner_id: uid })
  await pb.collection('workspace_members').create({ workspace_id: ws.id, user_id: uid, role: 'owner' })
  const cat = await pb.collection('categories').create({ workspace_id: ws.id, name: 'Courses', icon: '🛒' })
  const month = await pb.collection('months').create({ workspace_id: ws.id, month_key: '2026-10', label: 'Oct', income: 0 })
  const env = await pb.collection('envelopes').create({ month_id: month.id, slug: 'plaisir', name: 'Plaisir', budget: 0 })
  const tx = await pb.collection('transactions').create({ month_id: month.id, workspace_id: ws.id, envelope_slug: 'plaisir', label: 'Ciné', amount: 12, category_id: cat.id, created_by: uid })
  const fi = await pb.collection('fixed_items').create({ workspace_id: ws.id, label: 'Loyer', type: 'charge', is_active: true })
  await pb.collection('fixed_item_status').create({ workspace_id: ws.id, fixed_item_id: fi.id, month_key: '2026-10', is_done: true })
  await pb.collection('planned_expenses').create({ month_id: month.id, label: 'Resto', amount: 30, category_id: cat.id })
  await pb.collection('savings_goals').create({ workspace_id: ws.id, name: 'Vacances', target_amount: 500 })
  const members = await pb.collection('workspace_members').getFullList({ filter: pb.filter('user_id = {:u}', { u: uid }) })
  const store = await pb.collection('stores').create({ workspace_id: ws.id, name: 'Intermarché', icon: '🛒', color: '#fff3cd', position: 0 })
  return { pb, uid, ws, cat, month, env, tx, fi, members, store }
}

let A, B
try { A = await onboard('a@test.local'); expect('onboarding A complet', A.members.length === 1) } catch (e) { expect('onboarding A : ' + e?.response?.message, false); process.exit(1) }
try { B = await onboard('b@test.local'); expect('onboarding B complet', B.members.length === 1) } catch (e) { expect('onboarding B : ' + e?.response?.message, false); process.exit(1) }

// Usage normal de A
await allowed('A lit ses transactions', () => A.pb.collection('transactions').getFullList())
expect('A ne voit que ses transactions', (await A.pb.collection('transactions').getFullList()).every(t => t.workspace_id === A.ws.id))
await allowed('A modifie sa transaction', () => A.pb.collection('transactions').update(A.tx.id, { amount: 15 }))
await allowed('A modifie son enveloppe', () => A.pb.collection('envelopes').update(A.env.id, { budget: 100 }))
await allowed('A renomme son magasin', () => A.pb.collection('stores').update(A.store.id, { name: 'Intermarché Hyper' }))
await denied('A crée un magasin en double', () => A.pb.collection('stores').create({ workspace_id: A.ws.id, name: 'intermarché hyper' }))
await denied('A crée un magasin avec une couleur invalide', () => A.pb.collection('stores').create({ workspace_id: A.ws.id, name: 'X', color: 'red;}' }))
await allowed('A modifie son profil', () => A.pb.collection('users').update(A.uid, { display_name: 'Alice' }))

// Attaques de B contre A
const b = B.pb
for (const c of ['workspaces', 'months', 'categories', 'transactions', 'envelopes', 'planned_expenses', 'fixed_items', 'fixed_item_status', 'savings_goals', 'stores']) {
  const rows = await b.collection(c).getFullList()
  const leak = rows.filter(r => [r.workspace_id, r.month_id, r.id].some(v => v === A.ws.id || v === A.month.id))
  expect(`B ne voit rien de A dans ${c}`, leak.length === 0)
}
await denied('B lit la transaction de A par id', () => b.collection('transactions').getOne(A.tx.id))
await denied('B lit le profil de A', () => b.collection('users').getOne(A.uid))
expect('B ne liste que son propre compte', (await b.collection('users').getFullList()).length === 1)
await denied('B s\'ajoute membre du workspace de A', () => b.collection('workspace_members').create({ workspace_id: A.ws.id, user_id: B.uid, role: 'owner' }))
await denied('B ajoute A dans son workspace', () => b.collection('workspace_members').create({ workspace_id: B.ws.id, user_id: A.uid, role: 'editor' }))
await denied('B crée un workspace au nom de A', () => b.collection('workspaces').create({ name: 'x', owner_id: A.uid }))
await denied('B crée une transaction dans le workspace de A', () => b.collection('transactions').create({ month_id: A.month.id, workspace_id: A.ws.id, envelope_slug: 'x', label: 'x', amount: 1 }))
await denied('B crée une transaction avec le mois de A', () => b.collection('transactions').create({ month_id: A.month.id, workspace_id: B.ws.id, envelope_slug: 'x', label: 'x', amount: 1 }))
await denied('B utilise une catégorie de A', () => b.collection('transactions').create({ month_id: B.month.id, workspace_id: B.ws.id, category_id: A.cat.id, envelope_slug: 'x', label: 'x', amount: 1 }))
await denied('B crée une enveloppe dans le mois de A', () => b.collection('envelopes').create({ month_id: A.month.id, slug: 'x', name: 'x' }))
await denied('B crée un statut sur l\'élément fixe de A', () => b.collection('fixed_item_status').create({ workspace_id: B.ws.id, fixed_item_id: A.fi.id, month_key: '2026-10' }))
await denied('B modifie la transaction de A', () => b.collection('transactions').update(A.tx.id, { amount: 999 }))
await denied('B supprime la transaction de A', () => b.collection('transactions').delete(A.tx.id))
await denied('B modifie l\'enveloppe de A', () => b.collection('envelopes').update(A.env.id, { budget: 1 }))
await denied('B déplace sa transaction vers le workspace de A', () => b.collection('transactions').update(B.tx.id, { workspace_id: A.ws.id }))
await denied('B déplace son enveloppe vers le mois de A', () => b.collection('envelopes').update(B.env.id, { month_id: A.month.id }))
await denied('B prend la propriété de son workspace pour A', () => b.collection('workspaces').update(B.ws.id, { owner_id: A.uid }))
await denied('B lit le magasin de A par id', () => b.collection('stores').getOne(A.store.id))
await denied('B crée un magasin dans le workspace de A', () => b.collection('stores').create({ workspace_id: A.ws.id, name: 'Pirate' }))
await denied('B renomme le magasin de A', () => b.collection('stores').update(A.store.id, { name: 'x' }))
await denied('B supprime le magasin de A', () => b.collection('stores').delete(A.store.id))
await denied('B déplace son magasin vers le workspace de A', () => b.collection('stores').update(B.store.id, { workspace_id: A.ws.id }))
await denied('B supprime l\'adhésion de A', () => b.collection('workspace_members').delete(A.members[0].id))

// Anonyme
const anon = new PocketBase(URL)
await denied('Anonyme liste les transactions', () => anon.collection('transactions').getFullList())
await denied('Anonyme liste les magasins', () => anon.collection('stores').getFullList())
await denied('Inscription publique', () => anon.collection('users').create({ email: 'c@test.local', password: 'Passw0rd!123', passwordConfirm: 'Passw0rd!123' }))

// Intégrité : la transaction de A n'a pas bougé
const txA = await A.pb.collection('transactions').getOne(A.tx.id)
expect('Transaction de A intacte', txA.amount === 15 && txA.workspace_id === A.ws.id)
const storeA = await A.pb.collection('stores').getOne(A.store.id)
expect('Magasin de A intact', storeA.name === 'Intermarché Hyper' && storeA.workspace_id === A.ws.id)

console.log(`\n${ok} OK, ${ko} ÉCHEC`)
process.exit(ko ? 1 : 0)

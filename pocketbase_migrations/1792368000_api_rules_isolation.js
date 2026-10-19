/// <reference path="../pb_data/types.d.ts" />
// Moni — règles d'accès (API Rules) versionnées.
//
// Le navigateur parle directement à PocketBase : ces règles sont la SEULE barrière
// entre les données de deux comptes. Principe :
//   - un enregistrement n'est visible / modifiable que par les membres de son workspace ;
//   - on ne peut pas rattacher un enregistrement à un workspace (ou un mois, une
//     catégorie, un élément fixe) dont on n'est pas membre ;
//   - on ne peut pas déplacer un enregistrement vers un autre workspace / mois ;
//   - on ne peut s'ajouter qu'à un workspace dont on est propriétaire ;
//   - un utilisateur ne voit et ne modifie que son propre compte ;
//   - l'inscription publique est FERMÉE (créer les comptes depuis l'admin PocketBase,
//     ou remettre users.createRule = "" temporairement).
//
// La migration vérifie d'abord que chaque champ attendu existe et est bien une relation
// vers la bonne collection. Si ce n'est pas le cas, elle s'arrête AVANT toute
// modification (PocketBase exécute chaque migration dans une transaction).
migrate((app) => {
  const AUTH = '@request.auth.id != ""'

  // ── Vérification du schéma ────────────────────────────────────────────────
  const errors = []
  const cols = {}
  const get = (name) => {
    if (cols[name] !== undefined) return cols[name]
    try { cols[name] = app.findCollectionByNameOrId(name) } catch (_) { cols[name] = null }
    return cols[name]
  }
  const has = (col, field) => !!get(col) && !!get(col).fields.getByName(field)
  const requireRel = (col, field, target) => {
    const c = get(col)
    if (!c) { errors.push(`collection "${col}" introuvable`); return }
    const f = c.fields.getByName(field)
    const t = get(target)
    if (!f) errors.push(`${col}.${field} introuvable`)
    else if (f.type() !== "relation") errors.push(`${col}.${field} doit être une relation (type actuel : ${f.type()})`)
    else if (t && f.collectionId !== t.id) errors.push(`${col}.${field} doit pointer vers "${target}"`)
  }

  requireRel("workspaces", "owner_id", "users")
  requireRel("workspace_members", "workspace_id", "workspaces")
  requireRel("workspace_members", "user_id", "users")

  // Collections rattachées directement à un workspace / à un mois.
  const BY_WORKSPACE = ["months", "categories", "transactions", "fixed_items", "fixed_item_status", "savings_goals"]
  const BY_MONTH = ["envelopes", "planned_expenses"]
  BY_WORKSPACE.forEach(c => { if (get(c)) requireRel(c, "workspace_id", "workspaces") })
  BY_MONTH.forEach(c => { if (get(c)) requireRel(c, "month_id", "months") })
  if (BY_MONTH.some(c => get(c)) && get("months")) requireRel("months", "workspace_id", "workspaces")

  // Relations secondaires contrôlées si elles existent.
  const optionalRel = [
    ["transactions", "month_id", "months"],
    ["transactions", "category_id", "categories"],
    ["planned_expenses", "category_id", "categories"],
    ["fixed_item_status", "fixed_item_id", "fixed_items"],
  ]
  optionalRel.forEach(([c, f, t]) => { if (has(c, f)) requireRel(c, f, t) })

  if (errors.length) {
    throw new Error("Moni api_rules : schéma inattendu, aucune règle modifiée.\n - " + errors.join("\n - "))
  }

  // ── Construction des règles ───────────────────────────────────────────────
  const MEMBER = (path) => `${path}.workspace_members_via_workspace_id.user_id ?= @request.auth.id`
  const frozen = (field) => `(@request.body.${field}:isset = false || @request.body.${field} = ${field})`
  const and = (...parts) => parts.filter(Boolean).join(" && ")

  const apply = (name, r) => {
    const c = get(name)
    if (!c) return
    c.listRule = r.list; c.viewRule = r.view; c.createRule = r.create
    c.updateRule = r.update; c.deleteRule = r.remove
    app.save(c)
  }

  // users : uniquement soi-même. Inscription publique fermée (null = superusers seulement).
  const users = get("users")
  users.listRule = "id = @request.auth.id"
  users.viewRule = "id = @request.auth.id"
  users.createRule = null
  users.updateRule = "id = @request.auth.id"
  users.deleteRule = "id = @request.auth.id"
  app.save(users)

  // workspaces : visibles par les membres, gérés par le propriétaire.
  const wsMember = and(AUTH, "workspace_members_via_workspace_id.user_id ?= @request.auth.id")
  apply("workspaces", {
    list: wsMember,
    view: wsMember,
    create: and(AUTH, "owner_id = @request.auth.id"),
    update: and(AUTH, "owner_id = @request.auth.id", frozen("owner_id")),
    remove: and(AUTH, "owner_id = @request.auth.id"),
  })

  // workspace_members : on ne peut s'ajouter soi-même qu'à un workspace qu'on possède.
  apply("workspace_members", {
    list: and(AUTH, "(user_id = @request.auth.id || workspace_id.owner_id = @request.auth.id)"),
    view: and(AUTH, "(user_id = @request.auth.id || workspace_id.owner_id = @request.auth.id)"),
    create: and(AUTH, "user_id = @request.auth.id", "workspace_id.owner_id = @request.auth.id"),
    update: null,
    remove: and(AUTH, "workspace_id.owner_id = @request.auth.id"),
  })

  // Cohérence des relations secondaires (même workspace que l'enregistrement).
  const extraChecks = {
    transactions: [
      has("transactions", "month_id") && "month_id.workspace_id = workspace_id",
      has("transactions", "category_id") && '(category_id = "" || category_id.workspace_id = workspace_id)',
    ],
    fixed_item_status: [
      has("fixed_item_status", "fixed_item_id") && "fixed_item_id.workspace_id = workspace_id",
    ],
    planned_expenses: [
      has("planned_expenses", "category_id") && '(category_id = "" || category_id.workspace_id = month_id.workspace_id)',
    ],
  }
  const frozenParents = {
    transactions: ["workspace_id", "month_id"],
    fixed_item_status: ["workspace_id", "fixed_item_id"],
  }

  BY_WORKSPACE.forEach(name => {
    const m = and(AUTH, MEMBER("workspace_id"))
    const extra = (extraChecks[name] || []).filter(Boolean)
    const freeze = (frozenParents[name] || ["workspace_id"]).filter(f => has(name, f)).map(frozen)
    apply(name, {
      list: m, view: m, remove: m,
      create: and(m, ...extra),
      update: and(m, ...freeze, ...extra),
    })
  })

  BY_MONTH.forEach(name => {
    const m = and(AUTH, MEMBER("month_id.workspace_id"))
    const extra = (extraChecks[name] || []).filter(Boolean)
    apply(name, {
      list: m, view: m, remove: m,
      create: and(m, ...extra),
      update: and(m, frozen("month_id"), ...extra),
    })
  })
}, (app) => {
  // Pas de retour arrière automatique : revenir aux anciennes règles (inconnues et
  // potentiellement permissives) rouvrirait les données. Modifier via l'admin si besoin.
})

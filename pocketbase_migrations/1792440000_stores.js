/// <reference path="../pb_data/types.d.ts" />
// Moni — magasins personnalisés (page Courses).
//
// Crée la collection `stores` : un magasin appartient à un workspace. Les règles
// d'accès suivent celles de 1792368000_api_rules_isolation.js : seuls les membres du
// workspace voient, créent, modifient et suppriment ses magasins ; un magasin ne peut
// pas être déplacé vers un autre workspace. Le nom est unique par workspace.
migrate((app) => {
  if ((() => { try { return app.findCollectionByNameOrId("stores") } catch (_) { return null } })()) return

  const workspaces = app.findCollectionByNameOrId("workspaces")
  const AUTH = '@request.auth.id != ""'
  const MEMBER = 'workspace_id.workspace_members_via_workspace_id.user_id ?= @request.auth.id'
  const member = `${AUTH} && ${MEMBER}`

  const stores = new Collection({
    type: "base",
    name: "stores",
    fields: [
      { name: "workspace_id", type: "relation", collectionId: workspaces.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "name", type: "text", required: true, min: 1, max: 40 },
      { name: "icon", type: "text", max: 16 },
      { name: "color", type: "text", max: 7, pattern: "^(#[0-9a-fA-F]{6})?$" },
      { name: "position", type: "number" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_stores_ws_name ON stores (workspace_id, name COLLATE NOCASE)",
    ],
    listRule: member,
    viewRule: member,
    createRule: member,
    updateRule: `${member} && (@request.body.workspace_id:isset = false || @request.body.workspace_id = workspace_id)`,
    deleteRule: member,
  })
  app.save(stores)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("stores")) } catch (_) {}
})

/// Fixture de TEST uniquement : reproduit le schéma Moni avec des règles
/// permissives (situation "avant") pour valider la migration des API rules.
migrate((app) => {
  const open = '@request.auth.id != ""'
  const rules = { listRule: open, viewRule: open, createRule: open, updateRule: open, deleteRule: open }

  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new TextField({ name: "display_name" }))
  users.fields.add(new TextField({ name: "currency" }))
  users.listRule = ""; users.viewRule = ""; users.createRule = ""; users.updateRule = "id = @request.auth.id"; users.deleteRule = "id = @request.auth.id"
  app.save(users)

  const rel = (name, col) => ({ name, type: "relation", collectionId: col.id, maxSelect: 1 })
  const mk = (name, fields) => { const c = new Collection({ type: "base", name, fields, ...rules }); app.save(c); return c }

  const ws = mk("workspaces", [{ name: "name", type: "text" }, rel("owner_id", users)])
  mk("workspace_members", [rel("workspace_id", ws), rel("user_id", users), { name: "role", type: "text" }])
  const months = mk("months", [rel("workspace_id", ws), { name: "month_key", type: "text" }, { name: "label", type: "text" },
    { name: "income", type: "number" }, { name: "courses_budget", type: "number" }, { name: "courses_weekly_budget", type: "number" }])
  const cats = mk("categories", [rel("workspace_id", ws), { name: "name", type: "text" }, { name: "icon", type: "text" }])
  mk("envelopes", [rel("month_id", months), { name: "slug", type: "text" }, { name: "name", type: "text" }, { name: "budget", type: "number" }])
  mk("planned_expenses", [rel("month_id", months), rel("category_id", cats), { name: "label", type: "text" }, { name: "amount", type: "number" }])
  mk("transactions", [rel("month_id", months), rel("workspace_id", ws), rel("category_id", cats), { name: "label", type: "text" },
    { name: "amount", type: "number" }, { name: "envelope_slug", type: "text" }, rel("created_by", users)])
  const fi = mk("fixed_items", [rel("workspace_id", ws), { name: "label", type: "text" }, { name: "type", type: "text" }, { name: "is_active", type: "bool" }])
  mk("fixed_item_status", [rel("workspace_id", ws), rel("fixed_item_id", fi), { name: "month_key", type: "text" }, { name: "is_done", type: "bool" }])
  mk("savings_goals", [rel("workspace_id", ws), { name: "name", type: "text" }, { name: "target_amount", type: "number" }])
})

/// <reference path="../pb_data/types.d.ts" />
// Moni — revenus annuels (13e mois, primes)
// Ajoute sur fixed_items : annual_months (texte "06,11" = versé en juin et novembre chaque année).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("fixed_items")
  if (!collection.fields.getByName("annual_months")) {
    collection.fields.add(new TextField({ name: "annual_months", max: 40, pattern: "^((0[1-9]|1[0-2])(,(0[1-9]|1[0-2]))*)?$" }))
  }
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("fixed_items")
  collection.fields.removeByName("annual_months")
  return app.save(collection)
})

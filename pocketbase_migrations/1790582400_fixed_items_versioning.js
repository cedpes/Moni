/// <reference path="../pb_data/types.d.ts" />
// Moni — historisation des revenus + revenus exceptionnels
// Ajoute sur fixed_items : start_month, end_month (YYYY-MM) et is_exceptional.
// Les items existants gardent start_month/end_month vides = valables sur tous les mois.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("fixed_items")

  if (!collection.fields.getByName("start_month")) {
    collection.fields.add(new TextField({ name: "start_month", max: 7, pattern: "^(\\d{4}-\\d{2})?$" }))
  }
  if (!collection.fields.getByName("end_month")) {
    collection.fields.add(new TextField({ name: "end_month", max: 7, pattern: "^(\\d{4}-\\d{2})?$" }))
  }
  if (!collection.fields.getByName("is_exceptional")) {
    collection.fields.add(new BoolField({ name: "is_exceptional" }))
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("fixed_items")
  collection.fields.removeByName("start_month")
  collection.fields.removeByName("end_month")
  collection.fields.removeByName("is_exceptional")
  return app.save(collection)
})

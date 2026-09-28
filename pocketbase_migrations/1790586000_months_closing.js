/// <reference path="../pb_data/types.d.ts" />
// Moni — clôture des mois
// Ajoute sur months : is_closed (bool), closed_at (date) et fixed_snapshot (json :
// copie figée des revenus/charges fixes du mois au moment de la clôture).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("months")

  if (!collection.fields.getByName("is_closed")) {
    collection.fields.add(new BoolField({ name: "is_closed" }))
  }
  if (!collection.fields.getByName("closed_at")) {
    collection.fields.add(new DateField({ name: "closed_at" }))
  }
  if (!collection.fields.getByName("fixed_snapshot")) {
    collection.fields.add(new JSONField({ name: "fixed_snapshot", maxSize: 2000000 }))
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("months")
  collection.fields.removeByName("is_closed")
  collection.fields.removeByName("closed_at")
  collection.fields.removeByName("fixed_snapshot")
  return app.save(collection)
})

# Test d'isolation des API Rules PocketBase

Vérifie qu'un compte ne peut ni lire, ni créer, ni modifier, ni supprimer les données
d'un autre compte (48 contrôles). À lancer sur un PocketBase **jetable**, jamais sur la prod.

```bash
# 1. Base de test vide : fixture du schéma + migrations du dépôt
mkdir -p /tmp/moni-pb/pb_migrations
cp tests/pocketbase/fixture/*.js pocketbase_migrations/*.js /tmp/moni-pb/pb_migrations/
pocketbase migrate up --dir=/tmp/moni-pb/pb_data --migrationsDir=/tmp/moni-pb/pb_migrations
pocketbase superuser upsert admin@test.local 'Adm1nPassw0rd!' --dir=/tmp/moni-pb/pb_data
pocketbase serve --http=127.0.0.1:8099 --dir=/tmp/moni-pb/pb_data --migrationsDir=/tmp/moni-pb/pb_migrations &

# 2. Test
npm run test:rules
```

La fixture reproduit le schéma Moni avec des règles permissives (« avant ») ; la migration
`1792368000_api_rules_isolation.js` les remplace. Sans cette migration, le test échoue (fuites détectées).

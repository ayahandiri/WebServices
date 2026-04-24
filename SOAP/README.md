# PARTIE 1 — Service SOAP MythicGames

Service Web SOAP exposant les opérations CRUD sur les `products`, connecté à PostgreSQL.

## Démarrage

```bash
# 1. Lancer PostgreSQL
docker run --name pg-mythic \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=mythicdb \
  -p 5432:5432 -d postgres:15

# 2. Initialiser la base
docker exec -i pg-mythic psql -U postgres -d mythicdb < init.sql

# 3. Installer les dépendances
npm install

# 4. Démarrer le serveur
node server.js

# 5. Dans un autre terminal, lancer le client de test
node client.js
```

## Endpoints

| URL | Description |
|-----|-------------|
| `http://localhost:8000/products` | Endpoint SOAP |
| `http://localhost:8000/products?wsdl` | WSDL du service |

## Opérations SOAP

| Opération | Arguments | Retour |
|-----------|-----------|--------|
| `CreateProduct` | `name`, `about`, `price` | product |
| `GetProducts` | — | tableau de products |
| `GetProduct` | `id` | product |
| `PatchProduct` | `id` + champs optionnels | product mis à jour |
| `DeleteProduct` | `id` | message de confirmation |

## Gestion d'erreurs

- **400** — arguments manquants ou invalides
- **404** — produit introuvable
- **500** — erreur base de données

Les erreurs sont retournées comme des SOAP Faults standard.

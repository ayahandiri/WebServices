# PARTIE 2 — REST API + PostgreSQL

API REST Express avec validation Zod, hashage SHA-512, proxy FreeToGame, et Swagger UI.

## Démarrage

```bash
# PostgreSQL doit tourner (voir docker-compose.yml ou Partie 1)
docker exec -i pg-mythic psql -U postgres -d mythicdb < init.sql

npm install
node server.js
```

Serveur    : `http://localhost:3000`  
Swagger UI : `http://localhost:3000/docs`

## Routes

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /products | Créer un produit |
| GET | /products | Liste (filtres: ?name, ?about, ?price) |
| GET | /products/:id | Produit + reviews + score moyen |
| PUT | /products/:id | Remplacer |
| PATCH | /products/:id | Mise à jour partielle |
| DELETE | /products/:id | Supprimer |
| POST | /users | Créer (password hashé SHA-512) |
| GET | /users | Liste |
| GET | /users/:id | Un user (sans password) |
| PUT | /users/:id | Remplacer |
| PATCH | /users/:id | Mise à jour partielle |
| DELETE | /users/:id | Supprimer |
| GET | /f2p-games | Proxy FreeToGame |
| GET | /f2p-games/:id | Proxy FreeToGame détail |
| POST | /orders | Créer (total = somme * 1.2) |
| GET | /orders | Liste |
| GET | /orders/:id | Commande + user + produits |
| PUT | /orders/:id | Remplacer |
| PATCH | /orders/:id | Mise à jour partielle |
| DELETE | /orders/:id | Supprimer |
| POST | /reviews | Créer |
| GET | /reviews | Liste |
| GET | /reviews/:id | Une review |
| PUT | /reviews/:id | Remplacer |
| PATCH | /reviews/:id | Mise à jour partielle |
| DELETE | /reviews/:id | Supprimer |

## Sécurité

Le password est hashé ainsi : `sha512(salt + password)` stocké sous la forme `salt:hash`.  
Le champ password **n'est jamais** renvoyé dans les réponses.

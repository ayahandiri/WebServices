# PARTIE 3 — REST API + MongoDB

API REST Express + MongoDB avec agrégations ($lookup) et mise à jour temps réel via Socket.io.

## Démarrage

```bash
# MongoDB doit tourner
docker run --name mongodb -p 27017:27017 -d mongo:latest

npm install
node server.js
```

Serveur  : `http://localhost:3001`  
Frontend live : `http://localhost:3001/index.html`

## Routes

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /products | Créer un produit |
| GET | /products | Liste avec catégories jointes ($lookup) |
| GET | /products/:id | Produit avec catégories |
| PUT | /products/:id | Remplacer |
| PATCH | /products/:id | Mise à jour partielle |
| DELETE | /products/:id | Supprimer |
| POST | /categories | Créer une catégorie |
| GET | /categories | Liste |
| GET | /categories/:id | Une catégorie |
| PUT | /categories/:id | Remplacer |
| PATCH | /categories/:id | Mise à jour partielle |
| DELETE | /categories/:id | Supprimer |

## Socket.io

À chaque CREATE/UPDATE/DELETE sur `/products`, un événement est émis sur le canal `products` :

```json
{ "action": "CREATE" | "UPDATE" | "DELETE", "data": { ... } }
```

Le frontend sur `/index.html` écoute ces événements et met à jour la liste en temps réel.

## Agrégation MongoDB

Les produits sont retournés avec leurs catégories via un pipeline :

```js
[
  { $match: ... },
  { $addFields: { categoryOids: { $map: { input: '$categoryIds', ... $toObjectId } } } },
  { $lookup: { from: 'categories', localField: 'categoryOids', foreignField: '_id', as: 'categories' } }
]
```

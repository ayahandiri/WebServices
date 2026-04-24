# PARTIE 5 — REST Analytics

API d'analytics avec MongoDB (`analyticsDB`). Collecte les vues, actions et objectifs des visiteurs.

## Démarrage

```bash
# MongoDB doit tourner (même instance que Partie 3)
npm install
node server.js
```

Serveur : `http://localhost:3003`

## Routes

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /views | Enregistrer une vue |
| GET | /views | Toutes les vues |
| GET | /views/:id | Une vue |
| PUT | /views/:id | Remplacer |
| PATCH | /views/:id | Mise à jour partielle |
| DELETE | /views/:id | Supprimer |
| POST | /actions | Enregistrer une action |
| GET | /actions | Toutes les actions |
| GET | /actions/:id | Une action |
| PUT | /actions/:id | Remplacer |
| PATCH | /actions/:id | Mise à jour partielle |
| DELETE | /actions/:id | Supprimer |
| POST | /goals | Enregistrer un objectif |
| GET | /goals | Tous les objectifs |
| GET | /goals/:id | Un objectif |
| PUT | /goals/:id | Remplacer |
| PATCH | /goals/:id | Mise à jour partielle |
| DELETE | /goals/:id | Supprimer |
| **GET** | **/goals/:id/details** | **Parcours complet du visiteur** |

## Route spéciale : `/goals/:id/details`

Retourne le goal avec **toutes les vues et actions du même visiteur** via un pipeline MongoDB :

```json
{
  "_id": "...",
  "goal": "purchase_complete",
  "visitor": "visitor-uuid-001",
  "views":   [ { "url": "/products/elden-ring", "createdAt": "..." }, ... ],
  "actions": [ { "action": "add_to_cart", "createdAt": "..." }, ... ]
}
```

## Champ `meta`

Le champ `meta` est libre — utilise n'importe quelle structure :

```json
{ "meta": { "browser": "Chrome", "os": "Windows", "ref": "google" } }
{ "meta": { "orderId": "ord-999", "total": 49.99, "currency": "EUR" } }
{ "meta": { "duration": 120, "scrollDepth": "80%" } }
```

# MythicGames Marketplace — Atelier Services Web

Projet complet d'atelier couvrant SOAP, REST (PostgreSQL + MongoDB), WebSockets et Analytics.

## Prérequis

- Node.js 18+
- Docker Desktop (pour PostgreSQL et MongoDB)
- Extension REST Client (VS Code) pour tester les fichiers `.http`

## Lancement rapide (Docker Compose)

```bash
docker-compose up -d
```

Lance PostgreSQL (port 5432) et MongoDB (port 27017) en une commande.

---

## PARTIE 1 — SOAP (`SOAP/`)

Service Web SOAP sur NodeJS + PostgreSQL.

```bash
cd SOAP
npm install
# Lancer PostgreSQL
docker run --name pg-mythic -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mythicdb -p 5432:5432 -d postgres:15
docker exec -i pg-mythic psql -U postgres -d mythicdb < init.sql
# Démarrer le serveur
node server.js
# Dans un autre terminal, tester le client
node client.js
```

Serveur accessible sur : `http://localhost:8000/products?wsdl`

---

## PARTIE 2 — REST + PostgreSQL (`REST-POSTGRES/`)

API REST Express + PostgreSQL avec Zod, SHA-512, intégration FreeToGame.

```bash
cd REST-POSTGRES
npm install
# Réutilise le container pg-mythic (ou relance-le)
node server.js
```

Serveur : `http://localhost:3000`  
Swagger UI : `http://localhost:3000/docs`  
Fichier de test : `requests.http`

---

## PARTIE 3 — REST + MongoDB (`REST-MONGODB/`)

API REST Express + MongoDB avec agrégations et jointures.

```bash
cd REST-MONGODB
npm install
docker run --name mongodb -p 27017:27017 -d mongo:latest
node server.js
```

Serveur : `http://localhost:3001`  
Fichier de test : `requests.http`

---

## PARTIE 4 — WebSockets (`WEBSOCKETS/`)

### Chat temps-réel

```bash
cd WEBSOCKETS/chat
npm install
node index.js
```

Ouvre `http://localhost:3002` dans deux onglets pour tester le chat.

### Intégration Socket.io dans REST-MONGODB

Déjà intégré dans `REST-MONGODB/server.js`. Ouvre `http://localhost:3001` pour voir le live update.

---

## PARTIE 5 — REST Analytics (`REST-ANALYTICS/`)

API d'analytics avec MongoDB (base `analyticsDB`).

```bash
cd REST-ANALYTICS
npm install
# MongoDB doit tourner (voir Partie 3)
node server.js
```

Serveur : `http://localhost:3003`  
Fichier de test : `requests.http`

---

## Schémas des ressources

### Product
```json
{ "id": 1, "name": "Cyberpunk 2077", "about": "RPG futuriste", "price": 29.99 }
```

### User
```json
{ "id": 1, "username": "gamer42", "email": "gamer@example.com" }
```
*(le password est stocké hashé SHA-512+sel, jamais renvoyé)*

### Order
```json
{ "id": 1, "userId": 1, "productIds": [1,2], "total": 71.98, "payment": false, "createdAt": "...", "updatedAt": "..." }
```

### Review
```json
{ "id": 1, "userId": 1, "productId": 1, "score": 5, "content": "Chef d'oeuvre", "createdAt": "..." }
```

### Category (MongoDB)
```json
{ "_id": "...", "name": "RPG" }
```

### Analytics Views/Actions/Goals
```json
{ "_id": "...", "source": "mythicgames.com", "url": "/products/1", "visitor": "uuid-xxx", "createdAt": "2026-01-01T00:00:00Z", "meta": {} }
```

# PARTIE 4 — WebSockets

## Étape A — Chat Socket.io (`chat/`)

Chat temps-réel avec : pseudos, historique des 50 derniers messages, indicateur de frappe, liste des utilisateurs connectés.

```bash
cd chat
npm install
node index.js
```

Ouvre `http://localhost:3002` dans **deux onglets** pour tester la communication temps-réel.

### Fonctionnalités
- Rejoindre avec un pseudo
- Messages en temps réel (Socket.io)
- Indicateur "est en train d'écrire..."
- Liste des utilisateurs connectés
- Historique rechargé à la reconnexion
- Messages système (join/quit)

## Étape B — Intégration Socket.io dans REST-MONGODB

Socket.io est déjà intégré dans `REST-MONGODB/server.js`.

À chaque CREATE/UPDATE/DELETE sur `/products`, l'événement suivant est émis :

```json
{ "action": "CREATE" | "UPDATE" | "DELETE", "data": { ... } }
```

Le frontend `REST-MONGODB/public/index.html` écoute le canal `products` et met à jour l'affichage sans rechargement.

**Démonstration multi-utilisateur :**

1. Lance `REST-MONGODB/server.js`
2. Ouvre `http://localhost:3001` dans deux onglets (ou deux navigateurs)
3. Crée un produit via le formulaire dans l'onglet A
4. L'onglet B affiche le nouveau produit instantanément (avec animation)

'use strict';

const express  = require('express');
const postgres = require('postgres');
const crypto   = require('crypto');
const { z }    = require('zod');
const swaggerUi = require('swagger-ui-express');

const app  = express();
const PORT = 3000;
const sql  = postgres('postgres://postgres:postgres@localhost:5432/mythicdb');

app.use(express.json());

// ── request logger ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.on('finish', () => console.log(`${req.method} ${req.path} → ${res.statusCode}`));
  next();
});

// ── helpers ───────────────────────────────────────────────────────────────────

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha512').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

function zodError(res, err) {
  return res.status(400).json({ error: 'Validation error', details: err.errors });
}

// ── schemas ───────────────────────────────────────────────────────────────────

const ProductSchema = z.object({
  name:  z.string().min(1),
  about: z.string().optional().default(''),
  price: z.number().positive(),
});

const UserSchema = z.object({
  username: z.string().min(1),
  email:    z.string().email(),
  password: z.string().min(6),
});

const OrderSchema = z.object({
  userId:     z.number().int().positive(),
  productIds: z.array(z.number().int().positive()),
  payment:    z.boolean().optional().default(false),
});

const ReviewSchema = z.object({
  userId:    z.number().int().positive(),
  productId: z.number().int().positive(),
  score:     z.number().int().min(1).max(5),
  content:   z.string().optional().default(''),
});

// ════════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════════════════════════════════════════

app.post('/products', async (req, res) => {
  const parsed = ProductSchema.safeParse(req.body);
  if (!parsed.success) return zodError(res, parsed.error);
  try {
    const { name, about, price } = parsed.data;
    const [row] = await sql`INSERT INTO products (name,about,price) VALUES (${name},${about},${price}) RETURNING *`;
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/products', async (req, res) => {
  try {
    const { name, about, price } = req.query;
    let rows = await sql`SELECT p.*, COALESCE(AVG(r.score),0) AS avg_score, COUNT(r.id) AS review_count
      FROM products p LEFT JOIN reviews r ON r.product_id = p.id GROUP BY p.id ORDER BY p.id`;

    if (name)  rows = rows.filter(r => r.name.toLowerCase().includes(name.toLowerCase()));
    if (about) rows = rows.filter(r => r.about.toLowerCase().includes(about.toLowerCase()));
    if (price) rows = rows.filter(r => r.price <= parseFloat(price));

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [row] = await sql`SELECT * FROM products WHERE id = ${id}`;
    if (!row) return res.status(404).json({ error: 'Product not found' });

    const reviews = await sql`SELECT r.*, u.username FROM reviews r
      JOIN users u ON u.id = r.user_id WHERE r.product_id = ${id}`;
    const avgScore = reviews.length ? reviews.reduce((s, r) => s + r.score, 0) / reviews.length : 0;

    res.json({ ...row, reviews, avg_score: Math.round(avgScore * 10) / 10 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/products/:id', async (req, res) => {
  const parsed = ProductSchema.safeParse(req.body);
  if (!parsed.success) return zodError(res, parsed.error);
  try {
    const id = parseInt(req.params.id, 10);
    const { name, about, price } = parsed.data;
    const [row] = await sql`UPDATE products SET name=${name},about=${about},price=${price} WHERE id=${id} RETURNING *`;
    if (!row) return res.status(404).json({ error: 'Product not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await sql`SELECT * FROM products WHERE id = ${id}`;
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const name  = req.body.name  ?? existing.name;
    const about = req.body.about ?? existing.about;
    const price = req.body.price ?? existing.price;

    const partial = ProductSchema.partial().safeParse({ name, about, price });
    if (!partial.success) return zodError(res, partial.error);

    const [row] = await sql`UPDATE products SET name=${name},about=${about},price=${price} WHERE id=${id} RETURNING *`;
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/products/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [row] = await sql`DELETE FROM products WHERE id=${id} RETURNING *`;
    if (!row) return res.status(404).json({ error: 'Product not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════════════════════════════════

function safeUser(u) {
  const { password: _, ...safe } = u;
  return safe;
}

app.post('/users', async (req, res) => {
  const parsed = UserSchema.safeParse(req.body);
  if (!parsed.success) return zodError(res, parsed.error);
  try {
    const { username, email, password } = parsed.data;
    const hashed = hashPassword(password);
    const [row] = await sql`INSERT INTO users (username,email,password) VALUES (${username},${email},${hashed}) RETURNING *`;
    res.status(201).json(safeUser(row));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username or email already exists' });
    res.status(500).json({ error: e.message });
  }
});

app.get('/users', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM users ORDER BY id`;
    res.json(rows.map(safeUser));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [row] = await sql`SELECT * FROM users WHERE id = ${id}`;
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(safeUser(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/users/:id', async (req, res) => {
  const parsed = UserSchema.safeParse(req.body);
  if (!parsed.success) return zodError(res, parsed.error);
  try {
    const id = parseInt(req.params.id, 10);
    const { username, email, password } = parsed.data;
    const hashed = hashPassword(password);
    const [row] = await sql`UPDATE users SET username=${username},email=${email},password=${hashed} WHERE id=${id} RETURNING *`;
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(safeUser(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await sql`SELECT * FROM users WHERE id = ${id}`;
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const username = req.body.username ?? existing.username;
    const email    = req.body.email    ?? existing.email;
    const password = req.body.password ? hashPassword(req.body.password) : existing.password;

    const [row] = await sql`UPDATE users SET username=${username},email=${email},password=${password} WHERE id=${id} RETURNING *`;
    res.json(safeUser(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [row] = await sql`DELETE FROM users WHERE id=${id} RETURNING *`;
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(safeUser(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// F2P GAMES (proxy FreeToGame)
// ════════════════════════════════════════════════════════════════════════════════

app.get('/f2p-games', async (req, res) => {
  try {
    const r = await fetch('https://www.freetogame.com/api/games');
    if (!r.ok) return res.status(r.status).json({ error: 'Upstream error' });
    res.json(await r.json());
  } catch (e) {
    res.status(502).json({ error: 'FreeToGame unreachable: ' + e.message });
  }
});

app.get('/f2p-games/:id', async (req, res) => {
  try {
    const r = await fetch(`https://www.freetogame.com/api/game?id=${req.params.id}`);
    if (!r.ok) return res.status(r.status).json({ error: 'Upstream error' });
    res.json(await r.json());
  } catch (e) {
    res.status(502).json({ error: 'FreeToGame unreachable: ' + e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// ORDERS
// ════════════════════════════════════════════════════════════════════════════════

async function calcTotal(productIds) {
  if (!productIds.length) return 0;
  const rows = await sql`SELECT price FROM products WHERE id = ANY(${productIds})`;
  return rows.reduce((s, r) => s + r.price, 0) * 1.2;
}

app.post('/orders', async (req, res) => {
  const parsed = OrderSchema.safeParse(req.body);
  if (!parsed.success) return zodError(res, parsed.error);
  try {
    const { userId, productIds, payment } = parsed.data;
    const total = await calcTotal(productIds);
    const [row] = await sql`
      INSERT INTO orders (user_id, product_ids, total, payment)
      VALUES (${userId}, ${productIds}, ${total}, ${payment})
      RETURNING *`;
    res.status(201).json(row);
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ error: 'User not found' });
    res.status(500).json({ error: e.message });
  }
});

app.get('/orders', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM orders ORDER BY id`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/orders/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [order] = await sql`SELECT * FROM orders WHERE id = ${id}`;
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const [user]  = await sql`SELECT * FROM users WHERE id = ${order.user_id}`;
    const products = order.product_ids.length
      ? await sql`SELECT * FROM products WHERE id = ANY(${order.product_ids})`
      : [];

    res.json({ ...order, user: user ? safeUser(user) : null, products });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/orders/:id', async (req, res) => {
  const parsed = OrderSchema.safeParse(req.body);
  if (!parsed.success) return zodError(res, parsed.error);
  try {
    const id = parseInt(req.params.id, 10);
    const { userId, productIds, payment } = parsed.data;
    const total = await calcTotal(productIds);
    const [row] = await sql`
      UPDATE orders SET user_id=${userId}, product_ids=${productIds}, total=${total}, payment=${payment}, updated_at=NOW()
      WHERE id=${id} RETURNING *`;
    if (!row) return res.status(404).json({ error: 'Order not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/orders/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await sql`SELECT * FROM orders WHERE id = ${id}`;
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    const productIds = req.body.productIds ?? existing.product_ids;
    const payment    = req.body.payment    ?? existing.payment;
    const userId     = req.body.userId     ?? existing.user_id;
    const total      = req.body.productIds ? await calcTotal(productIds) : existing.total;

    const [row] = await sql`
      UPDATE orders SET user_id=${userId}, product_ids=${productIds}, total=${total}, payment=${payment}, updated_at=NOW()
      WHERE id=${id} RETURNING *`;
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/orders/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [row] = await sql`DELETE FROM orders WHERE id=${id} RETURNING *`;
    if (!row) return res.status(404).json({ error: 'Order not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// REVIEWS (bonus)
// ════════════════════════════════════════════════════════════════════════════════

app.post('/reviews', async (req, res) => {
  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) return zodError(res, parsed.error);
  try {
    const { userId, productId, score, content } = parsed.data;
    const [row] = await sql`
      INSERT INTO reviews (user_id, product_id, score, content)
      VALUES (${userId}, ${productId}, ${score}, ${content})
      RETURNING *`;
    res.status(201).json(row);
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ error: 'User or product not found' });
    res.status(500).json({ error: e.message });
  }
});

app.get('/reviews', async (req, res) => {
  try {
    const rows = await sql`SELECT r.*, u.username FROM reviews r JOIN users u ON u.id = r.user_id ORDER BY r.id`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/reviews/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [row] = await sql`SELECT r.*, u.username FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ${id}`;
    if (!row) return res.status(404).json({ error: 'Review not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/reviews/:id', async (req, res) => {
  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) return zodError(res, parsed.error);
  try {
    const id = parseInt(req.params.id, 10);
    const { userId, productId, score, content } = parsed.data;
    const [row] = await sql`
      UPDATE reviews SET user_id=${userId}, product_id=${productId}, score=${score}, content=${content}, updated_at=NOW()
      WHERE id=${id} RETURNING *`;
    if (!row) return res.status(404).json({ error: 'Review not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/reviews/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await sql`SELECT * FROM reviews WHERE id = ${id}`;
    if (!existing) return res.status(404).json({ error: 'Review not found' });

    const score   = req.body.score   ?? existing.score;
    const content = req.body.content ?? existing.content;
    const [row]   = await sql`
      UPDATE reviews SET score=${score}, content=${content}, updated_at=NOW()
      WHERE id=${id} RETURNING *`;
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/reviews/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [row] = await sql`DELETE FROM reviews WHERE id=${id} RETURNING *`;
    if (!row) return res.status(404).json({ error: 'Review not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// SWAGGER UI
// ════════════════════════════════════════════════════════════════════════════════

const swaggerDoc = {
  openapi: '3.0.0',
  info: { title: 'MythicGames REST API', version: '1.0.0', description: 'API REST MythicGames — PostgreSQL' },
  servers: [{ url: 'http://localhost:3000' }],
  paths: {
    '/products':     { get: { summary: 'List products', parameters: [{ in:'query', name:'name', schema:{type:'string'} }, { in:'query', name:'price', schema:{type:'number'} }], responses: { 200: { description: 'OK' } } }, post: { summary: 'Create product', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } } }, responses: { 201: { description: 'Created' } } } },
    '/products/{id}': { get: { summary: 'Get product with reviews', parameters: [{ in:'path', name:'id', required:true, schema:{type:'integer'} }], responses: { 200:{description:'OK'}, 404:{description:'Not found'} } }, put: { summary: 'Replace product', parameters: [{ in:'path', name:'id', required:true, schema:{type:'integer'} }], requestBody: { content: { 'application/json': { schema: { $ref:'#/components/schemas/ProductInput' } } } }, responses: { 200:{description:'OK'} } }, patch: { summary: 'Partial update', parameters: [{ in:'path', name:'id', required:true, schema:{type:'integer'} }], responses: { 200:{description:'OK'} } }, delete: { summary: 'Delete product', parameters: [{ in:'path', name:'id', required:true, schema:{type:'integer'} }], responses: { 200:{description:'Deleted resource'} } } },
    '/users':         { get: { summary: 'List users' , responses: { 200:{description:'OK'} } }, post: { summary: 'Create user', requestBody: { content: { 'application/json': { schema: { $ref:'#/components/schemas/UserInput' } } } }, responses: { 201:{description:'Created'} } } },
    '/orders':        { get: { summary: 'List orders', responses: { 200:{description:'OK'} } }, post: { summary: 'Create order', requestBody: { content: { 'application/json': { schema: { $ref:'#/components/schemas/OrderInput' } } } }, responses: { 201:{description:'Created'} } } },
    '/orders/{id}':   { get: { summary: 'Get order with user + products', parameters: [{ in:'path', name:'id', required:true, schema:{type:'integer'} }], responses: { 200:{description:'OK'} } } },
    '/reviews':       { get: { summary: 'List reviews', responses: { 200:{description:'OK'} } }, post: { summary: 'Create review', requestBody: { content: { 'application/json': { schema: { $ref:'#/components/schemas/ReviewInput' } } } }, responses: { 201:{description:'Created'} } } },
    '/f2p-games':     { get: { summary: 'Proxy FreeToGame list', responses: { 200:{description:'OK'} } } },
    '/f2p-games/{id}':{ get: { summary: 'Proxy FreeToGame detail', parameters: [{ in:'path', name:'id', required:true, schema:{type:'integer'} }], responses: { 200:{description:'OK'} } } },
  },
  components: {
    schemas: {
      ProductInput: { type:'object', required:['name','price'], properties: { name:{type:'string'}, about:{type:'string'}, price:{type:'number', minimum:0} } },
      UserInput:    { type:'object', required:['username','email','password'], properties: { username:{type:'string'}, email:{type:'string', format:'email'}, password:{type:'string', minLength:6} } },
      OrderInput:   { type:'object', required:['userId','productIds'], properties: { userId:{type:'integer'}, productIds:{type:'array', items:{type:'integer'}}, payment:{type:'boolean'} } },
      ReviewInput:  { type:'object', required:['userId','productId','score'], properties: { userId:{type:'integer'}, productId:{type:'integer'}, score:{type:'integer', minimum:1, maximum:5}, content:{type:'string'} } },
    },
  },
};

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.listen(PORT, () => {
  console.log(`REST-POSTGRES server on http://localhost:${PORT}`);
  console.log(`Swagger UI       on http://localhost:${PORT}/docs`);
});

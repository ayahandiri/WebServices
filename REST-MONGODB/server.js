'use strict';

const express    = require('express');
const http       = require('http');
const path       = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { Server } = require('socket.io');
const { z }      = require('zod');

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, { cors: { origin: '*' } });
const PORT       = 3001;
const MONGO_URI  = 'mongodb://localhost:27017';
const DB_NAME    = 'myDB';

let db;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── request logger ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.on('finish', () => console.log(`${req.method} ${req.path} → ${res.statusCode}`));
  next();
});

// ── helpers ───────────────────────────────────────────────────────────────────

function toObjectId(id) {
  try { return new ObjectId(id); } catch { return null; }
}

function zodError(res, err) {
  return res.status(400).json({ error: 'Validation error', details: err.errors });
}

// ── schemas ───────────────────────────────────────────────────────────────────

const CategorySchema = z.object({
  name: z.string().min(1),
});

const ProductSchema = z.object({
  name:        z.string().min(1),
  about:       z.string().optional().default(''),
  price:       z.number().positive(),
  categoryIds: z.array(z.string()).optional().default([]),
});

// ════════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ════════════════════════════════════════════════════════════════════════════════

app.post('/categories', async (req, res) => {
  const parsed = CategorySchema.safeParse(req.body);
  if (!parsed.success) return zodError(res, parsed.error);
  try {
    const result = await db.collection('categories').insertOne(parsed.data);
    const doc    = await db.collection('categories').findOne({ _id: result.insertedId });
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/categories', async (req, res) => {
  try {
    const docs = await db.collection('categories').find().toArray();
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/categories/:id', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(400).json({ error: 'Invalid id' });
  try {
    const doc = await db.collection('categories').findOne({ _id: oid });
    if (!doc) return res.status(404).json({ error: 'Category not found' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/categories/:id', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(400).json({ error: 'Invalid id' });
  const parsed = CategorySchema.safeParse(req.body);
  if (!parsed.success) return zodError(res, parsed.error);
  try {
    const result = await db.collection('categories').findOneAndUpdate(
      { _id: oid }, { $set: parsed.data }, { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Category not found' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/categories/:id', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(400).json({ error: 'Invalid id' });
  try {
    const result = await db.collection('categories').findOneAndUpdate(
      { _id: oid }, { $set: req.body }, { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Category not found' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/categories/:id', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(400).json({ error: 'Invalid id' });
  try {
    const result = await db.collection('categories').findOneAndDelete({ _id: oid });
    if (!result) return res.status(404).json({ error: 'Category not found' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// PRODUCTS (with category join via aggregation)
// ════════════════════════════════════════════════════════════════════════════════

function productPipeline(matchStage = {}) {
  return [
    { $match: matchStage },
    {
      $addFields: {
        categoryOids: {
          $map: {
            input: { $ifNull: ['$categoryIds', []] },
            as:   'cid',
            in:   { $toObjectId: '$$cid' },
          },
        },
      },
    },
    {
      $lookup: {
        from:         'categories',
        localField:   'categoryOids',
        foreignField: '_id',
        as:           'categories',
      },
    },
    { $project: { categoryOids: 0 } },
  ];
}

app.post('/products', async (req, res) => {
  const parsed = ProductSchema.safeParse(req.body);
  if (!parsed.success) return zodError(res, parsed.error);
  try {
    const result = await db.collection('products').insertOne(parsed.data);
    const doc    = await db.collection('products').aggregate(
      productPipeline({ _id: result.insertedId })
    ).next();
    io.emit('products', { action: 'CREATE', data: doc });
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/products', async (req, res) => {
  try {
    const docs = await db.collection('products').aggregate(productPipeline()).toArray();
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/products/:id', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(400).json({ error: 'Invalid id' });
  try {
    const doc = await db.collection('products').aggregate(
      productPipeline({ _id: oid })
    ).next();
    if (!doc) return res.status(404).json({ error: 'Product not found' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/products/:id', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(400).json({ error: 'Invalid id' });
  const parsed = ProductSchema.safeParse(req.body);
  if (!parsed.success) return zodError(res, parsed.error);
  try {
    const updated = await db.collection('products').findOneAndUpdate(
      { _id: oid }, { $set: parsed.data }, { returnDocument: 'after' }
    );
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    const doc = await db.collection('products').aggregate(productPipeline({ _id: oid })).next();
    io.emit('products', { action: 'UPDATE', data: doc });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/products/:id', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(400).json({ error: 'Invalid id' });
  try {
    const updated = await db.collection('products').findOneAndUpdate(
      { _id: oid }, { $set: req.body }, { returnDocument: 'after' }
    );
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    const doc = await db.collection('products').aggregate(productPipeline({ _id: oid })).next();
    io.emit('products', { action: 'UPDATE', data: doc });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/products/:id', async (req, res) => {
  const oid = toObjectId(req.params.id);
  if (!oid) return res.status(400).json({ error: 'Invalid id' });
  try {
    const result = await db.collection('products').findOneAndDelete({ _id: oid });
    if (!result) return res.status(404).json({ error: 'Product not found' });
    io.emit('products', { action: 'DELETE', data: { _id: req.params.id } });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`));
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log('Connected to MongoDB');

  httpServer.listen(PORT, () => {
    console.log(`REST-MONGODB server on http://localhost:${PORT}`);
    console.log(`Frontend          on http://localhost:${PORT}/index.html`);
  });
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

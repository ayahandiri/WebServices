'use strict';

const express  = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const { z }    = require('zod');

const app     = express();
const PORT    = 3003;
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME   = 'analyticsDB';

let db;

app.use(express.json());

// ── logger ────────────────────────────────────────────────────────────────────
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

// Accept ISO string or Date object
const dateZ = z.union([
  z.string().datetime({ offset: true }).transform(s => new Date(s)),
  z.date(),
]).optional().default(() => new Date());

// ── base schema factory ───────────────────────────────────────────────────────

const BaseSchema = z.object({
  source:    z.string().min(1),
  url:       z.string().min(1),
  visitor:   z.string().min(1),
  createdAt: dateZ,
  meta:      z.record(z.unknown()).optional().default({}),
});

const ViewSchema   = BaseSchema;
const ActionSchema = BaseSchema.extend({ action: z.string().min(1) });
const GoalSchema   = BaseSchema.extend({ goal:   z.string().min(1) });

// ── generic CRUD factory ──────────────────────────────────────────────────────

function makeCrud(collName, schema) {
  const router = require('express').Router();

  router.post('/', async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return zodError(res, parsed.error);
    try {
      const result = await db.collection(collName).insertOne(parsed.data);
      const doc    = await db.collection(collName).findOne({ _id: result.insertedId });
      res.status(201).json(doc);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const docs = await db.collection(collName).find().sort({ createdAt: -1 }).toArray();
      res.json(docs);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/:id', async (req, res) => {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid id' });
    try {
      const doc = await db.collection(collName).findOne({ _id: oid });
      if (!doc) return res.status(404).json({ error: `${collName} not found` });
      res.json(doc);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.put('/:id', async (req, res) => {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid id' });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return zodError(res, parsed.error);
    try {
      const result = await db.collection(collName).findOneAndUpdate(
        { _id: oid }, { $set: parsed.data }, { returnDocument: 'after' }
      );
      if (!result) return res.status(404).json({ error: `${collName} not found` });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch('/:id', async (req, res) => {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid id' });
    try {
      const result = await db.collection(collName).findOneAndUpdate(
        { _id: oid }, { $set: req.body }, { returnDocument: 'after' }
      );
      if (!result) return res.status(404).json({ error: `${collName} not found` });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid id' });
    try {
      const result = await db.collection(collName).findOneAndDelete({ _id: oid });
      if (!result) return res.status(404).json({ error: `${collName} not found` });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

// ════════════════════════════════════════════════════════════════════════════════
// ROUTES CRUD
// ════════════════════════════════════════════════════════════════════════════════

app.use('/views',   makeCrud('views',   ViewSchema));
app.use('/actions', makeCrud('actions', ActionSchema));
app.use('/goals',   makeCrud('goals',   GoalSchema));

// ════════════════════════════════════════════════════════════════════════════════
// SPECIAL: GET /goals/:goalId/details — aggregation with $lookup
// ════════════════════════════════════════════════════════════════════════════════

app.get('/goals/:goalId/details', async (req, res) => {
  const oid = toObjectId(req.params.goalId);
  if (!oid) return res.status(400).json({ error: 'Invalid id' });
  try {
    const goal = await db.collection('goals').findOne({ _id: oid });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    // Aggregate: find views and actions by the same visitor using $lookup
    const [result] = await db.collection('goals').aggregate([
      { $match: { _id: oid } },
      {
        $lookup: {
          from: 'views',
          let:  { v: '$visitor' },
          pipeline: [
            { $match: { $expr: { $eq: ['$visitor', '$$v'] } } },
            { $sort: { createdAt: 1 } },
          ],
          as: 'views',
        },
      },
      {
        $lookup: {
          from: 'actions',
          let:  { v: '$visitor' },
          pipeline: [
            { $match: { $expr: { $eq: ['$visitor', '$$v'] } } },
            { $sort: { createdAt: 1 } },
          ],
          as: 'actions',
        },
      },
    ]).toArray();

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`Connected to MongoDB — db: ${DB_NAME}`);

  app.listen(PORT, () => {
    console.log(`REST-ANALYTICS server on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

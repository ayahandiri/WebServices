CREATE TABLE IF NOT EXISTS products (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,
  about VARCHAR(500),
  price FLOAT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(100) NOT NULL UNIQUE,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_ids INTEGER[] NOT NULL DEFAULT '{}',
  total       FLOAT NOT NULL DEFAULT 0,
  payment     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  content    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sample data
INSERT INTO products (name, about, price) VALUES
  ('Cyberpunk 2077', 'RPG futuriste en monde ouvert.', 29.99),
  ('The Witcher 3',  'RPG médiéval fantastique.', 19.99)
ON CONFLICT DO NOTHING;

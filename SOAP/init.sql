CREATE TABLE IF NOT EXISTS products (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,
  about VARCHAR(500),
  price FLOAT NOT NULL
);

INSERT INTO products (name, about, price)
VALUES ('Cyberpunk 2077', 'RPG futuriste en monde ouvert dans la mégalopole Night City.', 29.99);

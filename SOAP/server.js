'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const soap = require('soap');
const postgres = require('postgres');

const PORT    = 8000;
const WSDL    = path.join(__dirname, 'productsService.wsdl');
const DB_URL  = 'postgres://postgres:postgres@localhost:5432/mythicdb';

const sql = postgres(DB_URL);

// ---- helpers ----------------------------------------------------------------

function soapFault(code, reason, statusCode = 500) {
  const err = new Error(reason);
  err.Fault = {
    faultcode: 'SOAP-ENV:' + code,
    faultstring: reason,
    statusCode,
  };
  return err;
}

function rowToProduct(row) {
  return { id: row.id, name: row.name, about: row.about, price: row.price };
}

// ---- service implementation -------------------------------------------------

const service = {
  ProductsService: {
    ProductsPort: {

      // CREATE
      async CreateProduct(args) {
        const { name, about, price } = args;
        if (!name || price === undefined || price === null) {
          throw soapFault('Client', 'name and price are required', 400);
        }
        try {
          const [row] = await sql`
            INSERT INTO products (name, about, price)
            VALUES (${name}, ${about ?? ''}, ${price})
            RETURNING *`;
          console.log(`[CreateProduct] created id=${row.id}`);
          return { product: rowToProduct(row) };
        } catch (e) {
          console.error('[CreateProduct] DB error:', e.message);
          throw soapFault('Server', 'Database error: ' + e.message);
        }
      },

      // GET ALL
      async GetProducts() {
        try {
          const rows = await sql`SELECT * FROM products ORDER BY id`;
          console.log(`[GetProducts] returned ${rows.length} rows`);
          return { products: { product: rows.map(rowToProduct) } };
        } catch (e) {
          console.error('[GetProducts] DB error:', e.message);
          throw soapFault('Server', 'Database error: ' + e.message);
        }
      },

      // GET ONE
      async GetProduct(args) {
        const id = parseInt(args.id, 10);
        if (!id || isNaN(id)) throw soapFault('Client', 'id must be a positive integer', 400);
        try {
          const [row] = await sql`SELECT * FROM products WHERE id = ${id}`;
          if (!row) throw soapFault('Client', `Product ${id} not found`, 404);
          console.log(`[GetProduct] id=${id}`);
          return { product: rowToProduct(row) };
        } catch (e) {
          if (e.Fault) throw e;
          console.error('[GetProduct] DB error:', e.message);
          throw soapFault('Server', 'Database error: ' + e.message);
        }
      },

      // PATCH
      async PatchProduct(args) {
        const id = parseInt(args.id, 10);
        if (!id || isNaN(id)) throw soapFault('Client', 'id must be a positive integer', 400);

        try {
          const [existing] = await sql`SELECT * FROM products WHERE id = ${id}`;
          if (!existing) throw soapFault('Client', `Product ${id} not found`, 404);

          const name  = args.name  !== undefined ? args.name  : existing.name;
          const about = args.about !== undefined ? args.about : existing.about;
          const price = args.price !== undefined ? parseFloat(args.price) : existing.price;

          const [row] = await sql`
            UPDATE products SET name = ${name}, about = ${about}, price = ${price}
            WHERE id = ${id} RETURNING *`;
          console.log(`[PatchProduct] updated id=${id}`);
          return { product: rowToProduct(row) };
        } catch (e) {
          if (e.Fault) throw e;
          console.error('[PatchProduct] DB error:', e.message);
          throw soapFault('Server', 'Database error: ' + e.message);
        }
      },

      // DELETE
      async DeleteProduct(args) {
        const id = parseInt(args.id, 10);
        if (!id || isNaN(id)) throw soapFault('Client', 'id must be a positive integer', 400);
        try {
          const [row] = await sql`DELETE FROM products WHERE id = ${id} RETURNING id`;
          if (!row) throw soapFault('Client', `Product ${id} not found`, 404);
          console.log(`[DeleteProduct] deleted id=${id}`);
          return { message: `Product ${id} deleted successfully` };
        } catch (e) {
          if (e.Fault) throw e;
          console.error('[DeleteProduct] DB error:', e.message);
          throw soapFault('Server', 'Database error: ' + e.message);
        }
      },
    },
  },
};

// ---- bootstrap --------------------------------------------------------------

async function main() {
  const wsdlXml  = fs.readFileSync(WSDL, 'utf8');
  const server   = http.createServer((req, res) => {
    res.writeHead(404);
    res.end('Not found');
  });

  soap.listen(server, '/products', service, wsdlXml, () => {
    console.log(`SOAP server listening on http://localhost:${PORT}/products`);
    console.log(`WSDL available at   http://localhost:${PORT}/products?wsdl`);
  });

  server.listen(PORT);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

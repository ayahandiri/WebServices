'use strict';

const soap = require('soap');

const WSDL_URL = 'http://localhost:8000/products?wsdl';

function sep(label) {
  console.log('\n' + '─'.repeat(50));
  console.log('  ' + label);
  console.log('─'.repeat(50));
}

async function run() {
  const client = await soap.createClientAsync(WSDL_URL);

  // ── 1. CreateProduct (valid) ──────────────────────────────
  sep('CreateProduct — valid');
  try {
    const res = await client.CreateProductAsync({
      name: 'The Witcher 3', about: 'RPG médiéval fantastique', price: 19.99,
    });
    console.log('Created:', res[0].product);
  } catch (e) {
    console.error('Error:', e.root?.Envelope?.Body?.Fault ?? e.message);
  }

  // ── 2. CreateProduct (missing name) ──────────────────────
  sep('CreateProduct — missing name (expect 400)');
  try {
    const res = await client.CreateProductAsync({ about: 'no name', price: 5 });
    console.log('Unexpected success:', res[0]);
  } catch (e) {
    console.log('Expected fault:', e.root?.Envelope?.Body?.Fault?.faultstring ?? e.message);
  }

  // ── 3. GetProducts ────────────────────────────────────────
  sep('GetProducts');
  try {
    const res = await client.GetProductsAsync({});
    const list = res[0].products.product;
    const arr  = Array.isArray(list) ? list : [list];
    console.log('Products:', arr);
  } catch (e) {
    console.error('Error:', e.root?.Envelope?.Body?.Fault ?? e.message);
  }

  // ── 4. GetProduct (id=1) ──────────────────────────────────
  sep('GetProduct — id=1');
  try {
    const res = await client.GetProductAsync({ id: 1 });
    console.log('Product:', res[0].product);
  } catch (e) {
    console.error('Error:', e.root?.Envelope?.Body?.Fault ?? e.message);
  }

  // ── 5. GetProduct (not found) ─────────────────────────────
  sep('GetProduct — id=99999 (expect 404)');
  try {
    const res = await client.GetProductAsync({ id: 99999 });
    console.log('Unexpected success:', res[0]);
  } catch (e) {
    console.log('Expected fault:', e.root?.Envelope?.Body?.Fault?.faultstring ?? e.message);
  }

  // ── 6. PatchProduct ───────────────────────────────────────
  sep('PatchProduct — update price of id=1');
  try {
    const res = await client.PatchProductAsync({ id: 1, price: 24.99 });
    console.log('Patched:', res[0].product);
  } catch (e) {
    console.error('Error:', e.root?.Envelope?.Body?.Fault ?? e.message);
  }

  // ── 7. DeleteProduct ──────────────────────────────────────
  sep('DeleteProduct — delete the product we just created');
  try {
    // find last product id
    const allRes = await client.GetProductsAsync({});
    const list   = allRes[0].products.product;
    const arr    = Array.isArray(list) ? list : (list ? [list] : []);
    const last   = arr[arr.length - 1];
    if (last) {
      const res = await client.DeleteProductAsync({ id: last.id });
      console.log('Deleted:', res[0].message);
    } else {
      console.log('No products to delete');
    }
  } catch (e) {
    console.error('Error:', e.root?.Envelope?.Body?.Fault ?? e.message);
  }

  // ── 8. DeleteProduct (not found) ─────────────────────────
  sep('DeleteProduct — id=99999 (expect 404)');
  try {
    const res = await client.DeleteProductAsync({ id: 99999 });
    console.log('Unexpected success:', res[0]);
  } catch (e) {
    console.log('Expected fault:', e.root?.Envelope?.Body?.Fault?.faultstring ?? e.message);
  }

  console.log('\n Done — all tests executed.\n');
}

run().catch(err => {
  console.error('Client fatal error:', err.message);
  process.exit(1);
});

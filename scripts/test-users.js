// quick test script for users/cart/checkout
// run with: node scripts/test-users.js
const base = "http://localhost:5000";
async function run() {
  try {
    console.log("GET /users");
    let r = await fetch(`${base}/users`);
    console.log("status", r.status);
    console.log(await r.json());

    console.log("\nPOST /users/1/cart {itemId:1, quantity:2}");
    r = await fetch(`${base}/users/1/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: 1, quantity: 2 }),
    });
    console.log("status", r.status);
    console.log(await r.json());

    console.log("\nPATCH /users/1/cart/1 {quantity:3}");
    r = await fetch(`${base}/users/1/cart/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: 3 }),
    });
    console.log("status", r.status);
    console.log(await r.json());

    console.log("\nPOST /users/1/checkout");
    r = await fetch(`${base}/users/1/checkout`, { method: "POST" });
    console.log("status", r.status);
    console.log(await r.json());

    console.log("\nGET /api/products (to see stock changes)");
    r = await fetch(`${base}/api/products`);
    console.log("status", r.status);
    console.log(await r.json());
  } catch (e) {
    console.error("error", e.message);
    process.exit(1);
  }
}
run();

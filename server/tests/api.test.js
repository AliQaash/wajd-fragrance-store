/**
 * API tests against a real in-memory MongoDB. Firebase token verification is
 * replaced by a fake that reads "test:<email>[:admin]" tokens, and Stripe by
 * a fake client, so the suite runs offline and fast.
 */
jest.mock("../src/config/firebaseAdmin", () => ({
  auth: () => ({
    verifyIdToken: async (token) => {
      const [kind, email, role] = token.split(":");
      if (kind !== "test" || !email) throw new Error("bad token");
      return { uid: email, email, role: role === "admin" ? "admin" : undefined };
    },
  }),
}));

process.env.ADMIN_EMAIL = "owner@wajd.test";
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.CLIENT_ORIGIN = "https://shop.example";

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const Product = require("../src/models/Product");
const Order = require("../src/models/Order");
const payments = require("../src/services/payments");
const runMigrations = require("../src/migrations");
const { products: catalog } = require("../scripts/seed");

const BUYER = "Bearer test:buyer@example.com";
const OTHER = "Bearer test:other@example.com";
const OWNER = "Bearer test:owner@wajd.test"; // admin by ADMIN_EMAIL
const CLAIM_ADMIN = "Bearer test:staff@wajd.test:admin"; // admin by custom claim

const delivery = {
  customerName: "Ayesha Khan",
  customerPhone: "0300 1234567",
  city: "Lahore",
  customerAddress: "House 12, Street 4, Gulberg III",
};

let mongo;
let fakeSession;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  payments._setClient({
    checkout: {
      sessions: {
        create: async (params) => {
          const total = params.line_items.reduce((s, l) => s + l.quantity * l.price_data.unit_amount, 0);
          fakeSession = { id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1", metadata: params.metadata, amount_total: total, payment_status: "unpaid" };
          return fakeSession;
        },
        retrieve: async () => fakeSession,
      },
    },
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Order.deleteMany({});
  await Product.insertMany(catalog);
});

const bySlug = (slug) => Product.findOne({ slug });
const variant = (p, size) => p.variants.find((v) => v.size === size);

describe("seed catalog", () => {
  test("every seeded product passes model validation, including MOQ and tier rules", async () => {
    for (const p of catalog) await expect(new Product(p).validate()).resolves.toBeUndefined();
  });
});

describe("catalog", () => {
  test("lists active products with paging", async () => {
    const res = await request(app).get("/api/products?limit=4&page=2");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(4);
    expect(res.body.total).toBe(catalog.length);
    expect(res.body.pages).toBe(Math.ceil(catalog.length / 4));
  });

  test("searches by note, partial word", async () => {
    const res = await request(app).get("/api/products?q=saffr&limit=48");
    const names = res.body.items.map((p) => p.name);
    expect(names).toContain("Layl");
    expect(names).toContain("Zafaran");
    expect(names).not.toContain("Suhail");
  });

  test("filters by type and family, sorts by lowest price", async () => {
    const res = await request(app).get("/api/products?type=Oil&sort=price-asc&limit=48");
    const mins = res.body.items.map((p) => p.minPrice);
    expect(res.body.items.every((p) => p.type === "Oil")).toBe(true);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
    const fam = await request(app).get("/api/products?family=Floral&limit=48");
    expect(fam.body.items.every((p) => p.family === "Floral")).toBe(true);
  });

  test("archived products are hidden from shoppers", async () => {
    await Product.updateOne({ slug: "layl" }, { active: false });
    expect((await request(app).get("/api/products/layl")).status).toBe(404);
    const list = await request(app).get("/api/products?limit=48");
    expect(list.body.items.map((p) => p.slug)).not.toContain("layl");
  });
});

describe("bulk pricing and MOQ", () => {
  test("two cart lines of the same size are merged before tier pricing (6 + 6 reaches the 12+ tier)", async () => {
    const layl = await bySlug("layl");
    const id = String(layl._id);
    const res = await request(app)
      .post("/api/orders/quote")
      .send({ items: [{ productId: id, size: "30ml", quantity: 6 }, { productId: id, size: "30ml", quantity: 6 }] });
    expect(res.body.lines).toHaveLength(1);
    expect(res.body.lines[0].quantity).toBe(12);
    expect(res.body.lines[0].unitPrice).toBe(58);
    expect(res.body.total).toBe(696);
    expect(res.body.savings).toBe(120);
    expect(res.body.valid).toBe(true);
  });

  test("best tier wins and the next tier is reported", async () => {
    const layl = await bySlug("layl");
    const res = await request(app)
      .post("/api/orders/quote")
      .send({ items: [{ productId: String(layl._id), size: "30ml", quantity: 47 }] });
    expect(res.body.lines[0].unitPrice).toBe(58);
    expect(res.body.lines[0].nextTier).toEqual({ minQty: 48, price: 51, addQty: 1 });
  });

  test("quantity below MOQ is flagged in the quote and refused at order time", async () => {
    const zafaran = await bySlug("zafaran-oil");
    const items = [{ productId: String(zafaran._id), size: "3ml", quantity: 2 }];
    const quote = await request(app).post("/api/orders/quote").send({ items });
    expect(quote.body.lines[0].error).toMatch(/Minimum order for 3ml is 3/);
    expect(quote.body.valid).toBe(false);
    const order = await request(app).post("/api/orders").set("Authorization", BUYER).send({ ...delivery, items });
    expect(order.status).toBe(409);
    expect(await Order.countDocuments()).toBe(0);
  });

  test("client-sent prices are ignored", async () => {
    const layl = await bySlug("layl");
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", BUYER)
      .send({ ...delivery, totalAmount: 1, items: [{ productId: String(layl._id), size: "30ml", quantity: 1, price: 0.01 }] });
    expect(res.status).toBe(201);
    expect(res.body.order.totalAmount).toBe(68);
    expect(res.body.order.items[0].price).toBe(68);
  });
});

describe("stock", () => {
  test("placing an order takes stock; cancelling puts it back exactly once", async () => {
    const layl = await bySlug("layl");
    const before = variant(layl, "50ml").stock;
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", BUYER)
      .send({ ...delivery, items: [{ productId: String(layl._id), size: "50ml", quantity: 5 }] });
    expect(res.status).toBe(201);
    expect(variant(await bySlug("layl"), "50ml").stock).toBe(before - 5);

    const id = res.body.order._id;
    expect((await request(app).post(`/api/orders/${id}/cancel`).set("Authorization", BUYER)).status).toBe(200);
    expect(variant(await bySlug("layl"), "50ml").stock).toBe(before);
    expect((await request(app).post(`/api/orders/${id}/cancel`).set("Authorization", BUYER)).status).toBe(409);
    expect(variant(await bySlug("layl"), "50ml").stock).toBe(before);
  });

  test("ordering more than stock is refused", async () => {
    const layl = await bySlug("layl");
    await Product.updateOne({ _id: layl._id, "variants.size": "100ml" }, { $set: { "variants.$.stock": 3 } });
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", BUYER)
      .send({ ...delivery, items: [{ productId: String(layl._id), size: "100ml", quantity: 4 }] });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Only 3 in stock/);
  });

  test("two buyers racing for the last units: exactly one wins and stock never goes negative", async () => {
    const layl = await bySlug("layl");
    await Product.updateOne({ _id: layl._id, "variants.size": "100ml" }, { $set: { "variants.$.stock": 5 } });
    const items = [{ productId: String(layl._id), size: "100ml", quantity: 5 }];
    const [a, b] = await Promise.all([
      request(app).post("/api/orders").set("Authorization", BUYER).send({ ...delivery, items }),
      request(app).post("/api/orders").set("Authorization", OTHER).send({ ...delivery, items }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(variant(await bySlug("layl"), "100ml").stock).toBe(0);
  });

  test("a multi-line order that fails on one line gives back the lines already taken", async () => {
    const layl = await bySlug("layl");
    const suhail = await bySlug("suhail");
    const suhailBefore = variant(suhail, "50ml").stock;
    await Product.updateOne({ _id: layl._id, "variants.size": "100ml" }, { $set: { "variants.$.stock": 1 } });
    // Quote passes (stock 1, qty 1) but a parallel order takes it first.
    await Product.updateOne({ _id: layl._id, "variants.size": "100ml" }, { $set: { "variants.$.stock": 1 } });
    const { reserveStock } = require("../src/services/quote");
    const result = await reserveStock([
      { productId: String(suhail._id), size: "50ml", quantity: 2, name: "Suhail" },
      { productId: String(layl._id), size: "100ml", quantity: 2, name: "Layl" },
    ]);
    expect(result.ok).toBe(false);
    expect(variant(await bySlug("suhail"), "50ml").stock).toBe(suhailBefore);
  });
});

describe("access control", () => {
  test("orders need a signed-in user; admin routes need an admin", async () => {
    expect((await request(app).post("/api/orders").send({})).status).toBe(401);
    expect((await request(app).get("/api/admin/orders").set("Authorization", BUYER)).status).toBe(403);
    expect((await request(app).get("/api/admin/orders").set("Authorization", OWNER)).status).toBe(200);
    expect((await request(app).get("/api/admin/orders").set("Authorization", CLAIM_ADMIN)).status).toBe(200);
  });

  test("/api/me reports the role", async () => {
    expect((await request(app).get("/api/me").set("Authorization", BUYER)).body.isAdmin).toBe(false);
    expect((await request(app).get("/api/me").set("Authorization", OWNER)).body.isAdmin).toBe(true);
  });

  test("a buyer cannot read or cancel someone else's order", async () => {
    const layl = await bySlug("layl");
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", BUYER)
      .send({ ...delivery, items: [{ productId: String(layl._id), size: "30ml", quantity: 1 }] });
    const id = res.body.order._id;
    expect((await request(app).get(`/api/orders/${id}`).set("Authorization", OTHER)).status).toBe(404);
    expect((await request(app).post(`/api/orders/${id}/cancel`).set("Authorization", OTHER)).status).toBe(404);
    expect((await request(app).get(`/api/orders/${id}`).set("Authorization", OWNER)).status).toBe(200);
  });

  test("checkout fields are validated with the field name", async () => {
    const layl = await bySlug("layl");
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", BUYER)
      .send({ ...delivery, customerPhone: "abc", items: [{ productId: String(layl._id), size: "30ml", quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe("customerPhone");
  });
});

describe("order lifecycle", () => {
  async function placeCod() {
    const layl = await bySlug("layl");
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", BUYER)
      .send({ ...delivery, items: [{ productId: String(layl._id), size: "30ml", quantity: 2 }] });
    return res.body.order._id;
  }
  const move = (id, status) => request(app).put(`/api/admin/orders/${id}/status`).set("Authorization", OWNER).send({ status });

  test("only valid next steps are allowed, history is recorded, COD is paid on delivery", async () => {
    const id = await placeCod();
    expect((await move(id, "Delivered")).status).toBe(409);
    expect((await move(id, "Approved")).status).toBe(200);
    expect((await move(id, "Pending")).status).toBe(409);
    expect((await move(id, "Dispatched")).status).toBe(200);
    expect((await move(id, "Cancelled")).status).toBe(409);
    const done = await move(id, "Delivered");
    expect(done.body.status).toBe("Delivered");
    expect(done.body.paymentStatus).toBe("Paid");
    expect(done.body.statusHistory.map((h) => h.status)).toEqual(["Pending", "Approved", "Dispatched", "Delivered"]);
  });

  test("a buyer cannot cancel once the order is approved", async () => {
    const id = await placeCod();
    await move(id, "Approved");
    expect((await request(app).post(`/api/orders/${id}/cancel`).set("Authorization", BUYER)).status).toBe(409);
  });

  test("admin cancel restores stock", async () => {
    const before = variant(await bySlug("layl"), "30ml").stock;
    const id = await placeCod();
    await move(id, "Approved");
    await move(id, "Cancelled");
    expect(variant(await bySlug("layl"), "30ml").stock).toBe(before);
  });
});

describe("card payments", () => {
  test("card order returns a checkout URL priced by the server, and is marked paid only after verification", async () => {
    const layl = await bySlug("layl");
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", BUYER)
      .set("Origin", "https://shop.example")
      .send({ ...delivery, paymentMethod: "Card", items: [{ productId: String(layl._id), size: "30ml", quantity: 12 }] });
    expect(res.status).toBe(201);
    expect(res.body.checkoutUrl).toMatch(/checkout\.stripe\.test/);
    expect(fakeSession.amount_total).toBe(696 * 100);
    const id = res.body.order._id;

    let v = await request(app).post(`/api/orders/${id}/verify-payment`).set("Authorization", BUYER);
    expect(v.body.paymentStatus).toBe("Unpaid");

    fakeSession.payment_status = "paid";
    fakeSession.amount_total = 1; // tampered amount
    v = await request(app).post(`/api/orders/${id}/verify-payment`).set("Authorization", BUYER);
    expect(v.body.paymentStatus).toBe("Unpaid");

    fakeSession.amount_total = 696 * 100;
    v = await request(app).post(`/api/orders/${id}/verify-payment`).set("Authorization", BUYER);
    expect(v.body.paymentStatus).toBe("Paid");
  });
});

describe("admin products", () => {
  const base = {
    name: "Test Musk",
    type: "Oil",
    concentration: "Concentrated Oil",
    family: "Musk",
    notes: { top: "White musk, pear", heart: "", base: "Ambrette" },
    variants: [{ size: "6ml", price: 30, stock: 50, moq: 6, cartonSize: 50, priceTiers: [{ minQty: 24, price: 25 }] }],
  };
  const create = (body) => request(app).post("/api/admin/products").set("Authorization", OWNER).send(body);

  test("creates a product with a unique slug and split notes", async () => {
    const a = await create(base);
    const b = await create(base);
    expect(a.status).toBe(201);
    expect(a.body.slug).toBe("test-musk");
    expect(b.body.slug).toBe("test-musk-2");
    expect(a.body.notes.top).toEqual(["White musk", "pear"]);
  });

  test("rejects a bulk tier at or below the MOQ, and one that is not cheaper", async () => {
    const atMoq = await create({ ...base, variants: [{ ...base.variants[0], priceTiers: [{ minQty: 6, price: 25 }] }] });
    expect(atMoq.status).toBe(400);
    expect(atMoq.body.error).toMatch(/above the minimum order of 6/);
    const notCheaper = await create({ ...base, variants: [{ ...base.variants[0], priceTiers: [{ minQty: 24, price: 31 }] }] });
    expect(notCheaper.status).toBe(400);
    expect(notCheaper.body.error).toMatch(/must be cheaper/);
  });

  test("editing runs the same rules (the old update path skipped them)", async () => {
    const a = await create(base);
    const bad = await request(app)
      .put(`/api/admin/products/${a.body._id}`)
      .set("Authorization", OWNER)
      .send({ ...base, variants: [{ ...base.variants[0], priceTiers: [{ minQty: 24, price: 99 }] }] });
    expect(bad.status).toBe(400);
    const good = await request(app)
      .put(`/api/admin/products/${a.body._id}`)
      .set("Authorization", OWNER)
      .send({ ...base, name: "Test Musk Renamed", variants: [{ ...base.variants[0], price: 32 }] });
    expect(good.status).toBe(200);
    expect(good.body.slug).toBe("test-musk-renamed");
    expect(good.body.variants[0].price).toBe(32);
  });

  test("validation errors name the field", async () => {
    const res = await create({ ...base, variants: [{ ...base.variants[0], price: -1 }] });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe("variants.0.price");
  });

  test("inline stock edit and archive", async () => {
    const layl = await bySlug("layl");
    const s = await request(app).patch(`/api/admin/products/${layl._id}/stock`).set("Authorization", OWNER).send({ size: "30ml", stock: 7 });
    expect(variant(s.body, "30ml").stock).toBe(7);
    const a = await request(app).patch(`/api/admin/products/${layl._id}/active`).set("Authorization", OWNER).send({ active: false });
    expect(a.body.active).toBe(false);
    const all = await request(app).get("/api/admin/products").set("Authorization", OWNER);
    expect(all.body).toHaveLength(catalog.length);
  });

  test("dashboard stats count orders and flag low stock", async () => {
    const layl = await bySlug("layl");
    await Product.updateOne({ _id: layl._id, "variants.size": "100ml" }, { $set: { "variants.$.stock": 4 } });
    await request(app)
      .post("/api/orders")
      .set("Authorization", BUYER)
      .send({ ...delivery, items: [{ productId: String(layl._id), size: "30ml", quantity: 12 }] });
    const res = await request(app).get("/api/admin/stats").set("Authorization", OWNER);
    expect(res.body.pending).toBe(1);
    expect(res.body.revenueWeek).toBe(696);
    expect(res.body.lowStock[0]).toMatchObject({ name: "Layl", size: "100ml", stock: 4 });
  });
});

describe("migrations", () => {
  test("raise 3ml MOQ on old data once, and backfill order history", async () => {
    await Product.updateMany({}, { $set: { "variants.$[].moq": 1 } });
    await mongoose.connection.collection("migrations").deleteMany({});
    await Order.collection.insertOne({
      userEmail: "old@example.com", customerName: "Old", customerPhone: "0300", customerAddress: "x",
      items: [{ productId: new mongoose.Types.ObjectId(), name: "Layl", size: "30ml", price: 68, quantity: 1 }],
      totalAmount: 68, status: "Delivered", createdAt: new Date(), updatedAt: new Date(),
    });
    await runMigrations();
    expect(variant(await bySlug("zafaran-oil"), "3ml").moq).toBe(3);
    expect(variant(await bySlug("bakhoor-muallaq"), "40g").moq).toBe(4);
    expect(variant(await bySlug("layl"), "30ml").moq).toBe(1);
    const old = await Order.findOne({ userEmail: "old@example.com" });
    expect(old.statusHistory.map((h) => h.status)).toEqual(["Pending", "Delivered"]);

    await Product.updateMany({}, { $set: { "variants.$[].moq": 1 } });
    await runMigrations(); // already recorded: does nothing
    expect(variant(await bySlug("zafaran-oil"), "3ml").moq).toBe(1);
  });
});

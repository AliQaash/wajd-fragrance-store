const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { TRANSITIONS } = Order;
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { productBody, statusBody, stockBody } = require("../validation/schemas");
const { cancelOrder } = require("./orders");

const router = express.Router();
router.use(requireAuth, requireAdmin);

const LOW_STOCK = 10;

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "product";
}

async function uniqueSlug(name, excludeId) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; await Product.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); i++) {
    slug = `${base}-${i}`;
  }
  return slug;
}

/** Turns a Mongoose validation error into { error, field } like zod errors. */
function sendModelError(res, err) {
  if (err.name === "ValidationError") {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ error: first.message, field: first.path });
  }
  return res.status(400).json({ error: err.message });
}

async function findProduct(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: "Product not found" });
    return null;
  }
  const product = await Product.findById(req.params.id);
  if (!product) res.status(404).json({ error: "Product not found" });
  return product;
}

// ---------- Dashboard ----------

// GET /api/admin/stats — what needs attention today
router.get("/stats", async (req, res, next) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [byStatus, week, products, recent] = await Promise.all([
      Order.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { createdAt: { $gte: weekAgo }, status: { $ne: "Cancelled" } } },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" }, orders: { $sum: 1 } } },
      ]),
      Product.find({ active: true }, { name: 1, slug: 1, variants: 1 }),
      Order.find().sort({ createdAt: -1 }).limit(5),
    ]);
    const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.n]));
    const lowStock = [];
    for (const p of products) {
      for (const v of p.variants) {
        if (v.stock < LOW_STOCK) lowStock.push({ productId: p._id, name: p.name, size: v.size, stock: v.stock });
      }
    }
    lowStock.sort((a, b) => a.stock - b.stock);
    res.json({
      pending: counts.Pending || 0,
      toDispatch: counts.Approved || 0,
      inTransit: counts.Dispatched || 0,
      revenueWeek: week[0] ? Math.round(week[0].revenue * 100) / 100 : 0,
      ordersWeek: week[0] ? week[0].orders : 0,
      activeProducts: products.length,
      lowStockThreshold: LOW_STOCK,
      lowStock,
      recentOrders: recent,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- Products ----------

// GET /api/admin/products — every product, archived included
router.get("/products", async (req, res, next) => {
  try {
    const filter = {};
    const q = String(req.query.q || "").trim();
    if (q) filter.name = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (req.query.status === "active") filter.active = true;
    if (req.query.status === "archived") filter.active = false;
    res.json(await Product.find(filter).sort({ active: -1, name: 1 }));
  } catch (err) {
    next(err);
  }
});

router.get("/products/:id", async (req, res, next) => {
  try {
    const product = await findProduct(req, res);
    if (product) res.json(product);
  } catch (err) {
    next(err);
  }
});

router.post("/products", validateBody(productBody), async (req, res, next) => {
  try {
    const product = new Product({ ...req.body, slug: await uniqueSlug(req.body.name) });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    if (err.name === "ValidationError" || err.message) return sendModelError(res, err);
    next(err);
  }
});

/**
 * PUT /api/admin/products/:id — full edit. Loads, assigns and save()s so the
 * tier/MOQ consistency hook runs; findByIdAndUpdate would skip it.
 */
router.put("/products/:id", validateBody(productBody), async (req, res, next) => {
  try {
    const product = await findProduct(req, res);
    if (!product) return;
    if (req.body.name !== product.name) product.slug = await uniqueSlug(req.body.name, product._id);
    product.set(req.body);
    await product.save();
    res.json(product);
  } catch (err) {
    return sendModelError(res, err);
  }
});

// PATCH /api/admin/products/:id/active — archive or restore
router.patch("/products/:id/active", async (req, res, next) => {
  try {
    const product = await findProduct(req, res);
    if (!product) return;
    product.active = Boolean(req.body.active);
    await product.save();
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/products/:id/stock — set one size's stock from the product table
router.patch("/products/:id/stock", validateBody(stockBody), async (req, res, next) => {
  try {
    const product = await findProduct(req, res);
    if (!product) return;
    const variant = product.variants.find((v) => v.size === req.body.size);
    if (!variant) return res.status(404).json({ error: "Size not found" });
    variant.stock = req.body.stock;
    await product.save();
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// ---------- Orders ----------

router.get("/orders", async (req, res, next) => {
  try {
    const filter = {};
    if (Order.STATUSES.includes(req.query.status)) filter.status = req.query.status;
    res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(200));
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/orders/:id/status — only the next valid step:
 * Pending → Approved | Cancelled, Approved → Dispatched | Cancelled,
 * Dispatched → Delivered. Cancelling puts stock back; delivering a cash
 * order marks it paid.
 */
router.put("/orders/:id/status", validateBody(statusBody), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Order not found" });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    const target = req.body.status;
    const allowed = TRANSITIONS[order.status] || [];
    if (!allowed.includes(target)) {
      return res.status(409).json({ error: `An order that is ${order.status} cannot move to ${target}` });
    }
    if (target === "Cancelled") return res.json(await cancelOrder(order, req.user.email));
    order.status = target;
    if (target === "Delivered" && order.paymentMethod === "COD") order.paymentStatus = "Paid";
    order.statusHistory.push({ status: target, by: req.user.email });
    await order.save();
    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const { FAMILIES, TYPES } = Product;

const router = express.Router();

const SORTS = {
  featured: { featured: -1, createdAt: -1 },
  "price-asc": { minPrice: 1, name: 1 },
  "price-desc": { minPrice: -1, name: 1 },
  newest: { createdAt: -1 },
  name: { name: 1 },
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/products — public catalog of active products.
 * ?q= search across name, notes, family and description (partial match)
 * ?type=Spray|Oil  ?family=Woody|...  ?sort=featured|price-asc|price-desc|newest|name
 * ?page=1&limit=12 → { items, total, page, pages }
 */
router.get("/", async (req, res, next) => {
  try {
    const match = { active: true };
    if (TYPES.includes(req.query.type)) match.type = req.query.type;
    if (FAMILIES.includes(req.query.family)) match.family = req.query.family;
    const q = String(req.query.q || "").trim().slice(0, 60);
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      match.$or = [
        { name: rx },
        { family: rx },
        { description: rx },
        { "notes.top": rx },
        { "notes.heart": rx },
        { "notes.base": rx },
      ];
    }
    const sort = SORTS[req.query.sort] || SORTS.featured;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 48);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const [result] = await Product.aggregate([
      { $match: match },
      { $addFields: { minPrice: { $min: "$variants.price" } } },
      { $sort: sort },
      {
        $facet: {
          items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: "n" }],
        },
      },
    ]);
    const total = result.total[0] ? result.total[0].n : 0;
    res.json({ items: result.items, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/id/:id — used by "Reorder" to rebuild a cart from an old order
router.get("/id/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Product not found" });
    const product = await Product.findOne({ _id: req.params.id, active: true });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:slug — one active product
router.get("/:slug", async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, active: true });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

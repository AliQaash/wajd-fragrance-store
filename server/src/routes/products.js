const express = require("express");
const Product = require("../models/Product");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const FAMILIES = ["Woody", "Floral", "Oriental", "Fresh", "Gourmand", "Musk", "Incense"];

// GET /api/products — public catalog, active products only
// Optional ?type=Spray|Oil (Perfumes vs Concentrated Oils section)
// Optional ?family=Woody|Floral|... (scent category)
router.get("/", async (req, res) => {
  try {
    const filter = { active: true };
    if (req.query.type && ["Spray", "Oil"].includes(req.query.type)) {
      filter.type = req.query.type;
    }
    if (req.query.family && FAMILIES.includes(req.query.family)) {
      filter.family = req.query.family;
    }
    const products = await Product.find(filter).sort({ featured: -1, createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:slug — single product by slug
router.get("/:slug", async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, active: true });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products — admin only
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/products/:id — admin only
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/products/:id — admin only, soft delete so historical orders still resolve
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { getUnitPrice } = require("../utils/pricing");

const router = express.Router();

// POST /api/orders — create an order for the logged-in user
// userEmail is taken from the verified token, never trusted from the body.
// Item prices are also never trusted from the body: the client only sends
// { productId, size, quantity }, and the server looks up the real product,
// finds the matching variant, and computes the correct bulk-tier price
// itself. Otherwise a tampered request could submit any price it likes.
router.post("/", requireAuth, async (req, res) => {
  try {
    const { customerName, customerPhone, customerAddress, items, paymentMethod, stripePaymentIntentId } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Order must include at least one item" });
    }

    const resolvedItems = [];
    for (const line of items) {
      const product = await Product.findOne({ _id: line.productId, active: true });
      if (!product) {
        return res.status(400).json({ error: `Product ${line.productId} not found` });
      }
      const variant = product.variants.find((v) => v.size === line.size);
      if (!variant) {
        return res.status(400).json({ error: `Size ${line.size} not available for ${product.name}` });
      }
      const quantity = Number(line.quantity) || 0;
      if (quantity < variant.moq) {
        return res.status(400).json({
          error: `${product.name} (${variant.size}) has a minimum order quantity of ${variant.moq}`,
        });
      }

      resolvedItems.push({
        productId: product._id,
        name: product.name,
        size: variant.size,
        price: getUnitPrice(variant, quantity), // server-computed, tier-aware
        quantity,
      });
    }

    const totalAmount = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = await Order.create({
      userEmail: req.user.email,
      customerName,
      customerPhone,
      customerAddress,
      items: resolvedItems,
      totalAmount,
      paymentMethod,
      stripePaymentIntentId: stripePaymentIntentId || null,
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/orders/mine — the logged-in user's own orders
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ userEmail: req.user.email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders — admin only, all orders
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/orders/:id/status — admin can set any status;
// a customer may only cancel their own still-pending order.
router.put("/:id/status", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const isAdmin = req.user.email === (process.env.ADMIN_EMAIL || "").toLowerCase();
    const isOwner = order.userEmail === req.user.email;

    if (isAdmin) {
      order.status = status;
    } else if (isOwner && status === "Cancelled" && order.status === "Pending") {
      order.status = "Cancelled";
    } else {
      return res.status(403).json({ error: "Not allowed to make this change" });
    }

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

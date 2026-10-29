const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { requireAuth } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { orderBody, quoteBody } = require("../validation/schemas");
const { quoteCart, reserveStock, releaseStock } = require("../services/quote");
const payments = require("../services/payments");
const { clientOriginFor } = require("../config/origins");

const router = express.Router();

/**
 * POST /api/orders/quote — prices a cart on the server. Public, so guests see
 * real prices, MOQ and stock problems before they sign in.
 */
router.post("/quote", validateBody(quoteBody), async (req, res, next) => {
  try {
    res.json(await quoteCart(req.body.items));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/orders — place an order. Everything that matters (who, prices,
 * totals, stock) is decided here: the email comes from the verified token,
 * prices from the database, and stock is taken atomically.
 */
router.post("/", requireAuth, validateBody(orderBody), async (req, res, next) => {
  try {
    const body = req.body;
    if (body.paymentMethod === "Card" && !payments.cardPaymentsEnabled()) {
      return res.status(400).json({ error: "Card payment is not available right now. Please choose cash on delivery.", field: "paymentMethod" });
    }

    const quote = await quoteCart(body.items);
    const bad = quote.lines.find((l) => l.error);
    if (bad) {
      return res.status(409).json({ error: `${bad.name ? `${bad.name} (${bad.size}): ` : ""}${bad.error}`, quote });
    }

    const reserved = await reserveStock(quote.lines);
    if (!reserved.ok) {
      const fresh = await quoteCart(body.items);
      return res.status(409).json({
        error: `${reserved.failed.name} (${reserved.failed.size}) just sold out at that quantity. Please review your cart.`,
        quote: fresh,
      });
    }

    let order;
    try {
      order = await Order.create({
        userEmail: req.user.email,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        city: body.city,
        customerAddress: body.customerAddress,
        deliveryNote: body.deliveryNote,
        items: quote.lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          slug: l.slug,
          imageUrl: l.imageUrl,
          size: l.size,
          basePrice: l.basePrice,
          price: l.unitPrice,
          quantity: l.quantity,
        })),
        subtotalBase: quote.subtotalBase,
        totalAmount: quote.total,
        paymentMethod: body.paymentMethod,
        statusHistory: [{ status: "Pending", by: req.user.email }],
      });
    } catch (err) {
      await releaseStock(quote.lines);
      throw err;
    }

    if (order.paymentMethod === "Card") {
      try {
        const session = await payments.createCheckoutSession(order, clientOriginFor(req));
        order.stripeSessionId = session.id;
        await order.save();
        return res.status(201).json({ order, checkoutUrl: session.url });
      } catch (err) {
        console.error("Stripe session failed:", err.message);
        return res.status(201).json({ order, checkoutUrl: null, paymentError: "Could not open the card payment page. You can retry from the order page." });
      }
    }

    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/mine — the signed-in buyer's orders, newest first
router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const filter = { userEmail: req.user.email };
    if (req.query.status === "active") filter.status = { $in: ["Pending", "Approved", "Dispatched"] };
    else if (["Delivered", "Cancelled"].includes(req.query.status)) filter.status = req.query.status;
    res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(100));
  } catch (err) {
    next(err);
  }
});

async function loadOwnOrder(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: "Order not found" });
    return null;
  }
  const order = await Order.findById(req.params.id);
  if (!order || (order.userEmail !== req.user.email && !req.user.isAdmin)) {
    res.status(404).json({ error: "Order not found" });
    return null;
  }
  return order;
}

// GET /api/orders/:id — one order, for its owner or an admin
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await loadOwnOrder(req, res);
    if (order) res.json(order);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/:id/cancel — a buyer may cancel their own order while it is Pending
router.post("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const order = await loadOwnOrder(req, res);
    if (!order) return;
    if (order.status !== "Pending") {
      return res.status(409).json({ error: `This order is already ${order.status.toLowerCase()} and can no longer be cancelled here. Please contact us.` });
    }
    await cancelOrder(order, req.user.email);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/:id/pay — open (or reopen) the card payment page for an unpaid card order
router.post("/:id/pay", requireAuth, async (req, res, next) => {
  try {
    const order = await loadOwnOrder(req, res);
    if (!order) return;
    if (order.paymentMethod !== "Card" || order.paymentStatus !== "Unpaid" || order.status === "Cancelled") {
      return res.status(409).json({ error: "This order does not need a card payment" });
    }
    const session = await payments.createCheckoutSession(order, clientOriginFor(req));
    order.stripeSessionId = session.id;
    await order.save();
    res.json({ checkoutUrl: session.url });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/:id/verify-payment — called after Stripe redirects back
router.post("/:id/verify-payment", requireAuth, async (req, res, next) => {
  try {
    const order = await loadOwnOrder(req, res);
    if (!order) return;
    if (order.paymentStatus === "Unpaid" && (await payments.sessionIsPaidFor(order))) {
      order.paymentStatus = "Paid";
      await order.save();
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});

/** Shared by buyer and admin cancellation: puts stock back once, records history. */
async function cancelOrder(order, byEmail) {
  if (!order.stockRestored) {
    await releaseStock(order.items.map((i) => ({ productId: i.productId, size: i.size, quantity: i.quantity })));
    order.stockRestored = true;
  }
  order.status = "Cancelled";
  if (order.paymentStatus === "Paid") order.paymentStatus = "Refund due";
  order.statusHistory.push({ status: "Cancelled", by: byEmail });
  await order.save();
  return order;
}

module.exports = router;
module.exports.cancelOrder = cancelOrder;

const express = require("express");
const Stripe = require("stripe");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// POST /api/payments/create-intent — logged-in users only
router.post("/create-intent", requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Card payments are not configured on this server" });
  }

  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });
    res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

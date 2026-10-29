const Stripe = require("stripe");

/**
 * Card payments use Stripe Checkout (hosted page, test mode). The server
 * builds the session from the order's own server-computed prices, so the
 * amount can never come from the browser. After Stripe redirects back, the
 * server retrieves the session and checks it is paid and the amount matches
 * before marking the order paid.
 *
 * Note: Stripe does not onboard Pakistani merchants; a real local launch
 * would use a gateway such as Safepay or PayFast behind the same interface.
 */
let client = null;
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

function cardPaymentsEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function toCents(n) {
  return Math.round(n * 100);
}

async function createCheckoutSession(order, clientOrigin) {
  const s = stripe();
  if (!s) throw Object.assign(new Error("Card payments are not configured"), { status: 503 });
  const id = String(order._id);
  return s.checkout.sessions.create({
    mode: "payment",
    customer_email: order.userEmail,
    client_reference_id: id,
    metadata: { orderId: id },
    line_items: order.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "usd",
        unit_amount: toCents(item.price),
        product_data: { name: `${item.name} (${item.size})` },
      },
    })),
    success_url: `${clientOrigin}/orders/${id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientOrigin}/orders/${id}?payment=cancelled`,
  });
}

/** True only if Stripe says the session is paid, for this order, for the full amount. */
async function sessionIsPaidFor(order) {
  const s = stripe();
  if (!s || !order.stripeSessionId) return false;
  const session = await s.checkout.sessions.retrieve(order.stripeSessionId);
  return (
    session.payment_status === "paid" &&
    session.metadata &&
    session.metadata.orderId === String(order._id) &&
    session.amount_total === toCents(order.totalAmount)
  );
}

module.exports = { cardPaymentsEnabled, createCheckoutSession, sessionIsPaidFor, _setClient: (c) => (client = c) };

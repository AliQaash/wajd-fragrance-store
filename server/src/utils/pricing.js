/**
 * Given a variant (with its base price and optional priceTiers) and an
 * order quantity, returns the correct per-unit price. Tiers are checked
 * from highest minQty down, so the best qualifying discount wins.
 *
 * This lives here (not just in frontend display logic) because the
 * server must recompute prices itself when an order is placed — never
 * trust a price the client sends, or a customer could submit any price
 * they want with a tampered request.
 */
function getUnitPrice(variant, quantity) {
  const tiers = [...(variant.priceTiers || [])].sort((a, b) => b.minQty - a.minQty);
  const match = tiers.find((tier) => quantity >= tier.minQty);
  return match ? match.price : variant.price;
}

module.exports = { getUnitPrice };

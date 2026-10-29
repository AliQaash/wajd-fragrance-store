/**
 * Pricing rules shared by the cart quote and order creation.
 *
 * A variant has a base unit price (applies from its MOQ upward) and optional
 * bulk tiers: "order minQty or more and every unit drops to price". The best
 * tier the quantity qualifies for wins. The server always recomputes prices
 * itself; nothing price-related is ever taken from the client.
 */
function sortedTiers(variant) {
  return [...(variant.priceTiers || [])].sort((a, b) => a.minQty - b.minQty);
}

function getUnitPrice(variant, quantity) {
  const tiers = sortedTiers(variant).reverse();
  const match = tiers.find((tier) => quantity >= tier.minQty);
  return match ? match.price : variant.price;
}

function nextTier(variant, quantity) {
  return sortedTiers(variant).find((tier) => quantity < tier.minQty) || null;
}

/** Money is stored in dollars; round to cents to avoid float drift (0.1 + 0.2). */
function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { getUnitPrice, nextTier, sortedTiers, round2 };

// Display-only mirror of server/src/utils/pricing.js. The server is the
// source of truth when an order is actually placed; this just lets the
// UI show the right price live as the person changes quantity.
export function getUnitPrice(variant, quantity) {
  const tiers = [...(variant.priceTiers || [])].sort((a, b) => b.minQty - a.minQty);
  const match = tiers.find((t) => quantity >= t.minQty);
  return match ? match.price : variant.price;
}

export function nextTier(variant, quantity) {
  const tiers = [...(variant.priceTiers || [])].sort((a, b) => a.minQty - b.minQty);
  return tiers.find((t) => quantity < t.minQty) || null;
}

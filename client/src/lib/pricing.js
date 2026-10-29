// Instant price feedback for the product page. Mirrors server/src/utils/pricing.js;
// the server re-prices everything for the cart total and the order.
export function sortedTiers(variant) {
  return [...(variant.priceTiers || [])].sort((a, b) => a.minQty - b.minQty);
}

export function getUnitPrice(variant, quantity) {
  const match = sortedTiers(variant).reverse().find((t) => quantity >= t.minQty);
  return match ? match.price : variant.price;
}

export function nextTier(variant, quantity) {
  return sortedTiers(variant).find((t) => quantity < t.minQty) || null;
}

/** Lowest price any buyer can reach on this product (best tier of any size). */
export function bulkFloor(product) {
  const prices = product.variants.flatMap((v) => [v.price, ...(v.priceTiers || []).map((t) => t.price)]);
  return Math.min(...prices);
}

export function fromPrice(product) {
  return Math.min(...product.variants.map((v) => v.price));
}

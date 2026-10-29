const mongoose = require("mongoose");
const Product = require("../models/Product");
const { getUnitPrice, nextTier, round2 } = require("../utils/pricing");

/**
 * Merges cart lines by product + size before pricing. Without this, adding
 * 6 bottles and later 6 more would create two lines of 6 and never reach the
 * 12+ bulk tier, which was the original bulk-pricing bug.
 */
function mergeLines(items) {
  const merged = new Map();
  for (const raw of items || []) {
    const productId = String(raw.productId || "");
    const size = String(raw.size || "");
    const quantity = Math.floor(Number(raw.quantity));
    const key = `${productId}::${size.toLowerCase()}`;
    const prev = merged.get(key);
    merged.set(key, { productId, size, quantity: (prev ? prev.quantity : 0) + (Number.isFinite(quantity) ? quantity : 0) });
  }
  return [...merged.values()];
}

/**
 * Prices a cart entirely on the server. Returns every line with its unit
 * price, plus a per-line `error` when the line cannot be ordered as is
 * (below MOQ, above stock, product archived). Callers decide whether an
 * error blocks them: the cart page shows it, order creation refuses.
 */
async function quoteCart(items) {
  const lines = mergeLines(items);
  const ids = lines.map((l) => l.productId).filter((id) => mongoose.isValidObjectId(id));
  const products = await Product.find({ _id: { $in: ids } });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const out = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product || !product.active) {
      out.push({ ...line, error: "This product is no longer available" });
      continue;
    }
    const variant = product.variants.find((v) => v.size.toLowerCase() === line.size.toLowerCase());
    if (!variant) {
      out.push({ ...line, name: product.name, error: `Size ${line.size} is no longer available` });
      continue;
    }

    const quantity = line.quantity;
    const unitPrice = getUnitPrice(variant, Math.max(quantity, 1));
    const next = nextTier(variant, quantity);
    let error = null;
    if (!Number.isInteger(quantity) || quantity < 1) error = "Quantity must be at least 1";
    else if (quantity < variant.moq) error = `Minimum order for ${variant.size} is ${variant.moq} units`;
    else if (quantity > variant.stock)
      error = variant.stock === 0 ? "Out of stock" : `Only ${variant.stock} in stock`;

    out.push({
      productId: String(product._id),
      slug: product.slug,
      name: product.name,
      imageUrl: product.imageUrl,
      size: variant.size,
      quantity,
      moq: variant.moq,
      stock: variant.stock,
      cartonSize: variant.cartonSize || null,
      basePrice: variant.price,
      unitPrice,
      lineTotal: round2(unitPrice * quantity),
      lineSavings: round2((variant.price - unitPrice) * quantity),
      nextTier: next ? { minQty: next.minQty, price: next.price, addQty: next.minQty - quantity } : null,
      error,
    });
  }

  const priced = out.filter((l) => l.lineTotal != null);
  const total = round2(priced.reduce((s, l) => s + l.lineTotal, 0));
  const subtotalBase = round2(priced.reduce((s, l) => s + l.basePrice * l.quantity, 0));
  return {
    lines: out,
    total,
    subtotalBase,
    savings: round2(subtotalBase - total),
    valid: out.length > 0 && out.every((l) => !l.error),
  };
}

/**
 * Takes stock for every line with conditional decrements, so two buyers can
 * never both get the last bottle. If any line fails, the lines already taken
 * are put back and the whole order is refused. Works on a plain MongoDB
 * deployment (no replica-set transaction needed).
 */
async function reserveStock(lines) {
  const taken = [];
  for (const line of lines) {
    const res = await Product.updateOne(
      { _id: line.productId, active: true, variants: { $elemMatch: { size: line.size, stock: { $gte: line.quantity } } } },
      { $inc: { "variants.$.stock": -line.quantity } }
    );
    if (res.modifiedCount !== 1) {
      await releaseStock(taken);
      return { ok: false, failed: line };
    }
    taken.push(line);
  }
  return { ok: true };
}

async function releaseStock(lines) {
  for (const line of lines) {
    await Product.updateOne(
      { _id: line.productId, "variants.size": line.size },
      { $inc: { "variants.$.stock": line.quantity } }
    );
  }
}

module.exports = { mergeLines, quoteCart, reserveStock, releaseStock };

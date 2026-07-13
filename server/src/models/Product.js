const mongoose = require("mongoose");

/**
 * A single quantity-based price break, e.g. "buy 12 or more of this
 * variant, pay $54 each instead of $68". No account type or approval
 * needed — any buyer who orders enough gets the lower unit price,
 * same as how the old app showed a strikethrough price and a discount
 * badge, just extended across quantity instead of a single fixed sale.
 */
const priceTierSchema = new mongoose.Schema(
  {
    minQty: { type: Number, required: true, min: 2 }, // 1 unit always uses variant.price
    price: { type: Number, required: true, min: 0 }, // per-unit price at this quantity or above
  },
  { _id: false }
);

/**
 * A product size/variant with its own price.
 * Fragrance retail sells by bottle size (30ml / 50ml / 100ml), not by
 * scaling a per-ml base price the way the old attar pricing model did —
 * larger bottles are NOT strictly cheaper per ml in real perfumery, so
 * each variant carries an explicit price rather than a derived one.
 */
const variantSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, trim: true }, // e.g. "30ml", "50ml", "100ml"
    price: { type: Number, required: true, min: 0 }, // unit price at quantity 1
    compareAtPrice: { type: Number, min: 0 }, // optional "was" price for a straight sale
    stock: { type: Number, default: 20, min: 0 },

    // Bulk pricing — sorted ascending by minQty. The effective unit price
    // for a given order quantity is the price on the highest tier whose
    // minQty is <= that quantity, falling back to `price` if none match.
    // The admin sets these thresholds freely (add/remove/edit rows in the
    // product form); the pre-validate hook below is the guardrail that
    // keeps whatever they enter internally consistent.
    priceTiers: { type: [priceTierSchema], default: [] },

    // Import/export ordering details
    moq: { type: Number, default: 1, min: 1 }, // minimum order quantity for this variant
    cartonSize: { type: Number, min: 1 }, // units per carton/case, if sold that way
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Top-level category the storefront filters/tabs by. Kept separate from
    // "concentration" below: type is "what section is this in", concentration
    // is "what exactly is in the bottle" (a detail shown on the product page).
    type: {
      type: String,
      enum: ["Spray", "Oil"],
      required: true,
    },
    concentration: {
      type: String,
      enum: ["Parfum", "Eau de Parfum", "Eau de Toilette", "Concentrated Oil", "Bakhoor"],
      default: "Eau de Parfum",
    },
    family: {
      type: String,
      enum: ["Woody", "Floral", "Oriental", "Fresh", "Gourmand", "Musk", "Incense"],
      required: true,
    },
    notes: {
      top: [{ type: String, trim: true }],
      heart: [{ type: String, trim: true }],
      base: [{ type: String, trim: true }],
    },
    description: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: "" },
    variants: {
      type: [variantSchema],
      validate: (v) => Array.isArray(v) && v.length > 0,
    },

    // Import/export details a Pakistani distributor or overseas buyer
    // will actually ask about before placing a bulk order.
    hsCode: { type: String, trim: true }, // customs tariff classification, e.g. "3303.00"
    originCountry: { type: String, trim: true, default: "Pakistan" },

    rating: { type: Number, default: 5, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text" });

/**
 * Keeps bulk pricing sane no matter what order the admin enters tiers in.
 * - Auto-sorts each variant's priceTiers ascending by minQty, so the admin
 *   can add rows in any order in the product form.
 * - Rejects duplicate thresholds (two tiers with the same minQty).
 * - Rejects a tier priced at or above the base price, or at or above a
 *   lower-quantity tier — a "bulk discount" that isn't actually cheaper
 *   is almost certainly a typo, and this catches it before it saves.
 * Errors are attached per-variant so the admin UI can show exactly which
 * size and which tier needs fixing, rather than one generic message.
 */
productSchema.pre("validate", function (next) {
  for (const variant of this.variants || []) {
    if (!variant.priceTiers || variant.priceTiers.length === 0) continue;

    variant.priceTiers.sort((a, b) => a.minQty - b.minQty);

    let previousPrice = variant.price;
    const seenQuantities = new Set();

    for (const tier of variant.priceTiers) {
      if (seenQuantities.has(tier.minQty)) {
        return next(
          new Error(`${variant.size}: duplicate bulk tier at quantity ${tier.minQty} — each threshold must be unique`)
        );
      }
      seenQuantities.add(tier.minQty);

      if (tier.price >= previousPrice) {
        return next(
          new Error(
            `${variant.size}: the tier at quantity ${tier.minQty} (price ${tier.price}) must be cheaper than the price at the tier below it (${previousPrice}) — a bulk tier has to actually be a discount`
          )
        );
      }
      previousPrice = tier.price;
    }
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);

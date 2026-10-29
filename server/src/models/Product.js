const mongoose = require("mongoose");

const TYPES = ["Spray", "Oil"];
const CONCENTRATIONS = ["Parfum", "Eau de Parfum", "Eau de Toilette", "Concentrated Oil", "Bakhoor"];
const FAMILIES = ["Woody", "Floral", "Oriental", "Fresh", "Gourmand", "Musk", "Incense"];

/**
 * A quantity-based price break: "order minQty or more of this variant and
 * every unit costs price". Any buyer who orders enough gets it; there is no
 * separate wholesale account.
 */
const priceTierSchema = new mongoose.Schema(
  {
    minQty: { type: Number, required: true, min: 2 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

/**
 * One bottle size. Each size carries its own price because larger bottles are
 * not strictly cheaper per ml in real perfumery.
 */
const variantSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, trim: true }, // "30ml", "40g"
    price: { type: Number, required: true, min: 0 }, // unit price from MOQ up
    compareAtPrice: { type: Number, min: 0 }, // optional "was" price
    stock: { type: Number, default: 0, min: 0 },
    moq: { type: Number, default: 1, min: 1 }, // smallest quantity shipped
    cartonSize: { type: Number, min: 1 }, // units per sealed carton
    priceTiers: { type: [priceTierSchema], default: [] },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: { type: String, enum: TYPES, required: true }, // storefront section
    concentration: { type: String, enum: CONCENTRATIONS, default: "Eau de Parfum" },
    family: { type: String, enum: FAMILIES, required: true },
    notes: {
      top: [{ type: String, trim: true }],
      heart: [{ type: String, trim: true }],
      base: [{ type: String, trim: true }],
    },
    description: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: "" },
    variants: {
      type: [variantSchema],
      validate: { validator: (v) => Array.isArray(v) && v.length > 0, message: "At least one size is required" },
    },
    hsCode: { type: String, trim: true }, // customs tariff code, e.g. 3303.00
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
 * Keeps sizes and bulk pricing internally consistent whatever order the admin
 * enters things in. Runs on create and on save(); product updates go through
 * save() for exactly this reason (findByIdAndUpdate would skip it).
 */
productSchema.pre("validate", function (next) {
  const sizes = new Set();
  for (const variant of this.variants || []) {
    const key = (variant.size || "").toLowerCase();
    if (sizes.has(key)) return next(new Error(`Size "${variant.size}" is listed twice`));
    sizes.add(key);

    if (variant.compareAtPrice != null && variant.compareAtPrice <= variant.price) {
      return next(new Error(`${variant.size}: the "was" price must be higher than the price`));
    }

    if (!variant.priceTiers || variant.priceTiers.length === 0) continue;
    variant.priceTiers.sort((a, b) => a.minQty - b.minQty);

    let previousPrice = variant.price;
    const seen = new Set();
    for (const tier of variant.priceTiers) {
      if (seen.has(tier.minQty)) {
        return next(new Error(`${variant.size}: two bulk tiers start at ${tier.minQty} units`));
      }
      seen.add(tier.minQty);
      if (tier.minQty <= variant.moq) {
        return next(
          new Error(
            `${variant.size}: a bulk tier must start above the minimum order of ${variant.moq} (tier at ${tier.minQty})`
          )
        );
      }
      if (tier.price >= previousPrice) {
        return next(
          new Error(
            `${variant.size}: the tier at ${tier.minQty} units (${tier.price}) must be cheaper than the price below it (${previousPrice})`
          )
        );
      }
      previousPrice = tier.price;
    }
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);
module.exports.TYPES = TYPES;
module.exports.CONCENTRATIONS = CONCENTRATIONS;
module.exports.FAMILIES = FAMILIES;

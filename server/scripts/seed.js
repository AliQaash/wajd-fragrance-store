require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../src/models/Product");

// HS codes: 3303.00 covers perfumes and toilet waters (our sprays).
// 3301.29 covers essential oils / concentrated aromatic oils (our oils).
// 3307.90 covers other perfumery/toilet preparations (bakhoor/incense).
const HS_PERFUME = "3303.00";
const HS_OIL = "3301.29";
const HS_INCENSE = "3307.90";
const REPO = "https://raw.githubusercontent.com/AliQaash/wajd-fragrance-store/main/docs/product-images";

const products = [
  // ---------------- SPRAYS (Eau de Parfum / Eau de Toilette) ----------------
  {
    name: "Layl",
    slug: "layl",
    type: "Spray",
    concentration: "Eau de Parfum",
    family: "Oriental",
    hsCode: HS_PERFUME,
    notes: { top: ["Saffron", "Bergamot"], heart: ["Rose", "Oud"], base: ["Amber", "Sandalwood"] },
    description:
      "A dark, resinous oud built around saffron and rose, settling into a long amber base. Wears close to the skin, made for evenings.",
    imageUrl: `${REPO}/layl.png`,
    variants: [
      {
        size: "30ml", price: 68, stock: 240, moq: 1, cartonSize: 12,
        priceTiers: [{ minQty: 12, price: 58 }, { minQty: 48, price: 51 }],
      },
      {
        size: "50ml", price: 98, stock: 180, moq: 1, cartonSize: 12,
        priceTiers: [{ minQty: 12, price: 84 }, { minQty: 48, price: 74 }],
      },
      {
        size: "100ml", price: 148, stock: 100, moq: 1, cartonSize: 6,
        priceTiers: [{ minQty: 6, price: 132 }, { minQty: 24, price: 118 }],
      },
    ],
    rating: 4.8,
    ratingCount: 34,
    featured: true,
  },
  {
    name: "Ward Taifi",
    slug: "ward-taifi",
    type: "Spray",
    concentration: "Eau de Parfum",
    family: "Floral",
    hsCode: HS_PERFUME,
    notes: { top: ["Green Notes", "Lychee"], heart: ["Taif Rose", "Peony"], base: ["Musk", "Cedar"] },
    description:
      "Named for the Taif rose it's built around: bright and green at first, then true rose through the heart, finished with clean musk and cedar.",
    imageUrl: `${REPO}/ward-taifi.png`,
    variants: [
      {
        size: "30ml", price: 62, stock: 200, moq: 1, cartonSize: 12,
        priceTiers: [{ minQty: 12, price: 53 }, { minQty: 48, price: 46 }],
      },
      {
        size: "50ml", price: 89, stock: 160, moq: 1, cartonSize: 12,
        priceTiers: [{ minQty: 12, price: 76 }, { minQty: 48, price: 67 }],
      },
      {
        size: "100ml", price: 132, stock: 80, moq: 1, cartonSize: 6,
        priceTiers: [{ minQty: 6, price: 118 }, { minQty: 24, price: 105 }],
      },
    ],
    rating: 4.6,
    ratingCount: 21,
    featured: true,
  },
  {
    name: "Suhail",
    slug: "suhail",
    type: "Spray",
    concentration: "Eau de Toilette",
    family: "Fresh",
    hsCode: HS_PERFUME,
    notes: { top: ["Bergamot", "Sea Salt"], heart: ["Fig", "Jasmine"], base: ["Ambergris", "Driftwood"] },
    description:
      "Named after the star sailors once steered by. Citrus and salt at the open, fig and jasmine through the middle, a quiet ambergris base.",
    imageUrl: `${REPO}/suhail.png`,
    variants: [
      {
        size: "30ml", price: 48, stock: 260, moq: 1, cartonSize: 12,
        priceTiers: [{ minQty: 12, price: 41 }, { minQty: 48, price: 36 }],
      },
      {
        size: "50ml", price: 72, stock: 200, moq: 1, cartonSize: 12,
        priceTiers: [{ minQty: 12, price: 61 }, { minQty: 48, price: 54 }],
      },
      {
        size: "100ml", price: 108, stock: 110, moq: 1, cartonSize: 6,
        priceTiers: [{ minQty: 6, price: 96 }, { minQty: 24, price: 86 }],
      },
    ],
    rating: 4.4,
    ratingCount: 19,
  },
  {
    name: "Qamar",
    slug: "qamar",
    type: "Spray",
    concentration: "Eau de Parfum",
    family: "Gourmand",
    hsCode: HS_PERFUME,
    notes: { top: ["Pear", "Cardamom"], heart: ["Praline", "Iris"], base: ["Vanilla", "Tonka Bean"] },
    description:
      "Soft and warm, built to feel like moonlight rather than dessert: pear and cardamom up front, praline and iris through the heart, vanilla and tonka settling underneath.",
    imageUrl: "",
    variants: [
      {
        size: "30ml", price: 58, stock: 220, moq: 1, cartonSize: 12,
        priceTiers: [{ minQty: 12, price: 49 }, { minQty: 48, price: 43 }],
      },
      {
        size: "50ml", price: 84, stock: 170, moq: 1, cartonSize: 12,
        priceTiers: [{ minQty: 12, price: 71 }, { minQty: 48, price: 63 }],
      },
      {
        size: "100ml", price: 124, stock: 90, moq: 1, cartonSize: 6,
        priceTiers: [{ minQty: 6, price: 110 }, { minQty: 24, price: 98 }],
      },
    ],
    rating: 4.7,
    ratingCount: 27,
  },
  {
    name: "Sidrah",
    slug: "sidrah",
    type: "Spray",
    concentration: "Eau de Parfum",
    family: "Woody",
    hsCode: HS_PERFUME,
    notes: { top: ["Cypress", "Black Pepper"], heart: ["Vetiver", "Leather"], base: ["Oud", "Patchouli"] },
    description:
      "Named for the lote tree. Sharp cypress and pepper give way to vetiver and leather, then a long, dry oud and patchouli base that lasts well into the night.",
    imageUrl: `${REPO}/sidrah.png`,
    variants: [
      {
        size: "30ml", price: 64, stock: 190, moq: 1, cartonSize: 12,
        priceTiers: [{ minQty: 12, price: 55 }, { minQty: 48, price: 48 }],
      },
      {
        size: "50ml", price: 94, stock: 140, moq: 1, cartonSize: 12,
        priceTiers: [{ minQty: 12, price: 80 }, { minQty: 48, price: 71 }],
      },
      {
        size: "100ml", price: 142, stock: 70, moq: 1, cartonSize: 6,
        priceTiers: [{ minQty: 6, price: 126 }, { minQty: 24, price: 112 }],
      },
    ],
    rating: 4.9,
    ratingCount: 41,
    featured: true,
  },
  {
    name: "Nur",
    slug: "nur",
    type: "Spray",
    concentration: "Eau de Toilette",
    family: "Fresh",
    hsCode: HS_PERFUME,
    notes: { top: ["White Tea", "Yuzu"], heart: ["Orange Blossom", "Neroli"], base: ["White Musk"] },
    description:
      "Light and radiant, close to skin. White tea and yuzu open into orange blossom and neroli, resting on a clean white musk that never gets heavy.",
    imageUrl: "",
    variants: [
      {
        size: "30ml", price: 44, stock: 280, moq: 1, cartonSize: 12,
        priceTiers: [{ minQty: 12, price: 37 }, { minQty: 48, price: 33 }],
      },
      {
        size: "50ml", price: 66, stock: 210, moq: 1, cartonSize: 12,
        priceTiers: [{ minQty: 12, price: 56 }, { minQty: 48, price: 49 }],
      },
      {
        size: "100ml", price: 98, stock: 120, moq: 1, cartonSize: 6,
        priceTiers: [{ minQty: 6, price: 87 }, { minQty: 24, price: 78 }],
      },
    ],
    rating: 4.3,
    ratingCount: 15,
  },

  // ---------------- CONCENTRATED OILS ----------------
  // Alcohol-free, worn directly or applied with a dabber/roll-on. Sold in
  // much smaller volumes than sprays since they're undiluted. Carton
  // sizes are larger (these are small, light, cheap to ship in bulk —
  // exactly the kind of line a distributor orders by the box of 100).
  {
    name: "Zafaran",
    slug: "zafaran-oil",
    type: "Oil",
    concentration: "Concentrated Oil",
    family: "Oriental",
    hsCode: HS_OIL,
    notes: { top: ["Saffron"], heart: ["Rose", "Amber"], base: ["Musk"] },
    description:
      "A concentrated oil built around saffron and rose over a warm amber-musk base. Alcohol-free and long-lasting directly on skin.",
    imageUrl: `${REPO}/zafaran.png`,
    variants: [
      {
        size: "3ml", price: 28, stock: 400, moq: 1, cartonSize: 100,
        priceTiers: [{ minQty: 24, price: 23 }, { minQty: 100, price: 19 }],
      },
      {
        size: "6ml", price: 42, stock: 300, moq: 1, cartonSize: 50,
        priceTiers: [{ minQty: 24, price: 35 }, { minQty: 100, price: 30 }],
      },
      {
        size: "12ml", price: 74, stock: 160, moq: 1, cartonSize: 24,
        priceTiers: [{ minQty: 12, price: 65 }, { minQty: 48, price: 57 }],
      },
    ],
    rating: 4.8,
    ratingCount: 22,
    featured: true,
  },
  {
    name: "Misk Abyad",
    slug: "misk-abyad",
    type: "Oil",
    concentration: "Concentrated Oil",
    family: "Musk",
    hsCode: HS_OIL,
    notes: { top: ["White Musk"], heart: ["Jasmine"], base: ["Sandalwood"] },
    description:
      "A clean white musk oil, soft jasmine through the heart, a light sandalwood base. Wears close and quiet, good for everyday and for layering.",
    imageUrl: `${REPO}/misk-abyad.png`,
    variants: [
      {
        size: "3ml", price: 22, stock: 420, moq: 1, cartonSize: 100,
        priceTiers: [{ minQty: 24, price: 18 }, { minQty: 100, price: 15 }],
      },
      {
        size: "6ml", price: 34, stock: 320, moq: 1, cartonSize: 50,
        priceTiers: [{ minQty: 24, price: 28 }, { minQty: 100, price: 24 }],
      },
      {
        size: "12ml", price: 58, stock: 180, moq: 1, cartonSize: 24,
        priceTiers: [{ minQty: 12, price: 51 }, { minQty: 48, price: 45 }],
      },
    ],
    rating: 4.6,
    ratingCount: 18,
  },
  {
    name: "Oud Dakhili",
    slug: "oud-dakhili",
    type: "Oil",
    concentration: "Concentrated Oil",
    family: "Woody",
    hsCode: HS_OIL,
    notes: { top: ["Oud"], heart: ["Saffron", "Rose"], base: ["Amber"] },
    description:
      "A dense, traditional oud oil. Smoky and deep from the first moment, with saffron and rose only lightly softening it. For those who want oud that reads as oud.",
    imageUrl: `${REPO}/oud-dakhili.png`,
    variants: [
      {
        size: "3ml", price: 38, stock: 260, moq: 1, cartonSize: 100,
        priceTiers: [{ minQty: 24, price: 32 }, { minQty: 100, price: 27 }],
      },
      {
        size: "6ml", price: 62, stock: 180, moq: 1, cartonSize: 50,
        priceTiers: [{ minQty: 24, price: 52 }, { minQty: 100, price: 45 }],
      },
      {
        size: "12ml", price: 110, stock: 90, moq: 1, cartonSize: 24,
        priceTiers: [{ minQty: 12, price: 97 }, { minQty: 48, price: 85 }],
      },
    ],
    rating: 4.9,
    ratingCount: 29,
    featured: true,
  },
  {
    name: "Amber Sharqi",
    slug: "amber-sharqi",
    type: "Oil",
    concentration: "Concentrated Oil",
    family: "Oriental",
    hsCode: HS_OIL,
    notes: { top: ["Amber"], heart: ["Labdanum", "Vanilla"], base: ["Musk"] },
    description:
      "A warm, resinous amber oil, sweetened lightly with vanilla and grounded in musk. Sits close to the skin and lasts most of the day from a single dab.",
    imageUrl: `${REPO}/amber-sharqi.png`,
    variants: [
      {
        size: "3ml", price: 24, stock: 340, moq: 1, cartonSize: 100,
        priceTiers: [{ minQty: 24, price: 20 }, { minQty: 100, price: 17 }],
      },
      {
        size: "6ml", price: 38, stock: 240, moq: 1, cartonSize: 50,
        priceTiers: [{ minQty: 24, price: 32 }, { minQty: 100, price: 27 }],
      },
      {
        size: "12ml", price: 64, stock: 130, moq: 1, cartonSize: 24,
        priceTiers: [{ minQty: 12, price: 56 }, { minQty: 48, price: 49 }],
      },
    ],
    rating: 4.5,
    ratingCount: 13,
  },

  // ---------------- HOME / INCENSE ----------------
  {
    name: "Bakhoor Muallaq",
    slug: "bakhoor-muallaq",
    type: "Oil",
    concentration: "Bakhoor",
    family: "Incense",
    hsCode: HS_INCENSE,
    notes: { top: ["Oud Chips"], heart: ["Frankincense"], base: ["Amber Resin"] },
    description:
      "Hand-dipped oud chips for burning, not wearing. Deep frankincense and amber smoke, meant for the home rather than the skin.",
    imageUrl: `${REPO}/bakhoor-muallaq.png`,
    variants: [
      {
        size: "40g", price: 36, stock: 300, moq: 1, cartonSize: 48,
        priceTiers: [{ minQty: 24, price: 30 }, { minQty: 96, price: 25 }],
      },
      {
        size: "100g", price: 78, stock: 150, moq: 1, cartonSize: 24,
        priceTiers: [{ minQty: 12, price: 68 }, { minQty: 48, price: 59 }],
      },
    ],
    rating: 4.5,
    ratingCount: 11,
  },
];

async function seed() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected. Clearing existing products...");

  await Product.deleteMany({});
  await Product.insertMany(products);

  const sprays = products.filter((p) => p.type === "Spray").length;
  const oils = products.filter((p) => p.type === "Oil").length;
  console.log(`Seeded ${products.length} products (${sprays} sprays, ${oils} oils/incense), all with bulk price tiers.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

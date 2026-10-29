const { z } = require("zod");
const { TYPES, CONCENTRATIONS, FAMILIES } = require("../models/Product");

const money = (label) =>
  z.coerce.number({ invalid_type_error: `${label} must be a number` }).positive(`${label} must be more than 0`);
const wholeNumber = (label, min) =>
  z.coerce.number({ invalid_type_error: `${label} must be a number` }).int(`${label} must be a whole number`).min(min, `${label} must be at least ${min}`);

const optionalNumber = (schema) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), schema.optional());

const noteList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (Array.isArray(v) ? v : (v || "").split(",")).map((s) => s.trim()).filter(Boolean));

const tierSchema = z.object({
  minQty: wholeNumber("Tier quantity", 2),
  price: money("Tier price"),
});

const variantSchema = z.object({
  size: z.string().trim().min(1, "Size is required (e.g. 30ml)").max(20),
  price: money("Price"),
  compareAtPrice: optionalNumber(money('"Was" price')),
  stock: wholeNumber("Stock", 0),
  moq: wholeNumber("Minimum order", 1).default(1),
  cartonSize: optionalNumber(wholeNumber("Carton size", 1)),
  priceTiers: z.array(tierSchema).default([]),
});

const productBody = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  type: z.enum(TYPES, { errorMap: () => ({ message: "Choose Perfume (spray) or Oil" }) }),
  concentration: z.enum(CONCENTRATIONS, { errorMap: () => ({ message: "Choose a concentration" }) }),
  family: z.enum(FAMILIES, { errorMap: () => ({ message: "Choose a scent family" }) }),
  notes: z
    .object({ top: noteList, heart: noteList, base: noteList })
    .default({ top: [], heart: [], base: [] }),
  description: z.string().trim().max(1200).default(""),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\//.test(v), "Image URL must start with https://")
    .default(""),
  hsCode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}(\.\d{2}){0,3}$/.test(v), "HS code looks like 3303.00")
    .default(""),
  originCountry: z.string().trim().max(60).default("Pakistan"),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  variants: z.array(variantSchema).min(1, "Add at least one size"),
});

const phone = z
  .string()
  .trim()
  .refine((v) => /^\+?[0-9\s-]{7,20}$/.test(v) && v.replace(/\D/g, "").length >= 7, "Enter a valid phone number, e.g. 0300 1234567");

const cartItems = z
  .array(
    z.object({
      productId: z.string().min(1),
      size: z.string().min(1),
      quantity: z.coerce.number().int().min(1),
    })
  )
  .min(1, "Your cart is empty")
  .max(50, "Too many lines in one order");

const quoteBody = z.object({ items: z.array(z.any()).max(50).default([]) });

const orderBody = z.object({
  customerName: z.string().trim().min(2, "Enter your full name").max(80),
  customerPhone: phone,
  city: z.string().trim().min(2, "Enter your city").max(60),
  customerAddress: z.string().trim().min(8, "Enter a full delivery address").max(300),
  deliveryNote: z.string().trim().max(300).default(""),
  paymentMethod: z.enum(["COD", "Card"]).default("COD"),
  items: cartItems,
});

const statusBody = z.object({ status: z.enum(["Pending", "Approved", "Dispatched", "Delivered", "Cancelled"]) });

const stockBody = z.object({ size: z.string().min(1), stock: wholeNumber("Stock", 0) });

const describeBody = z.object({
  name: z.string().trim().min(1, "Enter a name first"),
  family: z.string().optional(),
  notes: z.string().trim().min(1, "Enter at least one note first"),
});

module.exports = { productBody, orderBody, quoteBody, statusBody, stockBody, describeBody };

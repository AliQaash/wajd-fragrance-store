const mongoose = require("mongoose");

const STATUSES = ["Pending", "Approved", "Dispatched", "Delivered", "Cancelled"];
const PAYMENT_STATUSES = ["Unpaid", "Paid", "Refund due"];

/** Fulfilment moves an admin may make from each status. */
const TRANSITIONS = {
  Pending: ["Approved", "Cancelled"],
  Approved: ["Dispatched", "Cancelled"],
  Dispatched: ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    slug: { type: String },
    imageUrl: { type: String },
    size: { type: String, required: true },
    basePrice: { type: Number, min: 0 }, // unit price before bulk tiers, for showing savings
    price: { type: Number, required: true, min: 0 }, // unit price actually charged
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: String }, // email of whoever made the change
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    city: { type: String, trim: true },
    customerAddress: { type: String, required: true, trim: true },
    deliveryNote: { type: String, trim: true, default: "" },
    items: {
      type: [orderItemSchema],
      validate: (v) => Array.isArray(v) && v.length > 0,
    },
    subtotalBase: { type: Number, min: 0 }, // what it would cost without bulk tiers
    totalAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: STATUSES, default: "Pending", index: true },
    statusHistory: { type: [historySchema], default: [] },
    paymentMethod: { type: String, enum: ["COD", "Card"], default: "COD" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "Unpaid" },
    stripeSessionId: { type: String, default: null },
    stockRestored: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
module.exports.STATUSES = STATUSES;
module.exports.TRANSITIONS = TRANSITIONS;

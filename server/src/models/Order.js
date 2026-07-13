const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    size: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    customerAddress: { type: String, required: true, trim: true },
    items: {
      type: [orderItemSchema],
      validate: (v) => Array.isArray(v) && v.length > 0,
    },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Delivered", "Cancelled"],
      default: "Pending",
    },
    paymentMethod: { type: String, enum: ["COD", "Card"], default: "COD" },
    stripePaymentIntentId: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);

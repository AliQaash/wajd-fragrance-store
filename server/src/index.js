require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");
const aiRoutes = require("./routes/ai");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/ping", (req, res) => res.json({ ok: true }));

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/ai", aiRoutes);

// Centralized error fallback for anything that slips past route-level try/catch
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Wajd API listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

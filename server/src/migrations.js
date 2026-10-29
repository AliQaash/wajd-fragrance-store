const mongoose = require("mongoose");
const Product = require("./models/Product");
const Order = require("./models/Order");

/**
 * One-time data migrations, run at startup after the database connects.
 * Each runs once and is recorded in the `migrations` collection, so the live
 * database is updated by a normal deploy without anyone running a script.
 */
const MIGRATIONS = [
  {
    id: "2026-10-wholesale-moq",
    // Sample vials ship in packs of 3 and small bakhoor in packs of 4. Only
    // touches variants still at the old default MOQ of 1, and only where every
    // bulk tier stays above the new MOQ.
    async run() {
      const rules = [
        { match: (p, v) => v.size === "3ml", moq: 3 },
        { match: (p, v) => p.slug === "bakhoor-muallaq" && v.size === "40g", moq: 4 },
      ];
      const products = await Product.find({});
      let changed = 0;
      for (const p of products) {
        for (const v of p.variants) {
          const rule = rules.find((r) => r.match(p, v));
          if (!rule || v.moq !== 1) continue;
          if ((v.priceTiers || []).some((t) => t.minQty <= rule.moq)) continue;
          await Product.updateOne(
            { _id: p._id },
            { $set: { "variants.$[v].moq": rule.moq } },
            { arrayFilters: [{ "v.size": v.size }] }
          );
          changed++;
        }
      }
      return `${changed} variants`;
    },
  },
  {
    id: "2026-10-order-history",
    // Orders placed before status history existed get a starting entry so the
    // order timeline has something to show.
    async run() {
      const orders = await Order.find({ $or: [{ statusHistory: { $exists: false } }, { statusHistory: { $size: 0 } }] });
      for (const o of orders) {
        const history = [{ status: "Pending", at: o.createdAt }];
        if (o.status !== "Pending") history.push({ status: o.status, at: o.updatedAt });
        await Order.updateOne({ _id: o._id }, { $set: { statusHistory: history } });
      }
      return `${orders.length} orders`;
    },
  },
];

async function runMigrations() {
  const col = mongoose.connection.collection("migrations");
  for (const m of MIGRATIONS) {
    if (await col.findOne({ _id: m.id })) continue;
    const result = await m.run();
    await col.insertOne({ _id: m.id, at: new Date(), result });
    console.log(`Migration ${m.id}: ${result}`);
  }
}

module.exports = runMigrations;
module.exports.MIGRATIONS = MIGRATIONS;

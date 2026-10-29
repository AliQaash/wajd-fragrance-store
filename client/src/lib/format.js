const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const fmtMoney = (n) => money.format(Number(n) || 0);

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const fmtDate = (d) => (d ? date.format(new Date(d)) : "");
export const fmtDateTime = (d) => (d ? dateTime.format(new Date(d)) : "");

export const shortId = (id) => `#${String(id).slice(-6).toUpperCase()}`;

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const TYPES = [
  { value: "Spray", label: "Perfumes" },
  { value: "Oil", label: "Oils & bakhoor" },
];
export const FAMILIES = ["Woody", "Floral", "Oriental", "Fresh", "Gourmand", "Musk", "Incense"];
export const CONCENTRATIONS = {
  Spray: ["Parfum", "Eau de Parfum", "Eau de Toilette"],
  Oil: ["Concentrated Oil", "Bakhoor"],
};
export const ORDER_STEPS = ["Pending", "Approved", "Dispatched", "Delivered"];
export const STEP_LABELS = { Pending: "Placed", Approved: "Approved", Dispatched: "Dispatched", Delivered: "Delivered", Cancelled: "Cancelled" };
export const TRANSITIONS = {
  Pending: ["Approved", "Cancelled"],
  Approved: ["Dispatched", "Cancelled"],
  Dispatched: ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

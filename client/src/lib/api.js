import { auth } from "./firebase";

const BASE_URL = (import.meta.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, { status, field, data } = {}) {
    super(message);
    this.status = status;
    this.field = field;
    this.data = data;
  }
}

async function request(path, { method = "GET", body, auth: needsAuth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (needsAuth || auth.currentUser) {
    const user = auth.currentUser;
    if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
    else if (needsAuth) throw new ApiError("Please sign in first", { status: 401 });
  }
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("Cannot reach the store right now. Check your connection, or the server may be waking up (up to a minute).", { status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Something went wrong", { status: res.status, field: data.field, data });
  return data;
}

const qs = (params) => {
  const clean = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== "" && v != null));
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
};

export const api = {
  config: () => request("/config"),
  me: () => request("/me", { auth: true }),

  products: (params) => request(`/products${qs(params)}`),
  product: (slug) => request(`/products/${encodeURIComponent(slug)}`),
  productById: (id) => request(`/products/id/${id}`),

  quote: (items) => request("/orders/quote", { method: "POST", body: { items } }),
  placeOrder: (body) => request("/orders", { method: "POST", body, auth: true }),
  myOrders: (status) => request(`/orders/mine${qs({ status })}`, { auth: true }),
  order: (id) => request(`/orders/${id}`, { auth: true }),
  cancelOrder: (id) => request(`/orders/${id}/cancel`, { method: "POST", auth: true }),
  payOrder: (id) => request(`/orders/${id}/pay`, { method: "POST", auth: true }),
  verifyPayment: (id) => request(`/orders/${id}/verify-payment`, { method: "POST", auth: true }),

  admin: {
    stats: () => request("/admin/stats", { auth: true }),
    products: (params) => request(`/admin/products${qs(params)}`, { auth: true }),
    product: (id) => request(`/admin/products/${id}`, { auth: true }),
    createProduct: (body) => request("/admin/products", { method: "POST", body, auth: true }),
    updateProduct: (id, body) => request(`/admin/products/${id}`, { method: "PUT", body, auth: true }),
    setActive: (id, active) => request(`/admin/products/${id}/active`, { method: "PATCH", body: { active }, auth: true }),
    setStock: (id, size, stock) => request(`/admin/products/${id}/stock`, { method: "PATCH", body: { size, stock }, auth: true }),
    orders: (status) => request(`/admin/orders${qs({ status })}`, { auth: true }),
    setStatus: (id, status) => request(`/admin/orders/${id}/status`, { method: "PUT", body: { status }, auth: true }),
    describe: (body) => request("/ai/describe-product", { method: "POST", body, auth: true }),
  },
};

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },
  getProduct: (slug) => request(`/products/${slug}`),
  createProduct: (token, body) => request("/products", { method: "POST", token, body }),
  updateProduct: (token, id, body) => request(`/products/${id}`, { method: "PUT", token, body }),
  deleteProduct: (token, id) => request(`/products/${id}`, { method: "DELETE", token }),

  createOrder: (token, body) => request("/orders", { method: "POST", token, body }),
  getMyOrders: (token) => request("/orders/mine", { token }),
  getAllOrders: (token) => request("/orders", { token }),
  setOrderStatus: (token, id, status) =>
    request(`/orders/${id}/status`, { method: "PUT", token, body: { status } }),

  createPaymentIntent: (token, amount) =>
    request("/payments/create-intent", { method: "POST", token, body: { amount } }),

  describeProduct: (token, body) => request("/ai/describe-product", { method: "POST", token, body }),
};

import React, { useState, useEffect, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./lib/firebase";
import { api } from "./lib/api";
import { getUnitPrice, nextTier } from "./lib/pricing";
import "./styles/index.css";

export const BRAND = { ar: "وجد", latin: "WAJD", tagline: "Fine fragrances, honestly priced." };
const ADMIN_EMAIL = (process.env.REACT_APP_ADMIN_EMAIL || "").toLowerCase();

function Toast({ message }) {
  if (!message) return null;
  return <div className="toast">{message}</div>;
}

// ---------- AUTH ----------
function AuthView() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (mode === "login") await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    }
  }

  return (
    <div className="auth-container">
      <div className="brand" style={{ justifyContent: "center", marginBottom: 20 }}>
        <span className="ar">{BRAND.ar}</span>
        <span className="latin">{BRAND.latin}</span>
      </div>
      <form onSubmit={submit}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="error-text">{error}</div>}
        <button className="primary-btn" type="submit">{mode === "login" ? "Sign In" : "Create Account"}</button>
      </form>
      <p style={{ marginTop: 14, fontSize: 13, color: "var(--smoke)" }}>
        {mode === "login" ? "New here? " : "Already have an account? "}
        <span className="link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Create an account" : "Sign in"}
        </span>
      </p>
    </div>
  );
}

// ---------- PRICE TIER TABLE (shared) ----------
function TierTable({ variant, quantity }) {
  if (!variant.priceTiers || variant.priceTiers.length === 0) return null;
  const rows = [{ minQty: 1, price: variant.price }, ...[...variant.priceTiers].sort((a, b) => a.minQty - b.minQty)];
  return (
    <table className="tier-table">
      <tbody>
        {rows.map((t, i) => {
          const isActive = getUnitPrice(variant, quantity) === t.price;
          return (
            <tr key={i} className={isActive ? "active-tier" : ""}>
              <td>{t.minQty === 1 ? "1+" : `${t.minQty}+`} units</td>
              <td style={{ textAlign: "right" }}>${t.price.toFixed(2)} each</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------- PRODUCT DETAIL MODAL ----------
function ProductDetail({ product, onClose, onAddToCart }) {
  const [variantIdx, setVariantIdx] = useState(0);
  const variant = product.variants[variantIdx];
  const [qty, setQty] = useState(variant.moq || 1);

  useEffect(() => setQty(variant.moq || 1), [variantIdx]); // eslint-disable-line

  const unitPrice = getUnitPrice(variant, qty);
  const next = nextTier(variant, qty);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <span className="close-modal" onClick={onClose}>&times;</span>
        <div className="product-img detail-img">{BRAND.ar}</div>
        <div className="detail-title">{product.name}</div>
        <div className="detail-meta">{product.concentration} &middot; {product.family}</div>
        {product.description && <p style={{ marginTop: 10, fontSize: 14, color: "var(--smoke)" }}>{product.description}</p>}

        <div className="notes-row">
          <div><b>Top</b>{product.notes?.top?.join(", ")}</div>
          <div><b>Heart</b>{product.notes?.heart?.join(", ")}</div>
          <div><b>Base</b>{product.notes?.base?.join(", ")}</div>
        </div>

        <div className="size-selector">
          {product.variants.map((v, i) => (
            <div key={v.size} className={`size-chip ${i === variantIdx ? "selected" : ""}`} onClick={() => setVariantIdx(i)}>
              {v.size}
            </div>
          ))}
        </div>

        <div className="qty-row">
          <button className="qty-btn" onClick={() => setQty(Math.max(variant.moq || 1, qty - 1))}>&minus;</button>
          <span>{qty}</span>
          <button className="qty-btn" onClick={() => setQty(qty + 1)}>+</button>
          <span className="price-tag">${(unitPrice * qty).toFixed(2)}</span>
        </div>
        {variant.moq > 1 && <div className="moq-note">Minimum order: {variant.moq} units</div>}
        {variant.cartonSize && <div className="moq-note">Sold in cartons of {variant.cartonSize}</div>}
        {next && <div className="moq-note">Order {next.minQty}+ to drop to ${next.price.toFixed(2)}/unit</div>}

        <TierTable variant={variant} quantity={qty} />

        <button className="primary-btn" onClick={() => { onAddToCart(product, variant, qty); onClose(); }}>
          Add to Cart
        </button>
      </div>
    </div>
  );
}

// ---------- SHOP ----------
function Shop({ onAddToCart }) {
  const [products, setProducts] = useState([]);
  const [type, setType] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.getProducts(type ? { type } : {}).then(setProducts).catch(() => {}).finally(() => setLoading(false));
  }, [type]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="view">
      <div className="tabs">
        {[["", "All"], ["Spray", "Perfumes"], ["Oil", "Concentrated Oils"]].map(([val, label]) => (
          <div key={val} className={`tab-btn ${type === val ? "active" : ""}`} onClick={() => setType(val)}>{label}</div>
        ))}
      </div>
      {loading ? (
        <p style={{ color: "var(--smoke)" }}>Loading...</p>
      ) : products.length === 0 ? (
        <div className="empty-state">No products found.</div>
      ) : (
        <div className="grid">
          {products.map((p) => (
            <div key={p._id} className="product-card" onClick={() => setSelected(p)}>
              <div className="product-img">{BRAND.ar}</div>
              <div className="product-info">
                <div className="product-name">{p.name}</div>
                <div className="product-notes">{p.family} &middot; {p.concentration}</div>
                <div className="product-price">from ${Math.min(...p.variants.map((v) => v.price)).toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {selected && <ProductDetail product={selected} onClose={() => setSelected(null)} onAddToCart={onAddToCart} />}
    </div>
  );
}

// ---------- CART / CHECKOUT ----------
function Cart({ cart, setCart, user, onOrderPlaced }) {
  const [form, setForm] = useState({ customerName: "", customerPhone: "", customerAddress: "" });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const total = cart.reduce((sum, item) => sum + getUnitPrice(item.variant, item.quantity) * item.quantity, 0);

  function removeItem(idx) {
    setCart(cart.filter((_, i) => i !== idx));
  }

  async function placeOrder() {
    setError("");
    if (!form.customerName || !form.customerPhone || !form.customerAddress) {
      setError("Please fill in all delivery details.");
      return;
    }
    setPlacing(true);
    try {
      const token = await user.getIdToken();
      await api.createOrder(token, {
        ...form,
        paymentMethod: "COD",
        items: cart.map((item) => ({ productId: item.product._id, size: item.variant.size, quantity: item.quantity })),
      });
      setCart([]);
      onOrderPlaced();
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacing(false);
    }
  }

  if (cart.length === 0) return <div className="view"><div className="empty-state">Your cart is empty.</div></div>;

  return (
    <div className="view">
      {cart.map((item, i) => (
        <div key={i} className="cart-item">
          <div className="cart-details">
            <div style={{ fontWeight: 700 }}>{item.product.name} ({item.variant.size})</div>
            <div style={{ fontSize: 13, color: "var(--smoke)" }}>
              {item.quantity} &times; ${getUnitPrice(item.variant, item.quantity).toFixed(2)}
            </div>
          </div>
          <div style={{ fontWeight: 700 }}>${(getUnitPrice(item.variant, item.quantity) * item.quantity).toFixed(2)}</div>
          <button className="delete-btn" onClick={() => removeItem(i)}>&times;</button>
        </div>
      ))}
      <div className="checkout-section">
        <input placeholder="Full name" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
        <input placeholder="Phone" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
        <textarea placeholder="Delivery address" rows={2} value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} />
        <div className="total-row"><span>Total</span><span>${total.toFixed(2)}</span></div>
        {error && <div className="error-text">{error}</div>}
        <button className="primary-btn" disabled={placing} onClick={placeOrder}>
          {placing ? "Placing order..." : "Place Order (Cash on Delivery)"}
        </button>
        <p style={{ fontSize: 12, color: "var(--smoke)", marginTop: 8 }}>
          Card payment via Stripe is supported server-side; this demo checkout uses COD for simplicity.
        </p>
      </div>
    </div>
  );
}

// ---------- ORDERS (customer) ----------
function OrdersView({ user }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    user.getIdToken().then((token) => api.getMyOrders(token)).then(setOrders).catch(() => {});
  }, [user]);

  async function cancel(id) {
    const token = await user.getIdToken();
    await api.setOrderStatus(token, id, "Cancelled");
    setOrders(orders.map((o) => (o._id === id ? { ...o, status: "Cancelled" } : o)));
  }

  if (orders.length === 0) return <div className="view"><div className="empty-state">No orders yet.</div></div>;

  return (
    <div className="view">
      {orders.map((o) => (
        <div key={o._id} className={`order-card ${o.status}`}>
          <div className="order-header">
            <span>Order #{o._id.slice(-6)}</span>
            <span className="status-badge">{o.status}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--smoke)" }}>
            {o.items.map((it) => `${it.name} (${it.size}) x${it.quantity}`).join(", ")}
          </div>
          <div style={{ marginTop: 6, fontWeight: 700 }}>${o.totalAmount.toFixed(2)}</div>
          {o.status === "Pending" && (
            <button className="secondary-btn" onClick={() => cancel(o._id)}>Cancel Order</button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- ADMIN ----------
function emptyProductForm() {
  return {
    name: "", type: "Spray", concentration: "Eau de Parfum", family: "Oriental",
    description: "", hsCode: "", notesTop: "", notesHeart: "", notesBase: "",
    variants: [{ size: "", price: "", moq: 1, cartonSize: "", priceTiers: [] }],
  };
}

function AdminProducts({ user }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyProductForm());
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => { api.getProducts().then(setProducts); }, []);
  useEffect(() => { load(); }, [load]);

  function updateVariant(i, field, value) {
    const variants = [...form.variants];
    variants[i] = { ...variants[i], [field]: value };
    setForm({ ...form, variants });
  }
  function addTier(vi) {
    const variants = [...form.variants];
    variants[vi].priceTiers = [...variants[vi].priceTiers, { minQty: "", price: "" }];
    setForm({ ...form, variants });
  }
  function updateTier(vi, ti, field, value) {
    const variants = [...form.variants];
    variants[vi].priceTiers[ti][field] = value;
    setForm({ ...form, variants });
  }
  function removeTier(vi, ti) {
    const variants = [...form.variants];
    variants[vi].priceTiers = variants[vi].priceTiers.filter((_, i) => i !== ti);
    setForm({ ...form, variants });
  }

  async function generateDescription() {
    const notes = [form.notesTop, form.notesHeart, form.notesBase].filter(Boolean).join(", ");
    if (!form.name || !notes) { setError("Enter a name and at least one note first."); return; }
    setAiLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const { description } = await api.describeProduct(token, { name: form.name, family: form.family, notes });
      setForm({ ...form, description });
    } catch (err) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const token = await user.getIdToken();
      const payload = {
        name: form.name,
        slug: form.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        type: form.type,
        concentration: form.concentration,
        family: form.family,
        description: form.description,
        hsCode: form.hsCode,
        notes: {
          top: form.notesTop.split(",").map((s) => s.trim()).filter(Boolean),
          heart: form.notesHeart.split(",").map((s) => s.trim()).filter(Boolean),
          base: form.notesBase.split(",").map((s) => s.trim()).filter(Boolean),
        },
        variants: form.variants.map((v) => ({
          size: v.size,
          price: Number(v.price),
          moq: Number(v.moq) || 1,
          cartonSize: v.cartonSize ? Number(v.cartonSize) : undefined,
          priceTiers: v.priceTiers
            .filter((t) => t.minQty && t.price)
            .map((t) => ({ minQty: Number(t.minQty), price: Number(t.price) })),
        })),
      };
      await api.createProduct(token, payload);
      setForm(emptyProductForm());
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    const token = await user.getIdToken();
    await api.deleteProduct(token, id);
    load();
  }

  return (
    <div className="view">
      <form className="add-form" onSubmit={submit}>
        <h3 style={{ fontFamily: "var(--display)" }}>Add Product</h3>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="Spray">Spray (Perfume)</option>
          <option value="Oil">Oil (Concentrated / Bakhoor)</option>
        </select>
        <select value={form.family} onChange={(e) => setForm({ ...form, family: e.target.value })}>
          {["Woody", "Floral", "Oriental", "Fresh", "Gourmand", "Musk", "Incense"].map((f) => <option key={f}>{f}</option>)}
        </select>
        <input placeholder="HS code (e.g. 3303.00)" value={form.hsCode} onChange={(e) => setForm({ ...form, hsCode: e.target.value })} />
        <input placeholder="Top notes, comma separated" value={form.notesTop} onChange={(e) => setForm({ ...form, notesTop: e.target.value })} />
        <input placeholder="Heart notes, comma separated" value={form.notesHeart} onChange={(e) => setForm({ ...form, notesHeart: e.target.value })} />
        <input placeholder="Base notes, comma separated" value={form.notesBase} onChange={(e) => setForm({ ...form, notesBase: e.target.value })} />
        <textarea placeholder="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button type="button" className="ai-btn" disabled={aiLoading} onClick={generateDescription}>
          {aiLoading ? "Writing..." : "✨ Write description with AI"}
        </button>

        <h4 style={{ marginTop: 16, fontSize: 14 }}>Variants &amp; Bulk Pricing</h4>
        {form.variants.map((v, vi) => (
          <div key={vi} style={{ border: "1px solid rgba(237,227,208,0.1)", borderRadius: 8, padding: 10, marginTop: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="Size (e.g. 30ml)" value={v.size} onChange={(e) => updateVariant(vi, "size", e.target.value)} />
              <input placeholder="Price" type="number" value={v.price} onChange={(e) => updateVariant(vi, "price", e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="MOQ" type="number" value={v.moq} onChange={(e) => updateVariant(vi, "moq", e.target.value)} />
              <input placeholder="Carton size" type="number" value={v.cartonSize} onChange={(e) => updateVariant(vi, "cartonSize", e.target.value)} />
            </div>
            <label>Bulk tiers (order this many or more, at this price each)</label>
            {v.priceTiers.map((t, ti) => (
              <div key={ti} className="tier-row">
                <input placeholder="Min qty" type="number" value={t.minQty} onChange={(e) => updateTier(vi, ti, "minQty", e.target.value)} />
                <input placeholder="Price each" type="number" value={t.price} onChange={(e) => updateTier(vi, ti, "price", e.target.value)} />
                <button type="button" className="remove-tier" onClick={() => removeTier(vi, ti)}>&times;</button>
              </div>
            ))}
            <button type="button" className="secondary-btn" onClick={() => addTier(vi)}>+ Add bulk tier</button>
          </div>
        ))}

        {error && <div className="error-text">{error}</div>}
        <button className="primary-btn" type="submit">Save Product</button>
      </form>

      <h3 style={{ fontFamily: "var(--display)", marginBottom: 10 }}>Catalog ({products.length})</h3>
      <div className="grid">
        {products.map((p) => (
          <div key={p._id} className="product-card">
            <div className="product-img">{BRAND.ar}</div>
            <div className="product-info">
              <div className="product-name">{p.name}</div>
              <div className="product-notes">{p.type} &middot; {p.family}</div>
              <button className="secondary-btn" onClick={() => remove(p._id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminOrders({ user }) {
  const [orders, setOrders] = useState([]);
  useEffect(() => { user.getIdToken().then((t) => api.getAllOrders(t)).then(setOrders); }, [user]);

  async function setStatus(id, status) {
    const token = await user.getIdToken();
    await api.setOrderStatus(token, id, status);
    setOrders(orders.map((o) => (o._id === id ? { ...o, status } : o)));
  }

  return (
    <div className="view">
      {orders.map((o) => (
        <div key={o._id} className={`order-card ${o.status}`}>
          <div className="order-header"><span>{o.customerName}</span><span className="status-badge">{o.status}</span></div>
          <div style={{ fontSize: 13, color: "var(--smoke)" }}>
            {o.items.map((it) => `${it.name} (${it.size}) x${it.quantity}`).join(", ")} — ${o.totalAmount.toFixed(2)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {["Approved", "Delivered", "Cancelled"].map((s) => (
              <button key={s} className="secondary-btn" onClick={() => setStatus(o._id, s)}>{s}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminView({ user }) {
  const [tab, setTab] = useState("products");
  return (
    <div className="view">
      <div className="admin-tabs">
        <div className={`tab-btn ${tab === "products" ? "active" : ""}`} onClick={() => setTab("products")}>Products</div>
        <div className={`tab-btn ${tab === "orders" ? "active" : ""}`} onClick={() => setTab("orders")}>Orders</div>
      </div>
      {tab === "products" ? <AdminProducts user={user} /> : <AdminOrders user={user} />}
    </div>
  );
}

// ---------- ROOT ----------
export default function App() {
  const [user, setUser] = useState(undefined);
  const [page, setPage] = useState("shop");
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  function addToCart(product, variant, quantity) {
    setCart([...cart, { product, variant, quantity }]);
    setToast("Added to cart");
    setTimeout(() => setToast(""), 1500);
  }

  if (user === undefined) return null;
  if (user === null) return <AuthView />;

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;

  return (
    <>
      <header>
        <div className="brand" onClick={() => setPage("shop")}>
          <span className="ar">{BRAND.ar}</span>
          <span className="latin">{BRAND.latin}</span>
        </div>
        <div className="nav-icons">
          <button className="icon-btn" onClick={() => setPage("shop")}>Shop</button>
          <button className="icon-btn" onClick={() => setPage("cart")}>
            Cart{cart.length > 0 && <span className="badge">{cart.length}</span>}
          </button>
          <button className="icon-btn" onClick={() => setPage("orders")}>Orders</button>
          {isAdmin && <button className="icon-btn" onClick={() => setPage("admin")}>Admin</button>}
          <button className="icon-btn" onClick={() => signOut(auth)}>Sign Out</button>
        </div>
      </header>

      {page === "shop" && <Shop onAddToCart={addToCart} />}
      {page === "cart" && <Cart cart={cart} setCart={setCart} user={user} onOrderPlaced={() => setPage("orders")} />}
      {page === "orders" && <OrdersView user={user} />}
      {page === "admin" && isAdmin && <AdminView user={user} />}

      <Toast message={toast} />
    </>
  );
}

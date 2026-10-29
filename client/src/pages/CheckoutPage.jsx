import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fmtMoney } from "../lib/format";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { BackLink, Button, EmptyState, ErrorState, Field, Notice, Skeleton } from "../components/ui";

const EMPTY = { customerName: "", customerPhone: "", city: "", customerAddress: "", deliveryNote: "", paymentMethod: "COD" };

function validate(f) {
  const e = {};
  if (f.customerName.trim().length < 2) e.customerName = "Enter the name the parcel is addressed to";
  if (!/^\+?[0-9\s-]{7,20}$/.test(f.customerPhone.trim())) e.customerPhone = "Enter a phone number we can call, e.g. 0300 1234567";
  if (f.city.trim().length < 2) e.city = "Enter your city";
  if (f.customerAddress.trim().length < 8) e.customerAddress = "Enter house, street and area so the courier can find you";
  return e;
}

/** Screen 5: delivery details and payment. The summary is the server's own quote. */
export default function CheckoutPage() {
  const cart = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY, customerName: user?.displayName || "" });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  const config = useQuery({ queryKey: ["config"], queryFn: api.config, staleTime: 5 * 60_000 });
  const quote = useQuery({ queryKey: ["quote", cart.items], queryFn: () => api.quote(cart.items), enabled: cart.count > 0 });
  const lastOrders = useQuery({ queryKey: ["orders", "mine", ""], queryFn: () => api.myOrders() });

  // Prefill delivery details from the buyer's most recent order.
  useEffect(() => {
    const last = lastOrders.data?.[0];
    if (!last) return;
    setForm((f) => ({
      ...f,
      customerName: f.customerName || last.customerName,
      customerPhone: f.customerPhone || last.customerPhone,
      city: f.city || last.city || "",
      customerAddress: f.customerAddress || last.customerAddress,
    }));
  }, [lastOrders.data]);

  if (cart.count === 0 && !busy)
    return (
      <div className="page">
        <EmptyState title="Nothing to check out" action={<Link className="btn btn-primary" to="/">Browse fragrances</Link>}>
          Your cart is empty.
        </EmptyState>
      </div>
    );

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const q = quote.data;

  async function placeOrder(e) {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    setSubmitError(null);
    if (Object.keys(errs).length) {
      document.getElementById("checkout-form").querySelector("[aria-invalid=true]")?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await api.placeOrder({ ...form, items: cart.items });
      cart.clear();
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (res.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
        return;
      }
      navigate(`/orders/${res.order._id}?placed=1${res.paymentError ? "&payment=failed" : ""}`, { replace: true });
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      else setSubmitError(err.message);
      if (err.status === 409) quote.refetch();
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <BackLink to="/cart">Back to cart</BackLink>
      <h1>Checkout</h1>
      <div className="cart-layout">
        <form id="checkout-form" className="form-card" onSubmit={placeOrder} noValidate>
          <h2>Delivery details</h2>
          <Field label="Full name" error={errors.customerName}>
            {(p) => <input {...p} autoComplete="name" value={form.customerName} onChange={set("customerName")} />}
          </Field>
          <div className="row-2">
            <Field label="Phone" error={errors.customerPhone} help="The courier calls this number before delivery.">
              {(p) => <input {...p} type="tel" autoComplete="tel" placeholder="e.g. 0300 1234567" value={form.customerPhone} onChange={set("customerPhone")} />}
            </Field>
            <Field label="City" error={errors.city}>
              {(p) => <input {...p} autoComplete="address-level2" placeholder="e.g. Lahore" value={form.city} onChange={set("city")} />}
            </Field>
          </div>
          <Field label="Address" error={errors.customerAddress}>
            {(p) => <textarea {...p} rows={3} autoComplete="street-address" placeholder="House, street, area" value={form.customerAddress} onChange={set("customerAddress")} />}
          </Field>
          <Field label="Note for the courier" optional error={errors.deliveryNote}>
            {(p) => <input {...p} placeholder="e.g. Call before arriving, gate 2" value={form.deliveryNote} onChange={set("deliveryNote")} maxLength={300} />}
          </Field>

          <fieldset className="pay-options">
            <legend>Payment</legend>
            <label className={`pay-option ${form.paymentMethod === "COD" ? "selected" : ""}`}>
              <input type="radio" name="pay" value="COD" checked={form.paymentMethod === "COD"} onChange={set("paymentMethod")} />
              <span>
                <strong>Cash on delivery</strong>
                <small>Pay the courier when your order arrives.</small>
              </span>
            </label>
            {config.data?.cardPayments && (
              <label className={`pay-option ${form.paymentMethod === "Card" ? "selected" : ""}`}>
                <input type="radio" name="pay" value="Card" checked={form.paymentMethod === "Card"} onChange={set("paymentMethod")} />
                <span>
                  <strong>Card</strong>
                  <small>Secure payment page by Stripe (test mode: use card 4242 4242 4242 4242).</small>
                </span>
              </label>
            )}
            {errors.paymentMethod && <p className="field-error">{errors.paymentMethod}</p>}
          </fieldset>

          {submitError && <Notice tone="error">{submitError}</Notice>}
          <Button type="submit" size="lg" className="block" loading={busy} disabled={!q?.valid}>
            {form.paymentMethod === "Card" ? "Continue to card payment" : "Place order"}
            {q?.valid ? ` · ${fmtMoney(q.total)}` : ""}
          </Button>
        </form>

        <aside className="summary" aria-label="Order summary">
          <h2>Your order</h2>
          {quote.isLoading ? (
            <Skeleton lines={4} />
          ) : quote.isError ? (
            <ErrorState error={quote.error} onRetry={quote.refetch} />
          ) : (
            <>
              <ul className="summary-lines">
                {q.lines.map((l) => (
                  <li key={`${l.productId}-${l.size}`}>
                    <span>
                      {l.quantity} × {l.name} {l.size}
                      {l.error && <em className="field-error"> {l.error}</em>}
                    </span>
                    <span>{l.lineTotal != null && !l.error ? fmtMoney(l.lineTotal) : ""}</span>
                  </li>
                ))}
              </ul>
              <dl>
                {q.savings > 0 && (
                  <div className="save">
                    <dt>Bulk savings</dt>
                    <dd>−{fmtMoney(q.savings)}</dd>
                  </div>
                )}
                <div>
                  <dt>Delivery</dt>
                  <dd>Free</dd>
                </div>
                <div className="grand">
                  <dt>Total</dt>
                  <dd>{fmtMoney(q.total)}</dd>
                </div>
              </dl>
              {!q.valid && (
                <Notice tone="error">
                  Some items changed. <Link to="/cart">Review your cart</Link>.
                </Notice>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

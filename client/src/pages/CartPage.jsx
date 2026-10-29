import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fmtMoney } from "../lib/format";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { Button, EmptyState, ErrorState, Notice, ProductImage, QtyStepper, Skeleton } from "../components/ui";

/**
 * Screen 3: review the cart. Prices, MOQ and stock come from the server quote,
 * so what the buyer sees here is exactly what checkout will charge.
 */
export default function CartPage() {
  const cart = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const quote = useQuery({
    queryKey: ["quote", cart.items],
    queryFn: () => api.quote(cart.items),
    enabled: cart.count > 0,
    placeholderData: keepPreviousData,
  });

  if (cart.count === 0)
    return (
      <div className="page">
        <h1>Your cart</h1>
        <EmptyState title="Your cart is empty" action={<Link className="btn btn-primary" to="/">Browse fragrances</Link>}>
          Pick a size, and order more of it to unlock bulk prices.
        </EmptyState>
      </div>
    );

  const q = quote.data;
  const byKey = new Map((q?.lines || []).map((l) => [`${l.productId}::${l.size}`, l]));

  return (
    <div className="page">
      <h1>Your cart</h1>
      <div className="cart-layout">
        <ul className="cart-lines" aria-label="Items in your cart">
          {cart.lines.map((line) => {
            const s = byKey.get(`${line.productId}::${line.size}`);
            const max = s?.stock ?? Infinity;
            const min = s?.moq ?? 1;
            return (
              <li key={`${line.productId}-${line.size}`} className={`cart-line ${s?.error ? "has-error" : ""}`}>
                <Link to={`/p/${line.slug}`} className="cart-thumb">
                  <ProductImage src={line.imageUrl} alt={line.name} />
                </Link>
                <div className="cart-main">
                  <Link to={`/p/${line.slug}`} className="cart-name">
                    {line.name} <span>{line.size}</span>
                  </Link>
                  {s && !s.error && (
                    <p className="cart-unit">
                      {fmtMoney(s.unitPrice)} each
                      {s.unitPrice < s.basePrice && <s>{fmtMoney(s.basePrice)}</s>}
                      {s.lineSavings > 0 && <span className="save"> · saving {fmtMoney(s.lineSavings)}</span>}
                    </p>
                  )}
                  {s?.nextTier && !s.error && (
                    <p className="nudge">
                      Add {s.nextTier.addQty} more to pay {fmtMoney(s.nextTier.price)} each
                    </p>
                  )}
                  {s?.error && <p className="field-error">{s.error}</p>}
                  <div className="cart-controls">
                    <QtyStepper
                      size="sm"
                      value={line.quantity}
                      min={Math.min(min, line.quantity)}
                      max={Math.max(max, line.quantity)}
                      onChange={(n) => cart.setQuantity(line.productId, line.size, n)}
                      label={`Quantity of ${line.name} ${line.size}`}
                    />
                    {s?.error && min > line.quantity && (
                      <button className="link-btn" onClick={() => cart.setQuantity(line.productId, line.size, min)}>
                        Set to {min}
                      </button>
                    )}
                    {s?.error && s.stock > 0 && line.quantity > s.stock && (
                      <button className="link-btn" onClick={() => cart.setQuantity(line.productId, line.size, s.stock)}>
                        Set to {s.stock}
                      </button>
                    )}
                    <button className="link-btn danger" onClick={() => cart.remove(line.productId, line.size)} aria-label={`Remove ${line.name} ${line.size}`}>
                      Remove
                    </button>
                  </div>
                </div>
                <div className="cart-total">{s && !s.error ? fmtMoney(s.lineTotal) : "·"}</div>
              </li>
            );
          })}
        </ul>

        <aside className="summary" aria-label="Order summary">
          <h2>Summary</h2>
          {quote.isLoading ? (
            <Skeleton lines={3} />
          ) : quote.isError ? (
            <ErrorState error={quote.error} onRetry={quote.refetch} />
          ) : (
            <>
              <dl>
                <div>
                  <dt>Items at single-unit price</dt>
                  <dd>{fmtMoney(q.subtotalBase)}</dd>
                </div>
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
              {!q.valid && <Notice tone="error">Fix the highlighted items to continue.</Notice>}
              <Button size="lg" className="block" disabled={!q.valid || quote.isFetching} onClick={() => navigate(user ? "/checkout" : "/login?next=/checkout")}>
                {user ? "Continue to checkout" : "Sign in to check out"}
              </Button>
              <p className="help center">Your cart is kept on this device while you sign in.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

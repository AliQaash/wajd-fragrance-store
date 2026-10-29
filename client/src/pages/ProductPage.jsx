import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fmtMoney } from "../lib/format";
import { getUnitPrice, nextTier } from "../lib/pricing";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import TierTable from "../components/TierTable";
import { BackLink, Button, EmptyState, ErrorState, ProductImage, QtyStepper, Skeleton } from "../components/ui";

/** Screen 2: choose size and quantity, and see exactly what the price will be. */
export default function ProductPage() {
  const { slug } = useParams();
  const { data: product, isLoading, isError, error, refetch } = useQuery({ queryKey: ["product", slug], queryFn: () => api.product(slug) });

  useEffect(() => {
    if (product) document.title = `${product.name} · Wajd`;
    return () => {
      document.title = "Wajd · Fine Fragrances";
    };
  }, [product]);

  if (isLoading) return <div className="page"><Skeleton lines={6} /></div>;
  if (isError)
    return (
      <div className="page">
        {error.status === 404 ? (
          <EmptyState title="This fragrance is not available" action={<Link className="btn btn-primary" to="/">Browse the shop</Link>}>
            It may have been removed from the catalog.
          </EmptyState>
        ) : (
          <ErrorState error={error} onRetry={refetch} />
        )}
      </div>
    );
  return <ProductView product={product} />;
}

function ProductView({ product }) {
  const cart = useCart();
  const toast = useToast();
  const [sizeIdx, setSizeIdx] = useState(() => Math.max(product.variants.findIndex((v) => v.stock >= (v.moq || 1)), 0));
  const variant = product.variants[sizeIdx];
  const moq = variant.moq || 1;
  const inCart = cart.quantityOf(String(product._id), variant.size);
  const available = Math.max(variant.stock - inCart, 0);
  const minAdd = inCart > 0 ? 1 : moq; // MOQ applies to the size's total in the cart
  const soldOut = available < minAdd;
  const [qty, setQty] = useState(moq);

  useEffect(() => setQty(Math.min(Math.max(moq, 1), Math.max(available, 1))), [sizeIdx]); // eslint-disable-line

  const total = inCart + qty; // tiers apply to everything of this size in the cart
  const unit = getUnitPrice(variant, total);
  const next = nextTier(variant, total);
  const saving = (variant.price - unit) * qty;

  const add = () => {
    cart.add(product, variant, qty);
    setQty(Math.max(1, Math.min(qty, available - qty)));
    toast(`Added ${qty} × ${product.name} ${variant.size}`, { to: "/cart", label: "View cart" });
  };

  return (
    <div className="page">
      <BackLink to="/">All fragrances</BackLink>
      <div className="product-layout">
        <ProductImage src={product.imageUrl} alt={product.name} className="detail-img" />

        <div className="product-info">
          <p className="eyebrow">
            {product.family} · {product.concentration}
          </p>
          <h1>{product.name}</h1>
          {product.description && <p className="lead">{product.description}</p>}

          <dl className="notes">
            {["top", "heart", "base"].map((k) =>
              product.notes?.[k]?.length ? (
                <div key={k}>
                  <dt>{k[0].toUpperCase() + k.slice(1)} notes</dt>
                  <dd>{product.notes[k].join(", ")}</dd>
                </div>
              ) : null
            )}
          </dl>

          <fieldset className="sizes">
            <legend>Size</legend>
            <div className="chips">
              {product.variants.map((v, i) => (
                <button key={v.size} type="button" className={`chip ${i === sizeIdx ? "selected" : ""}`} aria-pressed={i === sizeIdx} onClick={() => setSizeIdx(i)}>
                  <span>{v.size}</span>
                  <small>{v.stock === 0 ? "Sold out" : fmtMoney(v.price)}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="buy-box">
            <div className="buy-row">
              <div>
                <span className="label-sm" id="qty-label">
                  Quantity
                </span>
                <QtyStepper value={qty} min={minAdd} max={Math.max(available, minAdd)} onChange={setQty} label="Quantity" />
              </div>
              <div className="price-now">
                <span className="label-sm">{fmtMoney(unit)} each</span>
                <strong>{fmtMoney(unit * qty)}</strong>
                {saving > 0 && <span className="save">You save {fmtMoney(saving)}</span>}
              </div>
            </div>

            {variant.cartonSize && available >= variant.cartonSize && (
              <button type="button" className="link-btn" onClick={() => setQty(Math.min(qty + variant.cartonSize, available))}>
                + Add a full carton ({variant.cartonSize} units)
              </button>
            )}

            <ul className="buy-facts">
              {moq > 1 && <li>Minimum order for {variant.size}: {moq} units</li>}
              {variant.cartonSize && <li>Ships in sealed cartons of {variant.cartonSize}</li>}
              {next && (
                <li className="nudge">
                  Add {next.minQty - total} more to pay {fmtMoney(next.price)} each
                </li>
              )}
              {inCart > 0 && <li>You already have {inCart} of this size in your cart; bulk pricing counts them together.</li>}
              {variant.stock > 0 && variant.stock < 10 && <li className="warn">Only {variant.stock} left</li>}
            </ul>

            <Button size="lg" className="block" onClick={add} disabled={soldOut}>
              {soldOut ? (variant.stock === 0 ? "Sold out" : "All available stock is in your cart") : `Add to cart · ${fmtMoney(unit * qty)}`}
            </Button>
          </div>

          <TierTable variant={variant} quantity={total} />

          <details className="export">
            <summary>Export and wholesale details</summary>
            <dl>
              <div>
                <dt>HS code</dt>
                <dd>{product.hsCode || "On request"}</dd>
              </div>
              <div>
                <dt>Origin</dt>
                <dd>{product.originCountry || "Pakistan"}</dd>
              </div>
              <div>
                <dt>Carton</dt>
                <dd>{variant.cartonSize ? `${variant.cartonSize} × ${variant.size}` : "Single units"}</dd>
              </div>
            </dl>
            <p className="help">The HS code is the customs tariff code import buyers need for their paperwork.</p>
          </details>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fmtDate, fmtDateTime, fmtMoney, ORDER_STEPS, shortId, STEP_LABELS } from "../lib/format";
import { BackLink, Button, ConfirmDialog, EmptyState, ErrorState, Notice, PaymentBadge, ProductImage, Skeleton, StatusBadge } from "../components/ui";
import { useReorder } from "./useReorder";
import { useToast } from "../context/ToastContext";

/** Screen 6: what happened to an order, and what the buyer can still do. */
export default function OrderDetailPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const reorder = useReorder();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const verified = useRef(false);
  const sessionId = params.get("session_id");

  const { data: order, isLoading, isError, error, refetch } = useQuery({ queryKey: ["order", id], queryFn: () => api.order(id) });

  // Back from Stripe: ask the server to confirm the payment with Stripe.
  useEffect(() => {
    if (!sessionId || verified.current) return;
    verified.current = true;
    api
      .verifyPayment(id)
      .then((o) => {
        qc.setQueryData(["order", id], o);
        qc.invalidateQueries({ queryKey: ["orders"] });
      })
      .catch(() => {})
      .finally(() => {
        const next = new URLSearchParams(params);
        next.delete("session_id");
        next.set("payment", "done");
        setParams(next, { replace: true });
      });
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <div className="page"><Skeleton lines={6} /></div>;
  if (isError)
    return (
      <div className="page">
        {error.status === 404 ? (
          <EmptyState title="Order not found" action={<Link className="btn btn-primary" to="/orders">Your orders</Link>}>
            It may belong to another account.
          </EmptyState>
        ) : (
          <ErrorState error={error} onRetry={refetch} />
        )}
      </div>
    );

  const cancelled = order.status === "Cancelled";
  const reached = new Map(order.statusHistory.map((h) => [h.status, h.at]));
  const currentIdx = ORDER_STEPS.indexOf(order.status);
  const savings = Math.max((order.subtotalBase || 0) - order.totalAmount, 0);
  const payment = params.get("payment");
  const canPay = order.paymentMethod === "Card" && order.paymentStatus === "Unpaid" && !cancelled;

  async function cancel() {
    setBusy(true);
    setActionError(null);
    try {
      const o = await api.cancelOrder(order._id);
      qc.setQueryData(["order", id], o);
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast("Order cancelled");
      setConfirm(false);
    } catch (err) {
      setActionError(err.message);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    setBusy(true);
    setActionError(null);
    try {
      const { checkoutUrl } = await api.payOrder(order._id);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setActionError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <BackLink to="/orders">All orders</BackLink>
      <div className="order-head">
        <div>
          <h1>Order {shortId(order._id)}</h1>
          <p className="muted">Placed {fmtDateTime(order.createdAt)}</p>
        </div>
        <div className="badges">
          <StatusBadge status={order.status} />
          <PaymentBadge order={order} />
        </div>
      </div>

      {params.get("placed") && !cancelled && order.paymentMethod === "COD" && (
        <Notice tone="success">Thank you. Your order is placed; we will call {order.customerPhone} before delivery.</Notice>
      )}
      {payment === "done" && order.paymentStatus === "Paid" && <Notice tone="success">Payment received. Thank you.</Notice>}
      {payment === "done" && order.paymentStatus === "Unpaid" && <Notice tone="error">We could not confirm the payment yet. If you were charged it will update shortly; otherwise pay again below.</Notice>}
      {payment === "cancelled" && canPay && <Notice tone="info">Payment was not completed. Your items are held; pay below or cancel the order.</Notice>}
      {payment === "failed" && <Notice tone="error">We could not open the payment page. Try “Pay now” below.</Notice>}
      {actionError && <Notice tone="error">{actionError}</Notice>}

      <section className="timeline-wrap" aria-label="Order progress">
        {cancelled ? (
          <p className="cancelled-line">
            Cancelled on {fmtDate(reached.get("Cancelled") || order.updatedAt)}
            {order.paymentStatus === "Refund due" && " · your card payment will be refunded"}
          </p>
        ) : (
          <ol className="timeline">
            {ORDER_STEPS.map((s, i) => (
              <li key={s} className={i <= currentIdx ? "done" : ""} aria-current={i === currentIdx ? "step" : undefined}>
                <span className="dot" aria-hidden="true" />
                <span className="step-name">{STEP_LABELS[s]}</span>
                <span className="step-date">{reached.get(s) ? fmtDate(reached.get(s)) : ""}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="cart-layout">
        <section className="form-card">
          <h2>Items</h2>
          <ul className="order-items">
            {order.items.map((it) => (
              <li key={`${it.productId}-${it.size}`}>
                <ProductImage src={it.imageUrl} alt={it.name} className="thumb" />
                <div>
                  {it.slug ? <Link to={`/p/${it.slug}`}>{it.name}</Link> : it.name} <span className="muted">{it.size}</span>
                  <div className="muted">
                    {it.quantity} × {fmtMoney(it.price)}
                    {it.basePrice > it.price && <s> {fmtMoney(it.basePrice)}</s>}
                  </div>
                </div>
                <strong>{fmtMoney(it.price * it.quantity)}</strong>
              </li>
            ))}
          </ul>
          <dl className="totals">
            {savings > 0 && (
              <div className="save">
                <dt>Bulk savings</dt>
                <dd>−{fmtMoney(savings)}</dd>
              </div>
            )}
            <div className="grand">
              <dt>Total</dt>
              <dd>{fmtMoney(order.totalAmount)}</dd>
            </div>
          </dl>
        </section>

        <aside className="summary">
          <h2>Delivery</h2>
          <p>
            {order.customerName}
            <br />
            {order.customerPhone}
            <br />
            {order.customerAddress}
            {order.city ? `, ${order.city}` : ""}
          </p>
          {order.deliveryNote && <p className="muted">Note: {order.deliveryNote}</p>}
          <div className="stack">
            {canPay && (
              <Button className="block" onClick={pay} loading={busy}>
                Pay now · {fmtMoney(order.totalAmount)}
              </Button>
            )}
            <Button variant="secondary" className="block" onClick={() => reorder(order)}>
              Reorder these items
            </Button>
            {order.status === "Pending" && (
              <Button variant="danger-ghost" className="block" onClick={() => setConfirm(true)}>
                Cancel order
              </Button>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog open={confirm} title={`Cancel order ${shortId(order._id)}?`} confirmLabel="Cancel order" danger busy={busy} onConfirm={cancel} onCancel={() => setConfirm(false)}>
        The {order.items.length === 1 ? "item goes" : "items go"} back on sale and this cannot be undone.
      </ConfirmDialog>
    </div>
  );
}

import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { fmtDateTime, fmtMoney, shortId, STEP_LABELS, TRANSITIONS } from "../../lib/format";
import { useToast } from "../../context/ToastContext";
import { Button, ConfirmDialog, EmptyState, ErrorState, Notice, PaymentBadge, Skeleton, StatusBadge } from "../../components/ui";

const FILTERS = ["", "Pending", "Approved", "Dispatched", "Delivered", "Cancelled"];
const ACTION_LABEL = { Approved: "Approve", Dispatched: "Mark dispatched", Delivered: "Mark delivered", Cancelled: "Cancel order" };

/** Screen 11: fulfil orders, one valid step at a time. */
export default function AdminOrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const openId = params.get("open");
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const list = useQuery({ queryKey: ["admin", "orders", status], queryFn: () => api.admin.orders(status) });
  // Loaded on its own so the panel stays open after the order moves out of the current filter.
  const openQuery = useQuery({ queryKey: ["order", openId], queryFn: () => api.order(openId), enabled: !!openId });
  const open = openQuery.data;

  const setParam = (patch) =>
    setParams(
      () => {
        // Read the live URL: React Router's "prev" is the value from the last render, which can be stale.
        const next = new URLSearchParams(window.location.search);
        Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
        return next;
      },
      { replace: true }
    );

  async function move(order, target) {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.admin.setStatus(order._id, target);
      qc.setQueryData(["order", order._id], updated);
      toast(`Order ${shortId(order._id)}: ${STEP_LABELS[target].toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <>
      <h1>Orders</h1>
      <div className="tabs" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button key={f || "all"} role="tab" aria-selected={status === f} className={`tab ${status === f ? "active" : ""}`} onClick={() => setParam({ status: f, open: "" })}>
            {f ? STEP_LABELS[f] : "All"}
          </button>
        ))}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {list.isLoading ? (
        <Skeleton lines={8} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : (
        <div className="orders-admin">
          {list.data.length === 0 && (open ? <p className="muted">No other orders with this status.</p> : <EmptyState title="No orders here" />)}
          <ul className="order-list compact">
            {list.data.map((o) => (
              <li key={o._id}>
                <button className={`order-row-main ${o._id === openId ? "selected" : ""}`} onClick={() => setParam({ open: o._id === openId ? "" : o._id })} aria-expanded={o._id === openId}>
                  <div>
                    <strong>
                      {shortId(o._id)} · {o.customerName}
                    </strong>
                    <span className="muted">
                      {fmtDateTime(o.createdAt)} · {o.city || "No city"} · {o.items.length} {o.items.length === 1 ? "line" : "lines"}
                    </span>
                  </div>
                  <div className="order-row-side">
                    <strong>{fmtMoney(o.totalAmount)}</strong>
                    <StatusBadge status={o.status} />
                    <PaymentBadge order={o} />
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {open && (
            <aside className="drawer" aria-label={`Order ${shortId(open._id)}`}>
              <div className="drawer-head">
                <h2>Order {shortId(open._id)}</h2>
                <button className="link-btn" onClick={() => setParam({ open: "" })} aria-label="Close order details">
                  Close
                </button>
              </div>
              <div className="badges">
                <StatusBadge status={open.status} />
                <PaymentBadge order={open} />
              </div>
              <h3>Customer</h3>
              <p>
                {open.customerName} · <a href={`tel:${open.customerPhone.replace(/\s/g, "")}`}>{open.customerPhone}</a>
                <br />
                {open.customerAddress}
                {open.city ? `, ${open.city}` : ""}
                <br />
                <span className="muted">{open.userEmail}</span>
              </p>
              {open.deliveryNote && <p className="muted">Note: {open.deliveryNote}</p>}
              <h3>Items</h3>
              <ul className="simple-list">
                {open.items.map((it) => (
                  <li key={`${it.productId}-${it.size}`}>
                    <span>
                      {it.quantity} × {it.name} {it.size}
                    </span>
                    <span className="muted">{fmtMoney(it.price)} each</span>
                    <strong>{fmtMoney(it.price * it.quantity)}</strong>
                  </li>
                ))}
                <li className="grand">
                  <span>Total</span>
                  <strong>{fmtMoney(open.totalAmount)}</strong>
                </li>
              </ul>
              <h3>History</h3>
              <ol className="history">
                {open.statusHistory.map((h, i) => (
                  <li key={i}>
                    <strong>{STEP_LABELS[h.status] || h.status}</strong> <span className="muted">{fmtDateTime(h.at)}{h.by ? ` · ${h.by}` : ""}</span>
                  </li>
                ))}
              </ol>
              {open.paymentStatus === "Refund due" && <Notice tone="error">This card order was paid and then cancelled: refund it from the Stripe dashboard.</Notice>}
              <div className="stack">
                {TRANSITIONS[open.status].length === 0 && <p className="muted">No further steps for this order.</p>}
                {TRANSITIONS[open.status].map((t) =>
                  t === "Cancelled" ? (
                    <Button key={t} variant="danger-ghost" className="block" onClick={() => setConfirm(open)} disabled={busy}>
                      {ACTION_LABEL[t]}
                    </Button>
                  ) : (
                    <Button key={t} className="block" onClick={() => move(open, t)} loading={busy}>
                      {ACTION_LABEL[t]}
                    </Button>
                  )
                )}
              </div>
            </aside>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={`Cancel order ${confirm ? shortId(confirm._id) : ""}?`}
        confirmLabel="Cancel order"
        danger
        busy={busy}
        onConfirm={() => move(confirm, "Cancelled")}
        onCancel={() => setConfirm(null)}
      >
        {confirm?.customerName}'s items go back into stock. This cannot be undone.
      </ConfirmDialog>
    </>
  );
}

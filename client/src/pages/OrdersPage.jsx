import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fmtDate, fmtMoney, plural, shortId } from "../lib/format";
import { EmptyState, ErrorState, PaymentBadge, Skeleton, StatusBadge } from "../components/ui";
import { useReorder } from "./useReorder";

const FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "In progress" },
  { value: "Delivered", label: "Delivered" },
  { value: "Cancelled", label: "Cancelled" },
];

/** Screen 7: order history. */
export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["orders", "mine", status], queryFn: () => api.myOrders(status) });
  const reorder = useReorder();

  return (
    <div className="page">
      <h1>My orders</h1>
      <div className="tabs" role="tablist" aria-label="Filter orders">
        {FILTERS.map((f) => (
          <button key={f.value} role="tab" aria-selected={status === f.value} className={`tab ${status === f.value ? "active" : ""}`} onClick={() => setParams(f.value ? { status: f.value } : {})}>
            {f.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Skeleton lines={5} />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.length === 0 ? (
        <EmptyState title={status ? "No orders here" : "No orders yet"} action={<Link className="btn btn-primary" to="/">Browse the shop</Link>}>
          {status ? "Try another filter." : "When you place an order it will show up here."}
        </EmptyState>
      ) : (
        <ul className="order-list">
          {data.map((o) => {
            const units = o.items.reduce((s, i) => s + i.quantity, 0);
            return (
              <li key={o._id} className="order-row">
                <Link to={`/orders/${o._id}`} className="order-row-main">
                  <div>
                    <strong>Order {shortId(o._id)}</strong>
                    <span className="muted">
                      {fmtDate(o.createdAt)} · {plural(units, "unit")}
                    </span>
                    <span className="muted clamp">{o.items.map((i) => `${i.name} ${i.size}`).join(", ")}</span>
                  </div>
                  <div className="order-row-side">
                    <strong>{fmtMoney(o.totalAmount)}</strong>
                    <StatusBadge status={o.status} />
                    <PaymentBadge order={o} />
                  </div>
                </Link>
                <button className="btn btn-ghost btn-sm" onClick={() => reorder(o)}>
                  Reorder
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

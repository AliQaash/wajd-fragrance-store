import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { fmtDateTime, fmtMoney, shortId } from "../../lib/format";
import { ErrorState, Skeleton, StatusBadge } from "../../components/ui";

/** Screen 8: what needs attention today. */
export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["admin", "stats"], queryFn: api.admin.stats });
  if (isLoading) return <Skeleton lines={6} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const tiles = [
    { label: "Waiting for approval", value: data.pending, to: "/admin/orders?status=Pending", hot: data.pending > 0 },
    { label: "Approved, to dispatch", value: data.toDispatch, to: "/admin/orders?status=Approved", hot: data.toDispatch > 0 },
    { label: "Revenue, last 7 days", value: fmtMoney(data.revenueWeek), note: `${data.ordersWeek} orders, cancellations excluded` },
    { label: "Products on sale", value: data.activeProducts, to: "/admin/products" },
  ];

  return (
    <>
      <h1>Dashboard</h1>
      <div className="tiles">
        {tiles.map((t) => {
          const body = (
            <>
              <span className="tile-label">{t.label}</span>
              <strong className="tile-value">{t.value}</strong>
              {t.note && <span className="tile-note">{t.note}</span>}
            </>
          );
          return t.to ? (
            <Link key={t.label} to={t.to} className={`tile ${t.hot ? "hot" : ""}`}>
              {body}
            </Link>
          ) : (
            <div key={t.label} className="tile">
              {body}
            </div>
          );
        })}
      </div>

      <div className="two-col">
        <section className="form-card">
          <h2>Low stock (under {data.lowStockThreshold})</h2>
          {data.lowStock.length === 0 ? (
            <p className="muted">Every size has at least {data.lowStockThreshold} units.</p>
          ) : (
            <ul className="simple-list">
              {data.lowStock.map((v) => (
                <li key={`${v.productId}-${v.size}`}>
                  <Link to={`/admin/products/${v.productId}`}>
                    {v.name} {v.size}
                  </Link>
                  <span className={v.stock === 0 ? "badge badge-cancelled" : "badge badge-pending"}>{v.stock === 0 ? "Sold out" : `${v.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="form-card">
          <h2>Latest orders</h2>
          {data.recentOrders.length === 0 ? (
            <p className="muted">No orders yet.</p>
          ) : (
            <ul className="simple-list">
              {data.recentOrders.map((o) => (
                <li key={o._id}>
                  <Link to={`/admin/orders?open=${o._id}`}>
                    {shortId(o._id)} · {o.customerName}
                  </Link>
                  <span className="muted">{fmtDateTime(o.createdAt)}</span>
                  <span>{fmtMoney(o.totalAmount)}</span>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

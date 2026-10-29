import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { fmtMoney } from "../../lib/format";
import { useToast } from "../../context/ToastContext";
import { ConfirmDialog, EmptyState, ErrorState, Notice, ProductImage, Skeleton } from "../../components/ui";

/** Screen 9: the catalog as the store team sees it, with quick stock edits. */
export default function AdminProductsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const status = params.get("status") || "";
  const qc = useQueryClient();
  const toast = useToast();
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const list = useQuery({ queryKey: ["admin", "products", { q, status }], queryFn: () => api.admin.products({ q, status }) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  async function setActive(p, active) {
    setBusy(true);
    setError(null);
    try {
      await api.admin.setActive(p._id, active);
      toast(active ? `${p.name} is back on sale` : `${p.name} archived`);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setArchiveTarget(null);
    }
  }

  async function saveStock(p, size, value, prev) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n === prev) return;
    setError(null);
    try {
      await api.admin.setStock(p._id, size, n);
      toast(`${p.name} ${size}: stock set to ${n}`);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const setParam = (k, v) =>
    setParams(
      () => {
        // Read the live URL: React Router's "prev" is the value from the last render, which can be stale.
        const next = new URLSearchParams(window.location.search);
        v ? next.set(k, v) : next.delete(k);
        return next;
      },
      { replace: true }
    );

  return (
    <>
      <div className="page-head">
        <h1>Products</h1>
        <Link className="btn btn-primary" to="/admin/products/new">
          + New product
        </Link>
      </div>
      <div className="toolbar">
        <div className="field search-field">
          <label htmlFor="admin-q">Search by name</label>
          <input id="admin-q" type="search" defaultValue={q} onChange={(e) => setParam("q", e.target.value.trim())} />
        </div>
        <div className="field">
          <label htmlFor="admin-status">Show</label>
          <select id="admin-status" value={status} onChange={(e) => setParam("status", e.target.value)}>
            <option value="">All products</option>
            <option value="active">On sale</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {list.isLoading ? (
        <Skeleton lines={8} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : list.data.length === 0 ? (
        <EmptyState title="No products match" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Stock by size</th>
                <th scope="col">Price from</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((p) => (
                <tr key={p._id} className={p.active ? "" : "muted-row"}>
                  <td data-label="Product">
                    <div className="prod-cell">
                      <ProductImage src={p.imageUrl} alt="" className="thumb" />
                      <div>
                        <strong>{p.name}</strong>
                        <span className="muted">
                          {p.type === "Spray" ? "Perfume" : "Oil"} · {p.family}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Stock by size">
                    <div className="stock-cells">
                      {p.variants.map((v) => (
                        <label key={v.size} className={`stock-cell ${v.stock < 10 ? "low" : ""}`}>
                          <span>{v.size}</span>
                          <input
                            type="number"
                            min="0"
                            defaultValue={v.stock}
                            key={`${p._id}-${v.size}-${v.stock}`}
                            aria-label={`${p.name} ${v.size} stock`}
                            onBlur={(e) => saveStock(p, v.size, e.target.value, v.stock)}
                            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                          />
                        </label>
                      ))}
                    </div>
                  </td>
                  <td data-label="Price from">{fmtMoney(Math.min(...p.variants.map((v) => v.price)))}</td>
                  <td data-label="Status">
                    <span className={`badge ${p.active ? "badge-delivered" : "badge-cancelled"}`}>{p.active ? "On sale" : "Archived"}</span>
                  </td>
                  <td className="actions">
                    <Link className="btn btn-ghost btn-sm" to={`/admin/products/${p._id}`}>
                      Edit
                    </Link>
                    {p.active ? (
                      <button className="btn btn-ghost btn-sm danger" onClick={() => setArchiveTarget(p)}>
                        Archive
                      </button>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => setActive(p, true)} disabled={busy}>
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="help">Type a new stock number and press Enter or click away to save it.</p>
        </div>
      )}
      <ConfirmDialog
        open={!!archiveTarget}
        title={`Archive ${archiveTarget?.name}?`}
        confirmLabel="Archive"
        danger
        busy={busy}
        onConfirm={() => setActive(archiveTarget, false)}
        onCancel={() => setArchiveTarget(null)}
      >
        It disappears from the shop. Past orders keep their details, and you can restore it any time.
      </ConfirmDialog>
    </>
  );
}

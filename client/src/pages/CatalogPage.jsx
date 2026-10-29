import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fmtMoney, FAMILIES, TYPES } from "../lib/format";
import { bulkFloor, fromPrice } from "../lib/pricing";
import { CardSkeletonGrid, EmptyState, ErrorState, ProductImage } from "../components/ui";

const SORTS = [
  { value: "featured", label: "Featured first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name A to Z" },
];

/** Screen 1: find a fragrance fast. Filters live in the URL so refresh and back keep them. */
export default function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const type = params.get("type") || "";
  const family = params.get("family") || "";
  const sort = params.get("sort") || "featured";
  const page = Number(params.get("page")) || 1;
  const [search, setSearch] = useState(q);

  // Functional update so a debounced search never overwrites a filter clicked meanwhile.
  const update = (patch) =>
    setParams(
      () => {
        // Read the live URL: React Router's "prev" is the value from the last render, which can be stale.
        const next = new URLSearchParams(window.location.search);
        Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
        if (!("page" in patch)) next.delete("page");
        return next;
      },
      { replace: true }
    );

  // Debounce typing so every keystroke does not hit the API.
  useEffect(() => {
    const t = setTimeout(() => search !== q && update({ q: search.trim() }), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["products", { q, type, family, sort, page }],
    queryFn: () => api.products({ q, type, family, sort, page, limit: 12 }),
    placeholderData: keepPreviousData,
  });

  const filtersOn = q || type || family;

  return (
    <div className="page">
      <section className="hero">
        <h1>Fine fragrances, honestly priced</h1>
        <p>Buy a single bottle, or order by the carton and the price drops on every unit. Bulk prices apply automatically.</p>
      </section>

      <div className="toolbar" role="search">
        <div className="field search-field">
          <label htmlFor="search">Search</label>
          <input id="search" type="search" placeholder="e.g. oud, rose, saffron" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="family">Scent family</label>
          <select id="family" value={family} onChange={(e) => update({ family: e.target.value })}>
            <option value="">All families</option>
            {FAMILIES.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={sort} onChange={(e) => update({ sort: e.target.value === "featured" ? "" : e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Product type">
        {[{ value: "", label: "All" }, ...TYPES].map((t) => (
          <button key={t.value} role="tab" aria-selected={type === t.value} className={`tab ${type === t.value ? "active" : ""}`} onClick={() => update({ type: t.value })}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CardSkeletonGrid />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState
          title="Nothing matches that"
          action={
            filtersOn && (
              <button className="btn btn-secondary" onClick={() => { setSearch(""); setParams({}, { replace: true }); }}>
                Clear search and filters
              </button>
            )
          }
        >
          Try another note or family.
        </EmptyState>
      ) : (
        <>
          <p className="result-count" aria-live="polite">
            {data.total} {data.total === 1 ? "fragrance" : "fragrances"}
            {isFetching && " · updating"}
          </p>
          <div className="grid">
            {data.items.map((p) => {
              const from = fromPrice(p);
              const floor = bulkFloor(p);
              return (
                <Link key={p._id} to={`/p/${p.slug}`} className="card">
                  <ProductImage src={p.imageUrl} alt={p.name} className="card-img" />
                  {p.featured && <span className="ribbon">Featured</span>}
                  <div className="card-body">
                    <h2 className="card-title">{p.name}</h2>
                    <p className="card-meta">
                      {p.family} · {p.concentration}
                    </p>
                    <p className="card-price">
                      from <strong>{fmtMoney(from)}</strong>
                      {floor < from && <span className="bulk-hint">bulk from {fmtMoney(floor)}</span>}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
          {data.pages > 1 && (
            <nav className="pager" aria-label="Pages">
              <button className="btn btn-ghost" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                ← Previous
              </button>
              <span>
                Page {page} of {data.pages}
              </span>
              <button className="btn btn-ghost" disabled={page >= data.pages} onClick={() => update({ page: String(page + 1) })}>
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

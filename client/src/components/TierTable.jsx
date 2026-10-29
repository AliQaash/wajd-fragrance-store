import { fmtMoney } from "../lib/format";
import { sortedTiers } from "../lib/pricing";

/** Price ladder for one size; the row the current quantity falls in is highlighted. */
export default function TierTable({ variant, quantity }) {
  const tiers = sortedTiers(variant);
  if (tiers.length === 0) return null;
  const rows = [{ minQty: variant.moq || 1, price: variant.price }, ...tiers];
  let activeIndex = -1;
  rows.forEach((r, i) => {
    if (quantity >= r.minQty) activeIndex = i;
  });
  return (
    <table className="tier-table">
      <caption>Bulk pricing for {variant.size}: order more, pay less on every unit</caption>
      <thead>
        <tr>
          <th scope="col">Quantity</th>
          <th scope="col">Price each</th>
          <th scope="col">You save</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t, i) => {
          const upTo = rows[i + 1] ? rows[i + 1].minQty - 1 : null;
          const isActive = i === activeIndex;
          const pct = Math.round((1 - t.price / variant.price) * 100);
          return (
            <tr key={t.minQty} className={isActive ? "active" : ""} aria-current={isActive ? "true" : undefined}>
              <td>{upTo ? `${t.minQty} to ${upTo}` : `${t.minQty}+`}</td>
              <td>{fmtMoney(t.price)}</td>
              <td>{pct > 0 ? `${pct}%` : "·"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

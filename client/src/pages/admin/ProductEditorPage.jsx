import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { CONCENTRATIONS, FAMILIES, fmtMoney } from "../../lib/format";
import { useToast } from "../../context/ToastContext";
import TierTable from "../../components/TierTable";
import { BackLink, Button, ErrorState, Field, Notice, ProductImage, Skeleton } from "../../components/ui";

const blankVariant = () => ({ size: "", price: "", compareAtPrice: "", stock: "", moq: 1, cartonSize: "", priceTiers: [] });
const blankProduct = () => ({
  name: "",
  type: "Spray",
  concentration: "Eau de Parfum",
  family: "Oriental",
  notesTop: "",
  notesHeart: "",
  notesBase: "",
  description: "",
  imageUrl: "",
  hsCode: "",
  originCountry: "Pakistan",
  featured: false,
  active: true,
  variants: [blankVariant()],
});

function fromProduct(p) {
  return {
    ...blankProduct(),
    ...p,
    notesTop: (p.notes?.top || []).join(", "),
    notesHeart: (p.notes?.heart || []).join(", "),
    notesBase: (p.notes?.base || []).join(", "),
    hsCode: p.hsCode || "",
    imageUrl: p.imageUrl || "",
    variants: p.variants.map((v) => ({
      ...blankVariant(),
      ...v,
      compareAtPrice: v.compareAtPrice ?? "",
      cartonSize: v.cartonSize ?? "",
      priceTiers: (v.priceTiers || []).map((t) => ({ ...t })),
    })),
  };
}

const FIX_MSG = "Fix the highlighted fields.";
const num = (v) => (v === "" || v == null ? NaN : Number(v));

/** Mirrors the server rules so mistakes show next to the field before saving. */
function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = "Give the product a name";
  if (f.imageUrl && !/^https:\/\//.test(f.imageUrl)) e.imageUrl = "Use a full https:// link";
  if (f.hsCode && !/^\d{4}(\.\d{2}){0,3}$/.test(f.hsCode.trim())) e.hsCode = "Format: 3303.00";
  const sizes = new Set();
  f.variants.forEach((v, i) => {
    const p = `variants.${i}`;
    const size = v.size.trim().toLowerCase();
    if (!size) e[`${p}.size`] = "Required, e.g. 30ml";
    else if (sizes.has(size)) e[`${p}.size`] = "This size is listed twice";
    sizes.add(size);
    const price = num(v.price);
    if (!(price > 0)) e[`${p}.price`] = "Enter a price above 0";
    if (v.compareAtPrice !== "" && !(num(v.compareAtPrice) > price)) e[`${p}.compareAtPrice`] = "Must be higher than the price";
    if (!Number.isInteger(num(v.stock)) || num(v.stock) < 0) e[`${p}.stock`] = "Whole number, 0 or more";
    const moq = num(v.moq);
    if (!Number.isInteger(moq) || moq < 1) e[`${p}.moq`] = "Whole number, at least 1";
    if (v.cartonSize !== "" && (!Number.isInteger(num(v.cartonSize)) || num(v.cartonSize) < 1)) e[`${p}.cartonSize`] = "Whole number";
    let prevPrice = price;
    const tiers = [...v.priceTiers].map((t, ti) => ({ ...t, ti })).sort((a, b) => num(a.minQty) - num(b.minQty));
    const seen = new Set();
    tiers.forEach((t) => {
      const tp = `${p}.priceTiers.${t.ti}`;
      const q = num(t.minQty);
      const tPrice = num(t.price);
      if (!Number.isInteger(q) || q < 2) e[`${tp}.minQty`] = "Whole number, 2 or more";
      else if (q <= moq) e[`${tp}.minQty`] = `Must be above the minimum order (${moq})`;
      else if (seen.has(q)) e[`${tp}.minQty`] = "Two tiers start here";
      seen.add(q);
      if (!(tPrice > 0)) e[`${tp}.price`] = "Enter a price";
      else if (tPrice >= prevPrice) e[`${tp}.price`] = `Must be below ${fmtMoney(prevPrice)}`;
      else prevPrice = tPrice;
    });
  });
  return e;
}

function toPayload(f) {
  return {
    name: f.name.trim(),
    type: f.type,
    concentration: f.concentration,
    family: f.family,
    notes: { top: f.notesTop, heart: f.notesHeart, base: f.notesBase },
    description: f.description.trim(),
    imageUrl: f.imageUrl.trim(),
    hsCode: f.hsCode.trim(),
    originCountry: f.originCountry.trim() || "Pakistan",
    featured: !!f.featured,
    active: !!f.active,
    variants: f.variants.map((v) => ({
      size: v.size.trim(),
      price: num(v.price),
      compareAtPrice: v.compareAtPrice === "" ? undefined : num(v.compareAtPrice),
      stock: num(v.stock),
      moq: num(v.moq),
      cartonSize: v.cartonSize === "" ? undefined : num(v.cartonSize),
      priceTiers: v.priceTiers.map((t) => ({ minQty: num(t.minQty), price: num(t.price) })),
    })),
  };
}

/** Screen 10: create or edit a product, with sizes and bulk tiers. */
export default function ProductEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const existing = useQuery({ queryKey: ["admin", "product", id], queryFn: () => api.admin.product(id), enabled: !isNew });

  if (!isNew && existing.isLoading) return <Skeleton lines={10} />;
  if (!isNew && existing.isError) return <ErrorState error={existing.error} onRetry={existing.refetch} />;
  return <Editor key={id || "new"} initial={isNew ? blankProduct() : fromProduct(existing.data)} id={id} />;
}

function Editor({ initial, id }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [previewQty, setPreviewQty] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // After the first save attempt, re-check as the admin types so fixed fields clear at once.
  useEffect(() => {
    if (submitted) setErrors(validate(form));
  }, [form, submitted]);

  useEffect(() => {
    // Keep concentration valid for the chosen type.
    if (!CONCENTRATIONS[form.type].includes(form.concentration)) setForm((f) => ({ ...f, concentration: CONCENTRATIONS[f.type][0] }));
  }, [form.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setVariant = (i, k, value) => setForm((f) => ({ ...f, variants: f.variants.map((v, vi) => (vi === i ? { ...v, [k]: value } : v)) }));
  const setTier = (i, ti, k, value) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, vi) => (vi === i ? { ...v, priceTiers: v.priceTiers.map((t, tj) => (tj === ti ? { ...t, [k]: value } : t)) } : v)),
    }));
  const addTier = (i) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v, vi) => (vi === i ? { ...v, priceTiers: [...v.priceTiers, { minQty: "", price: "" }] } : v)) }));
  const removeTier = (i, ti) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v, vi) => (vi === i ? { ...v, priceTiers: v.priceTiers.filter((_, tj) => tj !== ti) } : v)) }));

  async function writeDescription() {
    const notes = [form.notesTop, form.notesHeart, form.notesBase].filter(Boolean).join(", ");
    if (!form.name.trim() || !notes) {
      setErrors({ ...errors, description: "Enter a name and at least one note first" });
      return;
    }
    setAiBusy(true);
    try {
      const { description } = await api.admin.describe({ name: form.name, family: form.family, notes });
      setForm((f) => ({ ...f, description }));
      setErrors((e) => ({ ...e, description: undefined }));
    } catch (err) {
      setErrors({ ...errors, description: err.message });
    } finally {
      setAiBusy(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    setSubmitted(true);
    setSubmitError(null);
    if (Object.keys(errs).length) {
      setSubmitError(FIX_MSG);
      setTimeout(() => document.querySelector(".editor [aria-invalid=true]")?.focus(), 0);
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(form);
      const saved = id ? await api.admin.updateProduct(id, payload) : await api.admin.createProduct(payload);
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
      toast(id ? `${saved.name} saved` : `${saved.name} created`, { to: `/p/${saved.slug}`, label: "View in shop" });
      navigate("/admin/products");
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      setSubmitError(err.message);
      setSaving(false);
    }
  }

  const err = (k) => errors[k];

  return (
    <form className="editor" onSubmit={save} noValidate>
      <BackLink to="/admin/products">Products</BackLink>
      <div className="page-head">
        <h1>{id ? `Edit ${initial.name}` : "New product"}</h1>
      </div>

      <section className="form-card">
        <h2>Basics</h2>
        <div className="row-2">
          <Field label="Name" error={err("name")}>
            {(p) => <input {...p} value={form.name} onChange={set("name")} />}
          </Field>
          <Field label="Section" help="Which shop tab it appears under.">
            {(p) => (
              <select {...p} value={form.type} onChange={set("type")}>
                <option value="Spray">Perfumes (spray)</option>
                <option value="Oil">Oils & bakhoor</option>
              </select>
            )}
          </Field>
        </div>
        <div className="row-2">
          <Field label="Concentration" help="What is in the bottle; shown on the product page.">
            {(p) => (
              <select {...p} value={form.concentration} onChange={set("concentration")}>
                {CONCENTRATIONS[form.type].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Scent family" help="Used by the shop's family filter.">
            {(p) => (
              <select {...p} value={form.family} onChange={set("family")}>
                {FAMILIES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className="checks">
          <label>
            <input type="checkbox" checked={form.featured} onChange={set("featured")} /> Featured (shown first in the shop)
          </label>
          <label>
            <input type="checkbox" checked={form.active} onChange={set("active")} /> On sale (untick to archive)
          </label>
        </div>
      </section>

      <section className="form-card">
        <h2>Scent and description</h2>
        <div className="row-3">
          {[
            ["notesTop", "Top notes", "First impression, e.g. Saffron, Bergamot"],
            ["notesHeart", "Heart notes", "The core, e.g. Rose, Oud"],
            ["notesBase", "Base notes", "What lingers, e.g. Amber, Musk"],
          ].map(([k, label, help]) => (
            <Field key={k} label={label} help={help} optional>
              {(p) => <input {...p} value={form[k]} onChange={set(k)} />}
            </Field>
          ))}
        </div>
        <Field label="Description" error={err("description")} help="Two or three sentences in the shop's voice." optional>
          {(p) => <textarea {...p} rows={4} value={form.description} onChange={set("description")} maxLength={1200} />}
        </Field>
        <Button type="button" variant="secondary" onClick={writeDescription} loading={aiBusy}>
          {aiBusy ? "Writing…" : "Write it for me with AI"}
        </Button>
        <div className="row-image">
          <Field label="Image URL" error={err("imageUrl")} help="A square https:// image link. Leave empty to show the Wajd mark." optional>
            {(p) => <input {...p} value={form.imageUrl} onChange={set("imageUrl")} placeholder="https://…" />}
          </Field>
          <ProductImage src={/^https:\/\//.test(form.imageUrl) ? form.imageUrl : ""} alt="Image preview" className="thumb-lg" />
        </div>
      </section>

      <section className="form-card">
        <h2>Export details</h2>
        <div className="row-2">
          <Field label="HS code" error={err("hsCode")} help="Customs tariff code import buyers need: 3303.00 perfumes, 3301.29 oils, 3307.90 bakhoor." optional>
            {(p) => <input {...p} value={form.hsCode} onChange={set("hsCode")} placeholder="3303.00" />}
          </Field>
          <Field label="Country of origin">{(p) => <input {...p} value={form.originCountry} onChange={set("originCountry")} />}</Field>
        </div>
      </section>

      <section className="form-card">
        <h2>Sizes and bulk pricing</h2>
        <p className="help">Each size has its own price and stock. Bulk tiers lower the price of every unit once a buyer orders that many of the size.</p>
        {form.variants.map((v, i) => {
          const p = `variants.${i}`;
          const preview = { price: num(v.price) || 0, moq: num(v.moq) || 1, size: v.size || "this size", priceTiers: v.priceTiers.filter((t) => num(t.minQty) > 1 && num(t.price) > 0).map((t) => ({ minQty: num(t.minQty), price: num(t.price) })) };
          return (
            <div key={i} className="variant-card">
              <div className="variant-head">
                <h3>Size {i + 1}</h3>
                {form.variants.length > 1 && (
                  <button type="button" className="link-btn danger" onClick={() => setForm((f) => ({ ...f, variants: f.variants.filter((_, vi) => vi !== i) }))}>
                    Remove size
                  </button>
                )}
              </div>
              <div className="row-4">
                <Field label="Size" error={err(`${p}.size`)}>
                  {(pp) => <input {...pp} value={v.size} onChange={(e) => setVariant(i, "size", e.target.value)} placeholder="30ml" />}
                </Field>
                <Field label="Price (USD)" error={err(`${p}.price`)}>
                  {(pp) => <input {...pp} type="number" step="0.01" min="0" value={v.price} onChange={(e) => setVariant(i, "price", e.target.value)} />}
                </Field>
                <Field label={'"Was" price'} error={err(`${p}.compareAtPrice`)} help="Shows a sale." optional>
                  {(pp) => <input {...pp} type="number" step="0.01" min="0" value={v.compareAtPrice} onChange={(e) => setVariant(i, "compareAtPrice", e.target.value)} />}
                </Field>
                <Field label="Stock" error={err(`${p}.stock`)} help="Units on hand.">
                  {(pp) => <input {...pp} type="number" min="0" value={v.stock} onChange={(e) => setVariant(i, "stock", e.target.value)} />}
                </Field>
              </div>
              <div className="row-4">
                <Field label="Minimum order (MOQ)" error={err(`${p}.moq`)} help="Smallest quantity of this size we ship.">
                  {(pp) => <input {...pp} type="number" min="1" value={v.moq} onChange={(e) => setVariant(i, "moq", e.target.value)} />}
                </Field>
                <Field label="Carton size" error={err(`${p}.cartonSize`)} help="Units per sealed carton." optional>
                  {(pp) => <input {...pp} type="number" min="1" value={v.cartonSize} onChange={(e) => setVariant(i, "cartonSize", e.target.value)} />}
                </Field>
              </div>

              <fieldset className="tiers">
                <legend>Bulk tiers</legend>
                {v.priceTiers.length === 0 && <p className="muted">No bulk tiers: every unit costs the base price.</p>}
                {v.priceTiers.map((t, ti) => (
                  <div key={ti} className="tier-row">
                    <Field label={`From quantity`} error={err(`${p}.priceTiers.${ti}.minQty`)}>
                      {(pp) => <input {...pp} type="number" min="2" value={t.minQty} onChange={(e) => setTier(i, ti, "minQty", e.target.value)} />}
                    </Field>
                    <Field label="Price each" error={err(`${p}.priceTiers.${ti}.price`)}>
                      {(pp) => <input {...pp} type="number" step="0.01" min="0" value={t.price} onChange={(e) => setTier(i, ti, "price", e.target.value)} />}
                    </Field>
                    <button type="button" className="link-btn danger" onClick={() => removeTier(i, ti)} aria-label={`Remove tier ${ti + 1}`}>
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => addTier(i)}>
                  + Add bulk tier
                </button>
              </fieldset>
              {preview.priceTiers.length > 0 && preview.price > 0 && (
                <div className="tier-preview">
                  <label className="label-sm">
                    Preview at quantity{" "}
                    <input type="number" min="1" value={previewQty[i] ?? preview.moq} onChange={(e) => setPreviewQty({ ...previewQty, [i]: Number(e.target.value) || 1 })} />
                  </label>
                  <TierTable variant={preview} quantity={previewQty[i] ?? preview.moq} />
                </div>
              )}
            </div>
          );
        })}
        <button type="button" className="btn btn-secondary" onClick={() => setForm((f) => ({ ...f, variants: [...f.variants, blankVariant()] }))}>
          + Add another size
        </button>
      </section>

      {submitError && (submitError !== FIX_MSG || Object.values(errors).some(Boolean)) && <Notice tone="error">{submitError}</Notice>}
      <div className="sticky-actions">
        <Button type="button" variant="ghost" onClick={() => navigate("/admin/products")}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {id ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  );
}

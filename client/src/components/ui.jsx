import { useEffect, useId, useRef } from "react";
import { Link } from "react-router-dom";
import { STEP_LABELS } from "../lib/format";

export const BRAND = { ar: "وجد", latin: "WAJD" };

/** Label above, optional help text, error below; the control is passed as a child render fn. */
export function Field({ label, help, error, optional, children, className = "" }) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={`field ${error ? "has-error" : ""} ${className}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="optional"> (optional)</span>}
      </label>
      {children({ id, "aria-describedby": [helpId, errId].filter(Boolean).join(" ") || undefined, "aria-invalid": error ? true : undefined })}
      {help && !error && (
        <p className="help" id={helpId}>
          {help}
        </p>
      )}
      {error && (
        <p className="field-error" id={errId}>
          {error}
        </p>
      )}
    </div>
  );
}

export function Button({ variant = "primary", size, loading, children, className = "", ...rest }) {
  return (
    <button className={`btn btn-${variant} ${size ? `btn-${size}` : ""} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function QtyStepper({ value, min = 1, max = Infinity, onChange, label = "Quantity", size }) {
  const clamp = (n) => Math.min(Math.max(Number.isFinite(n) ? Math.floor(n) : min, min), Math.max(max, min));
  return (
    <div className={`stepper ${size === "sm" ? "stepper-sm" : ""}`} role="group" aria-label={label}>
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(clamp(value - 1))}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        onChange={(e) => onChange(e.target.value === "" ? min : Number(e.target.value))}
        onBlur={(e) => onChange(clamp(Number(e.target.value)))}
      />
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(clamp(value + 1))}>
        +
      </button>
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${String(status).toLowerCase().replace(/\s+/g, "-")}`}>{STEP_LABELS[status] || status}</span>;
}

export function PaymentBadge({ order }) {
  const label = order.paymentMethod === "COD" ? `Cash · ${order.paymentStatus}` : `Card · ${order.paymentStatus}`;
  return <span className={`badge badge-pay-${order.paymentStatus.toLowerCase().replace(/\s+/g, "-")}`}>{label}</span>;
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-mark" aria-hidden="true">
        {BRAND.ar}
      </div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <p>{error?.message || "Something went wrong."}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ lines = 3, className = "" }) {
  return (
    <div className={`skeleton-block ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function CardSkeletonGrid({ count = 8 }) {
  return (
    <div className="grid" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card card-skeleton">
          <div className="card-img shimmer" />
          <div className="card-body">
            <div className="skeleton-line" style={{ width: "70%" }} />
            <div className="skeleton-line" style={{ width: "45%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductImage({ src, alt, className = "" }) {
  return (
    <div className={`product-img ${className}`}>
      {src ? <img src={src} alt={alt} loading="lazy" /> : <span aria-hidden="true">{BRAND.ar}</span>}
    </div>
  );
}

/** Modal confirm for destructive actions; names the thing being changed. */
export function ConfirmDialog({ open, title, children, confirmLabel = "Confirm", danger, onConfirm, onCancel, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector("button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(e) => e.stopPropagation()} ref={ref}>
        <h2 id="dlg-title">{title}</h2>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">
          <Button variant="ghost" onClick={onCancel}>
            Keep it
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Notice({ tone = "info", children }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function BackLink({ to, children }) {
  return (
    <Link className="back-link" to={to}>
      ← {children}
    </Link>
  );
}

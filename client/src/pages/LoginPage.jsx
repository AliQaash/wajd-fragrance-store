import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { BRAND, Button, Field, Notice } from "../components/ui";

const MESSAGES = {
  "auth/invalid-credential": "That email and password do not match an account.",
  "auth/wrong-password": "That email and password do not match an account.",
  "auth/user-not-found": "No account uses that email. Create one below.",
  "auth/email-already-in-use": "An account already uses that email. Sign in instead.",
  "auth/weak-password": "Use at least 6 characters for the password.",
  "auth/invalid-email": "That email address does not look right.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/network-request-failed": "Cannot reach the sign-in service. Check your connection.",
};
const friendly = (err) => MESSAGES[err.code] || err.message.replace("Firebase: ", "");

/** Screen 4: sign in or create an account, then go back to where the buyer was. */
export default function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = mode === "signin" ? "Sign in · Wajd" : "Create account · Wajd";
  }, [mode]);

  // While signing up, wait for the name to be saved before leaving the page.
  if (user && !busy) return <Navigate to={next} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (mode === "signup" && form.name.trim().length < 2) errs.name = "Enter your name";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email address";
    if (form.password.length < 6) errs.password = "Use at least 6 characters";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        await updateProfile(cred.user, { displayName: form.name.trim() });
      }
      navigate(next, { replace: true });
    } catch (err) {
      setNotice({ tone: "error", text: friendly(err) });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setErrors({ email: "Enter your email above first" });
    try {
      await sendPasswordResetEmail(auth, form.email.trim());
      setNotice({ tone: "success", text: `If an account uses ${form.email.trim()}, a reset link is on its way.` });
    } catch (err) {
      setNotice({ tone: "error", text: friendly(err) });
    }
  }

  return (
    <div className="page narrow">
      <div className="auth-card">
        <div className="brand brand-lg" aria-hidden="true">
          <span className="ar">{BRAND.ar}</span>
          <span className="latin">{BRAND.latin}</span>
        </div>
        <div className="tabs tabs-equal" role="tablist">
          <button role="tab" aria-selected={mode === "signin"} className={`tab ${mode === "signin" ? "active" : ""}`} onClick={() => { setMode("signin"); setErrors({}); setNotice(null); }}>
            Sign in
          </button>
          <button role="tab" aria-selected={mode === "signup"} className={`tab ${mode === "signup" ? "active" : ""}`} onClick={() => { setMode("signup"); setErrors({}); setNotice(null); }}>
            Create account
          </button>
        </div>
        {next === "/checkout" && <p className="help center">Sign in to place your order. Your cart is saved.</p>}
        <form onSubmit={submit} noValidate>
          {mode === "signup" && (
            <Field label="Your name" error={errors.name}>
              {(p) => <input {...p} autoComplete="name" value={form.name} onChange={set("name")} />}
            </Field>
          )}
          <Field label="Email" error={errors.email}>
            {(p) => <input {...p} type="email" autoComplete="email" value={form.email} onChange={set("email")} />}
          </Field>
          <Field label="Password" error={errors.password} help={mode === "signup" ? "At least 6 characters" : undefined}>
            {(p) => <input {...p} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={form.password} onChange={set("password")} />}
          </Field>
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
          <Button type="submit" size="lg" className="block" loading={busy}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          {mode === "signin" && (
            <button type="button" className="link-btn center-block" onClick={reset}>
              Forgot your password?
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

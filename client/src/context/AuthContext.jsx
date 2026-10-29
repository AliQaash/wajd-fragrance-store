import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { api } from "../lib/api";

const AuthContext = createContext(null);
const FALLBACK_ADMIN = (import.meta.env.REACT_APP_ADMIN_EMAIL || "").toLowerCase();

/**
 * Who is signed in, and whether they are an admin. The role comes from the
 * server (/api/me), which is what actually enforces it; the env email is only
 * a fallback for showing the Admin link while the server is unreachable.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: undefined, isAdmin: false });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) return setState({ user: null, isAdmin: false });
        const guess = FALLBACK_ADMIN && user.email?.toLowerCase() === FALLBACK_ADMIN;
        setState({ user, isAdmin: guess });
        try {
          const me = await api.me();
          setState({ user, isAdmin: me.isAdmin });
        } catch {
          /* keep the fallback */
        }
      }),
    []
  );

  const value = { ...state, loading: state.user === undefined, signOut: () => signOut(auth) };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

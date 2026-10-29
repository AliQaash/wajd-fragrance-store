import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { BRAND } from "./ui";

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0); // newer browsers return a promise here; must not be returned from the effect
  }, [pathname]);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="Wajd home">
          <span className="ar">{BRAND.ar}</span>
          <span className="latin">{BRAND.latin}</span>
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>
            Shop
          </NavLink>
          {user && <NavLink to="/orders">Orders</NavLink>}
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
          <NavLink to="/cart" className="nav-cart" aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}>
            Cart{count > 0 && <span className="count">{count}</span>}
          </NavLink>
          {user ? (
            <button className="nav-btn" onClick={signOut} title={user.email}>
              Sign out
            </button>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </nav>
      </header>
      <main id="main" className="main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>
          {BRAND.latin} · fine fragrances, by the bottle or by the carton
        </span>
        <span>Prices in USD · Cash on delivery across Pakistan</span>
      </footer>
    </>
  );
}

import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import { EmptyState, Skeleton } from "./components/ui";
import CatalogPage from "./pages/CatalogPage";
import ProductPage from "./pages/ProductPage";
import CartPage from "./pages/CartPage";
import LoginPage from "./pages/LoginPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import AdminLayout from "./pages/admin/AdminLayout";
import DashboardPage from "./pages/admin/DashboardPage";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import ProductEditorPage from "./pages/admin/ProductEditorPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import { Link } from "react-router-dom";

/** Signed-in only; sends guests to sign in and brings them back afterwards. */
function RequireAuth({ children, admin }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page"><Skeleton lines={4} /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (admin && !isAdmin)
    return (
      <div className="page">
        <EmptyState title="Admins only" action={<Link className="btn btn-primary" to="/">Back to the shop</Link>}>
          This area is for the store team.
        </EmptyState>
      </div>
    );
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CatalogPage />} />
        <Route path="p/:slug" element={<ProductPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
        <Route path="orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
        <Route path="orders/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
        <Route path="admin" element={<RequireAuth admin><AdminLayout /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/new" element={<ProductEditorPage />} />
          <Route path="products/:id" element={<ProductEditorPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
        </Route>
        <Route
          path="*"
          element={
            <div className="page">
              <EmptyState title="Page not found" action={<Link className="btn btn-primary" to="/">Go to the shop</Link>}>
                That link does not lead anywhere in the store.
              </EmptyState>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}

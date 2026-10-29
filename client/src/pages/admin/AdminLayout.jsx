import { NavLink, Outlet } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div className="page admin">
      <nav className="subnav" aria-label="Admin">
        <NavLink to="/admin" end>
          Dashboard
        </NavLink>
        <NavLink to="/admin/products">Products</NavLink>
        <NavLink to="/admin/orders">Orders</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}

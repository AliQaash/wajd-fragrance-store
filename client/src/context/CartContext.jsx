import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const KEY = "wajd.cart.v2";

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((l) => l.productId && l.size && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

const sameLine = (a, productId, size) => a.productId === productId && a.size === size;

/**
 * One line per product + size, persisted in this browser so a refresh or a
 * trip to the sign-in page keeps the cart. Adding the same size again raises
 * the quantity on the existing line, so bulk tiers apply to the total.
 * Lines carry a snapshot (name, image, pricing) for instant display; the
 * cart page asks the server for the real prices and stock.
 */
export function CartProvider({ children }) {
  const [lines, setLines] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* private mode: cart just will not persist */
    }
  }, [lines]);

  const value = useMemo(() => {
    const add = (product, variant, quantity) =>
      setLines((prev) => {
        const id = String(product._id);
        const existing = prev.find((l) => sameLine(l, id, variant.size));
        if (existing) {
          return prev.map((l) => (sameLine(l, id, variant.size) ? { ...l, quantity: l.quantity + quantity } : l));
        }
        return [
          ...prev,
          {
            productId: id,
            slug: product.slug,
            name: product.name,
            imageUrl: product.imageUrl,
            size: variant.size,
            quantity,
          },
        ];
      });
    const setQuantity = (productId, size, quantity) =>
      setLines((prev) => prev.map((l) => (sameLine(l, productId, size) ? { ...l, quantity: Math.max(1, quantity) } : l)));
    const remove = (productId, size) => setLines((prev) => prev.filter((l) => !sameLine(l, productId, size)));
    const clear = () => setLines([]);
    const quantityOf = (productId, size) => lines.find((l) => sameLine(l, productId, size))?.quantity || 0;
    const items = lines.map(({ productId, size, quantity }) => ({ productId, size, quantity }));
    return { lines, items, count: lines.length, add, setQuantity, remove, clear, quantityOf };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);

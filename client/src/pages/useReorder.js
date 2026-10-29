import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";

/**
 * Puts an old order's items back in the cart at today's product data. Items
 * that are no longer sold are skipped and reported; the cart page then shows
 * current prices, MOQ and stock.
 */
export function useReorder() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  return async (order) => {
    let added = 0;
    let missing = 0;
    for (const item of order.items) {
      try {
        const product = await api.productById(item.productId);
        const variant = product.variants.find((v) => v.size === item.size);
        if (!variant) throw new Error("size gone");
        cart.add(product, variant, item.quantity);
        added++;
      } catch {
        missing++;
      }
    }
    if (added) {
      toast(missing ? `Added ${added} items; ${missing} are no longer sold` : "Order items added to your cart");
      navigate("/cart");
    } else {
      toast("None of those items are sold any more");
    }
  };
}

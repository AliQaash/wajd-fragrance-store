// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * End-to-end test for the Wajd fragrance shop.
 *
 * This runs the whole customer + admin journey in ONE continuous test
 * (rather than many small independent tests) because each step depends
 * on the state left by the previous one — same as a real shopper would
 * experience it: sign up -> browse -> configure a product -> checkout ->
 * see the order -> switch to the admin account -> add a product -> see
 * it show up in the shop.
 *
 * It's broken into named test.step() blocks. If something fails, the
 * step name Playwright prints (and shows in the HTML report) tells you
 * exactly which part of the flow broke, and a screenshot is attached
 * right at that point.
 */

// A fresh, never-used-before email every run, so "sign up" always works
// instead of colliding with a previous test run's account.
const RUN_ID = Date.now();
const TEST_EMAIL = `wajd.e2e.${RUN_ID}@example.com`;
const TEST_PASSWORD = "TestPass!2024";

const ADMIN_EMAIL = "aliqaash@gmail.com";
const ADMIN_PASSWORD = "pppppp";

const TEST_PRODUCT_NAME = `E2E Test Scent ${RUN_ID}`;

// Small helper: header nav buttons all share the class "icon-btn" and can
// contain extra text (e.g. a cart-count badge), so we match by
// "contains this text" rather than an exact match.
function navButton(page, label) {
  return page.locator("button.icon-btn", { hasText: label });
}

test.describe("Wajd shop — full customer + admin journey", () => {
  test("sign up, buy with bulk pricing, checkout COD, then admin adds a product", async ({ page }) => {
    // ---------------------------------------------------------------
    // 1. Sign up a brand-new test customer
    // ---------------------------------------------------------------
    await test.step("Sign up a new test user", async () => {
      await page.goto("/");

      // The app shows a login form by default; switch to "create account".
      await page.getByText("Create an account", { exact: false }).click();

      await page.locator('input[type="email"]').fill(TEST_EMAIL);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
      await page.getByRole("button", { name: "Create Account" }).click();

      // A successful signup swaps the auth screen for the main app shell.
      await expect(navButton(page, "Shop")).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: "test-results/01-signed-up.png" });
    });

    // ---------------------------------------------------------------
    // 2. Shop page loads and shows products
    // ---------------------------------------------------------------
    await test.step("Shop page loads and products render", async () => {
      await navButton(page, "Shop").click();
      const productCards = page.locator(".product-card");
      await expect(productCards.first()).toBeVisible({ timeout: 15000 });
      const count = await productCards.count();
      expect(count).toBeGreaterThan(0);
      await page.screenshot({ path: "test-results/02-shop-loaded.png" });
    });

    // ---------------------------------------------------------------
    // 3. Product modal: change size + quantity, verify bulk pricing
    // ---------------------------------------------------------------
    await test.step("Product modal: size + quantity changes update price, including a bulk-tier crossing", async () => {
      // "Layl" is one of the seeded products with bulk price tiers, so we
      // target it by name instead of assuming it's first in the grid.
      const card = page.locator(".product-card", { hasText: "Layl" }).first();
      await expect(card).toBeVisible({ timeout: 10000 });
      await card.click();

      const modal = page.locator(".modal-content");
      await expect(modal).toBeVisible();

      // Switch size from the default (30ml) to 50ml.
      await modal.locator(".size-chip", { hasText: "50ml" }).click();
      await expect(modal.locator(".size-chip.selected")).toHaveText("50ml");

      const qtyMinus = modal.locator(".qty-btn").nth(0);
      const qtyPlus = modal.locator(".qty-btn").nth(1);
      const qtyDisplay = modal.locator(".qty-row > span").first(); // the plain qty number, not .price-tag
      const priceTag = modal.locator(".price-tag");

      // At quantity 1, 50ml should be the base price ($98/unit -> $98.00 total).
      await expect(qtyDisplay).toHaveText("1");
      await expect(priceTag).toHaveText("$98.00");

      // Click "+" 11 times to reach quantity 12, which is exactly the first
      // bulk tier threshold for this variant ($84/unit at 12+).
      for (let i = 0; i < 11; i++) {
        await qtyPlus.click();
      }
      await expect(qtyDisplay).toHaveText("12");

      // This is the actual "does the price update correctly across a bulk
      // tier" check: 12 units x $84 = $1008.00, not 12 x $98.
      await expect(priceTag).toHaveText("$1008.00");

      // The tier table should also show the 12+ row as the active one.
      await expect(modal.locator("table.tier-table tr.active-tier")).toContainText("12+ units");
      await expect(modal.locator("table.tier-table tr.active-tier")).toContainText("$84.00 each");

      await page.screenshot({ path: "test-results/03-bulk-pricing.png" });

      // Sanity check the "-" button also works (does not affect the assertions
      // above, just confirms the control is wired up both ways).
      await qtyMinus.click();
      await expect(qtyDisplay).toHaveText("11");
      await qtyPlus.click(); // back to 12 before adding to cart

      await modal.getByRole("button", { name: "Add to Cart" }).click();
      await expect(modal).not.toBeVisible();
    });

    // ---------------------------------------------------------------
    // 4. Cart -> checkout -> place a COD order
    // ---------------------------------------------------------------
    let orderTotalText = "";
    await test.step("Add to cart, fill delivery details, place a COD order", async () => {
      await navButton(page, "Cart").click();

      const cartItem = page.locator(".cart-item", { hasText: "Layl" });
      await expect(cartItem).toBeVisible();
      await expect(cartItem).toContainText("50ml");
      await expect(cartItem).toContainText("12");

      await page.locator('input[placeholder="Full name"]').fill("Playwright Test Customer");
      await page.locator('input[placeholder="Phone"]').fill("0555000111");
      await page.locator('textarea[placeholder="Delivery address"]').fill("123 Automation Ave, Test City");

      orderTotalText = (await page.locator(".total-row span").nth(1).textContent()) || "";
      expect(orderTotalText.trim()).toBe("$1008.00");

      await page.getByRole("button", { name: /Place Order/ }).click();

      // Placing the order navigates the app straight to the Orders view.
      await expect(page.locator(".order-card").first()).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: "test-results/04-order-placed.png" });
    });

    // ---------------------------------------------------------------
    // 5. Confirm the order shows up under "Orders"
    // ---------------------------------------------------------------
    await test.step('Order appears under "Orders"', async () => {
      await navButton(page, "Orders").click();
      const orderCard = page.locator(".order-card").first();
      await expect(orderCard).toBeVisible();
      await expect(orderCard).toContainText("Layl (50ml) x12");
      await expect(orderCard).toContainText("Pending");
      await expect(orderCard).toContainText(orderTotalText.trim());
      await page.screenshot({ path: "test-results/05-orders-view.png" });
    });

    // ---------------------------------------------------------------
    // 6. Sign out, log back in as admin
    // ---------------------------------------------------------------
    await test.step("Sign out and log in as admin", async () => {
      await navButton(page, "Sign Out").click();
      await expect(page.locator('input[type="email"]')).toBeVisible();

      // Login is the default mode after signing out, so no need to toggle.
      await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
      await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: "Sign In" }).click();

      await expect(navButton(page, "Shop")).toBeVisible({ timeout: 15000 });
      await expect(navButton(page, "Admin")).toBeVisible();
      await page.screenshot({ path: "test-results/06-admin-logged-in.png" });
    });

    // ---------------------------------------------------------------
    // 7. Admin tab: product list loads, Add Product form is present
    // ---------------------------------------------------------------
    await test.step('Admin tab shows, product list loads, "Add Product" form is present', async () => {
      await navButton(page, "Admin").click();

      await expect(page.getByRole("heading", { name: "Add Product" })).toBeVisible();
      await expect(page.locator(".add-form")).toBeVisible();

      // The catalog grid under the form should have loaded existing products.
      const catalogCards = page.locator(".view > .grid .product-card");
      await expect(catalogCards.first()).toBeVisible({ timeout: 10000 });
      expect(await catalogCards.count()).toBeGreaterThan(0);
      await page.screenshot({ path: "test-results/07-admin-products-tab.png" });
    });

    // ---------------------------------------------------------------
    // 8. Add a new test product through the admin form
    // ---------------------------------------------------------------
    await test.step("Add a new product through the admin form", async () => {
      const form = page.locator("form.add-form");

      await form.locator('input[placeholder="Name"]').fill(TEST_PRODUCT_NAME);
      // Type / Family / notes / description are left at their defaults —
      // only the required fields (name, variant size + price) are needed
      // to save a product.
      await form.locator('input[placeholder="Size (e.g. 30ml)"]').first().fill("10ml");
      await form.locator('input[placeholder="Price"]').first().fill("25");

      await form.getByRole("button", { name: "Save Product" }).click();

      // On success the form clears and reloads the catalog below it —
      // wait for the new product to appear there.
      const newCatalogCard = page.locator(".view > .grid .product-card", { hasText: TEST_PRODUCT_NAME });
      await expect(newCatalogCard).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: "test-results/08-product-added-admin.png" });
    });

    // ---------------------------------------------------------------
    // 9. Confirm the new product appears in the public shop catalog
    // ---------------------------------------------------------------
    await test.step("New product appears in the customer-facing shop", async () => {
      await navButton(page, "Shop").click();
      const shopCard = page.locator(".product-card", { hasText: TEST_PRODUCT_NAME });
      await expect(shopCard).toBeVisible({ timeout: 15000 });
      await expect(shopCard).toContainText("$25.00");
      await page.screenshot({ path: "test-results/09-new-product-in-shop.png" });
    });

    // ---------------------------------------------------------------
    // 10. Cleanup: remove the test product so the catalog doesn't
    //     accumulate junk from repeated test runs. (Not part of the
    //     required checks — just tidiness. The COD order is left in
    //     place under "Pending" since orders aren't meant to be deleted.)
    // ---------------------------------------------------------------
    await test.step("Cleanup: remove the test product via admin", async () => {
      await navButton(page, "Admin").click();
      const card = page.locator(".view > .grid .product-card", { hasText: TEST_PRODUCT_NAME });
      await card.getByRole("button", { name: "Remove" }).click();
      await expect(card).not.toBeVisible({ timeout: 10000 });
    });
  });
});

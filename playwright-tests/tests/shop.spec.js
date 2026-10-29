// @ts-check
const { test, expect } = require("@playwright/test");
const { ensureUser, uniqueEmail, signUp, signIn, signOut, qtyInput, addToCart, fillDelivery, shot, ADMIN } = require("./helpers");

test.describe("shopper", () => {
  test("browses, searches and filters without an account", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Fine fragrances, honestly priced" })).toBeVisible();
    await expect(page.getByText("11 fragrances")).toBeVisible();
    await shot(page, "1-catalog");

    await page.getByLabel("Search").fill("saffron");
    await expect(page.getByRole("link", { name: /Layl/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Suhail/ })).toHaveCount(0);
    await expect(page).toHaveURL(/q=saffron/);

    await page.getByLabel("Search").fill("");
    await page.getByRole("tab", { name: "Oils & bakhoor" }).click();
    await expect(page.getByRole("link", { name: /Oud Dakhili/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Layl/ })).toHaveCount(0);

    await page.getByLabel("Scent family").selectOption("Musk");
    await expect(page.getByRole("link", { name: /Misk Abyad/ })).toBeVisible();
    await expect(page.getByText("1 fragrance", { exact: true })).toBeVisible();

    await page.getByLabel("Search").fill("zzzz");
    await expect(page.getByText("Nothing matches that")).toBeVisible();
    await page.getByRole("button", { name: "Clear search and filters" }).click();
    await expect(page.getByText("11 fragrances")).toBeVisible();
  });

  test("bulk tiers apply to the merged quantity, and MOQ is enforced", async ({ page }) => {
    await page.goto("/p/layl");
    await expect(page.getByRole("heading", { name: "Layl" })).toBeVisible();
    await expect(page.getByText("$68.00 each")).toBeVisible();
    const qty = qtyInput(page);
    await qty.fill("6");
    await qty.blur();
    await expect(page.getByText("Add 6 more to pay $58.00 each")).toBeVisible();
    await shot(page, "2-product");
    await page.getByRole("button", { name: /^Add to cart/ }).click();

    // Adding the same size again counts toward the same tier.
    await expect(page.getByText("You already have 6 of this size")).toBeVisible();
    await expect(page.getByText("$58.00 each")).toBeVisible();
    await page.getByRole("button", { name: /^Add to cart/ }).click();

    await page.getByRole("link", { name: /^Cart/ }).click();
    const lines = page.getByRole("list", { name: "Items in your cart" }).getByRole("listitem");
    await expect(lines).toHaveCount(1);
    await expect(page.getByRole("spinbutton", { name: "Quantity of Layl 30ml" })).toHaveValue("12");
    await expect(page.getByText("$58.00 each")).toBeVisible();
    await expect(page.getByText("−$120.00")).toBeVisible();
    await expect(page.locator(".summary .grand")).toContainText("$696.00");
    await expect(page.getByText("Add 36 more to pay $51.00 each")).toBeVisible();
    await shot(page, "3-cart");

    // MOQ: 3ml vials start at 3 and the stepper cannot go lower.
    await page.goto("/p/zafaran-oil");
    await page.getByRole("button", { name: /^3ml/ }).click();
    await expect(page.getByText("Minimum order for 3ml: 3 units")).toBeVisible();
    await expect(qtyInput(page)).toHaveValue("3");
    await expect(page.getByRole("button", { name: "Decrease" })).toBeDisabled();
  });

  test("guest is sent to sign up at checkout, keeps the cart, orders with cash on delivery and cancels", async ({ page }) => {
    const email = uniqueEmail("buyer");
    await addToCart(page, "ward-taifi", "50ml", 2);
    await page.goto("/cart");
    await page.getByRole("button", { name: "Sign in to check out" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fcheckout|\/login\?next=\/checkout/);
    await expect(page.getByText("Your cart is saved")).toBeVisible();
    await signUp(page, { name: "Ayesha Khan", email, password: "buyer-pass-1" });

    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByLabel("Full name")).toHaveValue("Ayesha Khan");
    await page.getByLabel("Phone").fill("abc");
    await page.getByLabel("City").fill("Lahore");
    await page.getByLabel("Address").fill("House 12, Street 4, Gulberg III");
    await page.getByRole("button", { name: /^Place order/ }).click();
    await expect(page.getByText("Enter a phone number we can call")).toBeVisible();
    await page.getByLabel("Phone").fill("0300 1234567");
    await shot(page, "5-checkout");
    await page.getByRole("button", { name: /^Place order/ }).click();

    await expect(page).toHaveURL(/\/orders\/[a-f0-9]{24}/);
    await expect(page.getByText("Your order is placed")).toBeVisible();
    await expect(page.locator(".order-head")).toContainText("Placed");
    await expect(page.locator(".totals .grand")).toContainText("$178.00");
    await shot(page, "6-order-detail");

    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel order" }).click();
    await expect(page.getByText(/Cancelled on/)).toBeVisible();

    await page.getByRole("link", { name: "Orders", exact: true }).click();
    await expect(page.getByRole("heading", { name: "My orders" })).toBeVisible();
    await expect(page.locator(".order-row").first()).toContainText("Cancelled");
    await page.getByRole("link", { name: /^Cart/ }).click();
    await expect(page.getByText("Your cart is empty")).toBeVisible();
  });
});

test.describe("admin", () => {
  test.beforeEach(async ({ request }) => ensureUser(request, ADMIN));

  test("fulfils an order step by step and the buyer sees it delivered", async ({ page }) => {
    const buyer = { name: "Bilal Ahmed", email: uniqueEmail("bilal"), password: "buyer-pass-2" };
    await page.goto("/login");
    await signUp(page, buyer);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await addToCart(page, "oud-dakhili", "3ml", 24);
    await page.goto("/checkout");
    await fillDelivery(page);
    await page.getByRole("button", { name: /^Place order/ }).click();
    await expect(page.getByText("Your order is placed")).toBeVisible();
    const orderUrl = page.url();
    await signOut(page);

    await signIn(page, ADMIN);
    await page.getByRole("link", { name: "Admin" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await shot(page, "8-admin-dashboard");
    await page.getByRole("link", { name: /Waiting for approval/ }).click();
    await page.getByRole("button", { name: /Bilal Ahmed/ }).click();
    const drawer = page.locator(".drawer");
    await expect(drawer).toContainText("24 × Oud Dakhili 3ml");
    await expect(drawer.getByRole("button", { name: "Mark delivered" })).toHaveCount(0);
    await drawer.getByRole("button", { name: "Approve" }).click();
    await expect(drawer.getByRole("button", { name: "Mark dispatched" })).toBeVisible();
    await shot(page, "11-admin-orders");
    await drawer.getByRole("button", { name: "Mark dispatched" }).click();
    await drawer.getByRole("button", { name: "Mark delivered" }).click();
    await expect(drawer).toContainText("No further steps");
    await expect(drawer).toContainText("Cash · Paid");
    await signOut(page);

    await signIn(page, buyer);
    await page.goto(orderUrl);
    await expect(page.locator(".timeline li.done")).toHaveCount(4);
    await expect(page.locator(".order-head")).toContainText("Delivered");
  });

  test("creates a product with validation, edits stock, and archives it", async ({ page }) => {
    const name = `E2E Musk ${Date.now()}`;
    await signIn(page, ADMIN);
    await page.goto("/admin/products/new");
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Section").selectOption("Oil");
    await expect(page.getByLabel("Concentration")).toHaveValue("Concentrated Oil");
    await page.getByLabel("Scent family").selectOption("Musk");
    await page.getByLabel("Top notes").fill("White musk, Pear");
    await page.getByLabel("Size", { exact: true }).fill("6ml");
    await page.getByLabel("Price (USD)").fill("30");
    await page.getByLabel("Stock").fill("50");
    await page.getByLabel("Minimum order (MOQ)").fill("6");
    await page.getByRole("button", { name: "+ Add bulk tier" }).click();
    await page.getByLabel("From quantity").fill("6");
    await page.getByLabel("Price each").fill("25");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page.getByText("Must be above the minimum order (6)")).toBeVisible();
    await page.getByLabel("From quantity").fill("24");
    await page.getByLabel("Price each").fill("31");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page.getByText("Must be below $30.00")).toBeVisible();
    await page.getByLabel("Price each").fill("24");
    await shot(page, "10-product-editor");
    await page.getByRole("button", { name: "Create product" }).click();

    await expect(page).toHaveURL(/\/admin\/products$/);
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await shot(page, "9-admin-products");

    // Shop shows it with the MOQ applied.
    await page.goto(`/?q=${encodeURIComponent(name)}`);
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await expect(qtyInput(page)).toHaveValue("6");
    await expect(page.getByText("Minimum order for 6ml: 6 units")).toBeVisible();

    // Inline stock edit, then the product page warns about low stock.
    await page.goto("/admin/products");
    const stock = page.getByLabel(`${name} 6ml stock`);
    await stock.fill("8");
    await stock.press("Enter");
    await expect(page.getByText(`${name} 6ml: stock set to 8`)).toBeVisible();
    await page.goto(`/?q=${encodeURIComponent(name)}`);
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await expect(page.getByText("Only 8 left")).toBeVisible();

    // Archive hides it from the shop.
    await page.goto("/admin/products");
    await page.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: "Archive" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("Archived");
    await page.goto(`/?q=${encodeURIComponent(name)}`);
    await expect(page.getByText("Nothing matches that")).toBeVisible();
  });

  test("customers cannot open the admin area", async ({ page }) => {
    await page.goto("/login");
    await signUp(page, { name: "Curious", email: uniqueEmail("curious"), password: "buyer-pass-3" });
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await page.goto("/admin");
    await expect(page.getByText("Admins only")).toBeVisible();
  });
});

const path = require("path");
const { expect } = require("@playwright/test");

const EMULATOR = "http://127.0.0.1:9099";
const ADMIN = { email: "admin@wajd.test", password: "admin-pass-123" };
const SHOTS = process.env.SHOTS ? path.resolve(__dirname, "../../docs/screenshots") : null;

/** Creates an account directly in the Auth emulator (ignores "already exists"). */
async function ensureUser(request, { email, password }) {
  await request.post(`${EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    data: { email, password, returnSecureToken: true },
  });
}

const uniqueEmail = (tag) => `${tag}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@example.com`;

async function signIn(page, { email, password }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

async function signOut(page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
}

async function signUp(page, { name, email, password }) {
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).last().click();
}

const qtyInput = (page) => page.getByRole("spinbutton", { name: "Quantity", exact: true });

async function addToCart(page, slug, size, qty) {
  await page.goto(`/p/${slug}`);
  if (size) await page.getByRole("button", { name: new RegExp(`^${size}`) }).click();
  const input = qtyInput(page);
  await input.fill(String(qty));
  await input.blur();
  await page.getByRole("button", { name: /^Add to cart/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added" })).toBeVisible();
}

async function fillDelivery(page) {
  await page.getByLabel("Phone").fill("0300 1234567");
  await page.getByLabel("City").fill("Lahore");
  await page.getByLabel("Address").fill("House 12, Street 4, Gulberg III");
}

async function shot(page, name) {
  if (!SHOTS) return;
  // Scroll through once so lazy images load, then back to the top for a clean sticky header.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

module.exports = { ADMIN, ensureUser, uniqueEmail, signIn, signOut, signUp, qtyInput, addToCart, fillDelivery, shot };

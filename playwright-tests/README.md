# Wajd E2E test

A single Playwright test that walks through the whole app the way a real
person would: sign up, browse the shop, open a product, change its size
and quantity (checking that bulk pricing kicks in at the right quantity),
add it to the cart, check out with cash-on-delivery, confirm the order
shows up, then switch to the admin account and add a new product.

This folder is completely separate from `client/` and `server/` — it has
its own `package.json` and doesn't touch your app's code or dependencies.

## One-time setup

From this folder (`playwright-tests/`):

```
npm install
npx playwright install chromium
```

The first command installs Playwright itself (already done for you, but
harmless to re-run). The second downloads the actual Chromium browser
Playwright drives — this only needs to happen once on your machine.

## Running the test

```
npx playwright test
```

That's it. You do **not** need to start `npm run dev` yourself first —
the test config checks if `localhost:3000` and `localhost:5000` are
already up, and if not, starts them for you (same as running `npm run
dev` from the project root) and waits until they're ready.

Useful variants:

- `npx playwright test --headed` — watch it click through the app in a
  real visible browser window instead of running invisibly.
- `npx playwright test --debug` — step through it one action at a time.
- `npm run report` — open the last run's HTML report (screenshots,
  video, and a step-by-step trace viewer for anything that failed).

## What it checks, in order

1. Signs up a brand-new test account (a fresh email is generated every
   run, so this never collides with a previous run).
2. Confirms the shop page loads and shows products.
3. Opens the "Layl" product, switches its size to 50ml, then increases
   the quantity from 1 to 12 — crossing into the first bulk-pricing
   tier — and checks the displayed price is exactly right at each step
   ($98.00 at qty 1, $1008.00 at qty 12).
4. Adds it to the cart, fills in delivery details, and places a
   cash-on-delivery order.
5. Confirms the order appears under "Orders" with the right items,
   status, and total.
6. Signs out and logs back in as the admin account.
7. Confirms the Admin tab appears, the existing product list loads, and
   the "Add Product" form is present.
8. Adds a new test product through that form and confirms it shows up
   both in the admin catalog and in the regular shop.
9. Cleans up by removing the test product it created (the test order is
   left in place, since orders aren't meant to be deleted).

## Reading the results

If everything passes, you'll see a green line per step in your terminal.

If something fails, Playwright prints exactly which named step broke
(e.g. `Product modal: size + quantity changes update price...`), saves a
screenshot of the page at that exact moment into `test-results/`, and
records a full trace you can replay with `npm run report`. Paste me the
terminal output (or the screenshot) and I'll explain in plain English
what it means and whether it points to a real bug.

## Heads up

This test creates a real Firebase user and a real MongoDB order every
run (using your live Firebase project and Atlas database, since that's
what the app is wired to). The test product it creates gets removed
automatically at the end; the test orders and test user accounts are
not — feel free to clean those out of Firebase/Atlas periodically if it
bothers you.

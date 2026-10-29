// @ts-check
const { test, expect } = require("@playwright/test");
const { addToCart, shot } = require("./helpers");

/** Phone-width checks: no sideways scrolling on the main shopper screens. */
async function noHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("shopper screens fit a phone screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("11 fragrances")).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, "m1-catalog");

  await addToCart(page, "layl", "30ml", 12);
  await noHorizontalScroll(page);
  await shot(page, "m2-product");

  await page.goto("/cart");
  await expect(page.locator(".summary .grand")).toContainText("$696.00");
  await noHorizontalScroll(page);
  await shot(page, "m3-cart");

  await page.goto("/login");
  await noHorizontalScroll(page);
  await shot(page, "4-login");
});

# Wajd end-to-end tests

Seven browser tests that use the store the way people do: a guest browsing and filtering, bulk tiers merging across two adds, MOQ on sample vials, a guest sent to sign up at checkout who keeps their cart and places a cash order, cancelling it, an admin approving, dispatching and delivering an order while the buyer watches it progress, an admin creating a product (with tier validation), editing stock and archiving it, customers being kept out of admin, and a phone-width check that nothing scrolls sideways.

Nothing here touches the live site. `npm test` starts:

1. the **Firebase Auth emulator** (accounts exist only for the run),
2. `stack.js`: an **in-memory MongoDB** seeded with the real catalog, plus the API pointed at it,
3. the **Vite client** pointed at both.

## One-time setup

```
npm install
npx playwright install chromium
```

The Auth emulator needs Java 11 or newer (`java -version`).

## Run

```
npm test                  # all tests, headless
npm run test:headed       # watch them in a browser
npm run report            # open the HTML report from the last run
SHOTS=1 npm test          # also refresh ../docs/screenshots
```

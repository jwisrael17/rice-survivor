# Rice Survivor — Second Course

A responsive, standalone front-end for a fan-created Rice University Survivor fantasy game.

## Run locally

From this folder:

```bash
node server.js
```

Then visit `http://localhost:4173`.

## Add the real cast

Edit the `players` array at the top of `app.js`. The cast grid, filters, and profile modals are all rendered from those 18 objects. You can later add an `image` field and replace the numbered `.portrait` placeholder with an `<img>` element.

The scoring values live in `index.html`.

## Backend and admin

The zero-dependency Node server persists leagues to `data/leagues.json` and exposes JSON endpoints under `/api`. Creating a league returns a six-character invite code. Open `/league.html?code=ABC123` for the public dashboard and `/admin.html?code=ABC123` for the PIN-protected commissioner dashboard.

This local data store is intended for development. Before publishing publicly, move the data layer to Firebase or another hosted database and add full member authentication.

## Firebase SDK

`firebase-config.js` initializes the registered `rice-survivor` web app with Analytics, Cloud Firestore, and Firebase Authentication. The configuration object is public by design; protect Firestore with Authentication and security rules. The existing league API still uses the local Node backend until its collections and authorization rules are migrated to Firestore.

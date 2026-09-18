# Rice Survivor — Second Course

A Firebase-hosted fantasy companion for the fan-created Rice University Survivor game.

## Run locally

```bash
node server.js
```

Visit `http://localhost:4173`. Google authentication should be tested in a normal Safari or Chrome window rather than an embedded preview browser.

## Contestants

The 18 castaway records are in `contestants.js`. Portraits should be placed in `assets/contestants`. See `CONTESTANTS.md` for the exact format and an example.

## Administration

- `/admin.html?code=ABC123` is a league-specific commissioner dashboard. The league's creator can update scoring rules, season status, and team totals.
- `/site-admin.html` is the PIN-protected, site-wide dashboard. It shows every league and records official tribal results.

The site-wide PIN is verified by the `unlockSiteAdmin` Cloud Function. Successful verification creates a one-hour server-issued session. Firestore rules require that active session for all tribal-result writes.

## Deploy

Install the function dependencies once:

```bash
cd functions
npm install
cd ..
```

Sign in and save the administration PIN in Firebase Secret Manager:

```bash
firebase login
firebase functions:secrets:set ADMIN_PIN
```

Enter `6767` when prompted. Then deploy:

```bash
firebase deploy --only functions,firestore:rules,hosting
```

Cloud Functions deployment may require the Firebase project to use the Blaze billing plan.

const crypto = require("crypto");
const { initializeApp } = require("firebase-admin/app");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp();

const adminPin = defineSecret("ADMIN_PIN");
const db = getFirestore();
const maximumAttempts = 5;
const lockDurationMs = 15 * 60 * 1000;
const sessionDurationMs = 60 * 60 * 1000;

function pinsMatch(submitted, expected) {
  const submittedHash = crypto.createHash("sha256").update(submitted).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(submittedHash, expectedHash);
}

exports.unlockSiteAdmin = onCall({ secrets: [adminPin], maxInstances: 10 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in with Google first.");

  const pin = String(request.data?.pin || "");
  if (!/^\d{4}$/.test(pin)) throw new HttpsError("invalid-argument", "Enter the four-digit admin PIN.");

  const attemptRef = db.doc(`adminAttempts/${request.auth.uid}`);
  const sessionRef = db.doc(`adminSessions/${request.auth.uid}`);
  const now = Date.now();

  const outcome = await db.runTransaction(async (transaction) => {
    const attemptSnapshot = await transaction.get(attemptRef);
    const attempt = attemptSnapshot.data() || {};
    const lockedUntil = attempt.lockedUntil?.toMillis?.() || 0;

    if (lockedUntil > now) {
      return { status: "locked" };
    }

    if (!pinsMatch(pin, adminPin.value())) {
      const failures = lockedUntil <= now ? Number(attempt.failures || 0) + 1 : 1;
      transaction.set(attemptRef, {
        failures: failures >= maximumAttempts ? 0 : failures,
        lockedUntil: failures >= maximumAttempts ? Timestamp.fromMillis(now + lockDurationMs) : null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: failures >= maximumAttempts ? "locked" : "incorrect" };
    }

    const expiresAt = Timestamp.fromMillis(now + sessionDurationMs);
    transaction.delete(attemptRef);
    transaction.set(sessionRef, {
      uid: request.auth.uid,
      email: request.auth.token.email || "",
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { status: "unlocked", expiresAt: expiresAt.toMillis() };
  });

  if (outcome.status === "locked") {
    throw new HttpsError("resource-exhausted", "Too many attempts. Try again in 15 minutes.");
  }
  if (outcome.status === "incorrect") {
    throw new HttpsError("permission-denied", "Incorrect admin PIN.");
  }
  return { expiresAt: outcome.expiresAt };
});

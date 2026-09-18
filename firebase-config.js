import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics, isSupported as analyticsIsSupported } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

// Firebase web configuration is intentionally public. Access to data is
// protected by Firebase Authentication and Firestore security rules.
export const firebaseConfig = {
  apiKey: "AIzaSyAIV4XXtpFKJai8x8Gj7xwqr1t0Y6xMpxk",
  authDomain: "rice-survivor.firebaseapp.com",
  projectId: "rice-survivor",
  storageBucket: "rice-survivor.firebasestorage.app",
  messagingSenderId: "720560201215",
  appId: "1:720560201215:web:97b640865a1f06e82fdbca",
  measurementId: "G-CHP4QSXMJX",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
export const functions = getFunctions(firebaseApp);

// Analytics is unavailable in a few browser/privacy environments, so it is
// initialized defensively and never blocks the game itself.
export const analyticsReady = analyticsIsSupported()
  .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
  .catch(() => null);

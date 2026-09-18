import { auth, db, functions } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const defaultScoringRules = {
  correctBoot: 3,
  individualImmunity: 4,
  advantageFound: 2,
  surviveTribal: 1,
  makeMerge: 5,
  soleSurvivor: 15,
};

function normalizeScoringRules(values = {}) {
  return Object.fromEntries(Object.entries(defaultScoringRules).map(([key, fallback]) => {
    const value = Number(values[key] ?? fallback);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new Error("Point values must be whole numbers from 0 to 100.");
    }
    return [key, value];
  }));
}

export const observeUser = (callback) => onAuthStateChanged(auth, callback);
export const currentUser = () => auth.currentUser;
export const signOut = () => firebaseSignOut(auth);

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    const storageError = [
      "auth/missing-initial-state",
      "auth/popup-blocked",
      "auth/web-storage-unsupported",
    ].includes(error?.code) || /missing initial state|sessionStorage|storage-partitioned/i.test(error?.message || "");

    if (storageError) {
      throw new Error(
        "This browser could not complete Google sign-in. Open the site in Safari or Chrome and try again."
      );
    }
    if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") {
      throw new Error("Google sign-in was cancelled. Please try again and keep the sign-in window open.");
    }
    throw error;
  }
}

export async function requireGoogleUser() {
  if (auth.currentUser) return auth.currentUser;
  return signInWithGoogle();
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function createLeague(name, scoringRules = defaultScoringRules) {
  const user = await requireGoogleUser();
  const cleanName = String(name || "").trim().slice(0, 32);
  if (cleanName.length < 2) throw new Error("Enter a league name.");
  const cleanScoringRules = normalizeScoringRules(scoringRules);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = makeCode();
    const leagueRef = doc(db, "leagues", code);
    try {
      await runTransaction(db, async (transaction) => {
        if ((await transaction.get(leagueRef)).exists()) throw new Error("CODE_COLLISION");
        transaction.set(leagueRef, {
          code,
          name: cleanName,
          commissionerUid: user.uid,
          commissionerName: user.displayName || user.email || "Commissioner",
          status: "Preseason",
          scoringRules: cleanScoringRules,
          createdAt: serverTimestamp(),
        });
        transaction.set(doc(db, "users", user.uid, "leagues", code), {
          code,
          name: cleanName,
          role: "commissioner",
          joinedAt: serverTimestamp(),
        });
      });
      return { code, name: cleanName };
    } catch (error) {
      if (error.message !== "CODE_COLLISION") throw error;
    }
  }
  throw new Error("Could not generate a league code. Please try again.");
}

export async function joinLeague(code, teamName) {
  const user = await requireGoogleUser();
  const cleanCode = String(code || "").trim().toUpperCase();
  const cleanTeam = String(teamName || "").trim().slice(0, 32);
  if (!/^[A-Z2-9]{6}$/.test(cleanCode)) throw new Error("Enter a valid six-character invite code.");
  if (cleanTeam.length < 2) throw new Error("Enter a fantasy team name.");
  const leagueRef = doc(db, "leagues", cleanCode);
  const league = await getDoc(leagueRef);
  if (!league.exists()) throw new Error("League not found. Check the invite code.");
  await runTransaction(db, async (transaction) => {
    transaction.set(doc(db, "leagues", cleanCode, "members", user.uid), {
      uid: user.uid,
      playerName: user.displayName || user.email || "Player",
      email: user.email || "",
      teamName: cleanTeam,
      points: 0,
      joinedAt: serverTimestamp(),
    }, { merge: true });
    transaction.set(doc(db, "users", user.uid, "leagues", cleanCode), {
      code: cleanCode,
      name: league.data().name,
      role: league.data().commissionerUid === user.uid ? "commissioner" : "member",
      joinedAt: serverTimestamp(),
    }, { merge: true });
  });
  return { code: cleanCode };
}

export async function getLeague(code) {
  const snapshot = await getDoc(doc(db, "leagues", String(code).toUpperCase()));
  if (!snapshot.exists()) throw new Error("League not found.");
  return { id: snapshot.id, ...snapshot.data() };
}

export function subscribeLeague(code, callback, onError) {
  const cleanCode = String(code).toUpperCase();
  let league = null;
  let members = [];
  const emit = () => league && callback({ ...league, members });
  const stopLeague = onSnapshot(doc(db, "leagues", cleanCode), (snapshot) => {
    if (!snapshot.exists()) return onError?.(new Error("League not found."));
    league = { id: snapshot.id, ...snapshot.data() };
    emit();
  }, onError);
  const stopMembers = onSnapshot(query(collection(db, "leagues", cleanCode, "members"), orderBy("points", "desc")), (snapshot) => {
    members = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    emit();
  }, onError);
  return () => { stopLeague(); stopMembers(); };
}

export async function listMyLeagues() {
  const user = await requireGoogleUser();
  const snapshot = await getDocs(collection(db, "users", user.uid, "leagues"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function adjustMemberScore(code, memberId, delta) {
  const amount = Number(delta);
  if (!Number.isInteger(amount) || Math.abs(amount) > 100) throw new Error("Invalid score change.");
  await updateDoc(doc(db, "leagues", code, "members", memberId), { points: increment(amount) });
}

export async function setMemberScore(code, memberId, points) {
  const amount = Number(points);
  if (!Number.isInteger(amount) || amount < -9999 || amount > 99999) throw new Error("Enter a valid whole-number score.");
  await updateDoc(doc(db, "leagues", code, "members", memberId), { points: amount });
}

export async function updateScoringRules(code, scoringRules) {
  await updateDoc(doc(db, "leagues", code), { scoringRules: normalizeScoringRules(scoringRules) });
}

export async function updateLeagueStatus(code, status) {
  await updateDoc(doc(db, "leagues", code), { status: String(status).slice(0, 30) });
}

export async function unlockSiteAdmin(pin) {
  await requireGoogleUser();
  const unlock = httpsCallable(functions, "unlockSiteAdmin");
  const result = await unlock({ pin: String(pin || "") });
  return result.data;
}

export async function hasActiveAdminSession() {
  const user = auth.currentUser;
  if (!user) return false;
  const snapshot = await getDoc(doc(db, "adminSessions", user.uid));
  const expiresAt = snapshot.data()?.expiresAt;
  return snapshot.exists() && expiresAt?.toMillis?.() > Date.now();
}

export async function listAllLeagueDetails() {
  const leagues = await getDocs(collection(db, "leagues"));
  return Promise.all(leagues.docs.map(async (leagueSnapshot) => {
    const members = await getDocs(collection(db, "leagues", leagueSnapshot.id, "members"));
    return {
      id: leagueSnapshot.id,
      ...leagueSnapshot.data(),
      members: members.docs.map((member) => ({ id: member.id, ...member.data() })),
    };
  }));
}

export function subscribeTribalResults(callback, onError) {
  return onSnapshot(query(collection(db, "tribalResults"), orderBy("tribalNumber", "desc")), (snapshot) => {
    callback(snapshot.docs.map((result) => ({ id: result.id, ...result.data() })));
  }, onError);
}

export async function saveTribalResult(result) {
  const tribalNumber = Number(result.tribalNumber);
  if (!Number.isInteger(tribalNumber) || tribalNumber < 1 || tribalNumber > 99) throw new Error("Enter a valid tribal number.");
  if (!result.votedOutId) throw new Error("Choose the contestant who was voted out.");
  await setDoc(doc(db, "tribalResults", `tribal-${String(tribalNumber).padStart(2, "0")}`), {
    tribalNumber,
    votedOutId: Number(result.votedOutId),
    votedOutName: String(result.votedOutName || "").slice(0, 80),
    immunityWinnerId: result.immunityWinnerId ? Number(result.immunityWinnerId) : null,
    immunityWinnerName: String(result.immunityWinnerName || "").slice(0, 80),
    advantageFinderId: result.advantageFinderId ? Number(result.advantageFinderId) : null,
    advantageFinderName: String(result.advantageFinderName || "").slice(0, 80),
    mergeReached: Boolean(result.mergeReached),
    soleSurvivorId: result.soleSurvivorId ? Number(result.soleSurvivorId) : null,
    soleSurvivorName: String(result.soleSurvivorName || "").slice(0, 80),
    notes: String(result.notes || "").trim().slice(0, 500),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid || "",
  }, { merge: true });
}

export async function deleteTribalResult(resultId) {
  await deleteDoc(doc(db, "tribalResults", resultId));
}

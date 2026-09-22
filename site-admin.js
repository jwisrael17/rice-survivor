import { contestants } from "./contestants.js?v=20260918-3";
import {
  deleteTribalResult,
  hasActiveAdminSession,
  listAllLeagueDetails,
  observeUser,
  saveTribalResult,
  signInWithGoogle,
  subscribeTribalResults,
  unlockSiteAdmin,
} from "./firebase-data.js";

const login = document.querySelector("#site-admin-login");
const dashboard = document.querySelector("#site-admin-dashboard");
const googleButton = document.querySelector("#site-admin-google");
const pinForm = document.querySelector("#site-admin-pin-form");
const message = document.querySelector("#site-admin-message");
const tribalForm = document.querySelector("#tribal-result-form");
let results = [];
let stopResults = null;
let dashboardLoaded = false;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const contestantById = (id) => contestants.find((contestant) => contestant.id === Number(id));
const optionList = (optional = false) => `${optional ? '<option value="">None</option>' : '<option value="">Choose a contestant</option>'}${contestants.map((contestant) => `<option value="${contestant.id}">${escapeHtml(contestant.name)}</option>`).join("")}`;

tribalForm.elements.votedOutId.innerHTML = optionList();
tribalForm.elements.immunityWinnerId.innerHTML = optionList(true);
tribalForm.elements.advantageFinderId.innerHTML = optionList(true);
tribalForm.elements.soleSurvivorId.innerHTML = optionList(true);

function readableDate(timestamp) {
  return timestamp?.toDate?.().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) || "Date unavailable";
}

function renderResults(items) {
  results = items;
  const container = document.querySelector("#tribal-results-admin");
  container.innerHTML = items.length ? items.map((result) => `<article class="result-admin-card">
    <div><small>TRIBAL ${result.tribalNumber}</small><strong>${escapeHtml(result.votedOutName)} voted out</strong><span>${result.immunityWinnerName ? `${escapeHtml(result.immunityWinnerName)} won immunity` : "No immunity winner recorded"}</span></div>
    <div class="result-admin-actions"><button data-edit-result="${escapeHtml(result.id)}">Edit</button><button data-delete-result="${escapeHtml(result.id)}">Delete</button></div>
  </article>`).join("") : '<p class="empty-light">No tribal results have been recorded.</p>';
}

function renderLeagues(leagues) {
  document.querySelector("#league-count").textContent = `${leagues.length} league${leagues.length === 1 ? "" : "s"}`;
  document.querySelector("#all-leagues").innerHTML = leagues.length ? leagues.map((league) => {
    const rules = league.scoringRules || {};
    const members = [...league.members].sort((a, b) => (b.points || 0) - (a.points || 0));
    return `<details class="league-admin-card"><summary><span><strong>${escapeHtml(league.name)}</strong><small>${escapeHtml(league.code)} · ${escapeHtml(league.status)}</small></span><b>${members.length} team${members.length === 1 ? "" : "s"}</b></summary><div class="league-admin-details"><p><strong>Commissioner:</strong> ${escapeHtml(league.commissionerName)}</p><p><strong>Created:</strong> ${readableDate(league.createdAt)}</p><p><strong>Scoring:</strong> Boot ${rules.correctBoot ?? 3}, IndivImmunity ${rules.indivImmunity ?? 3}, TribeImmunity ${rules.tribeImmunity ?? 2}, Firemaking ${rules.firemakingWin ?? 3}, Journey ${rules.journeyTrip ?? 2}, IdolAdvantage ${rules.idolAdvantage ?? 2}, IdolAdvantageSuccess ${rules.idolAdvantageSuccess ?? 3}, Survive ${rules.surviveRound ?? 1}, VoteCorrectly ${rules.correctVote ?? 1}, Merge ${rules.makeMerge ?? 3}, Winner ${rules.soleSurvivor ?? 12}</p><div class="league-member-list">${members.length ? members.map((member) => `<div><span><strong>${escapeHtml(member.teamName)}</strong><small>${escapeHtml(member.playerName)}</small></span><b>${Number(member.points) || 0} pts</b></div>`).join("") : "No teams have joined."}</div><a href="/league.html?code=${encodeURIComponent(league.code)}">Open league →</a></div></details>`;
  }).join("") : '<p class="empty-light">No leagues have been created.</p>';
}

async function loadLeagues() {
  document.querySelector("#league-count").textContent = "Loading…";
  try { renderLeagues(await listAllLeagueDetails()); }
  catch (error) { document.querySelector("#all-leagues").innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`; }
}

async function openDashboard() {
  login.hidden = true;
  dashboard.hidden = false;
  if (!dashboardLoaded) {
    dashboardLoaded = true;
    stopResults = subscribeTribalResults(renderResults, (error) => { document.querySelector("#tribal-message").textContent = error.message; });
  }
  await loadLeagues();
}

observeUser(async (user) => {
  if (!user) {
    login.hidden = false; dashboard.hidden = true; googleButton.hidden = false; pinForm.hidden = true;
    return;
  }
  googleButton.hidden = true;
  document.querySelector("#admin-auth-copy").textContent = `Signed in as ${user.displayName || user.email}. Enter the admin PIN.`;
  message.textContent = "";
  try {
    if (await hasActiveAdminSession()) await openDashboard();
    else pinForm.hidden = false;
  } catch (error) { message.textContent = error.message; pinForm.hidden = false; }
});

googleButton.addEventListener("click", async () => {
  try { await signInWithGoogle(); }
  catch (error) { message.textContent = error.message; }
});

pinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.target.querySelector("button");
  button.disabled = true; message.textContent = "Checking PIN…";
  try { await unlockSiteAdmin(document.querySelector("#site-admin-pin").value); await openDashboard(); }
  catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
});

tribalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  const result = {
    ...data,
    mergeReached: event.target.elements.mergeReached.checked,
    votedOutName: contestantById(data.votedOutId)?.name || "",
    immunityWinnerName: contestantById(data.immunityWinnerId)?.name || "",
    advantageFinderName: contestantById(data.advantageFinderId)?.name || "",
    soleSurvivorName: contestantById(data.soleSurvivorId)?.name || "",
  };
  const button = event.target.querySelector("button[type='submit']");
  const status = document.querySelector("#tribal-message");
  button.disabled = true;
  try { await saveTribalResult(result); status.textContent = `Tribal ${data.tribalNumber} saved.`; event.target.reset(); }
  catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});

document.querySelector("#tribal-results-admin").addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit-result]");
  const remove = event.target.closest("[data-delete-result]");
  if (edit) {
    const result = results.find((item) => item.id === edit.dataset.editResult);
    if (!result) return;
    ["tribalNumber", "votedOutId", "immunityWinnerId", "advantageFinderId", "soleSurvivorId", "notes"].forEach((name) => { tribalForm.elements[name].value = result[name] ?? ""; });
    tribalForm.elements.mergeReached.checked = Boolean(result.mergeReached);
    tribalForm.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  if (remove) {
    if (!window.confirm("Delete this tribal result?")) return;
    try { await deleteTribalResult(remove.dataset.deleteResult); }
    catch (error) { document.querySelector("#tribal-message").textContent = error.message; }
  }
});

document.querySelector("#refresh-admin").addEventListener("click", loadLeagues);
window.addEventListener("beforeunload", () => stopResults?.());

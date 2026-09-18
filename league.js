import { currentUser, defaultScoringRules, joinLeague, observeUser, signInWithGoogle, signOut, subscribeLeague, subscribeTribalResults } from "./firebase-data.js";

const code = new URLSearchParams(location.search).get("code")?.toUpperCase();
const title = document.querySelector("#league-title");
const codeEl = document.querySelector("#league-code");
const errorEl = document.querySelector("#league-error");
const content = document.querySelector("#league-content");
const board = document.querySelector("#leaderboard");
const authButton = document.querySelector("#auth-button");
const adminLink = document.querySelector("#admin-link");
let leagueData = null;
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const scoringLabels = {
  correctBoot: "Correct weekly boot",
  individualImmunity: "Individual immunity",
  advantageFound: "Hidden advantage found",
  surviveTribal: "Survive tribal council",
  makeMerge: "Make the merge",
  soleSurvivor: "Pick the Sole Survivor",
};

function renderLeague(league) {
  leagueData = league;
  title.textContent = league.name;
  codeEl.textContent = code;
  document.querySelector("#league-status").textContent = league.status;
  content.hidden = false;
  const ranked = [...league.members].sort((a, b) => b.points - a.points);
  board.innerHTML = ranked.length ? ranked.map((member, index) => `<div class="leader-row"><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${escapeHtml(member.teamName)}</strong><small>${escapeHtml(member.playerName)}</small></span><em>${member.points} PTS</em></div>`).join("") : `<div class="empty-board">No teams yet. Be the first to join.</div>`;
  const scoringRules = { ...defaultScoringRules, ...league.scoringRules };
  document.querySelector("#league-scoring-rules").innerHTML = Object.entries(scoringLabels).map(([key, label]) => `<div><span>${label}</span><strong>+${scoringRules[key]}</strong></div>`).join("");
  const user = currentUser();
  adminLink.hidden = !user || league.commissionerUid !== user.uid;
  adminLink.href = `/admin.html?code=${code}`;
}

if (!code) errorEl.textContent = "No league code was supplied.";
else subscribeLeague(code, renderLeague, (error) => { errorEl.textContent = error.message; });

subscribeTribalResults((results) => {
  const container = document.querySelector("#league-tribal-results");
  container.innerHTML = results.length ? results.map((result) => `<article><b>${String(result.tribalNumber).padStart(2, "0")}</b><span><strong>${escapeHtml(result.votedOutName)} voted out</strong><small>${result.immunityWinnerName ? `${escapeHtml(result.immunityWinnerName)} won immunity` : "No immunity winner recorded"}${result.notes ? ` · ${escapeHtml(result.notes)}` : ""}</small></span></article>`).join("") : '<div class="empty-board">No tribal results yet.</div>';
}, (error) => { document.querySelector("#league-tribal-results").innerHTML = `<div class="dash-error">${escapeHtml(error.message)}</div>`; });

observeUser((user) => {
  authButton.textContent = user ? `Sign out · ${user.displayName || user.email}` : "Continue with Google";
  document.querySelector("#league-user-note").textContent = user ? `Signed in as ${user.displayName || user.email}` : "Google sign-in required";
  if (leagueData) renderLeague(leagueData);
});

authButton.addEventListener("click", async () => { try { if (currentUser()) await signOut(); else await signInWithGoogle(); } catch (error) { errorEl.textContent = error.message; } });
document.querySelector("#copy-code").addEventListener("click", async () => { await navigator.clipboard.writeText(code); document.querySelector("#copy-code").lastChild.textContent = " ✓"; });
document.querySelector("#member-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const message = document.querySelector("#member-message");
  try { await joinLeague(code, document.querySelector("#team-name").value); message.textContent = "You're in. Your Google account will remember this league."; event.target.reset(); }
  catch (error) { message.textContent = error.message; }
});

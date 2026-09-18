import {
  adjustMemberScore,
  defaultScoringRules,
  getLeague,
  observeUser,
  setMemberScore,
  signInWithGoogle,
  subscribeLeague,
  updateLeagueStatus,
  updateScoringRules,
} from "./firebase-data.js";

const code = new URLSearchParams(location.search).get("code")?.toUpperCase() || "";
const loginCard = document.querySelector("#login-card");
const dashboard = document.querySelector("#admin-dashboard");
const message = document.querySelector("#login-message");
const scoringForm = document.querySelector("#scoring-rules-form");
document.querySelector("#back-link").href = code ? `/league.html?code=${code}` : "/";
let stopLeague = null;
let scoringFormInitialized = false;

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function renderMembers(members) {
  const table = document.querySelector("#admin-table");
  table.innerHTML = members.length
    ? `<div class="admin-row admin-row-head"><span>TEAM / PLAYER</span><span>SCORE</span><span>ADJUST</span></div>${[...members].sort((a, b) => b.points - a.points).map((member) => `<div class="admin-row"><span><strong>${escapeHtml(member.teamName)}</strong><small>${escapeHtml(member.playerName)}</small></span><label class="score-total"><span class="visually-hidden">Score for ${escapeHtml(member.teamName)}</span><input type="number" value="${Number(member.points) || 0}" data-score-input="${escapeHtml(member.id)}"><button data-set-score="${escapeHtml(member.id)}">Save</button></label><span class="score-actions"><button data-id="${escapeHtml(member.id)}" data-delta="-1" title="Subtract one point">−</button><button data-id="${escapeHtml(member.id)}" data-delta="1" title="Add one point">+</button></span></div>`).join("")}`
    : `<div class="empty-board">No one has joined this league yet.</div>`;
}

function renderScoringRules(rules) {
  if (scoringFormInitialized) return;
  const values = { ...defaultScoringRules, ...rules };
  Object.entries(values).forEach(([key, value]) => {
    if (scoringForm.elements[key]) scoringForm.elements[key].value = value;
  });
  scoringFormInitialized = true;
}

async function authorize(user) {
  if (!user || !code) { loginCard.hidden = false; dashboard.hidden = true; return; }
  try {
    const league = await getLeague(code);
    if (league.commissionerUid !== user.uid) throw new Error("This Google account is not the commissioner of this league.");
    loginCard.hidden = true; dashboard.hidden = false; message.textContent = "";
    document.querySelector("#admin-title").textContent = league.name;
    document.querySelector("#status-select").value = league.status;
    stopLeague?.();
    stopLeague = subscribeLeague(code, (liveLeague) => {
      document.querySelector("#status-select").value = liveLeague.status;
      renderScoringRules(liveLeague.scoringRules);
      renderMembers(liveLeague.members);
    }, (error) => { message.textContent = error.message; });
  } catch (error) { loginCard.hidden = false; dashboard.hidden = true; message.textContent = error.message; }
}

observeUser(authorize);
document.querySelector("#admin-login").addEventListener("click", async () => { try { await signInWithGoogle(); } catch (error) { message.textContent = error.message; } });

document.querySelector("#admin-table").addEventListener("click", async (event) => {
  const adjustButton = event.target.closest("[data-id]");
  const saveButton = event.target.closest("[data-set-score]");
  const button = adjustButton || saveButton;
  if (!button) return;
  button.disabled = true;
  try {
    if (adjustButton) await adjustMemberScore(code, adjustButton.dataset.id, Number(adjustButton.dataset.delta));
    if (saveButton) {
      const input = document.querySelector(`[data-score-input="${CSS.escape(saveButton.dataset.setScore)}"]`);
      await setMemberScore(code, saveButton.dataset.setScore, input.value);
    }
    message.textContent = "";
  } catch (error) { message.textContent = error.message; button.disabled = false; }
});

scoringForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = event.target.querySelector("button[type='submit']");
  const scoringMessage = document.querySelector("#scoring-message");
  submit.disabled = true;
  try {
    await updateScoringRules(code, Object.fromEntries([...new FormData(event.target).entries()].map(([key, value]) => [key, Number(value)])));
    scoringMessage.textContent = "Point values saved.";
  } catch (error) { scoringMessage.textContent = error.message; }
  finally { submit.disabled = false; }
});

document.querySelector("#status-select").addEventListener("change", async (event) => {
  try { await updateLeagueStatus(code, event.target.value); }
  catch (error) { message.textContent = error.message; }
});

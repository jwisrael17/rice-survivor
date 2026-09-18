import {
  createLeague,
  joinLeague,
  listMyLeagues,
  observeUser,
  signInWithGoogle,
  signOut,
} from "./firebase-data.js";
import { contestants as players } from "./contestants.js?v=20260918-3";

const grid = document.querySelector("#cast-grid");
const playerModal = document.querySelector("#player-modal");
const modalContent = document.querySelector("#player-modal-content");
const createModal = document.querySelector("#create-modal");
const joinLeagueModal = document.querySelector("#join-league-modal");
const myLeaguesModal = document.querySelector("#my-leagues-modal");
const authButton = document.querySelector("#auth-button");
const myLeaguesButton = document.querySelector("#my-leagues-button");
let signedInUser = null;

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function renderCast() {
  grid.innerHTML = players.map((player) => `
    <button class="cast-card" style="--card-color:#116a8d" data-player="${player.id}" aria-label="View ${player.name}'s profile">
      <span class="portrait">${String(player.id).padStart(2, "0")}</span>
      ${player.photo ? `<img class="portrait-photo" src="${escapeHtml(player.photo)}" alt="${escapeHtml(player.name)}" onerror="this.hidden=true">` : ""}
      <span class="cast-meta"><small>Season 02 castaway</small><strong>${escapeHtml(player.name)}</strong></span>
    </button>`).join("");
}

function openPlayer(id) {
  const player = players.find((item) => item.id === id);
  if (!player) return;
  const art = `<span>${String(player.id).padStart(2, "0")}</span>${player.photo ? `<img class="profile-photo" src="${escapeHtml(player.photo)}" alt="${escapeHtml(player.name)}" onerror="this.hidden=true">` : ""}`;
  modalContent.innerHTML = `<div class="profile-layout"><div class="profile-art" style="--card-color:#116a8d">${art}</div><div class="profile-copy"><span class="tribe">Season 02 · castaway ${String(player.id).padStart(2, "0")}</span><h2>${escapeHtml(player.name)}</h2><div class="profile-facts"><div><small>Residential college</small><strong>${escapeHtml(player.college)}</strong></div><div><small>Year / major</small><strong>${escapeHtml(player.year)} · ${escapeHtml(player.major)}</strong></div></div><p>${escapeHtml(player.bio)}</p></div></div>`;
  playerModal.showModal();
}

function updateAuthUi(user) {
  signedInUser = user;
  authButton.textContent = user ? `Sign out · ${user.displayName || user.email}` : "Continue with Google";
  myLeaguesButton.hidden = !user;
  const note = user ? `Signed in as ${user.displayName || user.email}` : "Google sign-in required";
  document.querySelector("#create-user-note").textContent = note;
  document.querySelector("#join-user-note").textContent = note;
}

renderCast();
observeUser(updateAuthUi);

grid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-player]");
  if (card) openPlayer(Number(card.dataset.player));
});

document.querySelectorAll(".open-create-league").forEach((button) => button.addEventListener("click", () => createModal.showModal()));
document.querySelectorAll(".open-join-league").forEach((button) => button.addEventListener("click", () => joinLeagueModal.showModal()));
document.querySelectorAll(".modal-close").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => event.target === dialog && dialog.close()));

authButton.addEventListener("click", async () => {
  try { if (signedInUser) await signOut(); else await signInWithGoogle(); }
  catch (error) { alert(error.message); }
});

myLeaguesButton.addEventListener("click", async () => {
  const list = document.querySelector("#my-leagues-list");
  list.innerHTML = "<p>Loading…</p>";
  myLeaguesModal.showModal();
  try {
    const leagues = await listMyLeagues();
    list.innerHTML = leagues.length ? leagues.map((league) => `<a href="/league.html?code=${encodeURIComponent(league.code)}"><strong>${escapeHtml(league.name)}</strong><span>${league.role} · ${league.code} →</span></a>`).join("") : "<p>You have not joined a league yet.</p>";
  } catch (error) { list.innerHTML = `<p>${escapeHtml(error.message)}</p>`; }
});

document.querySelector("#join-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector(".success-message");
  const submit = event.target.querySelector("button[type='submit']");
  submit.disabled = true; submit.textContent = signedInUser ? "Creating…" : "Opening Google…";
  try {
    const formData = new FormData(event.target);
    const scoringRules = Object.fromEntries(
      [...formData.entries()].filter(([key]) => key !== "leagueName").map(([key, value]) => [key, Number(value)])
    );
    const result = await createLeague(document.querySelector("#league-name").value, scoringRules);
    window.location.href = `/league.html?code=${result.code}`;
  } catch (error) {
    message.textContent = error.message; submit.disabled = false; submit.innerHTML = "Create league <span>↗</span>";
  }
});

document.querySelector("#join-league-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = document.querySelector("#invite-code").value.trim().toUpperCase();
  const message = document.querySelector(".join-league-message");
  const submit = event.target.querySelector("button[type='submit']");
  submit.disabled = true; submit.textContent = signedInUser ? "Joining…" : "Opening Google…";
  try {
    await joinLeague(code, document.querySelector("#join-team-name").value);
    window.location.href = `/league.html?code=${encodeURIComponent(code)}`;
  } catch (error) {
    message.textContent = error.message; submit.disabled = false; submit.innerHTML = "Join league <span>↗</span>";
  }
});

document.querySelector(".switch-flow").addEventListener("click", () => { joinLeagueModal.close(); createModal.showModal(); });
const menuButton = document.querySelector(".menu-button");
const nav = document.querySelector(".nav-links");
menuButton.addEventListener("click", () => { const open = nav.classList.toggle("open"); menuButton.setAttribute("aria-expanded", String(open)); menuButton.textContent = open ? "×" : "☰"; });
nav.addEventListener("click", (event) => { if (event.target.tagName === "A") { nav.classList.remove("open"); menuButton.setAttribute("aria-expanded", "false"); menuButton.textContent = "☰"; } });
const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("visible")), { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

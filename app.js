import "./firebase-config.js";

// Replace these placeholder objects with the real season-two cast.
// Keep the same field names and the page will update automatically.
const players = Array.from({ length: 18 }, (_, index) => ({
  id: index + 1,
  name: `Player ${String(index + 1).padStart(2, "0")}`,
  firstName: `Player ${String(index + 1).padStart(2, "0")}`,
  tribe: index < 9 ? "blue" : "gold",
  college: ["Baker", "Brown", "Duncan", "Hanszen", "Jones", "Lovett", "McMurtry", "Martel", "Sid Richardson"][index % 9],
  major: ["Architecture", "Biosciences", "Computer Science", "Economics", "English", "Engineering"][index % 6],
  year: ["Sophomore", "Junior", "Senior"][index % 3],
  bio: "Castaway bio placeholder. Add a short introduction, strategic outlook, and one fun campus detail here.",
}));

const grid = document.querySelector("#cast-grid");
const playerModal = document.querySelector("#player-modal");
const modalContent = document.querySelector("#player-modal-content");
const createModal = document.querySelector("#create-modal");
const joinLeagueModal = document.querySelector("#join-league-modal");

function renderCast(filter = "all") {
  const visiblePlayers = filter === "all" ? players : players.filter((player) => player.tribe === filter);
  grid.innerHTML = visiblePlayers.map((player) => `
    <button class="cast-card" style="--card-color:${player.tribe === "blue" ? "#116a8d" : "#8b6518"}" data-player="${player.id}" aria-label="View ${player.name}'s profile">
      <span class="portrait">${String(player.id).padStart(2, "0")}</span>
      <span class="cast-meta"><small>${player.tribe} tribe · ${player.college}</small><strong>${player.firstName}</strong></span>
    </button>`).join("");
}

function openPlayer(id) {
  const player = players.find((item) => item.id === id);
  if (!player) return;
  const color = player.tribe === "blue" ? "#116a8d" : "#8b6518";
  modalContent.innerHTML = `
    <div class="profile-layout">
      <div class="profile-art" style="--card-color:${color}">${String(player.id).padStart(2, "0")}</div>
      <div class="profile-copy">
        <span class="tribe">${player.tribe} tribe · castaway ${String(player.id).padStart(2, "0")}</span>
        <h2>${player.name}</h2>
        <div class="profile-facts">
          <div><small>Residential college</small><strong>${player.college}</strong></div>
          <div><small>Year / major</small><strong>${player.year} · ${player.major}</strong></div>
        </div>
        <p>${player.bio}</p>
      </div>
    </div>`;
  playerModal.showModal();
}

renderCast();

grid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-player]");
  if (card) openPlayer(Number(card.dataset.player));
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderCast(button.dataset.filter);
  });
});

document.querySelectorAll(".open-create-league").forEach((button) => button.addEventListener("click", () => createModal.showModal()));
document.querySelectorAll(".open-join-league").forEach((button) => button.addEventListener("click", () => joinLeagueModal.showModal()));
document.querySelectorAll(".modal-close").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
}));

document.querySelector("#join-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.querySelector("#league-name").value.trim();
  const ownerName = document.querySelector("#owner-name").value.trim();
  const adminPin = document.querySelector("#admin-pin").value;
  const message = document.querySelector(".success-message");
  const submit = event.target.querySelector("button[type='submit']");
  submit.disabled = true;
  submit.textContent = "Creating…";
  try {
    const response = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ownerName, adminPin }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not create league");
    localStorage.setItem(`rice-survivor-admin-${result.code}`, "true");
    window.location.href = `/league.html?code=${result.code}`;
  } catch (error) {
    message.textContent = error.message;
    submit.disabled = false;
    submit.innerHTML = "Create league <span>↗</span>";
  }
});

document.querySelector("#join-league-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = document.querySelector("#invite-code").value.trim().toUpperCase();
  const playerName = document.querySelector("#join-player-name").value.trim();
  const teamName = document.querySelector("#join-team-name").value.trim();
  const message = document.querySelector(".join-league-message");
  const submit = event.target.querySelector("button[type='submit']");
  submit.disabled = true;
  submit.textContent = "Joining…";
  try {
    const response = await fetch(`/api/leagues/${encodeURIComponent(code)}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName, teamName }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not join league");
    localStorage.setItem(`rice-survivor-member-${code}`, result.id);
    window.location.href = `/league.html?code=${encodeURIComponent(code)}`;
  } catch (error) {
    message.textContent = error.message;
    submit.disabled = false;
    submit.innerHTML = "Join league <span>↗</span>";
  }
});

document.querySelector(".switch-flow").addEventListener("click", () => {
  joinLeagueModal.close();
  createModal.showModal();
});

const menuButton = document.querySelector(".menu-button");
const nav = document.querySelector(".nav-links");
menuButton.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.textContent = open ? "×" : "☰";
});
nav.addEventListener("click", (event) => {
  if (event.target.tagName === "A") {
    nav.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.textContent = "☰";
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("visible"));
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

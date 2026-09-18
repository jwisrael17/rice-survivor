import "./firebase-config.js";

const code = new URLSearchParams(location.search).get("code")?.toUpperCase();
const title = document.querySelector("#league-title"); const codeEl = document.querySelector("#league-code"); const errorEl = document.querySelector("#league-error");
const content = document.querySelector("#league-content"); const board = document.querySelector("#leaderboard");
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
async function loadLeague() {
  if (!code) { errorEl.textContent = "No league code was supplied."; return; }
  try { const response = await fetch(`/api/leagues/${code}`); const league = await response.json(); if (!response.ok) throw new Error(league.error);
    title.textContent = league.name; codeEl.textContent = league.code; document.querySelector("#league-status").textContent = league.status; document.querySelector("#admin-link").href = `/admin.html?code=${code}`; content.hidden = false;
    const ranked = [...league.members].sort((a,b) => b.points-a.points);
    board.innerHTML = ranked.length ? ranked.map((member,index)=>`<div class="leader-row"><b>${String(index+1).padStart(2,"0")}</b><span><strong>${escapeHtml(member.teamName)}</strong><small>${escapeHtml(member.playerName)}</small></span><em>${member.points} PTS</em></div>`).join("") : `<div class="empty-board">No teams yet. Be the first to join.</div>`;
  } catch (error) { errorEl.textContent = error.message; }
}
document.querySelector("#copy-code").addEventListener("click", async()=>{ await navigator.clipboard.writeText(code); document.querySelector("#copy-code").lastChild.textContent=" ✓"; });
document.querySelector("#member-form").addEventListener("submit",async(event)=>{event.preventDefault();const message=document.querySelector("#member-message");try{const response=await fetch(`/api/leagues/${code}/members`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({playerName:document.querySelector("#player-name").value,teamName:document.querySelector("#team-name").value})});const result=await response.json();if(!response.ok)throw new Error(result.error);localStorage.setItem(`rice-survivor-member-${code}`,result.id);event.target.reset();message.textContent="You're in. Welcome to the league.";await loadLeague();}catch(error){message.textContent=error.message;}});
loadLeague();

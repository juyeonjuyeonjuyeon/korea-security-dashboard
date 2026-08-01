const $ = id => document.getElementById(id);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
}[character]));
const safeUrl = (value = "") => { try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : "#"; } catch { return "#"; } };
const readerUrl = (value = "") => { const url=safeUrl(value); return url==="#"?"#":`./reader.html?url=${encodeURIComponent(url)}`; };
let filter = "all";

function render() {
  const query = $("scrapSearch").value.trim().toLowerCase();
  const all = JuyeonBookmarks.all();
  const items = all.filter(item => (filter === "all" || item.section === filter)
    && (!query || `${item.title} ${item.source} ${item.topic}`.toLowerCase().includes(query)));
  $("scrapCount").textContent = `${all.length}건 저장`;
  $("scrapResult").textContent = query || filter !== "all" ? `검색 결과 ${items.length}건` : "최근 저장순";
  $("scrapList").innerHTML = items.length ? items.map(item => `
    <article class="scrap-row">
      <div class="scrap-meta">
        <span>${item.section === "tech" ? "기술" : "안보"}</span>
        <time>${escapeHtml(item.date || item.savedAt.slice(0, 10))}</time>
        <b>${escapeHtml(item.source)}</b>
      </div>
      <a href="${readerUrl(item.url)}">${escapeHtml(item.title)}</a>
      <small>${escapeHtml(item.topic || (item.section === "tech" ? "기술 트렌드" : "한반도 안보"))}</small>
      <button class="bookmark-button saved" type="button" data-remove-url="${escapeHtml(item.url)}" aria-label="스크랩에서 삭제" title="스크랩에서 삭제">★</button>
    </article>`).join("") : `<div class="scrap-empty"><strong>저장한 기사가 없습니다.</strong><p>안보면이나 기술면 뉴스 오른쪽의 ☆ 버튼을 누르면 이곳에 저장됩니다.</p></div>`;
}

$("scrapSearch").addEventListener("input", render);
document.querySelectorAll("[data-scrap-filter]").forEach(button => button.addEventListener("click", () => {
  filter = button.dataset.scrapFilter;
  document.querySelectorAll("[data-scrap-filter]").forEach(item => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  render();
}));
$("scrapList").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-url]");
  if (button) JuyeonBookmarks.remove(button.dataset.removeUrl);
});
$("exportScraps").addEventListener("click", () => JuyeonBookmarks.export());
$("importScraps").addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{JuyeonBookmarks.import(JSON.parse(await file.text()));alert("스크랩을 복원했습니다.")}catch(error){alert(error.message||"스크랩 복원에 실패했습니다.")}
  event.target.value="";
});
$("clearScraps").addEventListener("click", () => {
  if (JuyeonBookmarks.count() && confirm("이 브라우저에 저장한 스크랩을 모두 삭제할까요?")) JuyeonBookmarks.clear();
});
window.addEventListener("juyeonbookmarkschange", render);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js?v=29");
render();

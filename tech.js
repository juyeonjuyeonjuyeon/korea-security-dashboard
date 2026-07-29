const $ = id => document.getElementById(id);
const escapeHtml = (value="") => String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const safeUrl = (value="") => { try { const url=new URL(value); return /^https?:$/.test(url.protocol)?url.href:"#"; } catch { return "#"; } };
const fallback = {updatedAt:"자동 갱신 전",headline:"최신 기술 흐름을 불러오고 있습니다.",metrics:{articleCount:0,recentCount:0,sourceCount:0},summary:["새 자료 확인 중"],categories:[],news:[],sourceHealth:{successful:0,total:0}};
const bookmarkRegistry=new Map();
const bookmarkButton=item=>{
  bookmarkRegistry.set(item.url,{url:item.url,title:item.titleKo||item.title,source:item.source||"Unknown",date:item.date||"",section:"tech",topic:item.category||"기술 트렌드",confidence:item.confidence||""});
  const saved=JuyeonBookmarks.has(item.url);
  return `<button class="bookmark-button ${saved?"saved":""}" type="button" data-bookmark-url="${escapeHtml(item.url)}" aria-label="${saved?"스크랩에서 삭제":"스크랩에 저장"}" aria-pressed="${saved}" title="${saved?"저장됨":"스크랩"}">${saved?"★":"☆"}</button>`;
};
function syncBookmarkUi(){
  document.querySelectorAll(".bookmark-count").forEach(node=>node.textContent=JuyeonBookmarks.count());
  document.querySelectorAll("[data-bookmark-url]").forEach(button=>{const saved=JuyeonBookmarks.has(button.dataset.bookmarkUrl);button.classList.toggle("saved",saved);button.textContent=saved?"★":"☆";button.setAttribute("aria-pressed",String(saved));button.setAttribute("aria-label",saved?"스크랩에서 삭제":"스크랩에 저장")});
}

function render(data){
  bookmarkRegistry.clear();
  $("techUpdatedAt").textContent=`UPDATED ${data.updatedAt||"—"}`;
  $("techHeadline").textContent=data.headline||fallback.headline;
  $("techArticleCount").textContent=data.metrics?.articleCount??0;
  $("techRecentCount").textContent=data.metrics?.recentCount??0;
  $("techSourceCount").textContent=data.metrics?.sourceCount??0;
  if($("techRadarMode")) $("techRadarMode").textContent=`${data.sourceHealth?.mode||data.updateMode||"공식 채널 매시간 점검"} · 공식 출처 ${data.sourceHealth?.officialSources??data.metrics?.officialCount??0}곳`;
  $("techSummary").innerHTML=(data.summary||fallback.summary).map(item=>`<li>${escapeHtml(item)}</li>`).join("");
  const deferred=data.sourceHealth?.deferred||[];
  $("techSourceHealth").textContent=`수집 ${data.sourceHealth?.successful||0}/${data.sourceHealth?.total||0} · 공식·직접 경로 ${data.sourceHealth?.configuredTotal||data.sourceHealth?.total||0} · 기사 ${data.metrics?.articleCount||0}${deferred.length?` · 격주 자료 유지: ${deferred.join(", ")}`:""}`;
  $("techCategories").innerHTML=(data.categories||[]).map(item=>`<article class="tech-category-card">
    <header><span>${escapeHtml(item.code)}</span><b>${item.count}건</b></header>
    <h3>${escapeHtml(item.label)}</h3>
    <p>${escapeHtml(item.summary)}</p>
    <div class="tech-tags">${(item.themes||[]).map(tag=>`<span>${escapeHtml(tag)}</span>`).join("")}</div>
    <small>${escapeHtml(item.cadence||"매일")} 갱신 · 최근 확인 ${escapeHtml(item.latest||"—")}</small>
  </article>`).join("")||`<p class="empty-state">분야별 자료 확인 중</p>`;
  $("techNews").innerHTML=(data.news||[]).map(item=>`<article class="news-item tech-news-item bookmarkable">
    <time>${escapeHtml(item.date||"—")}</time><span class="tech-topic">${escapeHtml(item.category||"기술")}</span>
    <span class="news-source">${escapeHtml(item.source||"Unknown")}</span><a class="news-title" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.titleKo||item.title)}</a>
    <span class="tech-row-tags">${(item.themes||[]).map(tag=>`<i>${escapeHtml(tag)}</i>`).join("")}</span>
    <span class="source-badge ${escapeHtml(item.confidence||"C")}">${escapeHtml(item.confidence||"C")}</span>
    ${bookmarkButton(item)}
  </article>`).join("")||`<div class="news-item">새 기술 뉴스 없음</div>`;
  const radarItem=item=>`<article class="radar-item bookmarkable">
    <div><span class="radar-type">${escapeHtml(item.type||"업데이트")}</span><span class="source-badge ${escapeHtml(item.confidence||"C")}">${escapeHtml(item.confidence||"C")}</span></div>
    <a href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.titleKo||item.title)}</a>
    <small>${escapeHtml(item.source||"출처 미상")} · ${escapeHtml(item.date||"시각 미상")}</small>
    ${bookmarkButton(item)}
  </article>`;
  const fillRadar=(id,items,empty)=>{$(id).innerHTML=(items||[]).slice(0,6).map(radarItem).join("")||`<p class="empty-state">${empty}</p>`};
  fillRadar("techReleases",data.radar?.releases,"확인된 새 출시 없음");
  fillRadar("techCreative",data.radar?.creative,"새 창작 AI 변화 없음");
  fillRadar("techOpportunities",data.radar?.opportunities,"확인된 무료 행사 없음");
  fillRadar("techVoices",data.radar?.voices,"확인된 주요 발언 없음");
  syncBookmarkUi();
}
async function load(){
  try{
    const response=await fetch(`./data/tech.json?t=${Date.now()}`,{cache:"no-store"});
    if(!response.ok) throw Error("data");
    render(await response.json());
  }catch{render(fallback)}
}
$("techRefreshButton").addEventListener("click",load);
document.addEventListener("click",event=>{const button=event.target.closest("[data-bookmark-url]");if(button){const item=bookmarkRegistry.get(button.dataset.bookmarkUrl);if(item)JuyeonBookmarks.toggle(item)}});
window.addEventListener("juyeonbookmarkschange",syncBookmarkUi);
if("serviceWorker"in navigator) navigator.serviceWorker.register("./sw.js?v=23");
load();
window.addEventListener("pageshow",event=>{if(event.persisted)load()});

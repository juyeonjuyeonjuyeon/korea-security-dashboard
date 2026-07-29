const $ = id => document.getElementById(id);
const escapeHtml = (value="") => String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const safeUrl = (value="") => { try { const url=new URL(value); return /^https?:$/.test(url.protocol)?url.href:"#"; } catch { return "#"; } };
const fallback = {updatedAt:"자동 갱신 전",headline:"최신 기술 흐름을 불러오고 있습니다.",metrics:{articleCount:0,recentCount:0,sourceCount:0},summary:["새 자료 확인 중"],categories:[],news:[],sourceHealth:{successful:0,total:0}};

function render(data){
  $("techUpdatedAt").textContent=`UPDATED ${data.updatedAt||"—"}`;
  $("techHeadline").textContent=data.headline||fallback.headline;
  $("techArticleCount").textContent=data.metrics?.articleCount??0;
  $("techRecentCount").textContent=data.metrics?.recentCount??0;
  $("techSourceCount").textContent=data.metrics?.sourceCount??0;
  $("techSummary").innerHTML=(data.summary||fallback.summary).map(item=>`<li>${escapeHtml(item)}</li>`).join("");
  const deferred=data.sourceHealth?.deferred||[];
  $("techSourceHealth").textContent=`수집 ${data.sourceHealth?.successful||0}/${data.sourceHealth?.total||0} · 전체 분야 ${data.sourceHealth?.configuredTotal||data.sourceHealth?.total||0} · 기사 ${data.metrics?.articleCount||0}${deferred.length?` · 격주 자료 유지: ${deferred.join(", ")}`:""}`;
  $("techCategories").innerHTML=(data.categories||[]).map(item=>`<article class="tech-category-card">
    <header><span>${escapeHtml(item.code)}</span><b>${item.count}건</b></header>
    <h3>${escapeHtml(item.label)}</h3>
    <p>${escapeHtml(item.summary)}</p>
    <div class="tech-tags">${(item.themes||[]).map(tag=>`<span>${escapeHtml(tag)}</span>`).join("")}</div>
    <small>${escapeHtml(item.cadence||"매일")} 갱신 · 최근 확인 ${escapeHtml(item.latest||"—")}</small>
  </article>`).join("")||`<p class="empty-state">분야별 자료 확인 중</p>`;
  $("techNews").innerHTML=(data.news||[]).map(item=>`<a class="news-item tech-news-item" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">
    <time>${escapeHtml(item.date||"—")}</time><span class="tech-topic">${escapeHtml(item.category||"기술")}</span>
    <span class="news-source">${escapeHtml(item.source||"Unknown")}</span><span class="news-title">${escapeHtml(item.titleKo||item.title)}</span>
    <span class="tech-row-tags">${(item.themes||[]).map(tag=>`<i>${escapeHtml(tag)}</i>`).join("")}</span>
    <span class="source-badge ${escapeHtml(item.confidence||"C")}">${escapeHtml(item.confidence||"C")}</span>
  </a>`).join("")||`<div class="news-item">새 기술 뉴스 없음</div>`;
}
async function load(){
  try{
    const response=await fetch(`./data/tech.json?t=${Date.now()}`,{cache:"no-store"});
    if(!response.ok) throw Error("data");
    render(await response.json());
  }catch{render(fallback)}
}
$("techRefreshButton").addEventListener("click",load);
if("serviceWorker"in navigator) navigator.serviceWorker.register("./sw.js?v=20");
load();
window.addEventListener("pageshow",event=>{if(event.persisted)load()});

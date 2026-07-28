const $ = id => document.getElementById(id);
const signalDefinitions = [
  ["field_hospital","야전병원","전방 야전병원 설치와 혈액·의약품 이동은 지속 작전 준비를 판단하는 보조 신호입니다.",/hospital|medical|blood/i],
  ["ammunition_movement","탄약 이동","탄약·연료가 평시 범위를 넘어 전방으로 집중되는지 확인합니다.",/ammunition|munition|fuel/i],
  ["military_train","군용열차","전차·포병·발사대 등을 실은 군용열차가 비정상적으로 증가하는지 봅니다.",/train|equipment|launcher/i],
  ["kim_activity","김정은 공개활동","공개활동 중단과 전시 지휘시설 관련 동향을 봅니다. 단독 신호로 판단하지 않습니다.",/kim jong un|kim calls|kim supervises/i],
  ["resident_control","주민 이동통제","접경지역 소개, 도시 봉쇄, 철도·도로 통제 여부입니다.",/resident|lockdown|movement restriction/i],
  ["china_border_closure","중국 국경","북중 국경 폐쇄, 중국군 이동, 중국인 귀국 권고 여부입니다.",/china|chinese|border/i],
  ["russia_cooperation","북러 군사협력","북한 병력·무기 지원과 러시아의 기술·물자 제공 확대 여부입니다.",/russia|russian|ukraine/i],
  ["airline_change","항공사 운항","외국 항공사의 한국 노선 취소·축소가 동시에 나타나는지 봅니다.",/airline|flight|aviation/i],
  ["war_insurance","전쟁보험","한국 관련 선박·항공 전쟁위험 보험료의 비정상적 변화를 확인합니다.",/insurance|shipping|war risk/i],
  ["embassy_withdrawal","외국 대사관","비필수 인력·가족 철수나 공관 폐쇄는 강한 후기 경보 신호입니다.",/embassy|diplomat|evacuation|withdrawal/i]
];
const combinationDefinitions = [
  ["포병 + 탄약","포병 배치와 전투 탄약 이동이 동시에 확인되는지 봅니다.",/artillery|ammunition|munition/i],
  ["야전병원 + 병력","야전 의료체계와 대규모 병력 이동이 겹치는지 봅니다.",/hospital|medical|troop|deployment/i],
  ["대사관 + 항공편","공관 철수와 민간 항공편 중단이 함께 나타나는지 봅니다.",/embassy|evacuation|airline|flight/i],
  ["지도부 은신 + 미사일","지도부 활동 중단과 전략 미사일 분산이 동시에 확인되는지 봅니다.",/leadership|kim jong un|missile/i],
  ["중국 국경 + 병력","중국의 국경 통제와 접경 병력 증강이 겹치는지 봅니다.",/china|border|troop/i]
];
const coreDefinitions = [
  ["북한 병력이동","전방 병력·장비의 평시 범위를 벗어난 이동 여부입니다.",/troop|equipment|deployment/i],
  ["중국 움직임","북중 국경과 중국 측 비상 대응 변화를 종합합니다.",/china|chinese|border/i],
  ["외국 대사관","공관 운영 축소, 여행경보, 철수 조치를 함께 봅니다.",/embassy|diplomat|travel warning|evacuation/i],
  ["북한 군사활동","미사일·포병·해군·공군 활동의 추세 변화입니다.",/military|missile|artillery|naval/i],
  ["주한미군","비전투원·가족의 실제 출국 또는 대피 명령 여부입니다.",/USFK|noncombatant|military families/i]
];
const statusMeta = {
  normal:["정상","normal"],attention:["주의","attention"],warning:["경계","warning"],danger:["위험","danger"],
  watch:["주의","attention"],alert:["위험","danger"],unknown:["검토중","normal"]
};
const fallback = {
  updatedAt:"자동 갱신 전",risk:{score:0,level:"평상시",trend7:[0],reason:"확인된 복합 위험신호가 없습니다."},
  summary:{added:0,cleared:0,statusChange:"동일",items:["새 위험신호 없음","대사관 변화 없음","주한미군 변화 없음"]},
  officialAlert:{status:"현재 긴급 경보 없음",level:"normal",checkedAt:"—"},signals:[],combinations:[],coreSignals:[],news:[],relatedInfo:[],rumors:[]
};
let latestData=fallback, historyData=[], activeRange=7;
const escapeHtml=(value="")=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const safeUrl=(value="")=>{try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.href:"#"}catch{return"#"}};
const itemState=item=>statusMeta[item?.[2]]||statusMeta.normal;
const sourceRank=source=>/합참|국방부|IAEA|MSMT|state|defense|인도태평양|FCDO|ICAO|IMO|CTBTO|USGS|일본 방위성|NOTAM/i.test(source)?0:/Reuters/i.test(source)?1:/AP|Associated/i.test(source)?2:/BBC|AFP|WSJ|Yonhap|연합뉴스|YTN|KBS|MBC|SBS|Newsis|뉴시스/i.test(source)?3:/38 North|Beyond Parallel|CSIS|RUSI|IISS|NK News|RFA|Radio Free Asia|VOA|Voice of America|Daily NK|Asia Press/i.test(source)?4:9;
const matchNews=(data,pattern)=>(data.news||[]).filter(item=>pattern.test(`${item.title} ${item.titleKo||""}`)).slice(0,2);

function sourceLinks(news){
  return news.length?news.map(item=>`<a href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">[${escapeHtml(item.confidence||"D")}] ${escapeHtml(item.titleKo||item.title)}</a>`).join(""):`<span>연결된 근거 없음 · 상태 변경 미반영</span>`;
}
function detailPopover(description,news,data){
  const confidence=news.some(n=>n.confidence==="A")?"A · 공식":new Set(news.filter(n=>["A","B"].includes(n.confidence)).map(n=>n.source)).size>=2?"B · 복수 확인":news.length?"C · 단일/전문 분석":"D · 미확인";
  return `<aside class="detail-popover"><p>${escapeHtml(description)}</p><p>신뢰도 ${confidence} · 확인 ${escapeHtml(data.updatedAt||"—")}</p>${sourceLinks(news)}</aside>`;
}
function signalCards(data){
  return signalDefinitions.map((def,index)=>{
    const [id,title,description,pattern]=def;
    const old=(data.signals||[])[index];
    const forced=data.signalStatus?.[id];
    const [label,state]=forced?statusMeta[forced]||statusMeta.normal:itemState(old);
    const news=matchNews(data,pattern);
    const today=state==="normal"?"변화 없음":label;
    const recent=news[0]?.date||"최근 확인 없음";
    const source=news[0]?.source||"미확인";
    return `<article class="signal-card interactive ${state}" tabindex="0" aria-expanded="false">
      <header><h3>${title}</h3><span class="status-chip">${label}</span></header>
      <dl><dt>오늘</dt><dd>${today}</dd><dt>최근</dt><dd>${escapeHtml(recent)}</dd><dt>출처</dt><dd>${escapeHtml(source)}</dd></dl>
      ${detailPopover(description,news,data)}
    </article>`;
  }).join("");
}
function compactItems(definitions,data,type){
  const stored=type==="combination"?data.combinations:data.coreSignals;
  return definitions.map((def,index)=>{
    const [title,description,pattern]=def;
    const old=(stored||[])[index];
    const [label,state]=itemState(old);
    const news=matchNews(data,pattern);
    const display=type==="combination"?(state==="normal"?"미발생":state==="attention"?"검토중":"발생"):(old?.[1]||label);
    return `<div class="compact-item interactive ${state}" tabindex="0" role="button" aria-expanded="false"><strong>${title}</strong><small>${news[0]?.source?`근거 ${escapeHtml(news[0].source)}`:"확인된 근거 없음"}</small><span class="compact-status">${escapeHtml(display)}</span>${detailPopover(description,news,data)}</div>`;
  }).join("");
}
function render(data){
  latestData=data;
  $("updatedAt").textContent=`UPDATED ${data.updatedAt||"—"}`;
  const health=data.sourceHealth;
  $("sourceHealth").textContent=health?`뉴스 ${health.successful}/${health.total} · 공식 직접 ${health.directSuccessful??0}/${health.directTotal??0} · 기사 ${health.articleCount}`:"출처 신뢰도";
  if($("sourceCoverage")) $("sourceCoverage").textContent=health?.concentrationWarning
    ? `주의: ${health.topSource} 비중 ${health.topSourceShare}% · 출처 편중`
    : `서로 다른 출처 ${health?.uniqueSources??0}곳 · 최대 출처 비중 ${health?.topSourceShare??0}%`;
  $("riskLabel").textContent=data.risk?.level||"평상시";
  $("riskScore").textContent=data.risk?.score??0;
  $("riskReason").textContent=data.risk?.reason||"";
  const trend=data.risk?.trend7||[data.risk?.score||0];
  const previous=trend.at(-2)??trend.at(-1)??0,delta=(data.risk?.score||0)-previous;
  $("scoreDelta").textContent=`${delta>0?"+":""}${delta} D/D`;
  $("miniTrend").innerHTML=trend.map(value=>`<i style="height:${Math.max(3,value)}%"></i>`).join("");
  const summary=data.summary||fallback.summary;
  $("summaryList").innerHTML=(summary.items||[]).map(item=>`<li>${escapeHtml(item)}</li>`).join("");
  ["addedCount","stripAdded"].forEach(id=>$(id).textContent=summary.added||0);
  ["clearedCount","stripCleared"].forEach(id=>$(id).textContent=summary.cleared||0);
  ["statusChange","stripStatus"].forEach(id=>$(id).textContent=summary.statusChange||"동일");
  const official=data.officialAlert||fallback.officialAlert;
  $("officialAlertStatus").textContent=data.urgentChange||official.status;
  $("officialAlertTime").textContent=official.checkedAt||data.updatedAt||"—";
  $("officialAlert").dataset.level=official.level||((data.risk?.score||0)>=40?"alert":"normal");
  $("signals").innerHTML=signalCards(data);
  $("combinations").innerHTML=compactItems(combinationDefinitions,data,"combination");
  $("coreSignals").innerHTML=compactItems(coreDefinitions,data,"core");
  renderNews((data.news||[]).filter(item=>item.riskRelevant!==false));
  renderRelated(data.relatedInfo||[]);
  renderRumors(data.rumors||[]);
  renderChart();
}
function renderNews(news){
  const sorted=[...news].sort((a,b)=>sourceRank(a.source)-sourceRank(b.source)||String(b.date).localeCompare(String(a.date)));
  $("news").innerHTML=sorted.length?sorted.map(item=>`<a class="news-item" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer"><time>${escapeHtml(item.date||"—")}</time><span class="news-source">${escapeHtml(item.source||"Unknown")}</span><span class="news-title">${escapeHtml(item.titleKo||item.title)}</span><span class="source-badge ${escapeHtml(item.confidence||"D")}">${escapeHtml(item.confidence||"D")} · ${escapeHtml(item.verification||"분석")}</span></a>`).join(""):`<div class="news-item">새 뉴스 없음</div>`;
}
function renderRumors(rumors){
  const defaults=[{claim:"외국 대사관 철수",verdict:"공식 근거 없음",tone:"normal"},{claim:"주한미군 가족 철수",verdict:"확인 불가",tone:"unknown"},{claim:"북한 전면전 임박",verdict:"공식 근거 없음",tone:"normal"}];
  $("rumors").innerHTML=(rumors.length?rumors:defaults).map(item=>`<div class="rumor-item"><strong>${escapeHtml(item.claim)}</strong><span class="verdict ${escapeHtml(item.tone||"normal")}">${escapeHtml(item.verdict)}</span></div>`).join("");
}
function renderChart(){
  const values=(historyData.length?historyData:[{date:"오늘",score:latestData.risk?.score||0}]).slice(-activeRange);
  $("riskChart").innerHTML=values.map(item=>`<div style="height:${Math.max(2,item.score)}%" data-label="${escapeHtml(item.date)} · ${item.score}"></div>`).join("");
}
async function load(path="./data/dashboard.json",latest=true){
  try{const response=await fetch(`${path}?t=${Date.now()}`,{cache:"no-store"});if(!response.ok)throw Error("data");const data=await response.json();if(latest)await notifyOnChange(data);render(data)}catch{render(fallback)}
}
async function loadHistory(){
  try{
    const dates=await (await fetch(`./data/history/index.json?t=${Date.now()}`,{cache:"no-store"})).json();
    const snapshots=await Promise.all(dates.slice(0,90).map(async date=>{try{const d=await (await fetch(`./data/history/${date}.json?t=${Date.now()}`,{cache:"no-store"})).json();return{date,score:d.risk?.score||0,level:d.risk?.level||"평상시",updatedAt:d.updatedAt||"—",newsCount:Array.isArray(d.news)?d.news.length:0}}catch{return null}}));
    const valid=snapshots.filter(Boolean);
    $("historyList").innerHTML=`<div class="history-head" aria-hidden="true"><span>날짜</span><span>최종 갱신</span><span>위험도</span><span>점수</span><span>뉴스</span></div>${valid.map((item,index)=>`<button type="button" data-date="${escapeHtml(item.date)}" class="history-row ${index===0?"active":""}" aria-label="${escapeHtml(item.date)} 대시보드 보기, 뉴스 ${item.newsCount}건"><time>${escapeHtml(item.date)}</time><span>${escapeHtml(item.updatedAt)}</span><strong>${escapeHtml(item.level)}</strong><span>${item.score}</span><span>${item.newsCount}건</span></button>`).join("")}`;
    historyData=[...valid].reverse();renderChart();
  }catch{$("historyList").textContent="기록 없음"}
}
function renderRelated(items){
  $("relatedInfo").innerHTML=items.length?items.map(item=>`<a class="related-item" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">
    <time>${escapeHtml(item.date||"—")}</time><span class="related-topic">${escapeHtml(item.topic||"북한 관련")}</span>
    <span class="news-source">${escapeHtml(item.source||"Unknown")}</span><span class="news-title">${escapeHtml(item.titleKo||item.title)}</span>
    <span class="no-score">${escapeHtml(item.scoreImpact||"위험도 미반영")}</span>
  </a>`).join(""):`<div class="news-item">새로운 일반 북한·안보 정보 없음</div>`;
}
async function loadWeights(){
  try{const config=await (await fetch("./config/risk-weights.json")).json();$("scoreWeights").innerHTML=Object.values(config.events).map(item=>`<span>${escapeHtml(item.label)} <b>+${item.weight}</b></span>`).join("")}catch{}
}
document.addEventListener("click",event=>{
  const item=event.target.closest(".interactive");if(item&&!event.target.closest("a")){const open=!item.classList.contains("open");document.querySelectorAll(".interactive.open").forEach(node=>{node.classList.remove("open");node.setAttribute("aria-expanded","false")});item.classList.toggle("open",open);item.setAttribute("aria-expanded",String(open))}
});
document.addEventListener("keydown",event=>{if(["Enter"," "].includes(event.key)&&event.target.matches(".interactive")){event.preventDefault();event.target.click()}if(event.key==="Escape")document.querySelectorAll(".interactive.open").forEach(node=>node.classList.remove("open"))});
$("refreshButton").addEventListener("click",()=>load());
$("historyList").addEventListener("click",event=>{const button=event.target.closest("[data-date]");if(button){document.querySelectorAll(".history-row").forEach(row=>row.classList.toggle("active",row===button));load(`./data/history/${button.dataset.date}.json`,false)}});
document.querySelectorAll(".range-tabs button").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll(".range-tabs button").forEach(item=>{item.classList.remove("active");item.setAttribute("aria-pressed","false")});button.classList.add("active");button.setAttribute("aria-pressed","true");activeRange=Number(button.dataset.range);renderChart()}));

const settingsDialog=$("settingsDialog"),notificationToggle=$("notificationToggle"),ruleInputs=[...document.querySelectorAll("#notificationRules input")];
[$("settingsButton"),$("desktopSettingsButton")].filter(Boolean).forEach(button=>button.addEventListener("click",()=>settingsDialog.showModal()));
const rules=()=>{try{return JSON.parse(localStorage.getItem("notificationRules"))||["score","level","official"]}catch{return["score","level","official"]}};
ruleInputs.forEach(input=>{input.checked=rules().includes(input.value);input.addEventListener("change",()=>localStorage.setItem("notificationRules",JSON.stringify(ruleInputs.filter(i=>i.checked).map(i=>i.value))))});
function notificationState(){const supported="Notification"in window,permission=supported?Notification.permission:"unsupported",enabled=localStorage.getItem("notifications")==="on";notificationToggle.checked=supported&&enabled&&permission==="granted";notificationToggle.disabled=!supported||permission==="denied";$("notificationStatus").textContent=!supported?"이 브라우저는 알림을 지원하지 않습니다":permission==="denied"?"주소창의 사이트 설정에서 알림을 허용하세요":notificationToggle.checked?"알림 사용 중":"알림 꺼짐"}
notificationToggle.addEventListener("change",async()=>{if(!("Notification"in window))return;const permission=notificationToggle.checked?await Notification.requestPermission():"denied";localStorage.setItem("notifications",permission==="granted"?"on":"off");notificationState()});notificationState();
async function notifyOnChange(data){
  const prev={update:localStorage.getItem("lastUpdate"),score:Number(localStorage.getItem("lastScore")||0),level:localStorage.getItem("lastLevel")||"평상시"};
  const current={update:data.updatedAt||"",score:Number(data.risk?.score||0),level:data.risk?.level||"평상시"};
  localStorage.setItem("lastUpdate",current.update);localStorage.setItem("lastScore",current.score);localStorage.setItem("lastLevel",current.level);
  if(!prev.update||prev.update===current.update||!("Notification"in window)||Notification.permission!=="granted"||localStorage.getItem("notifications")!=="on")return;
  const selected=rules(),rank={평상시:0,주의:1,경계:2,심각:3},why=[];
  if(selected.includes("all"))why.push("새 자료");if(selected.includes("score")&&current.score>prev.score)why.push(`점수 ${prev.score}→${current.score}`);if(selected.includes("level")&&rank[current.level]>rank[prev.level])why.push(`단계 ${prev.level}→${current.level}`);if(selected.includes("official")&&data.officialAlert?.level==="alert")why.push("공식 경보");
  if(why.length)(await navigator.serviceWorker?.ready)?.showNotification("주연뉴스",{body:why.join(" · "),icon:"./icon-192.png?v=13",tag:"dashboard"});
}
if("serviceWorker"in navigator){let reloading=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!reloading){reloading=true;location.reload()}});navigator.serviceWorker.register("./sw.js?v=19")}
let installPrompt;window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("installButton").hidden=false});$("installButton").addEventListener("click",async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("installButton").hidden=true}});
load();loadHistory();loadWeights();
window.addEventListener("pageshow",event=>{if(event.persisted){load();loadHistory()}});

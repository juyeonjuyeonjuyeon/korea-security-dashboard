const fallback = {
  updatedAt: "자동 갱신 전",
  risk: { level: "평상시", reason: "공개 자료에서 전면전 임박을 뒷받침하는 복합 신호가 확인되지 않았습니다." },
  dailyChange: "기준 데이터",
  urgentChange: "확인된 긴급 변화 없음",
  signals: [
    ["야전병원·혈액 보급", "미확인", "unknown"],
    ["대규모 탄약·연료 이동", "미확인", "unknown"],
    ["군용열차·장비 이동", "미확인", "unknown"],
    ["김정은 공개활동 변화", "관찰", "watch"],
    ["북한 주민 이동 통제", "미확인", "unknown"],
    ["중국 접경 비상조치", "변화 없음", "normal"],
    ["북러 군사협력", "지속 관찰", "watch"],
    ["한국행 항공편 변화", "변화 없음", "normal"],
    ["전쟁위험 보험 변화", "미확인", "unknown"],
    ["주한 외국공관 철수", "변화 없음", "normal"]
  ],
  combinations: [
    ["병력 이동 + 탄약·연료 + 야전병원", "해당 없음", "normal"],
    ["대사관 철수 + 항공편 중단", "해당 없음", "normal"],
    ["주민 소개 + 지도부 은신", "해당 없음", "normal"],
    ["북중 국경 통제 + 병력 증강", "해당 없음", "normal"]
  ],
  coreSignals: [
    ["북한 병력·장비 이동", "미확인", "unknown"],
    ["중국 접경 움직임", "변화 없음", "normal"],
    ["외국 공관·여행경보", "변화 없음", "normal"],
    ["북한 군사활동", "지속 관찰", "watch"],
    ["주한미군 비전투원 조치", "변화 없음", "normal"]
  ],
  news: []
};

const $ = (id) => document.getElementById(id);
const labels = { normal: "확인됨", watch: "관찰", alert: "경고", unknown: "미확인" };

function draw(data) {
  $("updatedAt").textContent = data.updatedAt || "알 수 없음";
  $("dailyChange").textContent = data.dailyChange || "—";
  $("urgentChange").textContent = data.urgentChange || "—";
  $("riskLabel").textContent = data.risk?.level || "판정 보류";
  $("riskReason").textContent = data.risk?.reason || "충분한 공개 자료가 없습니다.";

  $("signals").innerHTML = data.signals.map((item, i) => `
    <div class="signal">
      <span class="num">${String(i + 1).padStart(2, "0")}</span>
      <strong>${escapeHtml(item[0])}</strong>
      <span class="badge ${item[2]}">${escapeHtml(item[1] || labels[item[2]])}</span>
    </div>`).join("");

  const stack = (items) => items.map(item => `
    <div class="stack-item">
      <span>${escapeHtml(item[0])}</span>
      <span class="badge ${item[2]}">${escapeHtml(item[1])}</span>
    </div>`).join("");
  $("combinations").innerHTML = stack(data.combinations || []);
  $("coreSignals").innerHTML = stack(data.coreSignals || []);

  $("news").innerHTML = data.news?.length ? data.news.map(item => `
    <a class="news-item" href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">
      <span class="source">${escapeHtml(item.source || "해외 보도")}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <time>${escapeHtml(item.date || "")}</time>
    </a>`).join("") : `<p class="empty">자동 수집된 새 해외 보도가 없습니다. 공식 발표와 원문을 직접 확인해 주세요.</p>`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[c]);
}
function safeUrl(value = "") {
  try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : "#"; } catch { return "#"; }
}
async function load() {
  try {
    const response = await fetch(`./data/dashboard.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("data");
    draw(await response.json());
  } catch { draw(fallback); }
}
$("refreshButton").addEventListener("click", load);
load();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
let installPrompt;
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  $("installButton").hidden = false;
});
$("installButton").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("installButton").hidden = true;
});

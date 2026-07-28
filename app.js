const fallback = {
  updatedAt: "자동 갱신 전",
  risk: { level: "평상시", score: 10, reason: "공개 자료에서 전면전 임박을 뒷받침하는 복합 신호가 확인되지 않았습니다." },
  dailyChange: "기준 데이터",
  urgentChange: "확인된 긴급 변화 없음",
  officialAlert: { status: "자동 연동 전 · 공식 채널 직접 확인", level: "unknown", checkedAt: "—" },
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
let latestData = fallback;
const signalDescriptions = {
  "야전병원·혈액 보급": "전방 야전병원 설치와 혈액·의약품 대량 이동은 장기 군사작전 준비 여부를 판단하는 보조 신호입니다.",
  "대규모 탄약·연료 이동": "탄약과 연료가 평시 수준을 넘어 전방 부대로 집중되는지 살핍니다. 훈련과 실전 준비를 구분해야 합니다.",
  "군용열차·장비 이동": "전차·포병·발사대 등을 실은 군용열차와 대규모 장비 이동의 비정상적 증가 여부입니다.",
  "김정은 공개활동 변화": "공개활동의 장기 중단이나 전시 지휘시설 관련 동향을 봅니다. 건강·일정 문제일 수도 있어 단독 판단은 금물입니다.",
  "북한 주민 이동 통제": "접경지역 소개, 평양 봉쇄, 철도·도로 통제 등 평시와 다른 주민 이동 제한 여부입니다.",
  "중국 접경 비상조치": "중국의 북중 국경 폐쇄, 병력 증강, 중국인 귀국 권고 같은 비상조치 여부입니다.",
  "북러 군사협력": "북한 병력·무기 지원과 러시아의 군사기술·물자 제공이 확대되는지 확인합니다.",
  "한국행 항공편 변화": "전쟁위험 평가에 민감한 외국 항공사의 한국 노선 취소·축소가 동시에 나타나는지 봅니다.",
  "전쟁위험 보험 변화": "한국 관련 선박·항공 전쟁위험 보험료가 비정상적으로 급등하는지 확인합니다.",
  "주한 외국공관 철수": "주한 외교공관의 비필수 인력·가족 철수나 공관 폐쇄는 강한 후기 경보 신호입니다."
};
const signalKeywords = {
  "야전병원·혈액 보급": /hospital|medical|blood/i,
  "대규모 탄약·연료 이동": /ammunition|munition|fuel|artillery/i,
  "군용열차·장비 이동": /train|troop|equipment|launcher|deployment/i,
  "김정은 공개활동 변화": /kim jong un|kim calls|kim supervises/i,
  "북한 주민 이동 통제": /resident|lockdown|movement restriction/i,
  "중국 접경 비상조치": /china|chinese|border/i,
  "북러 군사협력": /russia|russian|ukraine/i,
  "한국행 항공편 변화": /airline|flight|aviation/i,
  "전쟁위험 보험 변화": /insurance|shipping|war risk/i,
  "주한 외국공관 철수": /embassy|diplomat|evacuation|withdrawal/i
};

function draw(data) {
  $("updatedAt").textContent = data.updatedAt || "알 수 없음";
  $("dailyChange").textContent = data.dailyChange || "—";
  $("urgentChange").textContent = data.urgentChange || "—";
  $("riskLabel").textContent = data.risk?.level || "판정 보류";
  $("riskReason").textContent = data.risk?.reason || "충분한 공개 자료가 없습니다.";
  const calculatedScore = (data.signals || []).reduce((score, item) => score + (item[2] === "alert" ? 20 : item[2] === "watch" ? 5 : 0), 0);
  $("riskScore").textContent = Math.min(100, Number.isFinite(data.risk?.score) ? data.risk.score : calculatedScore);
  $("riskCard").dataset.level = data.risk?.level || "판정 보류";
  const official = data.officialAlert || fallback.officialAlert;
  $("officialAlertStatus").textContent = official.status;
  $("officialAlertTime").textContent = official.checkedAt ? `확인 ${official.checkedAt}` : "확인 시각 없음";
  $("officialAlert").dataset.level = official.level || "unknown";

  $("signals").innerHTML = data.signals.map((item, i) => `
    <div class="signal" tabindex="0" role="button" aria-expanded="false">
      <span class="num">${String(i + 1).padStart(2, "0")}</span>
      <strong>${escapeHtml(item[0])}</strong>
      <span class="badge ${item[2]}">${escapeHtml(item[1] || labels[item[2]])}</span>
      ${signalDetail(item, data)}
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
      <strong>${escapeHtml(item.titleKo || item.title)}</strong>
      <time>${escapeHtml(item.date || "")}</time>
    </a>`).join("") : `<p class="empty">자동 수집된 새 해외 보도가 없습니다. 공식 발표와 원문을 직접 확인해 주세요.</p>`;
}

function signalDetail(item, data) {
  const extra = item[3] || {};
  const confidence = extra.confidence || (item[2] === "unknown" ? "D · 미확인" : item[2] === "normal" ? "C · 공개자료 기준" : "C · 추가 확인 필요");
  const checkedAt = extra.checkedAt || data.indicatorsCheckedAt || data.updatedAt || "시각 없음";
  const attached = extra.sources || [];
  const matched = (data.news || []).filter(article => signalKeywords[item[0]]?.test(`${article.title} ${article.titleKo || ""}`)).slice(0, 2);
  const sources = attached.length ? attached : matched.map(article => ({ label: article.titleKo || article.title, url: article.url }));
  const links = sources.length
    ? sources.map(source => `<a href="${safeUrl(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a>`).join("")
    : `<span class="no-source">연결된 근거 기사 없음 · 미확인으로 해석</span>`;
  return `<aside class="signal-detail" aria-label="${escapeHtml(item[0])} 설명">
    <p>${escapeHtml(extra.description || signalDescriptions[item[0]] || "공개 자료의 변화를 확인하는 보조 지표입니다.")}</p>
    <div class="detail-meta"><span>신뢰도 ${escapeHtml(confidence)}</span><span>확인 ${escapeHtml(checkedAt)}</span></div>
    <div class="detail-sources">${links}</div>
  </aside>`;
}

function toggleSignal(signal) {
  const willOpen = !signal.classList.contains("open");
  document.querySelectorAll(".signal.open").forEach(item => {
    item.classList.remove("open");
    item.setAttribute("aria-expanded", "false");
  });
  signal.classList.toggle("open", willOpen);
  signal.setAttribute("aria-expanded", String(willOpen));
}
$("signals").addEventListener("click", event => {
  if (event.target.closest("a")) return;
  const signal = event.target.closest(".signal");
  if (signal) toggleSignal(signal);
});
$("signals").addEventListener("keydown", event => {
  if (!["Enter", " "].includes(event.key) || event.target.closest("a")) return;
  const signal = event.target.closest(".signal");
  if (!signal) return;
  event.preventDefault();
  toggleSignal(signal);
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  document.querySelectorAll(".signal.open").forEach(item => {
    item.classList.remove("open");
    item.setAttribute("aria-expanded", "false");
  });
});

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[c]);
}
function safeUrl(value = "") {
  try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : "#"; } catch { return "#"; }
}
async function load(path = "./data/dashboard.json", isLatest = true) {
  try {
    const response = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("data");
    const data = await response.json();
    if (isLatest) {
      latestData = data;
      await notifyOnChange(data);
    }
    draw(data);
  } catch { draw(fallback); }
}
$("refreshButton").addEventListener("click", () => load());
$("latestButton").addEventListener("click", () => load());
load();

async function loadHistory() {
  try {
    const response = await fetch(`./data/history/index.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("history");
    const dates = await response.json();
    $("historyList").innerHTML = dates.length ? dates.map((date, i) =>
      `<button class="date-button${i === 0 ? " current" : ""}" data-date="${escapeHtml(date)}">${escapeHtml(date)}</button>`
    ).join("") : `<span class="empty-inline">저장된 과거 기록이 없습니다.</span>`;
    $("historyList").addEventListener("click", event => {
      const button = event.target.closest("[data-date]");
      if (!button) return;
      document.querySelectorAll(".date-button").forEach(item => item.classList.toggle("current", item === button));
      load(`./data/history/${button.dataset.date}.json`, false);
      window.scrollTo({ top: $("today").offsetTop - 10, behavior: "smooth" });
    });
  } catch {
    $("historyList").innerHTML = `<span class="empty-inline">날짜별 기록은 다음 자동 갱신부터 쌓입니다.</span>`;
  }
}
loadHistory();

const settingsDialog = $("settingsDialog");
[$("settingsButton"), $("desktopSettingsButton")].forEach(button =>
  button.addEventListener("click", () => settingsDialog.showModal())
);
const notificationToggle = $("notificationToggle");
const notificationStatus = $("notificationStatus");
const ruleInputs = [...document.querySelectorAll("#notificationRules input")];
const defaultRules = ["score", "level", "official"];

function getNotificationRules() {
  try { return JSON.parse(localStorage.getItem("dashboardNotificationRules")) || defaultRules; }
  catch { return defaultRules; }
}
function renderNotificationRules() {
  const selected = getNotificationRules();
  ruleInputs.forEach(input => { input.checked = selected.includes(input.value); });
}
ruleInputs.forEach(input => input.addEventListener("change", () => {
  localStorage.setItem("dashboardNotificationRules", JSON.stringify(ruleInputs.filter(item => item.checked).map(item => item.value)));
}));
renderNotificationRules();

function renderNotificationState() {
  const supported = "Notification" in window;
  const enabled = localStorage.getItem("dashboardNotifications") === "on";
  notificationToggle.checked = supported && enabled && Notification.permission === "granted";
  notificationToggle.disabled = !supported || Notification.permission === "denied";
  notificationStatus.textContent = !supported
    ? "이 브라우저는 알림을 지원하지 않습니다."
    : Notification.permission === "denied"
      ? "브라우저 설정에서 알림 차단을 해제해 주세요."
      : notificationToggle.checked ? "알림이 켜져 있습니다." : "알림이 꺼져 있습니다.";
}
notificationToggle.addEventListener("change", async () => {
  if (!notificationToggle.checked) {
    localStorage.setItem("dashboardNotifications", "off");
    renderNotificationState();
    return;
  }
  const permission = await Notification.requestPermission();
  localStorage.setItem("dashboardNotifications", permission === "granted" ? "on" : "off");
  renderNotificationState();
});
renderNotificationState();

async function notifyOnChange(data) {
  const previous = {
    update: localStorage.getItem("dashboardLastSeenUpdate"),
    score: Number(localStorage.getItem("dashboardLastScore") || 0),
    level: localStorage.getItem("dashboardLastLevel") || "평상시",
    official: localStorage.getItem("dashboardLastOfficial") || "normal"
  };
  const current = {
    update: data.updatedAt || "",
    score: Number(data.risk?.score || 0),
    level: data.risk?.level || "평상시",
    official: data.officialAlert?.level || "normal"
  };
  localStorage.setItem("dashboardLastSeenUpdate", current.update);
  localStorage.setItem("dashboardLastScore", String(current.score));
  localStorage.setItem("dashboardLastLevel", current.level);
  localStorage.setItem("dashboardLastOfficial", current.official);
  if (!previous.update || previous.update === current.update) return;
  if (!("Notification" in window) || localStorage.getItem("dashboardNotifications") !== "on" || Notification.permission !== "granted") return;
  const rules = getNotificationRules();
  const levelRank = { "평상시": 0, "주의": 1, "경계": 2, "심각": 3 };
  const reasons = [];
  if (rules.includes("all")) reasons.push("새 자료");
  if (rules.includes("score") && current.score > previous.score) reasons.push(`점수 ${previous.score}→${current.score}`);
  if (rules.includes("level") && (levelRank[current.level] || 0) > (levelRank[previous.level] || 0)) reasons.push(`경보 ${previous.level}→${current.level}`);
  if (rules.includes("official") && current.official === "alert" && previous.official !== "alert") reasons.push("공식 긴급경보");
  if (!reasons.length) return;
  const registration = await navigator.serviceWorker?.ready;
  registration?.showNotification("주연상사뉴우스 갱신", {
    body: `${reasons.join(" · ")} · ${data.risk?.level || "상태 확인"}`,
    icon: "./icon.svg",
    tag: "dashboard-update"
  });
}

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

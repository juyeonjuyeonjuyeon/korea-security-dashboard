import fs from "node:fs/promises";

const dashboardFile = new URL("../data/dashboard.json", import.meta.url);
const weightsFile = new URL("../config/risk-weights.json", import.meta.url);
const sourcesFile = new URL("../config/sources.json", import.meta.url);
const historyDir = new URL("../data/history/", import.meta.url);
const historyIndexFile = new URL("../data/history/index.json", import.meta.url);
const previous = JSON.parse(await fs.readFile(dashboardFile, "utf8"));
const config = JSON.parse(await fs.readFile(weightsFile, "utf8"));
const sourceConfig = JSON.parse(await fs.readFile(sourcesFile, "utf8"));
const userAgent = "korea-security-dashboard/2.1 (+https://github.com/juyeonjuyeonjuyeon/korea-security-dashboard)";

const sourcePatterns = {
  A: /jcs\.mil\.kr|mnd\.go\.kr|국방부|합동참모본부|joint chiefs|state\.gov|defense\.gov|pentagon|iaea\.org|international atomic energy agency|gov\.uk|foreign commonwealth|icao\.int|notam|multilateral sanctions monitoring team|\bmsmt\b/i,
  B: /reuters|associated press|\bap news\b|\bbbc\b|\bafp\b|wall street journal|\bwsj\b|yonhap|연합뉴스/i,
  C: /38 north|beyond parallel|csis|rusi|iiss|nk news/i
};
const allowed = new RegExp(`${sourcePatterns.A.source}|${sourcePatterns.B.source}|${sourcePatterns.C.source}|kcna watch|daily nk|dailynk|asia press|rimjin-gang`, "i");
const relevant = /north korea|\bdprk\b|kim jong un|pyongyang|korean peninsula|inter-korean|북한|평양|김정은|한반도|남북/i;
const rules = {
  missile_test: /missile (test|launch|firing)|ballistic missile|미사일 (시험|발사)/i,
  artillery_movement: /artillery (movement|deployment|position|drill)|포병 (이동|배치)|방사포 이동/i,
  ammunition_movement: /ammunition movement|munitions transfer|ammunition shipment|fuel convoy|탄약 (이동|수송)|연료 수송/i,
  field_hospital: /field hospital|mobile hospital|blood suppl|야전병원|이동식 병원|혈액 보급/i,
  china_border_closure: /(china|chinese|북중|중국).{0,30}(border|국경|접경).{0,30}(clos|seal|restrict|봉쇄|폐쇄|통제)/i,
  embassy_withdrawal: /embassy.{0,30}(withdraw|evacuat|close)|diplomat.{0,30}(withdraw|evacuat)|대사관.{0,30}(철수|대피|폐쇄)/i,
  usfk_family_evacuation: /USFK.{0,30}famil.{0,30}evacuat|noncombatant evacuation.{0,30}korea|주한미군.{0,30}(가족|비전투원).{0,30}(철수|대피)/i,
  leadership_hiding: /leadership.{0,30}(bunker|underground|disappear)|kim jong un.{0,30}(disappear|absence)|지도부.{0,30}(대피|은신|지하)/i
};

const decodeXml = (value = "") => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/\s+/g, " ").trim();
const sourceGrade = value => sourcePatterns.A.test(value) ? "A" : sourcePatterns.B.test(value) ? "B" : sourcePatterns.C.test(value) ? "C" : "D";
const sourceName = article => String(article.source || article.domain || "Unknown");
const dateFrom = raw => {
  const parsed = new Date(raw);
  return Number.isNaN(parsed.valueOf()) ? "" : parsed.toISOString().slice(0, 16).replace("T", " ");
};

function parseRss(xml, fallbackSource, forcedGrade) {
  return [...xml.matchAll(/<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi)].map(match => {
    const item = match[1];
    const title = decodeXml(item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const linkTag = item.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i)?.[1];
    const url = decodeXml(linkTag || item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || "");
    const source = decodeXml(item.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || fallbackSource);
    const rawDate = item.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i)?.[1];
    return { title, url, source, date: dateFrom(rawDate), forcedGrade };
  });
}

async function fetchText(url, timeout = 12000) {
  const response = await fetch(url, { headers: { "user-agent": userAgent }, signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function collectGdelt() {
  const query = encodeURIComponent("(North Korea OR DPRK) (military OR missile OR embassy OR evacuation OR border OR Russia OR China)");
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=50&format=json&sort=datedesc`;
  const result = JSON.parse(await fetchText(url));
  return (result.articles || []).map(article => ({
    title: article.title,
    url: article.url,
    source: article.domain,
    date: String(article.seendate || "").slice(0, 12).replace(/(\d{4})(\d{2})(\d{2})(\d{4})?/, "$1-$2-$3 $4").trim()
  }));
}

async function collectGoogle(query) {
  const q = encodeURIComponent(`${query} when:${sourceConfig.freshness_days}d`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  return parseRss(await fetchText(url), "Google News");
}

async function collectDirectRss(feed) {
  return parseRss(await fetchText(feed.url), feed.name, feed.grade)
    .map(article => ({ ...article, source: feed.name }));
}

async function collectNews() {
  const jobs = [
    collectGdelt(),
    ...sourceConfig.queries.map(item => collectGoogle(item.query)),
    ...sourceConfig.rss.map(collectDirectRss)
  ];
  const settled = await Promise.allSettled(jobs);
  const articles = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const successful = settled.filter(result => result.status === "fulfilled").length;
  if (!successful) throw new Error("모든 공개 정보처 연결 실패");
  return { articles, successful, total: jobs.length };
}

function deduplicate(articles) {
  const seen = new Set();
  return articles.filter(article => {
    const key = article.title.toLowerCase()
      .replace(/\s+-\s+[^-]+$/, "")
      .replace(/[^a-z0-9가-힣]+/g, " ")
      .trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function translateNews(news) {
  const cached = new Map((previous.news || []).map(item => [item.title, item.titleKo]));
  const output = [];
  for (const article of news.slice(0, 30)) {
    let titleKo = cached.get(article.title);
    if (!titleKo && !/[가-힣]/.test(article.title)) {
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(article.title)}&langpair=en|ko`;
        const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
        const result = response.ok ? await response.json() : {};
        titleKo = decodeXml(result.responseData?.translatedText || "");
      } catch {}
    }
    const grade = article.forcedGrade || sourceGrade(`${sourceName(article)} ${article.url}`);
    output.push({
      title: article.title,
      url: article.url,
      source: sourceName(article),
      date: article.date,
      titleKo: titleKo && !/MYMEMORY WARNING/i.test(titleKo) ? titleKo : article.title,
      confidence: grade,
      verification: grade === "A" ? "공식확인" : grade === "B" ? "주요보도" : grade === "C" ? "전문분석" : "교차검증 필요"
    });
  }
  return output;
}

function verifiedEvents(news) {
  return Object.entries(rules).map(([id, pattern]) => {
    const matches = news.filter(article => pattern.test(`${article.title} ${article.titleKo || ""}`));
    const reliableSources = new Set(matches.filter(article => ["A", "B"].includes(article.confidence)).map(sourceName));
    const hasOfficial = matches.some(article => article.confidence === "A");
    const verified = hasOfficial || reliableSources.size >= config.verification.minimum_independent_reliable_sources;
    return {
      id,
      label: config.events[id].label,
      weight: config.events[id].weight,
      verified,
      sources: matches.slice(0, 3).map(article => ({
        label: article.titleKo || article.title,
        url: article.url,
        grade: article.confidence
      }))
    };
  });
}

const levelFor = score => score >= 60 ? "심각" : score >= 40 ? "경계" : score >= 20 ? "주의" : "평상시";
const statusFor = event => event.verified ? (event.weight >= 30 ? "danger" : event.weight >= 20 ? "warning" : "attention") : "normal";
const kstNow = () => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short"
}).format(new Date());

async function saveSnapshot(data) {
  const date = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  await fs.mkdir(historyDir, { recursive: true });
  await fs.writeFile(new URL(`${date}.json`, historyDir), `${JSON.stringify(data, null, 2)}\n`);
  let dates = [];
  try { dates = JSON.parse(await fs.readFile(historyIndexFile, "utf8")); } catch {}
  dates = [date, ...dates.filter(item => item !== date)].slice(0, 90);
  await fs.writeFile(historyIndexFile, `${JSON.stringify(dates, null, 2)}\n`);
}

try {
  const collected = await collectNews();
  const raw = deduplicate(collected.articles)
    .filter(article => article.title && article.url)
    .filter(article => relevant.test(`${article.title} ${article.source}`))
    .filter(article => allowed.test(`${sourceName(article)} ${article.url}`))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const news = await translateNews(raw);
  if (!news.length) throw new Error("유효한 공개 출처 뉴스 0건");

  const events = verifiedEvents(news);
  const scoreBreakdown = events.filter(event => event.verified);
  const score = Math.min(100, scoreBreakdown.reduce((sum, event) => sum + event.weight, 0));
  const oldScore = Number(previous.risk?.score || 0);
  const oldVerified = new Set((previous.scoreBreakdown || []).map(item => item.id));
  const newVerified = new Set(scoreBreakdown.map(item => item.id));
  const added = scoreBreakdown.filter(item => !oldVerified.has(item.id));
  const cleared = [...oldVerified].filter(id => !newVerified.has(id));
  const trend = [...(previous.risk?.trend7 || []), score].slice(-7);
  const data = {
    ...previous,
    schemaVersion: 2,
    updatedAt: kstNow(),
    sourceHealth: {
      successful: collected.successful,
      total: collected.total,
      articleCount: news.length,
      checkedAt: kstNow()
    },
    risk: {
      score,
      level: levelFor(score),
      trend7: trend,
      reason: scoreBreakdown.length
        ? `교차검증된 위험신호 ${scoreBreakdown.length}개가 점수에 반영됐습니다.`
        : "공식 발표 또는 복수 신뢰 출처로 확인된 위험신호가 없습니다."
    },
    summary: {
      added: added.length,
      cleared: cleared.length,
      statusChange: score === oldScore ? "동일" : score > oldScore ? "상승" : "하락",
      items: [
        ...added.map(item => `${item.label} 확인`),
        ...cleared.map(id => `${config.events[id]?.label || id} 해제`),
        news.some(item => /missile/i.test(item.title)) ? "미사일 관련 보도 확인 · 교차검증 기준 적용" : "새로운 미사일 시험 확인 없음",
        "대사관·주한미군 변화는 공식 확인 시에만 반영"
      ].slice(0, 4)
    },
    dailyChange: `새 위험신호 ${added.length} · 해제 ${cleared.length}`,
    urgentChange: score >= 40 ? `${levelFor(score)} 단계 · 공식 채널 확인 필요` : "현재 긴급 경보 없음",
    scoreBreakdown,
    news,
    rumors: [
      {
        claim: "외국 대사관 철수",
        verdict: events.find(item => item.id === "embassy_withdrawal")?.verified ? "복수 확인" : "공식 근거 없음",
        tone: events.find(item => item.id === "embassy_withdrawal")?.verified ? "danger" : "normal"
      },
      {
        claim: "주한미군 가족 철수",
        verdict: events.find(item => item.id === "usfk_family_evacuation")?.verified ? "복수 확인" : "확인 불가",
        tone: events.find(item => item.id === "usfk_family_evacuation")?.verified ? "danger" : "unknown"
      },
      {
        claim: "북한 전면전 임박",
        verdict: score >= 60 ? "고위험 신호 조합" : "공식 근거 없음",
        tone: score >= 60 ? "danger" : "normal"
      }
    ],
    signalStatus: Object.fromEntries(events.map(event => [event.id, statusFor(event)]))
  };
  await fs.writeFile(dashboardFile, `${JSON.stringify(data, null, 2)}\n`);
  await saveSnapshot(data);
} catch (error) {
  console.warn(`자동 갱신 실패: ${error.message}. 이전 정상 데이터를 유지합니다.`);
}

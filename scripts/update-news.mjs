import fs from "node:fs/promises";

const dashboardFile = new URL("../data/dashboard.json", import.meta.url);
const weightsFile = new URL("../config/risk-weights.json", import.meta.url);
const historyDir = new URL("../data/history/", import.meta.url);
const historyIndexFile = new URL("../data/history/index.json", import.meta.url);
const previous = JSON.parse(await fs.readFile(dashboardFile, "utf8"));
const config = JSON.parse(await fs.readFile(weightsFile, "utf8"));

const query = encodeURIComponent('(North Korea OR DPRK) (military OR missile OR embassy OR evacuation OR border OR Russia OR China)');
const gdelt = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=40&format=json&sort=datedesc`;
const google = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
const allowed = /reuters|associated press|ap news|bbc|afp|wall street journal|state department|defense\.gov|pentagon|iaea|38 north|csis|rusi|iiss|nk news|joint chiefs|mnd\.go\.kr/i;
const official = /state\.gov|defense\.gov|pentagon|iaea|joint chiefs|mnd\.go\.kr|합동참모|국방부/i;
const gradeB = /reuters|associated press|ap news|bbc|afp|wall street journal/i;
const gradeC = /38 north|csis|rusi|iiss|nk news/i;
const rules = {
  missile_test: /missile test|missile launch|ballistic missile|미사일/i,
  artillery_movement: /artillery movement|artillery deployment|포병 이동/i,
  ammunition_movement: /ammunition movement|munitions transfer|탄약 이동/i,
  field_hospital: /field hospital|blood suppl|야전병원|혈액 보급/i,
  china_border_closure: /china.*border.*clos|chinese border closure|중국.*국경.*봉쇄/i,
  embassy_withdrawal: /embassy.*withdraw|diplomat.*evacuat|대사관.*철수/i,
  usfk_family_evacuation: /USFK.*famil.*evacuat|noncombatant evacuation.*korea|주한미군.*가족.*철수/i,
  leadership_hiding: /leadership.*bunker|kim jong un.*disappear|지도부.*은신/i
};

const decodeXml = (value = "") => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const sourceGrade = value => official.test(value) ? "A" : gradeB.test(value) ? "B" : gradeC.test(value) ? "C" : "D";
const sourceName = article => String(article.source || article.domain || "Unknown");

async function collectNews() {
  try {
    const response = await fetch(gdelt, { headers: { "user-agent": "korea-security-dashboard/2.0" }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`GDELT ${response.status}`);
    const result = await response.json();
    return (result.articles || []).map(article => ({
      title: article.title, url: article.url, source: article.domain,
      date: String(article.seendate || "").slice(0, 12).replace(/(\d{4})(\d{2})(\d{2})(\d{4})?/, "$1-$2-$3 $4").trim()
    }));
  } catch {
    const response = await fetch(google, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Google News ${response.status}`);
    const xml = await response.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(match => match[1]).map(item => {
      const title = decodeXml(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
      const url = decodeXml(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "");
      const source = decodeXml(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "Google News");
      const rawDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
      return { title, url, source, date: rawDate ? new Date(rawDate).toISOString().slice(0, 16).replace("T", " ") : "" };
    });
  }
}

async function translateNews(news) {
  const cached = new Map((previous.news || []).map(item => [item.title, item.titleKo]));
  const output = [];
  for (const article of news.slice(0, 20)) {
    let titleKo = cached.get(article.title);
    if (!titleKo) {
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(article.title)}&langpair=en|ko`;
        const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
        const result = response.ok ? await response.json() : {};
        titleKo = decodeXml(result.responseData?.translatedText || "");
      } catch {}
    }
    const grade = sourceGrade(`${sourceName(article)} ${article.url}`);
    output.push({
      ...article,
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
    return { id, label: config.events[id].label, weight: config.events[id].weight, verified, sources: matches.slice(0, 3).map(article => ({ label: article.titleKo || article.title, url: article.url, grade: article.confidence })) };
  });
}

const levelFor = score => score >= 60 ? "심각" : score >= 40 ? "경계" : score >= 20 ? "주의" : "평상시";
const statusFor = event => event.verified ? (event.weight >= 30 ? "danger" : event.weight >= 20 ? "warning" : "attention") : "normal";
const kstNow = () => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date());

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
  const raw = (await collectNews()).filter(article => article.title && article.url && allowed.test(`${sourceName(article)} ${article.title}`));
  const news = await translateNews(raw);
  if (!news.length) throw new Error("신뢰 출처 뉴스 0건");
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
    risk: {
      score, level: levelFor(score), trend7: trend,
      reason: scoreBreakdown.length ? `교차검증된 위험신호 ${scoreBreakdown.length}개가 점수에 반영됐습니다.` : "공식 발표 또는 복수 신뢰 출처로 확인된 위험신호가 없습니다."
    },
    summary: {
      added: added.length, cleared: cleared.length,
      statusChange: score === oldScore ? "동일" : score > oldScore ? "상승" : "하락",
      items: [
        ...(added.map(item => `${item.label} 확인`)),
        ...(cleared.map(id => `${config.events[id]?.label || id} 해제`)),
        news.some(item => /missile/i.test(item.title)) ? "미사일 관련 보도 확인 · 교차검증 기준 적용" : "새로운 미사일 시험 확인 없음",
        "대사관·주한미군 변화는 공식 확인 시에만 반영"
      ].slice(0, 4)
    },
    dailyChange: `새 위험신호 ${added.length} · 해제 ${cleared.length}`,
    urgentChange: score >= 40 ? `${levelFor(score)} 단계 · 공식 채널 확인 필요` : "현재 긴급 경보 없음",
    scoreBreakdown,
    news,
    rumors: [
      { claim: "외국 대사관 철수", verdict: events.find(item => item.id === "embassy_withdrawal")?.verified ? "복수 확인" : "공식 근거 없음", tone: events.find(item => item.id === "embassy_withdrawal")?.verified ? "danger" : "normal" },
      { claim: "주한미군 가족 철수", verdict: events.find(item => item.id === "usfk_family_evacuation")?.verified ? "복수 확인" : "확인 불가", tone: events.find(item => item.id === "usfk_family_evacuation")?.verified ? "danger" : "unknown" },
      { claim: "북한 전면전 임박", verdict: score >= 60 ? "고위험 신호 조합" : "공식 근거 없음", tone: score >= 60 ? "danger" : "normal" }
    ],
    signalStatus: Object.fromEntries(events.map(event => [event.id, statusFor(event)]))
  };
  await fs.writeFile(dashboardFile, `${JSON.stringify(data, null, 2)}\n`);
  await saveSnapshot(data);
} catch (error) {
  console.warn(`자동 갱신 실패: ${error.message}. 이전 정상 데이터를 유지합니다.`);
}

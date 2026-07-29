import fs from "node:fs/promises";

const dashboardFile = new URL("../data/dashboard.json", import.meta.url);
const weightsFile = new URL("../config/risk-weights.json", import.meta.url);
const sourcesFile = new URL("../config/sources.json", import.meta.url);
const historyDir = new URL("../data/history/", import.meta.url);
const historyIndexFile = new URL("../data/history/index.json", import.meta.url);
const previous = JSON.parse(await fs.readFile(dashboardFile, "utf8"));
const config = JSON.parse(await fs.readFile(weightsFile, "utf8"));
const sourceConfig = JSON.parse(await fs.readFile(sourcesFile, "utf8"));
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36 korea-security-dashboard/2.2";

const sourcePatterns = {
  A: /jcs\.mil\.kr|mnd\.go\.kr|국방부|합동참모본부|joint chiefs|state\.gov|defense\.gov|pacom\.mil|pentagon|iaea\.org|ctbto\.org|usgs\.gov|mod\.go\.jp|imo\.org|international atomic energy agency|gov\.uk|foreign commonwealth|icao\.int|notam|multilateral sanctions monitoring team|\bmsmt\b/i,
  B: /reuters|associated press|\bap news\b|\bbbc\b|\bafp\b|wall street journal|\bwsj\b|yonhap|연합뉴스|\bytn\b|kbs|mbc|sbs|newsis|뉴시스/i,
  C: /38 north|beyond parallel|csis|rusi|iiss|nk news|radio free asia|\brfa\b|voice of america|\bvoa\b|daily nk|dailynk|asia press|rimjin-gang|arms control wonk|institute for the study of war|\bisw\b|understanding war|bellingcat|stimson|rand|covert shores|h i sutton|세종연구소|국가안보전략연구원|아산정책연구원|logpresso|로그프레소|서울신문|한국일보|the guardian|financial times/i
};
const allowed = new RegExp(`${sourcePatterns.A.source}|${sourcePatterns.B.source}|${sourcePatterns.C.source}|kcna watch|rodong|조선중앙통신|노동신문`, "i");
const relevant = /north korea|\bdprk\b|kim jong un|pyongyang|korean peninsula|inter-korean|북한|평양|김정은|한반도|남북/i;
const officialPages = [
  { name: "합동참모본부", url: "https://www.jcs.mil.kr/", includeArticles: true },
  { name: "대한민국 국방부", url: "https://www.mnd.go.kr/mnd/167/subview.do", includeArticles: true },
  { name: "IAEA DPRK", url: "https://www.iaea.org/newscenter/focus/dprk", includeArticles: true },
  { name: "미 국방부", url: "https://www.defense.gov/News/News-Stories/Tag/155460/north-korea/", includeArticles: true },
  { name: "미 국무부", url: "https://www.state.gov/countries-areas/north-korea/", includeArticles: true },
  { name: "미 인도태평양사령부", url: "https://www.pacom.mil/Media/News/", includeArticles: true },
  { name: "주한미군", url: "https://www.usfk.mil/Media/Press-Products/Press-Releases/", includeArticles: true },
  { name: "유엔군사령부", url: "https://www.unc.mil/", includeArticles: true },
  { name: "일본 방위성", url: "https://www.mod.go.jp/en/d_act/sec_env/nk/index.html", includeArticles: true },
  { name: "영국 FCDO", url: "https://www.gov.uk/foreign-travel-advice/south-korea", includeArticles: false },
  { name: "ICAO", url: "https://www.icao.int/", includeArticles: false },
  { name: "IMO", url: "https://www.imo.org/en/MediaCentre/Pages/Default.aspx", includeArticles: true },
  { name: "CTBTO", url: "https://www.ctbto.org/news-and-events/news", includeArticles: true }
];
const embassyMonitorPages = [
  { name: "미국 국무부 한국 여행경보", country: "미국", url: "https://travel.state.gov/en/international-travel/travel-advisories/south-korea.html" },
  { name: "영국 FCDO 한국 여행안내", country: "영국", url: "https://www.gov.uk/foreign-travel-advice/south-korea" },
  { name: "일본 외무성 한국 안전정보", country: "일본", url: "https://www.anzen.mofa.go.jp/m/mbtravelspecificinfo_003.html" },
  { name: "프랑스 외교부 한국 안전정보", country: "프랑스", url: "https://www.diplomatie.gouv.fr/fr/information-par-pays/coree-du-sud/conseils-aux-voyageurs-securite" },
  { name: "독일 외무부 한국 안전정보", country: "독일", url: "https://www.auswaertiges-amt.de/de/service/laender/korearepublik-node/korearepubliksicherheit-216132" },
  { name: "호주 Smartraveller 한국 여행안내", country: "호주", url: "https://www.smartraveller.gov.au/destinations/asia/south-korea-republic-korea" },
  { name: "캐나다 한국 여행안내", country: "캐나다", url: "https://travel.gc.ca/destinations/south-korea" },
  { name: "주한미군 공식 발표", country: "주한미군", url: "https://www.usfk.mil/Media/Press-Products/Press-Releases/" }
];
const orderedDeparturePattern = /ordered departure|mandatory departure|ordered (?:the )?departure|dependents? (?:have been |are )?ordered to (?:depart|leave)|eligible family members.{0,80}(?:ordered|must leave)|비필수.{0,30}(?:직원|인력).{0,30}(?:철수|출국)|가족.{0,30}(?:철수 명령|대피 명령|출국 명령)|退避命令|家族.{0,30}(?:退避|出国命令)|départ ordonné|personnel non essentiel.{0,50}(?:quitter|évacu)|angeordnete ausreise|familienangehörige.{0,50}(?:ausreise|evakuierung)/i;
const authorizedDeparturePattern = /authorized departure|voluntary departure|eligible family members.{0,80}(?:authorized|may leave)|non-essential personnel.{0,80}(?:leave|depart)|가족.{0,30}(?:자진 출국|출국 허가)|自主退避|退避を許可|départ autorisé|départ volontaire|freiwillige ausreise|ausreise gestattet/i;
const suspendedOperationsPattern = /embassy operations (?:are )?suspended|suspended operations|embassy (?:is )?closed until further notice|consular services (?:are )?suspended|공관.{0,30}(?:폐쇄|운영 중단)|영사.{0,30}(?:업무 중단|서비스 중단)|大使館.{0,30}(?:閉鎖|業務停止)|activités de l'ambassade.{0,40}suspendues|services consulaires.{0,40}suspendus|botschaft.{0,40}(?:geschlossen|betrieb eingestellt)/i;
const exercisePattern = /exercise|drill|focused passage|courageous channel|annual|routine|훈련|연례|연습/i;
const rules = {
  missile_test: /missile (test|launch|firing)|ballistic missile|미사일 (시험|발사)/i,
  artillery_movement: /artillery (movement|deployment|position|drill)|포병 (이동|배치)|방사포 이동/i,
  ammunition_movement: /ammunition movement|munitions transfer|ammunition shipment|fuel convoy|탄약 (이동|수송)|연료 수송/i,
  field_hospital: /field hospital|mobile hospital|blood suppl|야전병원|이동식 병원|혈액 보급/i,
  military_train: /military train|rail shipment|equipment train|transporter erector launcher|군용열차|군용 열차|장비 수송 열차/i,
  kim_activity: /kim jong un.{0,40}(?:disappear|absence|missing|no public appearance)|leadership.{0,30}(?:bunker|underground)|김정은.{0,30}(?:잠행|공개활동 중단|장기 부재)|지도부.{0,30}(?:은신|지하 이동)/i,
  resident_control: /resident evacuation|movement restriction|city lockdown|road closure|rail closure|주민.{0,30}(?:소개|대피|이동 통제)|도시.{0,20}봉쇄|철도.{0,20}통제/i,
  china_border_closure: /(china|chinese|북중|중국).{0,30}(border|국경|접경).{0,30}(clos|seal|restrict|봉쇄|폐쇄|통제)/i,
  russia_cooperation: /(north korea|dprk|북한).{0,50}(russia|russian|러시아).{0,60}(troop|weapon|ammunition|missile|military cooperation|병력|무기|탄약|군사협력)/i,
  airline_change: /(south korea|seoul|incheon|한국|서울|인천).{0,60}(suspend flights|flight suspension|mass cancellation|airspace closure|운항 중단|대규모 결항|영공 폐쇄)/i,
  war_insurance: /(korea|korean peninsula|한국|한반도).{0,50}(war risk insurance|joint war committee|listed area|전쟁위험 보험|전쟁보험)/i,
  embassy_withdrawal: new RegExp(`${orderedDeparturePattern.source}|${authorizedDeparturePattern.source}|${suspendedOperationsPattern.source}`, "i"),
  usfk_family_evacuation: /USFK.{0,50}(?:family|families|dependents|noncombatant).{0,50}(?:ordered to leave|evacuation order|mandatory departure)|주한미군.{0,40}(?:가족|비전투원).{0,40}(?:철수 명령|대피 명령|출국 명령)/i,
  leadership_hiding: /leadership.{0,30}(bunker|underground|disappear)|kim jong un.{0,30}(disappear|absence)|지도부.{0,30}(대피|은신|지하)/i
};
const riskNewsPattern = /missile|ballistic|nuclear|weapon|artillery|troop|ammunition|military deployment|embassy|evacuat|border clos|field hospital|bunker|미사일|핵|무기|포병|병력|탄약|군사 배치|대사관|철수|국경 봉쇄|야전병원|지도부 은신/i;
const relatedTopic = item => {
  const text = `${item.title} ${item.titleKo || ""}`;
  if (/지뢰|mine|댐 방류|flood|GPS|GNSS|오물풍선|balloon|무인기|drone|접경|border area/i.test(text)) return "접경·생활안전";
  if (/경제|시장|식량|농업|무역|econom|market|food|trade|society|human rights|인권|주민/i.test(text)) return "북한 사회·경제";
  if (/중국|러시아|외교|제재|china|russia|diplom|sanction/i.test(text)) return "대외관계";
  if (/김정은|당대회|정치|leadership|party congress|politic/i.test(text)) return "북한 정치";
  if (/kcna|rodong|조선중앙통신|노동신문/i.test(`${item.source} ${text}`)) return "북한 관영 발표";
  return "북한 관련";
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

async function collectOfficialPage(page) {
  const html = await fetchText(page.url, 18000);
  if (!page.includeArticles) return [];
  const articles = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = decodeXml(match[2]);
    if (title.length < 12 || !relevant.test(title) || /^(north korea|dprk|북한)$/i.test(title)) continue;
    try {
      articles.push({ title, url: new URL(decodeXml(match[1]), page.url).href, source: page.name, date: "", forcedGrade: "A" });
    } catch {}
    if (articles.length >= 5) break;
  }
  return articles;
}

async function collectEmbassyMonitor(page) {
  const html = await fetchText(page.url, 20000);
  const text = decodeXml(html);
  const ordered = orderedDeparturePattern.test(text);
  const authorized = authorizedDeparturePattern.test(text);
  const suspended = suspendedOperationsPattern.test(text);
  const state = ordered || suspended ? "danger" : authorized ? "attention" : "normal";
  const status = ordered ? "가족·비필수 인력 출국 명령 감지"
    : suspended ? "공관 운영 중단 문구 감지"
    : authorized ? "자발적 출국 허가 문구 감지"
    : "공식 대피 문구 없음";
  const monitor = { name: page.name, country: page.country, url: page.url, ok: true, state, status, checkedAt: kstNow() };
  const articles = state === "normal" ? [] : [{
    title: `${page.country}: ${status}`,
    url: page.url,
    source: page.name,
    date: dateFrom(Date.now()),
    forcedGrade: "A",
    officialDeparture: true
  }];
  return { monitor, articles };
}

async function collectSeismic() {
  const start = new Date(Date.now() - 7 * 86400000).toISOString();
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${encodeURIComponent(start)}&minlatitude=33&maxlatitude=44&minlongitude=124&maxlongitude=132&minmagnitude=2.5`;
  const result = JSON.parse(await fetchText(url, 18000));
  return (result.features || []).map(event => ({
    title: `Korean Peninsula seismic event: ${event.properties?.title || "USGS detection"}`,
    url: event.properties?.url || "https://earthquake.usgs.gov/",
    source: "USGS 지진 관측",
    date: dateFrom(event.properties?.time),
    forcedGrade: "A"
  }));
}

async function collectNews() {
  const discoveryJobs = [
    collectGdelt(),
    ...sourceConfig.queries.map(item => collectGoogle(item.query)),
    ...sourceConfig.rss.map(collectDirectRss)
  ];
  const officialJobs = [
    ...officialPages.map(page => collectOfficialPage(page)),
    collectSeismic()
  ];
  const embassyJobs = embassyMonitorPages.map(collectEmbassyMonitor);
  const [settled, officialSettled, embassySettled] = await Promise.all([
    Promise.allSettled(discoveryJobs),
    Promise.allSettled(officialJobs),
    Promise.allSettled(embassyJobs)
  ]);
  const articles = [
    ...settled.flatMap(result => result.status === "fulfilled" ? result.value : []),
    ...officialSettled.flatMap(result => result.status === "fulfilled" ? result.value : []),
    ...embassySettled.flatMap(result => result.status === "fulfilled" ? result.value.articles : [])
  ];
  const successful = settled.filter(result => result.status === "fulfilled").length;
  const officialNames = [...officialPages.map(page => page.name), "USGS 지진 관측"];
  const directSources = officialSettled.map((result, index) => ({
    name: officialNames[index],
    ok: result.status === "fulfilled"
  }));
  const directSuccessful = directSources.filter(item => item.ok).length;
  const embassyMonitors = embassySettled.map((result, index) => result.status === "fulfilled"
    ? result.value.monitor
    : { name: embassyMonitorPages[index].name, country: embassyMonitorPages[index].country, url: embassyMonitorPages[index].url, ok: false, state: "unknown", status: "연결 실패", checkedAt: kstNow() });
  if (!successful) throw new Error("모든 공개 정보처 연결 실패");
  return {
    articles,
    successful,
    total: discoveryJobs.length,
    directSuccessful,
    directTotal: officialJobs.length,
    directSources,
    embassyMonitors
  };
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

function limitPerSource(articles, maximum = 5) {
  const counts = new Map();
  return articles.filter(article => {
    const source = sourceName(article).toLowerCase();
    const count = counts.get(source) || 0;
    if (count >= maximum) return false;
    counts.set(source, count + 1);
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
      verification: grade === "A" ? "공식확인" : grade === "B" ? "주요보도" : grade === "C" ? "전문·단일 확인" : "관영·교차검증 필요",
      riskRelevant: riskNewsPattern.test(`${article.title} ${titleKo || ""}`)
    });
  }
  return output;
}

function verifiedEvents(news) {
  return Object.entries(rules).map(([id, pattern]) => {
    const matches = news.filter(article => pattern.test(`${article.title} ${article.titleKo || ""}`))
      .filter(article => !["embassy_withdrawal", "usfk_family_evacuation"].includes(id) || !exercisePattern.test(`${article.title} ${article.titleKo || ""}`));
    const reliableSources = new Set(matches.filter(article => ["A", "B"].includes(article.confidence)).map(sourceName));
    const hasOfficial = matches.some(article => article.confidence === "A");
    const requiresOfficial = ["embassy_withdrawal", "usfk_family_evacuation"].includes(id);
    const verified = requiresOfficial
      ? hasOfficial
      : hasOfficial || reliableSources.size >= config.verification.minimum_independent_reliable_sources;
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
  const raw = limitPerSource(deduplicate(collected.articles)
    .filter(article => article.title && article.url)
    .filter(article => article.officialDeparture || relevant.test(`${article.title} ${article.source}`))
    .filter(article => article.forcedGrade === "A" || allowed.test(sourceName(article)))
    .sort((a, b) => String(b.date).localeCompare(String(a.date))));
  const news = await translateNews(raw);
  if (!news.length) throw new Error("유효한 공개 출처 뉴스 0건");
  const sourceCounts = Object.entries(news.reduce((counts, item) => {
    counts[item.source] = (counts[item.source] || 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1]);
  const topSourceShare = sourceCounts.length ? Math.round(sourceCounts[0][1] / news.length * 100) : 0;

  const events = verifiedEvents(news);
  const embassyEvent = events.find(item => item.id === "embassy_withdrawal");
  const usfkEvent = events.find(item => item.id === "usfk_family_evacuation");
  const eventMap = new Map(events.map(item => [item.id, item]));
  const eventVerified = id => Boolean(eventMap.get(id)?.verified);
  const eventObserved = id => Boolean(eventMap.get(id)?.sources?.length);
  const combinedState = ids => ids.every(eventVerified) ? ["발생", "danger"]
    : ids.some(eventVerified) || ids.some(eventObserved) ? ["검토중", "unknown"]
    : ["미발생", "normal"];
  const coreState = ids => ids.some(eventVerified) ? ["주의", "watch"]
    : ids.some(eventObserved) ? ["검토중", "unknown"]
    : ["미확인", "unknown"];
  const embassyChecksOk = collected.embassyMonitors.some(item => item.ok);
  const signalStatus = Object.fromEntries(events.map(event => [
    event.id,
    event.verified ? statusFor(event)
      : event.id === "embassy_withdrawal" && embassyChecksOk ? "normal"
      : "unknown"
  ]));
  const combinations = [
    ["포병 + 탄약", ...combinedState(["artillery_movement", "ammunition_movement"])],
    ["야전병원 + 병력", ...combinedState(["field_hospital", "military_train"])],
    ["대사관 + 항공편", ...combinedState(["embassy_withdrawal", "airline_change"])],
    ["지도부 은신 + 미사일", ...combinedState(["leadership_hiding", "missile_test"])],
    ["중국 국경 + 병력", ...combinedState(["china_border_closure", "military_train"])]
  ];
  const coreSignals = [
    ["북한 병력이동", ...coreState(["artillery_movement", "ammunition_movement", "military_train"])],
    ["중국 움직임", ...coreState(["china_border_closure"])],
    ["외국 대사관", embassyEvent?.verified ? "경고" : embassyChecksOk ? "변화 없음" : "확인 실패", embassyEvent?.verified ? "danger" : embassyChecksOk ? "normal" : "unknown"],
    ["북한 군사활동", ...coreState(["missile_test", "artillery_movement", "ammunition_movement"])],
    ["주한미군", usfkEvent?.verified ? "경고" : eventObserved("usfk_family_evacuation") ? "검토중" : "미확인", usfkEvent?.verified ? "danger" : "unknown"]
  ];
  const relatedInfo = news.filter(item => !item.riskRelevant).slice(0, 20).map(item => ({
    ...item,
    topic: relatedTopic(item),
    scoreImpact: "위험도 미반영"
  }));
  const osintPattern = /arms control wonk|institute for the study of war|\bisw\b|understanding war|bellingcat|stimson|rand|covert shores|h i sutton|38 north|beyond parallel|csis/i;
  const osintWatch = news.filter(item => osintPattern.test(`${item.source} ${item.title}`)).slice(0, 12).map(item => ({
    ...item,
    topic: "전문 분석·OSINT",
    scoreImpact: "종합 위험점수 미반영"
  }));
  const anomalyGroups = [
    ["military","군사 이동",["artillery_movement","ammunition_movement","field_hospital","military_train"]],
    ["diplomatic","외교·대피",["embassy_withdrawal","usfk_family_evacuation"]],
    ["mobility","국경·교통",["china_border_closure","airline_change"]],
    ["leadership","지휘·주민",["leadership_hiding","resident_control"]],
    ["strategic","전략 활동",["missile_test","war_insurance"]]
  ].map(([id,label,ids])=>{
    const matched=ids.map(eventId=>eventMap.get(eventId)).filter(Boolean);
    const verified=matched.filter(event=>event.verified).length;
    const observed=matched.filter(event=>!event.verified&&event.sources?.length).length;
    const score=verified?2:observed?1:0;
    return {id,label,score,status:score===2?"확인":score===1?"관찰":"변화 없음",evidence:matched.flatMap(event=>event.sources||[]).slice(0,2)};
  });
  const anomalyScore=anomalyGroups.reduce((sum,item)=>sum+item.score,0);
  const anomalyLevel=anomalyScore>=7?"높음":anomalyScore>=4?"주의":anomalyScore>=2?"관찰":"안정";
  const scoreBreakdown = events.filter(event => event.verified && event.weight > 0);
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
      directSuccessful: collected.directSuccessful,
      directTotal: collected.directTotal,
      directSources: collected.directSources,
      embassyMonitors: collected.embassyMonitors,
      uniqueSources: sourceCounts.length,
      topSource: sourceCounts[0]?.[0] || "—",
      topSourceShare,
      concentrationWarning: topSourceShare >= 50,
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
    officialAlert: {
      status: embassyEvent?.verified ? "외국 공관 가족·비필수 인력 대피 조치 공식 감지"
        : usfkEvent?.verified ? "주한미군 가족·비전투원 대피 명령 공식 감지"
        : "현재 공식 긴급 경보 없음",
      level: embassyEvent?.verified || usfkEvent?.verified ? "alert" : "normal",
      checkedAt: kstNow()
    },
    scoreBreakdown,
    combinations,
    coreSignals,
    news,
    relatedInfo,
    anomalyIndex: {
      score: anomalyScore,
      maximum: 10,
      level: anomalyLevel,
      categories: anomalyGroups,
      note: "공개자료의 이상 패턴을 보여주는 보조 지수이며 종합 위험점수에는 반영하지 않습니다."
    },
    osintWatch,
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
    signalStatus,
    indicatorEvidence: {
      embassy_withdrawal: collected.embassyMonitors.map(item => ({
        title: `${item.country}: ${item.status}`,
        titleKo: `${item.country}: ${item.status}`,
        url: item.url,
        source: item.name,
        date: item.checkedAt,
        confidence: item.ok ? "A" : "D"
      }))
    }
  };
  await fs.writeFile(dashboardFile, `${JSON.stringify(data, null, 2)}\n`);
  await saveSnapshot(data);
} catch (error) {
  console.warn(`자동 갱신 실패: ${error.message}. 이전 정상 데이터를 유지합니다.`);
}

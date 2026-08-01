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
  troop_movement: /large[- ]scale troop|troop (?:movement|concentration|deployment|mass)|대규모 병력|병력 (?:이동|집결|전개)/i,
  artillery_movement: /artillery (movement|deployment|position|drill)|포병 (이동|배치)|방사포 이동/i,
  ammunition_movement: /ammunition movement|munitions transfer|ammunition shipment|fuel convoy|탄약 (이동|수송)|연료 수송/i,
  field_hospital: /field hospital|mobile hospital|blood suppl|야전병원|이동식 병원|혈액 보급/i,
  military_train: /military train|rail shipment|equipment train|transporter erector launcher|군용열차|군용 열차|장비 수송 열차/i,
  resident_control: /resident evacuation|movement restriction|city lockdown|road closure|rail closure|주민.{0,30}(?:소개|대피|이동 통제)|도시.{0,20}봉쇄|철도.{0,20}통제/i,
  china_border_closure: /(china|chinese|북중|중국).{0,30}(border|국경|접경).{0,30}(clos|seal|restrict|봉쇄|폐쇄|통제)/i,
  russia_cooperation: /(north korea|dprk|북한).{0,50}(russia|russian|러시아).{0,60}(troop|weapon|ammunition|missile|military cooperation|병력|무기|탄약|군사협력)/i,
  airline_change: /(south korea|seoul|incheon|한국|서울|인천).{0,60}(suspend flights|flight suspension|mass cancellation|airspace closure|운항 중단|대규모 결항|영공 폐쇄)/i,
  war_insurance: /(korea|korean peninsula|한국|한반도).{0,50}(war risk insurance|joint war committee|listed area|전쟁위험 보험|전쟁보험)/i,
  embassy_withdrawal: new RegExp(`${orderedDeparturePattern.source}|${authorizedDeparturePattern.source}|${suspendedOperationsPattern.source}`, "i"),
  usfk_family_evacuation: /USFK.{0,50}(?:family|families|dependents|noncombatant).{0,50}(?:ordered to leave|evacuation order|mandatory departure)|주한미군.{0,40}(?:가족|비전투원).{0,40}(?:철수 명령|대피 명령|출국 명령)/i,
  leadership_hiding: /leadership.{0,30}(bunker|underground|disappear)|kim jong un.{0,30}(disappear|absence)|지도부.{0,30}(대피|은신|지하)/i,
  readiness_change: /(?:alert level|readiness|defcon|watchcon|jin dog|경계태세|진돗개|데프콘).{0,50}(?:raised|increase|격상|발령)/i,
  hybrid_disruption: /(?:GPS|GNSS|communications?|telecom|cyber).{0,50}(?:jamming|disruption|outage|attack|교란|장애|공격)/i,
  navigation_warning: /(?:NOTAM|NAVTEX|navigation warning|airspace closure|항행경보|항공고시|해상경보|영공 폐쇄)/i
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
const hostOf = value => { try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return ""; } };
const primaryOrigin = article => {
  const text=`${article.title} ${sourceName(article)} ${article.url}`;
  const reprint=text.match(/\b(Reuters|Associated Press|AP News|AFP|Yonhap|연합뉴스|KCNA|조선중앙통신)\b/i)?.[1];
  return (reprint||sourceName(article)||hostOf(article.url)).toLowerCase().replace(/[^a-z0-9가-힣]+/g,"-");
};
const sourceTypeFor = article => {
  const text=`${sourceName(article)} ${article.url}`;
  if(/USGS|satellite imagery|위성|seismic|지진 관측/i.test(text)) return "직접 관측자료";
  if(article.forcedGrade==="A"||sourcePatterns.A.test(text)) return "직접 공식자료";
  if(/Reuters|Associated Press|AP News|AFP|Yonhap|연합뉴스/i.test(text)) return "주요 통신사 취재";
  if(/38 North|Beyond Parallel|CSIS|ISW|Stimson|RAND|RUSI|IISS/i.test(text)) return "전문기관 분석";
  if(/KCNA|Rodong|조선중앙통신|노동신문/i.test(text)) return "북한 관영매체";
  if(/anonymous|unnamed|익명|관계자/i.test(article.title||"")) return "익명 관계자 주장";
  return article.forcedGrade==="D"?"SNS·미검증 자료":"언론·전문보도";
};
const claimNatureFor = article => /said|claimed|according to|주장|밝혔다|관계자|소식통/i.test(article.title||"")?"주장·인용":"직접 발표·관측";
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
    url: index<officialPages.length?officialPages[index].url:"https://earthquake.usgs.gov/",
    kind: index<officialPages.length?"공식 발표 원문":"지진 관측 데이터",
    ok: result.status === "fulfilled",
    records: result.status === "fulfilled" ? result.value.length : 0,
    checkedAt: kstNow()
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
    const sourceType=sourceTypeFor(article),originKey=primaryOrigin(article),claimNature=claimNatureFor(article);
    output.push({
      title: article.title,
      url: article.url,
      source: sourceName(article),
      date: article.date,
      titleKo: titleKo && !/MYMEMORY WARNING/i.test(titleKo) ? titleKo : article.title,
      confidence: grade,
      sourceType,originKey,claimNature,
      originalSource: originKey,
      directReport: claimNature==="직접 발표·관측",
      checkedAt:kstNow(),
      verification: sourceType==="직접 공식자료" ? "공식 원문" : sourceType==="직접 관측자료"?"직접 관측":grade === "B" ? "주요보도·원출처 확인 필요" : grade === "C" ? "전문·단일 확인" : "주장·교차검증 필요",
      riskRelevant: riskNewsPattern.test(`${article.title} ${titleKo || ""}`)
    });
  }
  return output;
}

function verifiedEvents(news) {
  return Object.entries(rules).map(([id, pattern]) => {
    const matches = news.filter(article => pattern.test(`${article.title} ${article.titleKo || ""}`))
      .filter(article => !["embassy_withdrawal", "usfk_family_evacuation"].includes(id) || !exercisePattern.test(`${article.title} ${article.titleKo || ""}`));
    const independentReliable = new Set(matches.filter(article => ["직접 공식자료","직접 관측자료","주요 통신사 취재"].includes(article.sourceType)&&article.claimNature!=="주장·인용").map(article=>article.originKey));
    const directObservations=new Set(matches.filter(article=>article.sourceType==="직접 관측자료").map(article=>article.originKey));
    const authorityOfficial=matches.some(article=>article.sourceType==="직접 공식자료"&&["embassy_withdrawal","usfk_family_evacuation","readiness_change","navigation_warning"].includes(id));
    const partyClaims=matches.filter(article=>["북한 관영매체","교전 당사자 주장"].includes(article.sourceType)).length;
    const verified = authorityOfficial || independentReliable.size>=config.verification.minimum_independent_reliable_sources || (directObservations.size>=1&&independentReliable.size>=2);
    const partiallyVerified=!verified&&matches.length>0;
    const detection=config.events[id]?.detectability||"낮음";
    const judgmentConfidence=verified?(independentReliable.size>=2||authorityOfficial?"높음":"중간"):partiallyVerified?"낮음":/높음/.test(detection)?"중간":"낮음";
    return {
      id,
      label: config.events[id].label,
      weight: config.events[id].weight,
      verified,
      partiallyVerified,
      status:verified?"확인됨":partiallyVerified?"일부 확인":/높음/.test(detection)?"공개자료상 미탐지":"관측자료 부족",
      independentSourceCount:independentReliable.size,
      directObservationCount:directObservations.size,
      partyClaimCount:partyClaims,
      judgmentConfidence,
      detectability:detection,
      informationGap:/낮음/.test(detection)?`${config.events[id].label}은 공개정보로 직접 탐지하기 어렵습니다.`:"공개 공식자료 범위 밖의 정보는 확인할 수 없습니다.",
      opposingEvidence:matches.length?[]:["공개 검색 범위에서 신규 근거가 발견되지 않음"],
      checkedAt:kstNow(),
      sources: matches.slice(0, 3).map(article => ({
        label: article.titleKo || article.title,
        url: article.url,
        grade: article.confidence,source:article.source,sourceType:article.sourceType,originKey:article.originKey,publishedAt:article.date,checkedAt:article.checkedAt,claim:`${config.events[id].label} 관련 근거`,directReport:article.directReport
      }))
    };
  });
}

const levelFor = score => score >= 70 ? "심각" : score >= 50 ? "경계" : score >= 30 ? "주의" : score >= 15 ? "관심" : "평상시";
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
  const todayKst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  let comparisonSnapshot = previous;
  try {
    const historyDates = JSON.parse(await fs.readFile(historyIndexFile, "utf8"));
    const priorDate = historyDates.find(date => date !== todayKst);
    if (priorDate) comparisonSnapshot = JSON.parse(await fs.readFile(new URL(`${priorDate}.json`, historyDir), "utf8"));
  } catch {}
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
    : ids.some(eventVerified) || ids.some(eventObserved) ? ["일부 발생", "attention"]
    : ids.some(id=>/낮음/.test(eventMap.get(id)?.detectability||"")) ? ["판단 불가", "unknown"]
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
  const combinationDefs=[
    ["포병 이동 + 탄약 전방 이동",["artillery_movement","ammunition_movement"]],
    ["야전병원 + 병력 집결",["field_hospital","troop_movement"]],
    ["지도부 은신 + 미사일 분산배치",["leadership_hiding","artillery_movement"]],
    ["대사관 철수 + 항공편 중단",["embassy_withdrawal","airline_change"]],
    ["주한미군 대피 + 군 경계태세",["usfk_family_evacuation","readiness_change"]],
    ["중국 국경 비상조치 + 주민·병력 이동",["china_border_closure","resident_control","troop_movement"]],
    ["GPS 교란 + 통신 장애 + 군사행동",["hybrid_disruption","artillery_movement"]],
    ["연료·탄약 + 지휘부 분산 + 민간 통제",["ammunition_movement","leadership_hiding","resident_control"]]
  ];
  const combinations=combinationDefs.map(([label,ids])=>{const [status,tone]=combinedState(ids);return{label,ids,status,tone,confirmed:ids.filter(eventVerified).length,observed:ids.filter(eventObserved).length,total:ids.length,reason:status==="판단 불가"?"구성 지표의 직접 관측자료가 부족합니다.":`${ids.filter(eventObserved).length}/${ids.length}개 구성 신호에 공개 근거가 있습니다.`}});
  const coreSignals = [
    ["북한 병력이동", ...coreState(["artillery_movement", "ammunition_movement", "military_train"])],
    ["중국 움직임", ...coreState(["china_border_closure"])],
    ["외국 대사관", embassyEvent?.verified ? "경고" : embassyChecksOk ? "변화 없음" : "확인 실패", embassyEvent?.verified ? "danger" : embassyChecksOk ? "normal" : "unknown"],
    ["북한 군사활동", ...coreState(["missile_test", "artillery_movement", "ammunition_movement"])],
    ["주한미군", usfkEvent?.verified ? "경고" : eventObserved("usfk_family_evacuation") ? "검토중" : "미확인", usfkEvent?.verified ? "danger" : "unknown"]
  ];
  const priorEventMap=new Map((comparisonSnapshot.signalAssessments||[]).map(item=>[item.id,item]));
  const failedCount=collected.directSources.filter(item=>!item.ok).length+collected.embassyMonitors.filter(item=>!item.ok).length;
  const signalAssessments=events.map(event=>({
    ...event,
    change:(priorEventMap.get(event.id)?.status||event.status)===event.status?"이전 상태 유지":`${priorEventMap.get(event.id)?.status||"기록 없음"} → ${event.status}`,
    collectionStatus:event.verified
      ? ((priorEventMap.get(event.id)?.status||event.status)===event.status?"재검증 완료":"신규 확인")
      : event.partiallyVerified?"신규 확인"
      : /낮음/.test(event.detectability||"")?"직접 관측 부족"
      : failedCount>0?"이전 상태 유지"
      : "새로운 자료 없음",
    lastNewInformation:event.sources[0]?.publishedAt||"확인된 신규 정보 없음",
    lastDirectObservation:event.sources.find(source=>source.sourceType==="직접 관측자료")?.publishedAt||"직접 관측 부족",
    sourceReliability:event.sources[0]?.sourceType||"확인 가능한 원정보 없음",
    stateReason:event.verified?`독립 원정보 ${event.independentSourceCount}개 또는 발령권한 기관 자료로 확인`:
      event.partiallyVerified?"관련 공개자료는 있으나 독립 교차검증 기준 미충족":"확인 가능한 신규 원정보가 없으며 탐지 가능성을 함께 고려함"
  }));
  const completenessParts=events.map(event=>event.verified?100:event.partiallyVerified?65:/높음/.test(event.detectability)?60:/중간/.test(event.detectability)?40:20);
  const completeness=Math.max(0,Math.round(completenessParts.reduce((a,b)=>a+b,0)/Math.max(1,completenessParts.length)-failedCount*2));
  const staleIndicators=signalAssessments.filter(item=>{const stamp=Date.parse(item.lastNewInformation);return !Number.isFinite(stamp)||Date.now()-stamp>24*3600000}).length;
  const latestDirectObservation=signalAssessments.map(item=>item.lastDirectObservation).filter(value=>value&&value!=="직접 관측 부족").sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||"최신 직접 관측자료 없음";
  const confidence=completeness>=80&&events.filter(event=>event.verified).every(event=>event.judgmentConfidence==="높음")?"높음":completeness>=55?"중간":"낮음";
  const largestGaps=signalAssessments.filter(item=>item.status==="관측자료 부족"||item.status==="평가 불가").sort((a,b)=>a.detectability.localeCompare(b.detectability)).slice(0,4).map(item=>item.informationGap);
  const actionByLevel={
    평상시:["집·직장·학교 주변 대피소 2곳 저장","가족 연락계획과 집결지 지정","생존가방과 정부 재난알림 점검"],
    관심:["휴대전화·보조배터리 충전","식수·상비약·현금 보충","가족 위치·귀가경로와 차량 연료 확인"],
    주의:["불필요한 장거리 이동 재검토","대피소 실제 이동경로 확인","중요 서류·의약품 즉시 반출 상태 유지"],
    경계:["즉시 대피 가능한 상태 유지","가족별 이동 담당과 대체 연락방법 가동","정부·지자체 공식 지시를 최우선 확인"],
    심각:["가까운 민방위 대피소나 지하시설로 즉시 대피","정부 방송·재난문자를 계속 확인","확인되지 않은 SNS 정보에 따라 이동하지 않기"]
  };
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
    const evidence=matched.flatMap(event=>event.sources||[]).slice(0,3);
    return {id,label,score,status:score===2?"확인":score===1?"관찰":"변화 없음",checkedAt:kstNow(),evidence};
  });
  const anomalyScore=anomalyGroups.reduce((sum,item)=>sum+item.score,0);
  const anomalyLevel=anomalyScore>=7?"높음":anomalyScore>=4?"주의":anomalyScore>=2?"관찰":"안정";
  const oldAnomalyGroups=new Map((comparisonSnapshot.anomalyIndex?.categories||[]).map(item=>[item.id,item]));
  const anomalyAdded=anomalyGroups.filter(item=>item.score>(oldAnomalyGroups.get(item.id)?.score||0));
  const anomalyCleared=anomalyGroups.filter(item=>item.score<(oldAnomalyGroups.get(item.id)?.score||0));
  const sampleDate=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const anomalyTrend=[
    ...(previous.anomalyIndex?.trend||[]).filter(item=>item.date!==sampleDate),
    {date:sampleDate,score:anomalyScore}
  ].slice(-90);
  const scoreBreakdown = events.filter(event => event.verified && event.weight > 0);
  const baseScore=scoreBreakdown.reduce((sum,event)=>sum+event.weight,0);
  const activeCombinations=combinations.filter(item=>item.status==="발생");
  const combinationBonus=activeCombinations.length*Number(config.combination_bonus||0);
  const decisiveSignal=scoreBreakdown.some(event=>config.events[event.id]?.decisive);
  const calculatedScore=Math.min(100,Math.max(decisiveSignal?50:0,baseScore+combinationBonus));
  const oldScore = Number(previous.risk?.score || 0);
  const oldLevel=previous.risk?.level||"평상시";
  const oldUpdated=Date.parse(previous.generatedAt||"");
  const deescalationHold=calculatedScore<oldScore&&["경계","심각"].includes(oldLevel)&&Number.isFinite(oldUpdated)&&Date.now()-oldUpdated<24*3600000;
  const riseLimited=!decisiveSignal&&!activeCombinations.length&&calculatedScore>oldScore+20;
  const score=deescalationHold?oldScore:riseLimited?oldScore+20:calculatedScore;
  const oldVerified = new Set((previous.scoreBreakdown || []).map(item => item.id));
  const newVerified = new Set(scoreBreakdown.map(item => item.id));
  const added = scoreBreakdown.filter(item => !oldVerified.has(item.id));
  const cleared = [...oldVerified].filter(id => !newVerified.has(id));
  const trend = [...(previous.risk?.trend7 || []), score].slice(-7);
  const data = {
    ...previous,
    schemaVersion: 3,
    generatedAt:new Date().toISOString(),
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
      checkedAt: kstNow(),
      failedSources: collected.directSources.filter(item=>!item.ok).map(item=>item.name)
    },
    risk: {
      score,
      level: levelFor(score),
      trend7: trend,
      reason: scoreBreakdown.length
        ? `교차검증된 위험신호 ${scoreBreakdown.length}개가 점수에 반영됐습니다.`
        : "공식 발표 또는 독립 원정보 2개로 확인된 위험신호가 없습니다.",
      calculatedScore,
      deescalationHold,
      riseLimited,
      deescalationReason:deescalationHold?"경계·심각 단계 하향에는 최소 24시간 안정 확인 또는 공식 해제가 필요합니다.":"하향 보류 조건 없음"
    },
    judgment:{
      confidence,
      completeness,
      largestGaps,
      support:scoreBreakdown.map(item=>`${item.label}: ${item.independentSourceCount}개 독립 원정보`).slice(0,4),
      upwardContributors:scoreBreakdown.map(item=>`${item.label} +${item.weight}`).slice(0,6),
      downwardContributors:cleared.map(id=>`${config.events[id]?.label||id} 해제`).slice(0,6),
      opposingEvidence:events.flatMap(item=>item.opposingEvidence||[]).slice(0,4),
      underestimationRisk:"북한 내부 병력·군수·지하시설 활동의 직접 공개관측이 제한됩니다.",
      overestimationRisk:"훈련·정치적 위협 발언·동일 원출처 재인용이 실제 작전준비로 과대해석될 수 있습니다.",
      alternatives:["통상 훈련 또는 억제 메시지","대외 협상용 강압","실제 준비활동이 공개자료에 포착되지 않았을 가능성"],
      nextSignals:["전방 탄약·연료 이동의 직접 관측","지도부 장기 은신","대사관·주한미군 실제 대피","정부·군 경계태세 공식 격상"],
      disclaimer:"이 평가는 공개적으로 검증 가능한 자료를 기반으로 한다. 공개자료에서 확인되지 않았다는 것이 실제로 존재하지 않는다는 의미는 아니다. 공식 재난경보나 정부 지시가 발령되면 대시보드 판단보다 해당 지시를 우선한다."
    },
    dataQuality:{
      completeness,
      successfulIndicators:signalAssessments.filter(item=>item.sources.length||/미탐지/.test(item.status)).length,
      retainedIndicators:signalAssessments.filter(item=>item.change==="이전 상태 유지").length,
      failedIndicators:failedCount,
      staleIndicators,
      latestDirectObservation,
      checkedAt:kstNow(),
      collectionScope:{targets:collected.total+collected.directTotal+collected.embassyMonitors.length,period:`최근 ${sourceConfig.freshness_days}일`,lastSearch:kstNow(),inaccessible:["북한 내부 비공개 군사통신","유료 상업위성 전체 영상","비공개 보험시장 실시간 요율","정보기관 비공개 자료"]}
    },
    ingestion:{
      collected:collected.articles.length,
      retained:news.length,
      duplicatesAndReprints:Math.max(0,collected.articles.length-raw.length),
      commentaryExcluded:news.filter(item=>!item.riskRelevant).length,
      riskRelevant:news.filter(item=>item.riskRelevant).length,
      newIndependentInformation:new Set(events.flatMap(event=>event.sources.map(source=>source.originKey))).size
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
    urgentChange: score >= 50 ? `${levelFor(score)} 단계 · 공식 채널 확인 필요` : "현재 공식 긴급경보 없음",
    officialAlert: {
      status: embassyEvent?.verified ? "외국 공관 가족·비필수 인력 대피 조치 공식 감지"
        : usfkEvent?.verified ? "주한미군 가족·비전투원 대피 명령 공식 감지"
        : eventVerified("readiness_change") ? "정부·군 경계태세 공식 격상 감지"
        : eventVerified("navigation_warning") ? "공식 항행·운항 통제 감지"
        : "현재 공식 긴급 경보 없음",
      level: embassyEvent?.verified || usfkEvent?.verified || eventVerified("readiness_change") || eventVerified("navigation_warning") ? "alert" : "normal",
      checkedAt: kstNow()
    },
    scoreBreakdown,
    scoreModel:{baseScore,combinationBonus,opposingEvidenceDiscount:0,informationGapPenalty:Math.min(config.information_gap_penalty_cap||20,Math.round((100-completeness)/5)),decisiveSignal,thresholds:config.thresholds,modelVersion:config.version},
    combinations,
    coreSignals,
    signals:signalAssessments,
    signalAssessments,
    preparedness:{level:levelFor(score),actions:actionByLevel[levelFor(score)],officialGuidance:{name:"국민안전24 비상시 국민행동요령",url:"https://www.safekorea.go.kr/safekorea-kor/acts/nacts/action-guide.do?actsHeaderTitle=%EB%B9%84%EC%83%81%EC%82%AC%ED%83%9C&category=stateOfEmergency&menuSn=4",checkedAt:kstNow()}},
    news,
    relatedInfo,
    anomalyIndex: {
      score: anomalyScore,
      maximum: 10,
      level: anomalyLevel,
      categories: anomalyGroups,
      change: {
        added: anomalyAdded.map(item=>item.label),
        cleared: anomalyCleared.map(item=>item.label),
        delta: anomalyScore-Number(comparisonSnapshot.anomalyIndex?.score||0)
      },
      trend: anomalyTrend,
      checkedAt: kstNow(),
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

import fs from "node:fs/promises";

const file = new URL("../data/dashboard.json", import.meta.url);
const historyDir = new URL("../data/history/", import.meta.url);
const historyIndex = new URL("../data/history/index.json", import.meta.url);
const data = JSON.parse(await fs.readFile(file, "utf8"));
const query = encodeURIComponent('(North Korea OR DPRK) (military OR missile OR embassy OR evacuation OR border)');
const endpoint = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=30&format=json&sort=datedesc`;
const googleNews = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
const allowed = /reuters|associated press|ap news|bbc|state department|pentagon|iaea|38 north|csis/i;

const decodeXml = (value = "") => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function collectNews() {
  try {
    const response = await fetch(endpoint, { headers: { "user-agent": "korea-security-dashboard/1.0" } });
    if (!response.ok) throw new Error(`GDELT ${response.status}`);
    const result = await response.json();
    return (result.articles || [])
      .filter(article => allowed.test(`${article.domain} ${article.title}`))
      .slice(0, 12)
      .map(article => ({
        title: article.title,
        url: article.url,
        source: article.domain,
        date: String(article.seendate || "").slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
      }));
  } catch {
    const response = await fetch(googleNews, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!response.ok) throw new Error(`Google News ${response.status}`);
    const xml = await response.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map(match => match[1])
      .map(item => {
        const title = decodeXml(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
        const url = decodeXml(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "");
        const source = decodeXml(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "Google News");
        const rawDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
        return { title, url, source, date: rawDate ? new Date(rawDate).toISOString().slice(0, 10) : "" };
      })
      .filter(article => article.title && article.url && allowed.test(`${article.source} ${article.title}`))
      .slice(0, 12);
  }
}

async function translateNews(news) {
  const cached = new Map((data.news || []).map(item => [item.title, item.titleKo]));
  const translated = [];
  for (const article of news) {
    if (cached.get(article.title)) {
      translated.push({ ...article, titleKo: cached.get(article.title) });
      continue;
    }
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(article.title)}&langpair=en|ko`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("translation");
      const result = await response.json();
      const titleKo = decodeXml(result.responseData?.translatedText || "");
      translated.push({ ...article, titleKo: titleKo && !/MYMEMORY WARNING/i.test(titleKo) ? titleKo : article.title });
    } catch {
      translated.push({ ...article, titleKo: article.title });
    }
  }
  return translated;
}

async function saveDailySnapshot() {
  const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await fs.mkdir(historyDir, { recursive: true });
  await fs.writeFile(new URL(`${kstDate}.json`, historyDir), `${JSON.stringify(data, null, 2)}\n`);
  let dates = [];
  try { dates = JSON.parse(await fs.readFile(historyIndex, "utf8")); } catch {}
  dates = [kstDate, ...dates.filter(date => date !== kstDate)].slice(0, 90);
  await fs.writeFile(historyIndex, `${JSON.stringify(dates, null, 2)}\n`);
}

try {
  const news = await collectNews();
  if (news.length) data.news = await translateNews(news);
  data.updatedAt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short"
  }).format(new Date());
  data.dailyChange = news.length ? `새 해외 보도 ${news.length}건` : "새 주요 보도 없음";
  data.urgentChange = "자동 판정 안 함 · 공식 출처 확인 필요";
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
  await saveDailySnapshot();
} catch (error) {
  console.warn(`뉴스 수집 실패: ${error.message}. 이전 정상 데이터를 유지합니다.`);
}

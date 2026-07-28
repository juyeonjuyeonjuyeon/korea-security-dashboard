import fs from "node:fs/promises";

const file = new URL("../data/dashboard.json", import.meta.url);
const data = JSON.parse(await fs.readFile(file, "utf8"));
const query = encodeURIComponent('(North Korea OR DPRK) (military OR missile OR embassy OR evacuation OR border)');
const endpoint = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=20&format=json&sort=datedesc`;

try {
  const response = await fetch(endpoint, { headers: { "user-agent": "korea-security-dashboard/1.0" } });
  if (!response.ok) throw new Error(`GDELT ${response.status}`);
  const result = await response.json();
  const allowed = /reuters|apnews|bbc|state\.gov|defense\.gov|gov\.uk|iaea|38north|csis/i;
  data.news = (result.articles || [])
    .filter(article => allowed.test(`${article.domain} ${article.url}`))
    .slice(0, 12)
    .map(article => ({
      title: article.title,
      url: article.url,
      source: article.domain,
      date: String(article.seendate || "").slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
    }));
  data.updatedAt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short"
  }).format(new Date());
  data.dailyChange = data.news.length ? `새 해외 보도 ${data.news.length}건` : "새 주요 보도 없음";
  data.urgentChange = "자동 판정 안 함 · 공식 출처 확인 필요";
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

import fs from "node:fs/promises";

const outputFile = new URL("../data/tech.json", import.meta.url);
const previous = JSON.parse(await fs.readFile(outputFile, "utf8"));
const userAgent = "juyeon-news-tech/1.0 (+https://github.com/juyeonjuyeonjuyeon/korea-security-dashboard)";
const categories = [
  {id:"ai",code:"AI",label:"인공지능",query:"(artificial intelligence OR generative AI OR AI model OR AI agent)",pattern:/artificial intelligence|\bAI\b|model|agent|OpenAI|Anthropic|DeepMind/i},
  {id:"chips",code:"CHIP",label:"반도체·컴퓨팅",query:"(semiconductor OR chip OR GPU OR quantum computing)",pattern:/semiconductor|chip|\bGPU\b|Nvidia|quantum|processor|foundry/i},
  {id:"robotics",code:"ROBOT",label:"로봇·모빌리티",query:"(robotics OR humanoid robot OR autonomous vehicle OR drone technology)",pattern:/robot|humanoid|autonomous|self-driving|drone|mobility/i},
  {id:"cyber",code:"CYBER",label:"사이버보안",query:"(cybersecurity OR ransomware OR zero-day OR data breach)",pattern:/cyber|ransomware|malware|zero-day|breach|security flaw/i},
  {id:"space",code:"SPACE",label:"우주·통신",query:"(space technology OR satellite OR rocket OR 6G)",pattern:/space|satellite|rocket|SpaceX|NASA|\b6G\b|telecom/i},
  {id:"energy",code:"ENERGY",label:"에너지·기후기술",query:"(battery technology OR nuclear fusion OR clean energy technology OR climate tech)",pattern:/battery|fusion|clean energy|solar|climate tech|nuclear|energy storage/i}
];
const allowedSource = /Reuters|Associated Press|\bAP\b|BBC|MIT Technology Review|IEEE Spectrum|Ars Technica|The Verge|TechCrunch|Wired|Financial Times|Bloomberg|OpenAI|Anthropic|Google DeepMind|NVIDIA|Microsoft|Apple|NASA/i;

const decodeXml = (value="") => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]+>/g," ")
  .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
  .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)))
  .replace(/\s+/g," ").trim();
const dateFrom = raw => { const date=new Date(raw); return Number.isNaN(date.valueOf())?"":date.toISOString().slice(0,16).replace("T"," "); };
const gradeFor = value => /reuters|associated press|\bap news\b|\bbbc\b/i.test(value)?"B":/openai\.com|anthropic\.com|deepmind\.google|nvidia\.com|microsoft\.com|apple\.com|nasa\.gov|ieee\.org/i.test(value)?"A":"C";
const sourceFromTitle = title => title.match(/\s+-\s+([^-]+)$/)?.[1]?.trim() || "Google News";

function parseRss(xml, category) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match=>{
    const item=match[1];
    const title=decodeXml(item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");
    const url=decodeXml(item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]||"");
    const source=decodeXml(item.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1]||"")||sourceFromTitle(title);
    const rawDate=item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1];
    return {title,url,source,date:dateFrom(rawDate),category:category.label,categoryId:category.id,confidence:gradeFor(`${source} ${url}`)};
  });
}
async function fetchText(url){
  const response=await fetch(url,{headers:{"user-agent":userAgent},signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw Error(`${response.status} ${url}`);
  return response.text();
}
async function collect(category){
  const query=encodeURIComponent(`${category.query} technology when:7d`);
  const url=`https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  return parseRss(await fetchText(url),category);
}
const deduplicate = articles => {
  const seen=new Set();
  return articles.filter(article=>{
    const key=article.title.toLowerCase().replace(/\s+-\s+[^-]+$/,"").replace(/[^a-z0-9가-힣]+/g," ").trim();
    if(!key||seen.has(key)) return false;
    seen.add(key); return true;
  });
};
async function translate(articles){
  const cached=new Map((previous.news||[]).map(item=>[item.title,item.titleKo]));
  const output=[];
  for(const article of articles.slice(0,40)){
    let titleKo=cached.get(article.title);
    if(!titleKo&&!/[가-힣]/.test(article.title)){
      try{
        const response=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(article.title)}&langpair=en|ko`,{signal:AbortSignal.timeout(7000)});
        const result=response.ok?await response.json():{};
        titleKo=decodeXml(result.responseData?.translatedText||"");
      }catch{}
    }
    output.push({...article,titleKo:titleKo&&!/MYMEMORY WARNING/i.test(titleKo)?titleKo:article.title});
  }
  return output;
}
const kstNow = () => new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",dateStyle:"medium",timeStyle:"short"}).format(new Date());

try{
  const settled=await Promise.allSettled(categories.map(collect));
  const successful=settled.filter(item=>item.status==="fulfilled").length;
  if(!successful) throw Error("모든 기술 정보처 연결 실패");
  const raw=deduplicate(settled.flatMap(item=>item.status==="fulfilled"?item.value:[]))
    .filter(item=>item.title&&item.url)
    .filter(item=>allowedSource.test(item.source))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const news=await translate(raw);
  if(!news.length) throw Error("유효한 기술 기사 없음");
  const cutoff=Date.now()-24*3600000;
  const categoryData=categories.map(category=>{
    const items=news.filter(item=>item.categoryId===category.id);
    return {
      id:category.id,code:category.code,label:category.label,count:items.length,
      summary:items[0]?.titleKo||"새로운 주요 변화 확인 없음",
      latest:items[0]?.date||"—"
    };
  });
  const ranked=[...categoryData].sort((a,b)=>b.count-a.count);
  const data={
    schemaVersion:1,updatedAt:kstNow(),
    headline:ranked[0]?.count?`${ranked[0].label} 분야의 새 보도가 가장 활발합니다.`:"확인된 주요 기술 변화가 없습니다.",
    metrics:{
      articleCount:news.length,
      recentCount:news.filter(item=>new Date(`${item.date.replace(" ","T")}:00Z`).valueOf()>=cutoff).length,
      sourceCount:new Set(news.map(item=>item.source)).size
    },
    summary:ranked.filter(item=>item.count).slice(0,4).map(item=>`${item.label}: ${item.summary}`),
    categories:categoryData,news,
    sourceHealth:{successful,total:categories.length,checkedAt:kstNow()}
  };
  await fs.writeFile(outputFile,`${JSON.stringify(data,null,2)}\n`);
}catch(error){
  console.warn(`기술 뉴스 자동 갱신 실패: ${error.message}. 이전 정상 데이터를 유지합니다.`);
}

import fs from "node:fs/promises";

const outputFile = new URL("../data/tech.json", import.meta.url);
const previous = JSON.parse(await fs.readFile(outputFile, "utf8"));
const userAgent = "juyeon-news-tech/1.0 (+https://github.com/juyeonjuyeonjuyeon/korea-security-dashboard)";
const categories = [
  {id:"ai",code:"AI",label:"인공지능",query:"(artificial intelligence OR generative AI OR AI model OR AI agent) (launch OR update OR policy OR regulation OR startup OR funding OR OpenAI OR Anthropic OR Google OR Microsoft OR Meta)",pattern:/artificial intelligence|\bAI\b|model|agent|OpenAI|Anthropic|DeepMind/i,cadence:"daily"},
  {id:"chips",code:"CHIP",label:"반도체·컴퓨팅",query:"(semiconductor OR chip OR GPU OR quantum computing) (NVIDIA OR AMD OR Intel OR TSMC OR Samsung OR policy OR export control OR startup OR funding)",pattern:/semiconductor|chip|\bGPU\b|Nvidia|quantum|processor|foundry/i,cadence:"daily"},
  {id:"robotics",code:"ROBOT",label:"로봇·모빌리티",query:"(robotics OR humanoid robot OR autonomous vehicle OR drone technology) (Tesla OR Boston Dynamics OR policy OR regulation OR startup OR funding)",pattern:/robot|humanoid|autonomous|self-driving|drone|mobility/i,cadence:"daily"},
  {id:"cyber",code:"CYBER",label:"사이버보안",query:"(cybersecurity OR ransomware OR zero-day OR data breach) (Microsoft OR Google OR policy OR regulation OR startup OR funding)",pattern:/cyber|ransomware|malware|zero-day|breach|security flaw/i,cadence:"daily"},
  {id:"space",code:"SPACE",label:"우주·통신",query:"(space technology OR satellite OR rocket OR 6G) (SpaceX OR Amazon OR NASA OR policy OR regulation OR startup OR funding)",pattern:/space|satellite|rocket|SpaceX|NASA|\b6G\b|telecom/i,cadence:"daily"},
  {id:"energy",code:"ENERGY",label:"에너지·기후기술",query:"(battery technology OR nuclear fusion OR clean energy technology OR climate tech) (policy OR regulation OR startup OR funding OR breakthrough)",pattern:/battery|fusion|clean energy|solar|climate tech|nuclear|energy storage/i,cadence:"biweekly",intervalDays:14},
  {id:"software",code:"DEV",label:"소프트웨어·개발",query:"(software development OR open source OR developer tools OR cloud computing OR programming OR GitHub)",pattern:/software|developer|open source|GitHub|programming|framework|cloud|API|DevOps|coding assistant/i,cadence:"daily"}
];
const allowedSource = /Reuters|Associated Press|\bAP\b|BBC|MIT Technology Review|IEEE Spectrum|Ars Technica|The Verge|TechCrunch|Wired|Financial Times|Bloomberg|OpenAI|Anthropic|Google DeepMind|NVIDIA|Microsoft|Apple|NASA|GitHub|InfoQ|InfoWorld|The Register|Stack Overflow|ZDNET|TechRepublic|SD Times/i;

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
    const key=`${article.categoryId}:`+article.title.toLowerCase().replace(/\s+-\s+[^-]+$/,"").replace(/[^a-z0-9가-힣]+/g," ").trim();
    if(!key||seen.has(key)) return false;
    seen.add(key); return true;
  });
};
async function translate(articles){
  const cached=new Map((previous.news||[]).map(item=>[item.title,item.titleKo]));
  const output=[];
  for(const article of articles.slice(0,70)){
    let titleKo=cached.get(article.title);
    if(!titleKo&&!/[가-힣]/.test(article.title)){
      try{
        const response=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(article.title)}&langpair=en|ko`,{signal:AbortSignal.timeout(7000)});
        const result=response.ok?await response.json():{};
        titleKo=decodeXml(result.responseData?.translatedText||"");
      }catch{}
    }
    const translatedTitle=titleKo&&!/MYMEMORY WARNING/i.test(titleKo)?titleKo:article.title;
    output.push({...article,titleKo:translatedTitle,themes:themeTags(`${article.title} ${translatedTitle}`)});
  }
  return output;
}
const kstNow = () => new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",dateStyle:"medium",timeStyle:"short"}).format(new Date());
const themeTags = value => {
  const tags=[];
  if(/OpenAI|Anthropic|Google|Microsoft|Meta|Apple|Amazon|NVIDIA|AMD|Intel|TSMC|Samsung|Tesla|SpaceX|빅테크/i.test(value)) tags.push("빅테크");
  if(/policy|regulation|law|antitrust|export control|government|정책|규제|법안|수출 통제/i.test(value)) tags.push("정책·규제");
  if(/startup|funding|investment|venture|seed round|series [a-f]|스타트업|투자|펀딩/i.test(value)) tags.push("스타트업·투자");
  return tags;
};
const previousCategories = new Map((previous.categories||[]).map(item=>[item.id,item]));
const dueForRefresh = category => {
  if(category.cadence!=="biweekly") return true;
  const last=previousCategories.get(category.id)?.lastRefreshed;
  const timestamp=Date.parse(last||"");
  return !Number.isFinite(timestamp)||Date.now()-timestamp>=category.intervalDays*86400000;
};

try{
  const activeCategories=categories.filter(dueForRefresh);
  const deferredCategories=categories.filter(category=>!dueForRefresh(category));
  const settled=await Promise.allSettled(activeCategories.map(collect));
  const successful=settled.filter(item=>item.status==="fulfilled").length;
  if(!successful) throw Error("모든 기술 정보처 연결 실패");
  const refreshedIds=new Set(activeCategories.filter((_,index)=>settled[index]?.status==="fulfilled").map(item=>item.id));
  const carried=(previous.news||[]).filter(item=>deferredCategories.some(category=>category.id===item.categoryId));
  const fetched=settled.flatMap((item,index)=>item.status==="fulfilled"
    ? item.value.filter(article=>activeCategories[index].pattern.test(article.title)).slice(0,10)
    : []);
  const raw=deduplicate([...fetched,...carried])
    .filter(item=>item.title&&item.url)
    .filter(item=>allowedSource.test(item.source))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const news=await translate(raw);
  if(!news.length) throw Error("유효한 기술 기사 없음");
  const cutoff=Date.now()-24*3600000;
  const categoryData=categories.map(category=>{
    const items=news.filter(item=>item.categoryId===category.id);
    const prior=previousCategories.get(category.id);
    return {
      id:category.id,code:category.code,label:category.label,count:items.length,
      summary:items[0]?.titleKo||"새로운 주요 변화 확인 없음",
      latest:items[0]?.date||"—",
      cadence:category.cadence==="biweekly"?"격주":"매일",
      lastRefreshed:refreshedIds.has(category.id)?new Date().toISOString():prior?.lastRefreshed||null,
      themes:[...new Set(items.flatMap(item=>item.themes||[]))].slice(0,3)
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
    sourceHealth:{
      successful,total:activeCategories.length,configuredTotal:categories.length,
      deferred:deferredCategories.map(item=>item.label),checkedAt:kstNow()
    }
  };
  await fs.writeFile(outputFile,`${JSON.stringify(data,null,2)}\n`);
}catch(error){
  console.warn(`기술 뉴스 자동 갱신 실패: ${error.message}. 이전 정상 데이터를 유지합니다.`);
}

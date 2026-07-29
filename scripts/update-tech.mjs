import fs from "node:fs/promises";

const outputFile = new URL("../data/tech.json", import.meta.url);
const sourceFile = new URL("../config/tech-sources.json", import.meta.url);
const previous = JSON.parse(await fs.readFile(outputFile, "utf8"));
const sourceConfig = JSON.parse(await fs.readFile(sourceFile, "utf8"));
const flashMode = process.env.TECH_MODE === "flash";
const userAgent = "juyeon-news-tech/2.0 (+https://github.com/juyeonjuyeonjuyeon/korea-security-dashboard)";

const categories = [
  {id:"ai",code:"AI",label:"인공지능",query:"(artificial intelligence OR generative AI OR AI model OR AI agent) (launch OR update OR release OR research OR policy)",pattern:/artificial intelligence|\bAI\b|model|agent|OpenAI|Anthropic|DeepMind|Gemini|Claude|ChatGPT/i,cadence:"daily"},
  {id:"chips",code:"CHIP",label:"반도체·컴퓨팅",query:"(semiconductor OR chip OR GPU OR quantum computing) (NVIDIA OR AMD OR Intel OR TSMC OR Samsung OR launch OR research)",pattern:/semiconductor|chip|\bGPU\b|NVIDIA|quantum|processor|foundry|computing/i,cadence:"daily"},
  {id:"robotics",code:"ROBOT",label:"로봇·모빌리티",query:"(robotics OR humanoid robot OR autonomous vehicle OR drone technology) (launch OR update OR research OR startup)",pattern:/robot|humanoid|autonomous|self-driving|drone|mobility/i,cadence:"daily"},
  {id:"cyber",code:"CYBER",label:"사이버보안",query:"(cybersecurity OR ransomware OR zero-day OR data breach OR AI security) (update OR advisory OR release)",pattern:/cyber|ransomware|malware|zero-day|breach|security flaw|vulnerability/i,cadence:"daily"},
  {id:"space",code:"SPACE",label:"우주·통신",query:"(space technology OR satellite OR rocket OR 6G) (launch OR update OR research)",pattern:/space|satellite|rocket|SpaceX|NASA|\b6G\b|telecom/i,cadence:"daily"},
  {id:"energy",code:"ENERGY",label:"에너지·기후기술",query:"(battery technology OR nuclear fusion OR clean energy technology OR climate tech) (breakthrough OR launch OR research)",pattern:/battery|fusion|clean energy|solar|climate tech|nuclear|energy storage/i,cadence:"biweekly",intervalDays:14},
  {id:"software",code:"DEV",label:"소프트웨어·개발",query:"(software development OR open source OR developer tools OR cloud computing OR programming OR GitHub) (release OR update OR launch)",pattern:/software|developer|open source|GitHub|programming|framework|cloud|API|DevOps|coding assistant/i,cadence:"daily"},
  {id:"creative",code:"CREATE",label:"창작 AI·미디어",query:"(generative AI OR AI tool) (video OR music OR audio OR image OR design OR 3D OR animation) (launch OR update OR feature OR beta)",pattern:/video|music|audio|voice|image|design|3D|animation|creative|Runway|Firefly|ElevenLabs|Suno|Udio|Midjourney|Stability|Blender/i,cadence:"daily"}
];

const allowedSource = /Reuters|Associated Press|\bAP\b|BBC|MIT Technology Review|IEEE Spectrum|Ars Technica|The Verge|TechCrunch|Wired|Financial Times|Bloomberg|Axios|CNBC|Forbes|Nikkei|Guardian|OpenAI|Anthropic|Google|DeepMind|NVIDIA|Microsoft|Apple|NASA|GitHub|Hugging Face|InfoQ|InfoWorld|The Register|Stack Overflow|ZDNET|TechRepublic|Adobe|Runway|Stability AI|ElevenLabs|Blender/i;
const relevantTech = /artificial intelligence|\bAI\b|model|agent|software|developer|open source|GitHub|chip|GPU|semiconductor|robot|autonomous|cyber|security|space|satellite|battery|energy|video|music|audio|voice|image|design|3D|animation|creative|OpenAI|Anthropic|Gemini|Claude|ChatGPT|NVIDIA|Adobe|Runway|ElevenLabs|Suno|Udio|Midjourney|Stability|Blender/i;
const eventSignal = /webinar|event|workshop|hackathon|conference|keynote|livestream|registration|register now|free trial|free tier|free credits?|open beta|public beta|무료|웨비나|행사|등록|베타/i;
const peopleSignal = /said|says|told|announc|predict|warn|interview|keynote|remarks?|발언|말했다|전망|인터뷰|기조연설/i;
const decodeXml = (value="") => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]+>/g," ")
  .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
  .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)))
  .replace(/\s+/g," ").trim();
const dateFrom = raw => { const date=new Date(raw); return Number.isNaN(date.valueOf())?"":date.toISOString().slice(0,16).replace("T"," "); };
const gradeFor = value => /openai\.com|anthropic\.com|deepmind\.google|developers\.google|nvidia\.com|microsoft\.com|apple\.com|adobe\.com|runwayml\.com|stability\.ai|elevenlabs\.io|github\.com|github\.blog|huggingface\.co|nasa\.gov|ieee\.org/i.test(value)?"A":/reuters|associated press|\bap news\b|\bbbc\b/i.test(value)?"B":"C";
const sourceFromTitle = title => title.match(/\s+-\s+([^-]+)$/)?.[1]?.trim() || "Google News";

function parseFeed(xml, meta={}) {
  return [...xml.matchAll(/<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi)].map(match=>{
    const item=match[1];
    const title=decodeXml(item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");
    const href=item.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1];
    const url=decodeXml(href||item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]||"");
    const source=meta.name||decodeXml(item.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1]||"")||sourceFromTitle(title);
    const rawDate=item.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i)?.[1];
    return {title,url,source,date:dateFrom(rawDate),categoryId:meta.categoryId,confidence:meta.grade||gradeFor(`${source} ${url}`),stream:meta.stream||"news"};
  });
}
async function fetchText(url, timeout=18000){
  const response=await fetch(url,{headers:{"user-agent":userAgent},signal:AbortSignal.timeout(timeout)});
  if(!response.ok) throw Error(`${response.status} ${url}`);
  return response.text();
}
async function collectGoogle(query, meta={}){
  const url=`https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:7d`)}&hl=en-US&gl=US&ceid=US:en`;
  return parseFeed(await fetchText(url),meta);
}
async function collectCategory(category){
  const items=await collectGoogle(category.query,{categoryId:category.id,stream:"news"});
  return items.filter(item=>category.pattern.test(item.title));
}
async function collectFeed(feed){
  return parseFeed(await fetchText(feed.url),feed);
}
async function collectPage(page){
  const html=await fetchText(page.url);
  const articles=[];
  const signal=/launch|introduc|announc|release|update|new |event|webinar|workshop|beta|free|open source|model|AI|video|audio|music|image|design|출시|공개|업데이트|행사|무료/i;
  for(const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const title=decodeXml(match[2]);
    if(title.length<12||title.length>180||!signal.test(title)) continue;
    try{
      articles.push({title,url:new URL(decodeXml(match[1]),page.url).href,source:page.name,date:"",categoryId:page.categoryId,confidence:page.grade||"A",stream:page.categoryId==="events"?"event":"release"});
    }catch{}
    if(articles.length>=8) break;
  }
  return articles;
}
const categoryFor = item => {
  if(item.categoryId && item.categoryId!=="events") return item.categoryId;
  const text=`${item.title} ${item.source}`;
  return categories.find(category=>category.pattern.test(text))?.id || (/event|webinar|workshop|hackathon/i.test(text)?"creative":"ai");
};
const classify = item => {
  const text=`${item.title} ${item.stream}`;
  if(item.stream==="people") return "인물 발언";
  if(item.stream==="event"||/webinar|event|workshop|hackathon|conference|keynote|livestream|registration/i.test(text)) return "행사";
  if(/free tier|free credit|free trial|open beta|public beta|무료|베타/i.test(text)) return "무료·베타";
  if(/open source|open-source|github|released? v?\d|changelog/i.test(text)) return "오픈소스";
  if(/launch|introduc|announc|release|available|new model|new feature|update/i.test(text)) return "출시·업데이트";
  return "뉴스·분석";
};
const themeTags = item => {
  const value=`${item.title} ${item.source}`;
  const tags=[];
  if(/OpenAI|Anthropic|Google|Microsoft|Meta|Apple|Amazon|NVIDIA|AMD|Intel|TSMC|Samsung|Tesla|SpaceX/i.test(value)) tags.push("주요 기업");
  if(/video|Runway|Luma|Pika|Premiere|DaVinci/i.test(value)) tags.push("영상");
  if(/music|audio|voice|ElevenLabs|Suno|Udio|Descript/i.test(value)) tags.push("음악·음성");
  if(/image|design|3D|Adobe|Firefly|Canva|Figma|Blender|Midjourney|Stability/i.test(value)) tags.push("미술·디자인");
  if(/free|beta|webinar|event|workshop|hackathon|credit/i.test(value)) tags.push("기회");
  return tags.slice(0,3);
};
const deduplicate = articles => {
  const seen=new Set();
  return articles.filter(article=>{
    const key=article.title.toLowerCase().replace(/\s+-\s+[^-]+$/,"").replace(/[^a-z0-9가-힣]+/g," ").trim();
    if(!key||seen.has(key)) return false;
    seen.add(key); return true;
  });
};
const limitPerSource = (articles,maximum=6) => {
  const counts=new Map();
  return articles.filter(article=>{
    const key=article.source.toLowerCase();
    const count=counts.get(key)||0;
    if(count>=maximum) return false;
    counts.set(key,count+1);
    return true;
  });
};
async function translate(articles){
  const cached=new Map((previous.news||[]).map(item=>[item.title,item.titleKo]));
  const output=[];
  for(const [index,article] of articles.slice(0,120).entries()){
    let titleKo=cached.get(article.title);
    if(!titleKo&&index<45&&!/[가-힣]/.test(article.title)){
      try{
        const response=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(article.title)}&langpair=en|ko`,{signal:AbortSignal.timeout(7000)});
        const result=response.ok?await response.json():{};
        titleKo=decodeXml(result.responseData?.translatedText||"");
      }catch{}
    }
    const categoryId=categoryFor(article);
    const category=categories.find(item=>item.id===categoryId)?.label||"인공지능";
    output.push({...article,categoryId,category,titleKo:titleKo&&!/MYMEMORY WARNING/i.test(titleKo)?titleKo:article.title,type:classify(article),themes:themeTags(article),official:article.confidence==="A"});
  }
  return output;
}
const kstNow = () => new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",dateStyle:"medium",timeStyle:"short"}).format(new Date());
const recentEnough = item => {
  if(!item.date) return true;
  const time=Date.parse(item.date.replace(" ","T")+"Z");
  return !Number.isFinite(time)||time>=Date.now()-14*86400000;
};

try{
  const jobs=[
    ...sourceConfig.directFeeds.map(feed=>collectFeed(feed)),
    ...sourceConfig.officialPages.map(page=>collectPage(page)),
    ...sourceConfig.eventQueries.map(item=>collectGoogle(item.query,{source:item.name,stream:"event"}).then(items=>items.filter(entry=>eventSignal.test(entry.title)))),
    ...sourceConfig.peopleQueries.map(item=>collectGoogle(item.query,{source:item.name,stream:"people"}).then(items=>items.filter(entry=>peopleSignal.test(entry.title)))),
    ...(!flashMode?categories.filter(item=>item.id!=="energy"||!previous.categories?.find(old=>old.id==="energy")?.lastRefreshed||Date.now()-Date.parse(previous.categories.find(old=>old.id==="energy").lastRefreshed)>14*86400000).map(collectCategory):[])
  ];
  const settled=await Promise.allSettled(jobs);
  const successful=settled.filter(item=>item.status==="fulfilled").length;
  if(!successful) throw Error("모든 기술 정보처 연결 실패");
  const fetched=settled.flatMap(item=>item.status==="fulfilled"?item.value:[]);
  const carried=(previous.news||[]).filter(recentEnough);
  const raw=limitPerSource(deduplicate([...fetched,...carried])
    .filter(item=>item.title&&item.url)
    .filter(item=>item.confidence==="A"||allowedSource.test(item.source))
    .filter(item=>item.confidence==="A"||relevantTech.test(item.title))
    .filter(item=>item.stream!=="event"||eventSignal.test(item.title))
    .filter(item=>item.stream!=="people"||peopleSignal.test(item.title))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date))),6).slice(0,80);
  const news=await translate(raw);
  if(!news.length) throw Error("유효한 기술 정보 없음");
  const categoryData=categories.map(category=>{
    const items=news.filter(item=>item.categoryId===category.id);
    return {id:category.id,code:category.code,label:category.label,count:items.length,summary:items[0]?.titleKo||"새로운 주요 변화 확인 없음",latest:items[0]?.date||"—",cadence:category.id==="energy"?"격주":"매일",lastRefreshed:new Date().toISOString(),themes:[...new Set(items.flatMap(item=>item.themes||[]))].slice(0,3)};
  });
  const radar={
    releases:news.filter(item=>["출시·업데이트","오픈소스"].includes(item.type)).slice(0,12),
    creative:news.filter(item=>item.categoryId==="creative").slice(0,12),
    opportunities:news.filter(item=>["행사","무료·베타"].includes(item.type)).slice(0,12),
    voices:news.filter(item=>item.type==="인물 발언").slice(0,12)
  };
  const ranked=[...categoryData].sort((a,b)=>b.count-a.count);
  const data={
    schemaVersion:2,updatedAt:kstNow(),updateMode:flashMode?"공식 채널 매시간 점검":"전체 오전 6시·오후 6시 점검",
    headline:radar.releases[0]?.titleKo||`${ranked[0]?.label||"기술"} 분야의 최신 변화를 확인했습니다.`,
    metrics:{articleCount:news.length,recentCount:news.filter(item=>item.date&&Date.parse(item.date.replace(" ","T")+"Z")>=Date.now()-86400000).length,sourceCount:new Set(news.map(item=>item.source)).size,officialCount:news.filter(item=>item.official).length,opportunityCount:radar.opportunities.length},
    summary:[
      radar.releases[0]&&`새 출시: ${radar.releases[0].titleKo}`,
      radar.creative[0]&&`창작 기술: ${radar.creative[0].titleKo}`,
      radar.opportunities[0]&&`행사·무료: ${radar.opportunities[0].titleKo}`,
      radar.voices[0]&&`인물 발언: ${radar.voices[0].titleKo}`
    ].filter(Boolean),
    categories:categoryData,radar,news,
    sourceHealth:{successful,total:jobs.length,configuredTotal:sourceConfig.directFeeds.length+sourceConfig.officialPages.length,officialSources:new Set(news.filter(item=>item.official).map(item=>item.source)).size,checkedAt:kstNow(),mode:flashMode?"매시간 공식 레이더":"하루 2회 전체 수집"}
  };
  const contentSignature=value=>JSON.stringify((value.news||[]).map(item=>[item.title,item.url,item.source,item.type,item.categoryId]));
  if(flashMode&&contentSignature(data)===contentSignature(previous)){
    console.log("공식 기술 레이더에 새 변화가 없어 이전 데이터를 유지합니다.");
  }else{
    await fs.writeFile(outputFile,`${JSON.stringify(data,null,2)}\n`);
  }
}catch(error){
  console.warn(`기술 뉴스 자동 갱신 실패: ${error.message}. 이전 정상 데이터를 유지합니다.`);
}

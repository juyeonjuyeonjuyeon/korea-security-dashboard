(()=>{
  const ignored="nav,footer,aside,form,dialog,[role=navigation],[role=complementary],[aria-hidden=true],script,style,noscript,template,svg,canvas";
  const clean=text=>String(text||"").replace(/\s+/g," ").trim();
  const score=node=>{const text=clean(node.innerText);const paragraphs=node.querySelectorAll("p").length;const links=node.querySelectorAll("a").length;return text.length+paragraphs*180-links*25};
  const candidates=[...document.querySelectorAll("article,[role=main],main")].filter(node=>!node.closest(ignored));
  const root=candidates.sort((a,b)=>score(b)-score(a))[0]||document.body;
  const seen=new Set(),blocks=[];
  root.querySelectorAll("h1,h2,h3,p,li,blockquote,figcaption,th,td").forEach(node=>{
    if(node.closest(ignored)||node.children.length&&[...node.children].some(child=>/^(P|H1|H2|H3|LI|BLOCKQUOTE)$/i.test(child.tagName)))return;
    const text=clean(node.innerText||node.textContent);if(text.length<2||seen.has(text)||(/^\W+$/.test(text)))return;
    const linkText=clean([...node.querySelectorAll("a")].map(a=>a.innerText).join(" "));if(text.length>40&&linkText.length/text.length>.75)return;
    seen.add(text);blocks.push({type:/^H[1-3]$/.test(node.tagName)?node.tagName.toLowerCase():node.tagName==="LI"?"li":node.tagName==="BLOCKQUOTE"?"blockquote":"p",text});
  });
  if(!blocks.length){clean(root.innerText).split(/\n{2,}/).filter(text=>text.length>20).slice(0,300).forEach(text=>blocks.push({type:"p",text}))}
  const byline=clean(document.querySelector('[rel=author],.byline,[class*=author i],[itemprop=author]')?.innerText);
  const siteName=clean(document.querySelector('meta[property="og:site_name"]')?.content||location.hostname);
  return {title:clean(document.querySelector('meta[property="og:title"]')?.content||document.title),byline:byline.slice(0,200),siteName,lang:(document.documentElement.lang||"").split("-")[0],url:location.href,blocks:blocks.slice(0,500)};
})()

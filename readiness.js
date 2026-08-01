(()=>{
  const KEY="juyeon-readiness-v1",$=id=>document.getElementById(id);
  const read=()=>{try{const value=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(value)?value.slice(0,20):[]}catch{return[]}};
  const clean=value=>String(value||"").trim().slice(0,200);
  const render=()=>{
    const root=$("savedPlaces");if(!root)return;root.replaceChildren();
    const items=read();
    if(!items.length){const empty=document.createElement("p");empty.textContent="저장한 위치가 없습니다.";root.append(empty);return}
    items.forEach(item=>{const card=document.createElement("article"),title=document.createElement("strong"),address=document.createElement("span"),shelter=document.createElement("span"),meta=document.createElement("small"),remove=document.createElement("button");title.textContent=`${item.type} · ${item.name}`;address.textContent=item.address;shelter.textContent=`대피소 ${item.primaryShelter||"미지정"}${item.alternateShelter?` / 대체 ${item.alternateShelter}`:""}`;meta.textContent=[item.walkingInfo,item.meetingPoint&&`집결 ${item.meetingPoint}`,item.emergencyContact&&`연락 ${item.emergencyContact}`].filter(Boolean).join(" · ")||"세부계획 미입력";remove.type="button";remove.textContent="삭제";remove.className="terminal-button";remove.addEventListener("click",()=>{localStorage.setItem(KEY,JSON.stringify(read().filter(saved=>saved.id!==item.id)));render()});card.append(title,address,shelter,meta,remove);root.append(card)});
  };
  $("placeForm")?.addEventListener("submit",event=>{event.preventDefault();const item={id:crypto.randomUUID(),type:clean($("placeType").value),name:clean($("placeName").value),address:clean($("placeAddress").value),primaryShelter:clean($("primaryShelter").value),alternateShelter:clean($("alternateShelter").value),walkingInfo:clean($("walkingInfo").value),meetingPoint:clean($("meetingPoint").value),emergencyContact:clean($("emergencyContact").value),savedAt:new Date().toISOString()};localStorage.setItem(KEY,JSON.stringify([item,...read()].slice(0,20)));event.target.reset();render()});
  const online=()=>{const banner=$("offlineBanner");if(banner)banner.hidden=navigator.onLine};window.addEventListener("online",online);window.addEventListener("offline",online);online();render();
})();

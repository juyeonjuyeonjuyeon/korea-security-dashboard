window.addEventListener("message",event=>{
  if(event.source!==window||event.data?.source!=="juyeon-reader-page"||event.data.type!=="JUYEON_READER_REQUEST")return;
  chrome.runtime.sendMessage({type:"EXTRACT_FOR_READER",url:event.data.url},response=>{
    if(chrome.runtime.lastError)return window.postMessage({source:"juyeon-reader-extension",type:"JUYEON_READER_ERROR",message:chrome.runtime.lastError.message},location.origin);
    window.postMessage(response?.ok?{source:"juyeon-reader-extension",type:"JUYEON_READER_RESULT",article:response.article}:{source:"juyeon-reader-extension",type:"JUYEON_READER_ERROR",message:response?.error||"원문을 가져오지 못했습니다."},location.origin);
  });
});

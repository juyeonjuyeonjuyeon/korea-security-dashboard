(() => {
  const KEY = "juyeon-news-bookmarks-v1";
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(value) ? value.filter(item => item?.url && item?.title) : [];
    } catch { return []; }
  };
  const write = items => {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 500)));
    window.dispatchEvent(new CustomEvent("juyeonbookmarkschange", { detail: items }));
    return items;
  };
  const normalize = item => ({
    url: String(item.url || ""),
    title: String(item.title || ""),
    source: String(item.source || "Unknown"),
    date: String(item.date || ""),
    section: item.section === "tech" ? "tech" : "security",
    topic: String(item.topic || ""),
    confidence: String(item.confidence || ""),
    savedAt: item.savedAt || new Date().toISOString()
  });
  const api = {
    all: () => read().sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))),
    has: url => read().some(item => item.url === url),
    toggle(item) {
      const next = normalize(item);
      const items = read();
      const index = items.findIndex(saved => saved.url === next.url);
      if (index >= 0) items.splice(index, 1);
      else items.unshift(next);
      write(items);
      return index < 0;
    },
    remove: url => write(read().filter(item => item.url !== url)),
    clear: () => write([]),
    count: () => read().length,
    export() {
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), items: api.all() }, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `juyeon-news-scraps-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    },
    import(value) {
      const incoming=Array.isArray(value)?value:value?.items;
      if(!Array.isArray(incoming)) throw new Error("올바른 스크랩 백업 파일이 아닙니다.");
      const merged=new Map(read().map(item=>[item.url,item]));
      incoming.map(normalize).filter(item=>item.url&&item.title).forEach(item=>merged.set(item.url,item));
      return write([...merged.values()]);
    }
  };
  window.JuyeonBookmarks = api;
})();

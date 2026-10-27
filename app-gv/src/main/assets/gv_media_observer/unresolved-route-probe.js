(function () {
  "use strict";
  // Passive, no player interaction, no URL tokens or media URLs in evidence.
  const ROUTES=Object.freeze([
    {id:"the-islamic-network",host:"theislamicnetwork.org",path:"/"},
    {id:"sankhya-television",host:"sankhyatv.com",path:"/live"},
    {id:"scorch-tv",host:"scorchtv.com",path:"/"},
    {id:"tvcarib",host:"tvcarib.com",path:"/"},
    {id:"jamaica-travel-channel",host:"jamaicatravelchannel.com",path:"/"},
    {id:"alcarrizos-tv",host:"alcarrizostv.com",path:"/"},
    {id:"cdn-37",host:"cdn.com.do",path:"/"},
    {id:"teleantillas",host:"teleantillas.com.do",path:"/radio-page"},
    {id:"live-99-tv",host:"live99fm.com",path:"/"},
    {id:"bonaire-tv",host:"bonaire.tv",path:"/"},
    {id:"zns-tv",host:"znsbahamas.com",path:"/"},
    {id:"vip-radio-aruba-tv",host:"viponlineradio.com",path:"/vip-tv"},
    {id:"cubavision-internacional",host:"teveo.cu",path:"/live/video/akddwvmtyzfsfnnj"},
    {id:"telemundo-puerto-rico",host:"telemundopr.com",path:"/noticias/puerto-rico/mira-aqui-nuestra-programacion-en-vivo-3/2019645"},
    {id:"tvc-st-kitts",host:"tvcplus.live",path:"/watch-live-tv"},
    {id:"hgptv",host:"hgptv.com",path:"/"},
    {id:"mtv-guyana",host:"mtvgy.com",path:"/live"}
  ]);
  function path(s) { return String(s || '/').toLowerCase().replace(/\/+$/, '') || '/'; }
  function routeFor(raw) {
    try {
      const u=new URL(String(raw || ""));
      if (u.protocol!=="https:" || u.username || u.password) return null;
      return ROUTES.find(r=>r.host===u.hostname.toLowerCase().replace(/^www\./,"")
        &&r.path===path(u.pathname))||null;
    } catch (_) { return null; }
  }
  function frameHost(frame) {
    for (const a of ["src","data-src","data-lazy-src","data-litespeed-src"]) {
      try {
        const raw=frame.getAttribute(a);
        if (!raw) continue;
        const u=new URL(raw,"https://invalid.example/");
        if (u.protocol==="https:"&&!u.username&&!u.password&&u.hostname!=="invalid.example")
          return u.hostname.toLowerCase().replace(/^www\./,"").slice(0,90);
      } catch (_) {}
    }
    return "";
  }
  function visible(node) {
    try { const r=node.getBoundingClientRect(); return r.width>=240 && r.height>=140; }
    catch (_) { return false; }
  }
  function observe(doc) {
    const frames=Array.from(doc.querySelectorAll("iframe")).slice(0,80);
    const videos=Array.from(doc.querySelectorAll("video")).slice(0,30);
    const visibleVideos=videos.filter(visible);
    const playing=visibleVideos.filter(v=>!v.paused&&v.readyState>=2);
    const hosts=[...new Set(frames.map(frameHost).filter(Boolean))].slice(0,8);
    const families=[];
    const has=q=>{try{return !!doc.querySelector(q);}catch(_){return false;}};
    if(has(".video-js,video-js")) families.push("videojs");
    if(has(".jwplayer,.jw-player")) families.push("jwplayer");
    if(has(".flowplayer")) families.push("flowplayer");
    if(has(".rmp-container,.rmp-player")) families.push("radiant");
    if(has(".plyr")) families.push("plyr");
    if(hosts.some(h=>h==="youtube.com"||h.endsWith(".youtube.com"))) families.push("youtube-frame");
    if(hosts.some(h=>h==="dailymotion.com"||h.endsWith(".dailymotion.com"))) families.push("dailymotion-frame");
    if(hosts.some(h=>h==="vimeo.com"||h==="player.vimeo.com")) families.push("vimeo-frame");
    if(videos.length) families.push("html5-video");
    return {
      iframeCount:frames.length,visibleIframeCount:frames.filter(visible).length,
      videoCount:videos.length,visibleVideoCount:visibleVideos.length,
      readyVideoCount:visibleVideos.filter(v=>v.readyState>=2).length,
      playingCount:playing.length,mutedPlayingCount:playing.filter(v=>!!v.muted).length,
      frameHosts:hosts,familyHints:families.slice(0,10)
    };
  }
  globalThis.KfUnresolvedProbe=Object.freeze({routes:ROUTES,routeFor,frameHost,observe});
  if(typeof window==="undefined"||typeof document==="undefined"||window.top!==window) return;
  const selected=routeFor(window.location.href);
  if(!selected) return;
  [750,3000,8000,15000,25000].forEach((delay,i)=>setTimeout(()=>{
    if(routeFor(window.location.href)!==selected) return;
    try { window.prompt("__GV_MEDIA__"+JSON.stringify({
      type:"unresolved-route-probe",phase:"content-unresolved-route-sample",
      pageUrl:window.location.href,providerId:selected.id,
      sampleIndex:i+1,sampleDelayMs:delay,...observe(document)
    }),""); } catch(_){}
  },delay));
})();

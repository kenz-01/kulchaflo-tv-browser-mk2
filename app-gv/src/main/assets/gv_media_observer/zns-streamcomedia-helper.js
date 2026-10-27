(function(){
"use strict";
// Scoped official ZNS browser player. Not a stream extractor.
const URLS={site:"znsbahamas.com",embed:"player.streamcomedia.com"};
const checks=[300,900,2000,4000,7000,11000,18000];
function route(raw){
 try { const u=new URL(raw);
   if(u.protocol!=="https:"||u.username||u.password)return "";
   const host=u.hostname.toLowerCase().replace(/^www\./,"");
   const path=u.pathname.toLowerCase().replace(/\/+$/,"")||"/";
   if(host===URLS.site&&path==="/")return "site";
   if(host===URLS.embed&&path==="/html5/znstv")return "embed";
 }catch(_){}
 return "";
}
function shown(el){try{const b=el.getBoundingClientRect();return b.width>=280&&b.height>=150;}catch(_){return false;}}
function one(arr){const v=Array.from(arr).filter(shown);return v.length===1?v[0]:null;}
function frame(doc){return one(Array.from(doc.querySelectorAll("iframe[src]"))
  .filter(x=>route(x.getAttribute("src")||x.src)==="embed"));}
function report(phase,extra={}){
 try{window.prompt("__GV_MEDIA__"+JSON.stringify({type:"zns-player-state",phase,
  pageUrl:window.location.href,...extra}),"");}catch(_){}
}
function layout(el,doc){
 if(!el||!doc.body)return false;
 const path=new Set();let e=el;
 while(e&&e!==doc.body){path.add(e);e=e.parentElement;}
 if(e!==doc.body)return false;
 for(const node of path){
   for(const sib of Array.from(node.parentElement?.children||[]))
     if(!path.has(sib)&&sib.style)sib.style.setProperty("display","none","important");
 }
 for(let n=el;n&&n!==doc.body;n=n.parentElement){
   if(!n.style)continue;
   for(const [k,v] of [["position","fixed"],["inset","0"],["width","100vw"],
     ["height","100vh"],["max-width","none"],["max-height","none"],
     ["z-index","2147483000"],["background","#000"],["margin","0"]])
     n.style.setProperty(k,v,"important");
 }
 for(const n of [doc.body,doc.documentElement]){
   if(n?.style){n.style.setProperty("overflow","hidden","important");n.style.setProperty("background","#000","important");}
 }
 return true;
}
globalThis.KfZnsHelper=Object.freeze({route,shown,one,frame,layout});
if(typeof window==="undefined"||typeof document==="undefined")return;
const own=route(window.location.href);
if(own==="site"&&window.top===window){
 let applied=false;
 const attempt=()=>{
  if(applied||route(window.location.href)!=="site")return;
  const el=frame(document);if(!el)return;
  const allow=String(el.getAttribute("allow")||"");
  if(!allow.toLowerCase().includes("autoplay"))
    el.setAttribute("allow",allow?allow+"; autoplay":"autoplay");
  el.setAttribute("allowfullscreen","true");
  if(!layout(el,document))return;
  applied=true;
  report("zns-outer-player-first");
 };
 checks.forEach(t=>setTimeout(attempt,t));
 return;
}
if(own!=="embed"||window.top===window||route(document.referrer)!=="site")return;
const played=new WeakSet(),observed=new WeakSet();
const attempt=()=>{
 const el=one(Array.from(document.querySelectorAll("video")).slice(0,8));
 if(!el)return;
 if(!observed.has(el)){
  observed.add(el);
  el.addEventListener("playing",()=>report("zns-embedded-playing"));
 }
 if(el.readyState<2||played.has(el))return;
 played.add(el);
 try{
  el.muted=false;
  if(typeof el.volume==="number")el.volume=1;
  if(el.paused&&typeof el.play==="function"){
   const result=el.play();
   if(result&&typeof result.catch==="function")
     result.catch(()=>report("zns-embedded-play-rejected"));
  }
  report("zns-embedded-start-attempt");
 }catch(_){report("zns-embedded-play-rejected");}
};
checks.forEach(t=>setTimeout(attempt,t));
})();
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const dir=resolve(process.cwd(),'../../app-gv/src/main/assets/gv_media_observer');
const code=readFileSync(resolve(dir,'zns-streamcomedia-helper.js'),'utf8');
const ctx={URL};runInNewContext(code,ctx);
const api=ctx.KfZnsHelper;
test('strict HTTPS first-party and trusted StreamcoMedia URL checks',()=>{
 assert.equal(api.route('https://znsbahamas.com/'),'site');
 assert.equal(api.route('https://www.znsbahamas.com/#'),'site');
 assert.equal(api.route('https://player.streamcomedia.com/HTML5/znstv/'),'embed');
 for(const x of ['http://znsbahamas.com/','https://evil.znsbahamas.com/',
 'https://znsbahamas.com/news','https://evil.player.streamcomedia.com/HTML5/znstv/'])
 assert.equal(api.route(x),'',x);
});
test('one official visible embed gets player-first; other page chrome hidden',()=>{
 let count=0;const events=[],sty=()=>({setProperty(k,v){events.push([k,v]);}});
 const body={children:[],style:sty()},frame={style:sty(),parentElement:body,
  attrs:{src:'https://player.streamcomedia.com/HTML5/znstv/'},
  getAttribute(k){return this.attrs[k]||null;},setAttribute(k,v){this.attrs[k]=v;},
  getBoundingClientRect(){return {width:900,height:500};}
 };
 const other={style:sty()};body.children=[frame,other];
 const w={location:{href:'https://znsbahamas.com/'},prompt(){count++;}};w.top=w;
 const tasks=[];
 runInNewContext(code,{URL,window:w,document:{
   body,documentElement:{style:sty()},
   querySelectorAll(q){return q==='iframe[src]'?[frame]:[];}
 },setTimeout(fn){tasks.push(fn);}});
 tasks.forEach(fn=>fn());
 assert.equal(count,1);assert.equal(tasks.length,7);
 assert.equal(frame.attrs.allowfullscreen,'true');
 assert.equal(frame.attrs.src,'https://player.streamcomedia.com/HTML5/znstv/');
 assert.ok(frame.attrs.allow.includes('autoplay'));
 assert.ok(events.some(x=>x[0]==='position'&&x[1]==='fixed'));
 assert.ok(events.some(x=>x[0]==='display'&&x[1]==='none'));
});
test('ambiguous frames do not trigger selection',()=>{
 const f=()=>({getAttribute(){return 'https://player.streamcomedia.com/HTML5/znstv/'},
 getBoundingClientRect(){return {width:900,height:500};}});
 assert.equal(api.frame({querySelectorAll(){return [f(),f()];}}),null);
});
test('trusted embedded video unmutes and attempts play at most once',()=>{
 let calls=0;const events=[],timers=[];
 const video={readyState:4,paused:true,muted:true,volume:0,
 getBoundingClientRect(){return {width:900,height:500};},
 addEventListener(k,fn){if(k==='playing')this.onPlaying=fn;},
 play(){calls++;return Promise.resolve();}};
 const w={location:{href:'https://player.streamcomedia.com/HTML5/znstv/'},
 top:{},prompt(x){events.push(x);}};
 runInNewContext(code,{URL,window:w,document:{
 referrer:'https://znsbahamas.com/',querySelectorAll(k){return k==='video'?[video]:[];}
 },setTimeout(fn){timers.push(fn);}});
 timers.forEach(fn=>fn());video.onPlaying();
 assert.equal(calls,1);assert.equal(video.muted,false);assert.equal(video.volume,1);
 assert.ok(events.some(x=>x.includes('zns-embedded-playing')));
});
test('untrusted referrer cannot trigger frame autoplay',()=>{
 const timers=[],w={location:{href:'https://player.streamcomedia.com/HTML5/znstv/'},top:{}};
 runInNewContext(code,{URL,window:w,document:{referrer:'https://other.invalid/'},
 setTimeout(fn){timers.push(fn);}});
 assert.equal(timers.length,0);
});
test('native route, permission and browser ownership are narrowly scoped',()=>{
 const kt=readFileSync(resolve(process.cwd(),
 '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt'),'utf8');
 const manifest=JSON.parse(readFileSync(resolve(dir,'manifest.json'),'utf8'));
 assert.ok(kt.includes('private fun isZnsTvSiteUrl('));
 assert.ok(kt.includes('private fun isZnsStreamcomediaEmbedUrl('));
 assert.ok(kt.includes('znsAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW'));
 assert.ok(kt.includes('zns browser-first native promotion skipped'));
 assert.ok(kt.includes('type == "zns-player-state"'));
 assert.equal(manifest.content_scripts[0].js.at(-2),'zns-streamcomedia-helper.js');
 assert.ok(!code.includes('dispatchEvent(new MouseEvent'));
 assert.ok(!code.includes('window.location.replace('));
});

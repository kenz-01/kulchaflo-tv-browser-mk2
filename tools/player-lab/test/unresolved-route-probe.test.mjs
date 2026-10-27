import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const root=resolve(process.cwd(),'../../app-gv/src/main/assets/gv_media_observer');
const source=readFileSync(resolve(root,'unresolved-route-probe.js'),'utf8');
const context={URL}; runInNewContext(source,context);
const api=context.KfUnresolvedProbe;
const inventory=JSON.parse(readFileSync(resolve(process.cwd(),'config/public-targets.json'),'utf8')).targets;
const keys=["kf-post-933-islamic-network","kf-post-931-sankhya-television","kf-post-930-scorch-tv","kf-post-929-tvcarib","kf-post-924-jamaica-travel-channel","kf-post-917-alcarrizos-tv","kf-post-913-cdn-37","kf-post-909-teleantillas","kf-post-900-live-99-tv","kf-post-898-bonaire-tv","kf-post-897-zns-tv","kf-post-895-vip-radio-live-tv","kf-post-904-cubavision-internacional","kf-post-744-telemundo-pr","kf-post-738-tvc-st-kitts","kf-post-736-hgptv","kf-post-734-mtv-guyana"];
test('all 17 registered uncertain source routes match exact official URLs',()=>{
 assert.equal(api.routes.length,17);
 const found=new Set();
 for(const key of keys){
  const t=inventory[key];assert.ok(t,key);
  const p=api.routeFor(t.initialUrl);assert.ok(p,key);assert.equal(p.id,t.providerId);found.add(p.id);
  const u=new URL(t.initialUrl);
  assert.equal(api.routeFor('http://'+u.host+u.pathname),null);
  assert.equal(api.routeFor('https://evil.'+u.host+u.pathname),null);
 }
 assert.equal(found.size,17);
});
test('HGPTV canonical watch-live route retains homepage probe but rejects unrelated routes',()=>{
 const exact='https://www.hgptv.com/watch-live/';
 const home='https://www.hgptv.com/';
 assert.equal(api.routeFor(exact)?.id,'hgptv');
 assert.equal(api.routeFor(home)?.id,'hgptv');
 for(const invalid of [
  'http://www.hgptv.com/watch-live/',
  'https://evil.hgptv.com/watch-live/',
  'https://www.hgptv.com/watch-live-backup/',
  'https://www.hgptv.com/article/',
 ])assert.equal(api.routeFor(invalid),null);
 const java=readFileSync(resolve(process.cwd(),
  '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt'),'utf8');
 assert.ok(java.includes('"hgptv.com" -> path == "/watch-live" || path == "/"'));
});

test('media evidence includes host only, never source URLs or tokens',()=>{
 const f={getAttribute(k){return k==='src'?'https://player.vimeo.com/video/123?secret=TOKEN':'';},
  getBoundingClientRect(){return {width:800,height:400};}};
 const v={paused:false,muted:true,readyState:4,src:'https://cdn.example/?secret=TOKEN',
  getBoundingClientRect(){return {width:800,height:400};}};
 const d={querySelectorAll(q){return q==='iframe'?[f]:q==='video'?[v]:[];},
  querySelector(q){return q==='.video-js,video-js'?{}:null;}};
 const x=api.observe(d);
 assert.equal(x.playingCount,1);assert.equal(x.mutedPlayingCount,1);
 assert.ok(x.frameHosts.includes('player.vimeo.com'));assert.ok(x.familyHints.includes('vimeo-frame'));
 assert.doesNotMatch(JSON.stringify(x),/TOKEN|https:|video\/123/);
});
test('probe schedules five samples only on top-level exact targets',()=>{
 const timers=[],messages=[];
 const d={querySelectorAll(){return[];},querySelector(){return null;}};
 const w={location:{href:'https://www.hgptv.com/'},prompt(s){messages.push(s);}};w.top=w;
 runInNewContext(source,{URL,window:w,document:d,setTimeout(fn,ms){timers.push([fn,ms]);}});
 assert.deepEqual(timers.map(x=>x[1]),[750,3000,8000,15000,25000]);
 timers.forEach(([fn])=>fn());
 assert.equal(messages.length,5);
 assert.ok(messages.every(m=>m.startsWith('__GV_MEDIA__')&&m.includes('unresolved-route-probe')));
 const none=[],other={location:{href:'https://kulchaflo.com/'}};other.top=other;
 runInNewContext(source,{URL,window:other,document:d,setTimeout(fn){none.push(fn);}});
 assert.equal(none.length,0);
 const child={location:{href:w.location.href},top:{}};
 runInNewContext(source,{URL,window:child,document:d,setTimeout(fn){none.push(fn);}});
 assert.equal(none.length,0);
});
test('native logs scoped evidence and probe never controls playback',()=>{
 const java=readFileSync(resolve(process.cwd(),
  '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt'),'utf8');
 assert.ok(java.includes('type == "unresolved-route-probe"'));
 assert.ok(java.includes('isUnresolvedProbePageUrl(currentUrl)'));
 for(const r of api.routes)assert.ok(java.includes('"'+r.host+'" -> path == "'+r.path+'"'));
 for(const x of ['.play(','.click(','.setAttribute(','.scrollIntoView(', 'fetch('])
  assert.equal(source.includes(x),false);
});

test('host-side sweep enumerates all 17 registered targets without deleting TV data', () => {
  const sweep = readFileSync(resolve(process.cwd(),'scripts/bravia-unresolved-sweep.sh'),'utf8');
  for(const key of keys) {
    const target = inventory[key];
    assert.ok(sweep.includes("'" + target.providerId + "|" + target.initialUrl + "'"),
      'missing official sweep route ' + key);
  }
  assert.match(sweep, /requested=\(hgptv zns-tv mtv-guyana\)/);
  assert.match(sweep, /sleep 28/);
  assert.match(sweep, /logcat -v threadtime -T 1/);
  assert.match(sweep, /KfMkIIGV:/);
  assert.match(sweep, /unresolved probe id=\$id sample=/);
  assert.match(sweep, /sample_count >= 2/);
  assert.match(sweep, /CAPTURE_PID=\$!/);
  assert.match(sweep, /\.unfiltered\.log\.gz/);
  assert.match(sweep, /missing=\$\(\(missing \+ 1\)\)/);
  assert.doesNotMatch(sweep, /-s GvMedia:I GvNav:I/);
  for(const forbidden of [' uninstall ', ' pm clear ', ' trim-caches ', ' logcat -c', ' shell input ', ' curl ', ' wget ']) {
    assert.equal(sweep.includes(forbidden), false, forbidden);
  }
});

test('known first-party-linked iframe hosts are classified without exposing player URLs',()=>{
  const samples=[
    ['https://iframe.dacast.com/live/example?token=PRIVATE','dacast-frame'],
    ['https://player.streamcomedia.com/HTML5/znstv/?token=PRIVATE','streamcomedia-frame'],
    ['https://new.opencaster.com/player?id=PRIVATE','opencaster-frame'],
    ['https://media.streambrothers.com/public/8014?token=PRIVATE','streambrothers-frame']
  ];
  for(const [src,hint] of samples) {
    const doc={
      querySelectorAll(sel) {
        return sel==='iframe'?[{
          getAttribute(k){return k==='src'?src:null;},
          getBoundingClientRect(){return {width:800,height:400};}
        }]:[];
      },
      querySelector(){return null;}
    };
    const result=api.observe(doc);
    assert.ok(result.familyHints.includes(hint),hint);
    assert.equal(result.iframeCount,1);
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  }
});

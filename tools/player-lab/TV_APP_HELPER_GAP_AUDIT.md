# TV App Helper Coverage Gap Audit

## Purpose

Use the Android TV app itself as the authority for helper coverage. A channel is not a true helper gap merely because it is a newer WordPress Channel record. The audit classifies each profiled channel by detected player family and then compares that family with accepted runtime helper families already present in `app-gv`.

## Existing runtime helper families in the app

The current app contains accepted or provider-proven handling for:

- YouTube
- Vimeo
- Dailymotion
- JWPlayer
- Video.js / exact-HLS provider patterns
- Flowplayer
- Bradmax
- Tego
- Novus

It also contains provider-specific helpers for ABS, TTT, Telearuba/Novus, CGTV, Caribbean Hot TV, CaribVision, CBC, CVM, Island TV/Island TV+, CBN Virgin Islands, CNC3, CVC9, GBN, Compass TV and DBS TV.

Existing-family classification does **not** automatically authorize copying one provider helper to another. It means the player technology is already understood and should be solved by reuse/extension before creating a new engine.

## Full Player Lab pass — current classification

### Existing family: reuse/extend before new helper

- Acento TV — YouTube
- Ahora TV — YouTube
- Antena 7 — YouTube
- Balchi TV — Video.js
- Bizz TV — Video.js (behind Streamhoster wrapper)
- Bonce TV — Video.js
- Energia TV — YouTube
- ETV Guadeloupe — Video.js
- Madras FM TV — Video.js (Infomaniak-hosted)
- Pointe TV Antigua — Vimeo
- Prensa Latina TV — YouTube
- RHT Radio Haute Tension TV — Video.js (Infomaniak-hosted)
- Scorch TV — Video.js
- Télé Péyi Guyane — Video.js
- Telecentro 13 — YouTube in passive profile; shared broadcaster wrapper requires route validation
- TeleOnce — JWPlayer
- Telesistema 11 — Dailymotion
- Teleuniverso 29 — Dailymotion
- TV Direct 13 Curaçao — JWPlayer

### Genuine new family gap

- Digital 15 — Radiant Media Player
- Telemicro 5 — Radiant Media Player

Radiant is the clearest player family in the current tranche that was not part of the original accepted helper bank. It should be treated as one shared family investigation, not two independent provider hacks.

### Generic Hls.js review

- Bonao TV
- RTVD
- Sankhya Television
- The Islamic Network
- Yunavisión

These are not automatically provider-helper gaps. Hls.js is already recognized by Player Lab and may remain browser-first. The RTVD interaction probe successfully advanced playback using bounded browser media activation, which supports trying a generic browser-side route before any provider-specific helper.

### Generic HTML5 review

- Adoram TV

The interaction probe advanced Adoram playback from paused to playing with audio unmuted. No new player-family engine is justified from current evidence.

### No player-family evidence / likely no helper or route-specific review

- Alcarrizos TV
- Bonaire TV
- CDN 37
- Jamaica Travel Channel
- Live 99 TV
- Teleantillas
- TVCARiB
- VIP Radio Live TV
- XFM Aruba
- ZNS TV

Several of these were classified by the analyzer as `no-helper-needed` on passive evidence. Others require route-specific validation rather than a new family helper.

## Interaction-probe evidence

Current bounded probes show:

- XFM Aruba: Video.js media advanced from 0 to ~7.6 s, unmuted.
- RTVD: Hls.js media advanced from 0 to ~4.9 s, unmuted.
- Telecentro 13: Radiant media advanced from ~3.0 to ~7.9 s, unmuted.
- Digital 15: Radiant media time advanced from ~2.4 to ~9.9 s even though the final paused flag remained true; playback state needs interpretation before helper design.
- Adoram TV: native HTML5 media advanced from ~5.5 to ~10.4 s, unmuted.
- Télé Péyi: Video.js became ready and advanced to ~3.5 s.
- Madras FM TV: Video.js became ready and began advancing.
- Balchi TV: play state changed but media remained unready; further route/player validation is required.

## Missing queue records discovered during audit

The automated target registry initially omitted:

- #928 SVG-TV
- #926 Identité Télé Caraïbes
- #925 Fusion TV

#926 and #925 have now been restored to the profiler registry using their official broadcaster routes. #928 remains intentionally unregistered until a current trustworthy SVG-TV route is established.

## Working conclusion

The unfinished work is substantially smaller than the list of newer Channel posts.

Priority order:

1. Complete the missing-record profiles (#925/#926; #928 route discovery).
2. Treat Radiant as the first true new player-family gap.
3. Test whether Hls.js channels can use one bounded generic browser-play path before creating provider helpers.
4. Reuse existing YouTube/Vimeo/Dailymotion/JWPlayer/Video.js families for the remaining channels, adding only minimal provider wrappers where evidence shows they are necessary.
5. Keep channels classified `no-helper-needed` out of helper code unless physical TV validation proves otherwise.

No Android runtime helper should be added solely from family detection; physical Bravia validation remains the final acceptance gate.

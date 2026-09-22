# Newest live-channel helper reconnaissance

## Scope

Work newest additions first and move backwards. The numbers 15550, 15549, and 15548 are iCanlive source identifiers, not Kulcha Flo WordPress post IDs. They must not be used as the canonical WordPress ordering key.

This checkpoint does not change Android runtime behavior. It extends Player Lab classification only, so new hosted-player families can be observed without being mistaken for generic HTML5/direct-media candidates.

## Current reconnaissance set

### TV Famille — Martinique

- Secondary source: iCanlive source id 15550.
- Current secondary listing is reachable.
- No sufficiently authoritative official browser-player route has yet been established.
- Classification: observation required.
- Runtime action: none.

### Identité Télé Caraïbes — Martinique

- Secondary source: iCanlive source id 15549.
- Official broadcaster page: https://identiteradio.com/tv/
- The official page currently embeds the live player on vdo2.pro-fhi.net.
- Player Lab family added: pro-fhi.
- The family is treated as hosted-player evidence and outranks a generic HTML5 media-element signal.
- Classification status: family-known; runtime behavior still requires profiling.
- Runtime action: none.

### FUSION TV — Martinique

- Secondary source: iCanlive source id 15548.
- Official broadcaster page: https://radiofusion.fr/fusion-tv/
- The official page currently embeds player.infomaniak.com.
- Infomaniak documents its player as an iframe-based adaptive player using HLS by default with optional MPEG-DASH.
- Player Lab family added: infomaniak.
- The family is treated as hosted-player evidence and outranks a generic HTML5 media-element signal.
- Classification status: family-known; runtime behavior still requires profiling.
- Runtime action: none.

## Safety rules for the next pass

1. Prefer an official broadcaster page over an aggregator when an official playable route exists.
2. Do not treat Fluid Player and Flowplayer as the same family.
3. Do not infer native promotion from HLS/DASH capability alone.
4. Hosted-player evidence wins over a generic media-element observation until profiling proves a safe direct source.
5. Keep accepted helpers unchanged while these targets are being characterized.
6. Recover the actual Kulcha Flo WordPress post-ID order before using post IDs as the reverse work queue.

## Next evidence required

For each target, collect the canonical Player Lab profile and offline analysis. Record player family, frame host, selector evidence, autoplay state, transport/fullscreen behavior, candidate ranking and whether direct-media evidence is stable. Only then decide between an existing generic helper capability, a provider-specific helper, or browser-first retention.


## Reverse WordPress-ID work queue

Canonical source: Kulcha Flo metadata audit recovered from File Library.

| WP ID | Channel | Current route status | Player-family status | Next action |
| ---: | --- | --- | --- | --- |
| 933 | The Islamic Network | Official site current; live endpoint not yet trustworthy | historical JW reference only; unconfirmed current | browser profile required |
| 932 | Bizz TV | Official live page | Streamhoster iframe | profile Streamhoster inner player |
| 931 | Sankhya Television | Official /live page | hidden Wix-hosted player; family unknown | browser profile required |
| 930 | Scorch TV | Current app/cable distribution confirmed; official web-player route unresolved | unknown | route discovery required |
| 929 | TVCARiB | Official site current | secondary evidence shows direct HLS, not yet accepted as authoritative | profile official page before direct promotion |
| 928 | SVG-TV | Channel remains a distinct SVGBC broadcaster; old web route weak/stale | unknown | current official web route discovery |
| 927 | TeleOnce | Official /en-vivo page | JWPlayer | existing JW helper-family comparison |
| 926 | Identité Télé Caraïbes | Official broadcaster page | pro-fhi | profile hosted player |
| 925 | Fusion TV | Official broadcaster page | Infomaniak | profile hosted player |
| 924 | Jamaica Travel Channel | Official channel site current | unknown; secondary direct-HLS evidence exists | profile official site |
| 923 | Madras FM TV | Official site current | secondary Fluid Player evidence only | profile official site; do not conflate Fluid Player with Flowplayer |
| 922 | RHT Radio Haute Tension TV | Official live-video page | Infomaniak | reuse Infomaniak family profile |
| 921 | ETV Guadeloupe | Official site and official M3U distribution | direct-stream capability likely, exact browser route not yet characterized | profile web player and playlist safely |
| 919 | Antena 7 | Official en-vivo page | unknown | browser profile required |
| 918 | Bonao TV | Official site with En Vivo | unknown | browser profile required |
| 917 | Alcarrizos TV | Official site with live iframe | unknown hosted frame | browser profile required |
| 916 | Adoram TV | no trustworthy official route yet | unknown | route discovery required |
| 915 | Yuna Visión | Official site current | unknown | browser profile required |
| 914 | Teleuniverso Canal 29 | Official site current | unknown | browser profile required |
| 913 | CDN Canal 37 | Official broadcaster site current | unknown | browser profile required |
| 912 | Digital 15 | Official live page | Telemicro shared player | reuse Telemicro family profile |
| 911 | Telecentro Canal 13 | Official live page | Telemicro/YouTube surfaces | profile intended live route, avoid programme-level YouTube confusion |
| 910 | Telemicro Canal 5 | Official live page | Telemicro shared player | reuse Telemicro family profile |
| 909 | Teleantillas | Official broadcaster site current; live route weakly surfaced | unknown | browser profile required |
| 908 | Telesistema 11 | Official en-vivo page | unknown | browser profile required |
| 905 | RTVD | Official site with RTVD 4/17/International live choices | multi-channel family unknown | browser profile and channel-intent characterization |

## New reusable Player Lab families added in this checkpoint

- `infomaniak`
- `pro-fhi`
- `streamhoster`
- `telemicro`

These additions are classifier/signature work only. They do not authorize Android runtime helpers or direct-media promotion.

## Offline completion boundary

The remaining step for every `browser profile required` target is to run the existing Player Lab browser profiler against the registered public target. That profiler requires a browser-capable runtime with outbound access. This ChatGPT execution environment cannot resolve external hosts from the local container, and the GitHub repository currently has no workflow wired to execute these profiling jobs remotely.

The branch therefore intentionally stops before inventing player selectors, autoplay behavior, synthetic taps, native promotion, or Android runtime changes from web-search evidence alone.


## Queue completion additions

The canonical reverse-ID audit also confirms:
- #920 Télé Péyi Guyane — official current live page registered at PÉYI GUYANE.
- #907 Ahora TV — official current live page registered.
- #906 Acento TV — official current live page registered.
- #902 TV Direct 13 — official Direct Media Curaçao web route registered.
- #893 Pointe TV — official Pointville live-stream route registered.
- #891 Island TV Plus — already covered by the accepted Island TV Vimeo single-player-shell helper family and marks the lower boundary of this newest unsolved tranche.

#904 Cubavisión Internacional is confirmed as a Channel record, but the reconnaissance branch intentionally does not register an unverified web route. Current public evidence points to Cuba's official TV/Teveo ecosystem, but an exact durable browser target has not yet been established strongly enough for the fixed public-target registry.

No #892 live-channel record was established by the recovered metadata audit. The workflow therefore does not invent one.

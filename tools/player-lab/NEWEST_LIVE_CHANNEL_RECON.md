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

# Android media-candidate ranking

## Why the first-direct rule was unsafe

The former generic Android path accepted the first recognizable direct media
source reported by a frame. It could hide GeckoView and start native playback
before the rest of that frame's media candidates had settled. DOM discovery
order is not evidence that a media element is the page's intended player.

The MTM production profile exposed the failure mode in one top-level frame:

1. a visible, wide and shallow background video with a short finite duration,
   muted autoplay, no controls, and a direct MP4 source;
2. a hidden, zero-area player support video with no usable source and a media
   error;
3. a visible, ready Bradmax player with primary-player geometry, controls,
   player ancestry, and a managed MediaSource backed by HLS delivery.

The facts above come from the canonical Player Lab observation. The conclusion
that early native promotion explains the physical-TV symptom is an inference
from those facts and the inspected Android selection flow.

## Descriptor and hard eligibility

The existing all-frame media-evidence message now carries bounded descriptors.
They include frame-local identity and order, source kind, a promotable direct
URL only when it passes the existing boundary, MIME type, rendered visibility
and geometry, media error/readiness state, playback attributes, a bounded
duration category, and boolean ancestry signals. It does not add page text,
selectors, cookies, credentials, signed manifests, or non-promotable source
paths.

A native candidate is hard-ineligible when it is hidden, has no visible area,
is outside the viewport, is errored, is a hidden support element, is not video,
has no safe supported direct source, is audio-only, or is a blob/managed
MediaSource. A managed candidate is relevant as competition only when it is
rendered, error-free, and supported by a managed source or by the combined
player-ancestry, readiness, and primary-geometry evidence.

## Decorative signals and safe behavior

Decorative evidence is scored with named reasons:

- `decorative-finite-short`
- `decorative-muted-autoplay`
- `decorative-no-controls`
- `decorative-background-ancestry`
- `decorative-loop`
- `decorative-ended-short`
- `decorative-wide-shallow`

No individual signal suppresses a candidate. A direct candidate is suppressed
only when at least three bounded decorative signals agree and an eligible
managed player exists in the same frame. This protects ordinary muted media,
autoplay media, short clips, and media without native controls.

A visible background MP4 with no competing managed player remains eligible
after settlement. This fail-open choice avoids suppressing legitimate
standalone short-form or on-demand media based on styling alone. A visible,
user-facing short clip likewise remains eligible.

The MTM Bradmax blob is never sent to Media3. It is evidence that a genuine
managed web player exists, so the decorative direct candidate is suppressed
and GeckoView remains visible for Bradmax to operate.

## Settlement and frame boundary

The content observer publishes immediately and on its established two-second
cadence. A direct candidate must have the same bounded descriptor set for three
observations before promotion, corresponding normally to the initial sample
and two cadence samples. A newly appearing or changing candidate set restarts
the count. This gives a delayed managed player a bounded opportunity to appear
without adding another timer owner.

Each content script instance observes one frame and sends one frame-local
candidate set. Ranking never combines unrelated frame reports or treats their
arrival order as a shared DOM order. A candidate in one frame therefore cannot
suppress a direct candidate in another frame. Cross-frame arbitration remains
intentionally outside this checkpoint.

The media cadence timer is cleared and settlement state is discarded on
`pagehide`. The Android ranker itself owns no timers. Repeated stable evidence
for an already active source reaches the existing same-source guard and does
not restart playback.

## Decisions and diagnostics

The bounded decision states are:

- `promote-direct-candidate`
- `suppress-decorative-candidate`
- `wait-for-candidate-settlement`
- `no-eligible-direct-candidate`
- `retain-web-player`

Hard-eligibility, decorative, settlement, same-frame competition, and
selection reasons are emitted as bounded reason codes. Generic diagnostics do
not print complete media URLs.

## Validation boundary

This checkpoint implements and tests the generic rule and builds the Bravia
release APK. It does not visit a provider and does not install the APK.
Physical Sony Bravia validation is still required to prove that the MTM page
stays in GeckoView, that the managed player remains usable, and that known
standalone direct-media providers continue to promote correctly.

# Media Candidate Arbitration

## Checkpoint purpose

This diagnostic checkpoint records the MTM production symptom and the bounded
evidence needed to design a later reusable media-candidate ranking change. It
does not change Android, the runtime observer, or any provider helper.

On physical Bravia hardware, the MTM page was reported to repeatedly enter the
native media/fullscreen route for decorative animation instead of settling on
the scheduled live player. Passive profiling established three top-level media
candidates in one frame:

1. Candidate 1 is a visible, short, muted-autoplay background video with a
   direct MP4 source, no native controls, and wide/shallow rendering.
2. Candidate 2 is a hidden, zero-area Bradmax support video with no usable
   source and a media error.
3. Candidate 3 is the visible Bradmax live player, backed by a managed media
   source and successful HLS delivery, with playable readiness and live-player
   ancestry.

The current Android path discovers media elements and accepts the first
recognised direct media URL. It does not rank finite duration, muted autoplay,
background ancestry, visibility, errors, managed sources, or live-player
evidence. Candidate 1 therefore satisfies that rule before candidate 3.

The three candidates and their attributes are observed facts. The conclusion
that repeated physical-TV promotion cycles reselect candidate 1 is an inference
from those facts, the read-only Android logic, and the reported symptom. The
passive page observation did not observe the background video looping or
restarting.

## Bounded arbitration

Discovery order is retained as report order only. It is not treated as a
global DOM order across unrelated frames.

- `same-frame-confirmed` requires the likely decorative direct candidate and
  likely live candidate to share a frame, with the decorative candidate earlier
  by frame-local discovery order.
- `cross-frame-race-possible` records candidates in different frames without
  claiming that global report order proves which frame produced media first.
- `no-conflict-established` covers cases without an eligible pair or without a
  proven same-frame ordering conflict.

Decorative evidence is bounded to rendered visibility plus signals such as
finite-short duration, muted autoplay, no controls, background ancestry,
looping, and wide/shallow geometry. A hidden decorative element cannot
establish a conflict.

Live selection excludes hidden, zero-area, non-intersecting, failed, and
source-less support elements. Positive ranking evidence includes a managed
media source, HLS or DASH classification, active progression, playable
readiness, player ancestry, bounded control evidence, and visible primary-player
geometry.

MTM is `same-frame-confirmed` with high inference confidence: candidate 1 is
the likely decorative candidate and candidate 3 is the likely live candidate.
Candidate 2 is ineligible. This indicates a generic ranking weakness rather
than evidence for an MTM-only helper.

## Safety and follow-up

A generic rule must not suppress legitimate short-form or on-demand media.
Future regression coverage must include standalone short clips, background
video, direct live media, managed hosted players, delayed player creation,
multiple candidates, and cross-frame races.

No Android remedy is implemented here. A later engine checkpoint must design
and certify candidate scoring, followed by controlled GeckoView testing and
physical Bravia validation.

The Sony-emulated Playwright profile received a provider WAF 403 response. The
canonical evidence therefore came from a passive desktop-profile observation
of the same registered target. That observation is not a substitute for the
physical Bravia validation required after an Android engine patch.

## Evidence bindings

- Canonical report:
  `reports/mtm-tv/2026-07-27T11-23-37-649Z/report.json`
- Canonical report SHA-256:
  `5ac6c0e41cb5967322f0d40971bfd3f5f90c4da303460c6bd8213cf788859878`
- Regenerated analysis:
  `reports/mtm-tv/2026-07-27T11-23-37-649Z/analysis/2026-07-27T11-39-25-137Z/analysis.json`
- Regenerated analysis SHA-256:
  `835e7add3564c367f5311e9f294978be92b35c211ad07b4b632bbb84c16e2070`

Profile evidence retains safe hosts and bounded media kinds while replacing
manifest paths, direct-media paths, and transport-segment paths with fixed
redaction placeholders. Query strings, signed values, response bodies, and
local paths are not retained.

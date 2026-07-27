# Direct-media Back dismissal

## Physical regression

Checkpoint 4J-B2 verified the generic candidate-ranking change on a Sony Bravia. MTM retained its visible managed web player, and CVM's Vimeo transport continued to work. CBC TV8 Barbados also promoted its genuine direct live media into Media3 and played correctly.

The CBC Back lifecycle exposed a separate defect:

1. Media3 was stopped and released.
2. GeckoView was made visible on the still-active CBC provider document.
3. The previous source-only suppression expired after 15 seconds.
4. The unchanged document published the same candidate evidence again.
5. Media3 was constructed and started a second time.

Release alone was therefore insufficient. It ended one player instance without expressing that the user had dismissed native promotion from the originating document.

## Generic dismissal model

The application now keeps an in-memory dismissal record scoped to:

- the originating GeckoSession;
- a monotonically increasing top-level document generation;
- a SHA-256 of the normalized page identity;
- a SHA-256 of the promoted source identity;
- the bounded reason `user-back`.

Complete page and media URLs are not retained by this state or included in its diagnostic messages. Query data can distinguish a genuine navigation, but exists only inside the one-way page-identity hash.

When Back is pressed during native promotion, the application records dismissal before it stops Media3 or exposes GeckoView. It then immediately uses the existing navigation architecture:

- browser history when available;
- provider-tab closure when the provider is in a separate tab;
- the configured default Kulcha Flo start page as the established single-tab fallback.

There is no CBC host, path, source, or selector exception.

## Suppression and reset boundaries

All direct-media entry points, including specialised live-HLS evidence and the generic candidate ranker, consult the same session/document decision. Evidence from any frame in a dismissed document receives:

- `suppress-user-dismissed-document`;
- `retain-browser-after-user-back`;
- `ignore-stale-promotion-evidence`.

Stopping Media3, showing GeckoView, a timer, or seeing the source again does not clear dismissal. State clears only on a genuine top-level location callback (including a deliberate same-address reload), tab/session closure, or process restart. Evidence callbacks merely ensure the current identity and cannot advance the generation. Navigating away and deliberately reopening the provider therefore creates a new generation and permits promotion again. Another session or provider is unaffected.

## Protected behaviour

The change does not alter media eligibility or ranking. MTM's decorative-direct suppression and managed-player retention remain governed by the 4J-B1 ranker. CVM remains on its embedded Vimeo helper and transport path. A standalone direct source may still promote normally on a fresh document generation.

## Remaining physical validation

A Bravia follow-up must confirm that CBC Back now exits to Kulcha Flo without delayed re-promotion and that deliberately reopening CBC promotes normally. The already-passed MTM and CVM checks should be repeated as regressions.

MTV Guyana is queued only as a supplementary post-fix physical regression. Its actual route must first be identified from bounded runtime decisions; it is not assumed to use direct media or any particular helper.

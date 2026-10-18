export function sampleReportInput(overrides = {}) {
  return {
    metadata: {
      providerId: 'fixture-provider',
      profilerVersion: '0.1.0-checkpoint2',
    },
    requestedUrl: 'https://user:pass@example.test/watch?token=secret#frag',
    finalUrl: 'https://example.test/final?session=secret#done',
    timing: {
      startedAt: '2026-07-14T00:00:00.000Z',
      finishedAt: '2026-07-14T00:00:20.000Z',
      durationSeconds: 20,
    },
    browser: {
      engine: 'fixture',
      profile: 'desktop-firefox',
      userAgent: 'fixture-agent',
      viewport: { width: 1920, height: 1080 },
    },
    navigation: {
      result: 'fixture-only',
      errors: [],
      redirectCount: 0,
      popupCount: 0,
      unexpectedPopupUrls: ['https://popup.example.test/path?token=secret#popup'],
    },
    frames: [
      {
        id: 'frame-1',
        parentId: null,
        url: 'https://example.test/frame?token=secret#frame',
        hostname: 'example.test',
        name: 'main',
        mainFrame: true,
        accessible: true,
      },
    ],
    scripts: [
      { src: 'https://example.test/mock-player.js?token=secret#script' },
    ],
    iframes: [
      { src: 'https://example.test/nested-frame.html?token=secret#nested', title: 'Nested fixture player' },
    ],
    mediaObservations: [
      {
        id: 'media-1',
        frameId: 'frame-1',
        tagType: 'video',
        src: 'https://cdn.example.test/live/index.m3u8?token=secret#media',
        currentSrc: 'https://cdn.example.test/live/index.m3u8?token=secret#current',
        poster: 'https://cdn.example.test/poster.jpg?token=secret#poster',
        computedVisibility: 'visible',
        viewportCoverageRatio: 0.75,
        timeAdvanced: true,
        replacementDetected: true,
      },
    ],
    networkEvidence: [
      {
        kind: 'script',
        url: 'https://cdn.example.test/player.js?token=secret#script',
        message: 'Loaded https://user:pass@cdn.example.test/player.js?token=message-secret#message-frag and https://media.example.test/live.m3u8?sig=abc#media.',
      },
    ],
    lifecycleEvidence: {
      playing: [{
        timestamp: '2026-07-14T00:00:01.000Z',
        event: 'playing',
        detail: 'Lifecycle saw https://media.example.test/live.m3u8?token=life-secret#life-frag.',
      }],
    },
    candidateControls: [
      { role: 'button', ariaLabel: 'Play', text: 'Play https://controls.example.test/path?token=control-secret#control-frag' },
    ],
    playerClassification: {
      primaryFamily: 'native-html5',
      confidence: 'medium',
      supportingEvidence: [{
        family: 'native-html5',
        reason: 'video element',
        value: 'Observed https://player.example.test/embed?token=evidence-secret#evidence-frag.',
      }],
      contradictoryEvidence: [],
      uncertainty: [],
    },
    routeClassification: {
      route: 'official-page browser-first',
      confidence: 'medium',
      evidence: ['official page media observed'],
      uncertainty: [],
    },
    truncation: {
      relevantNetworkRecords: { truncated: true, limit: 1 },
      mediaElementObservations: { truncated: false, limit: 100 },
    },
    warnings: ['fixture warning https://warn.example.test/a?token=warning-secret#warning-frag'],
    omissions: ['raw cookies omitted'],
    ...overrides,
  };
}

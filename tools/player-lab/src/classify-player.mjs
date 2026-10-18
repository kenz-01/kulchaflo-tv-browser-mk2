import { loadPlayerSignatures } from './load-player-signatures.mjs';
import { PLAYER_FAMILIES } from './player-families.mjs';

export { PLAYER_FAMILIES };

const HOSTED_PLAYER_FAMILIES = new Set(['youtube', 'vimeo', 'dailymotion', 'jwplayer', 'bradmax', 'tego', 'novus']);
const STREAM_TECH_FAMILIES = new Set(['hlsjs', 'shaka', 'native-html5']);

const WEIGHTS = Object.freeze({
  iframe: 5,
  script: 4,
  global: 4,
  dom: 3,
  media: 1,
  element: 2,
});

export function classifyPlayer(evidence = {}, options = {}) {
  const signatures = options.signatures ?? loadPlayerSignatures();
  const records = normalizeEvidence(evidence);
  const scores = new Map();
  const supporting = [];
  const contradictory = [];
  const uncertainty = [];

  for (const family of PLAYER_FAMILIES.filter((name) => name !== 'unknown')) {
    scores.set(family, 0);
  }

  for (const record of records) {
    const matchedFamilies = matchRecord(record, signatures);
    for (const match of matchedFamilies) {
      scores.set(match.family, scores.get(match.family) + match.weight);
      supporting.push({
        family: match.family,
        kind: record.kind,
        value: record.safeValue,
        reason: match.reason,
        weight: match.weight,
      });
    }
  }

  const mediaElements = Number(evidence.mediaElementCount ?? evidence.mediaElements?.length ?? 0);
  if (mediaElements > 0 && scores.get('native-html5') === 0) {
    scores.set('native-html5', Math.max(4, mediaElements));
    supporting.push({
      family: 'native-html5',
      kind: 'media-element',
      value: String(mediaElements),
      reason: 'accessible video/audio element observed',
      weight: Math.max(4, mediaElements),
    });
  }

  const sorted = [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort(compareFamilyScores);

  if (sorted.length === 0) {
    return {
      primaryFamily: 'unknown',
      secondaryFamilies: [],
      confidence: 'low',
      supportingEvidence: [],
      contradictoryEvidence: [],
      uncertainty: ['No known player signatures were observed.'],
    };
  }

  const [primaryFamily, primaryScore] = sorted[0];
  const secondaryFamilies = sorted.slice(1).map(([family]) => family);
  const topHosted = sorted.find(([family]) => HOSTED_PLAYER_FAMILIES.has(family));
  const topStream = sorted.find(([family]) => STREAM_TECH_FAMILIES.has(family));

  if (topHosted && topStream) {
    uncertainty.push('Stream technology evidence is present but does not outrank hosted player evidence by itself.');
  }

  if (sorted.length > 1 && sorted[1][1] >= primaryScore - 1) {
    contradictory.push({
      family: sorted[1][0],
      reason: 'Competing signature score is close to the primary family.',
      score: sorted[1][1],
    });
  }

  return {
    primaryFamily,
    secondaryFamilies,
    confidence: confidenceFor(primaryScore, sorted[1]?.[1] ?? 0),
    supportingEvidence: supporting.filter((item) => item.family === primaryFamily),
    secondaryEvidence: supporting.filter((item) => item.family !== primaryFamily),
    contradictoryEvidence: contradictory,
    uncertainty,
    scores: Object.fromEntries(sorted),
  };
}

function compareFamilyScores([familyA, scoreA], [familyB, scoreB]) {
  if (scoreA !== scoreB) {
    return scoreB - scoreA;
  }
  const hostedA = HOSTED_PLAYER_FAMILIES.has(familyA) ? 1 : 0;
  const hostedB = HOSTED_PLAYER_FAMILIES.has(familyB) ? 1 : 0;
  if (hostedA !== hostedB) {
    return hostedB - hostedA;
  }
  return PLAYER_FAMILIES.indexOf(familyA) - PLAYER_FAMILIES.indexOf(familyB);
}

function confidenceFor(primaryScore, secondaryScore) {
  if (primaryScore >= 8 && primaryScore >= secondaryScore + 3) {
    return 'high';
  }
  if (primaryScore >= 4 && primaryScore >= secondaryScore + 1) {
    return 'medium';
  }
  return 'low';
}

function normalizeEvidence(evidence) {
  const records = [];
  addValues(records, 'iframe', evidence.iframeUrls ?? evidence.iframes);
  addValues(records, 'script', evidence.scriptUrls ?? evidence.scripts);
  addValues(records, 'global', evidence.globals ?? evidence.globalNames);
  addValues(records, 'dom', evidence.domSignals ?? evidence.elements ?? evidence.classNames);
  addValues(records, 'media', evidence.mediaUrls ?? evidence.networkUrls ?? evidence.manifestUrls);
  return records;
}

function addValues(records, kind, values) {
  if (!values) {
    return;
  }
  const list = Array.isArray(values) ? values : [values];
  for (const value of list) {
    if (value === null || value === undefined) {
      continue;
    }
    const safeValue = String(value).slice(0, 400);
    records.push({ kind, safeValue, normalized: safeValue.toLowerCase() });
  }
}

function matchRecord(record, signatures) {
  const matches = [];
  for (const [family, signature] of Object.entries(signatures.families)) {
    if (record.kind === 'global' && includesToken(signature.globalNames, record.safeValue)) {
      matches.push({ family, reason: 'known global object', weight: WEIGHTS.global });
      continue;
    }
    if (record.kind === 'dom' && includesToken(signature.domPatterns, record.normalized)) {
      matches.push({ family, reason: 'known DOM id/class/wrapper signal', weight: WEIGHTS.dom });
      continue;
    }
    if (record.kind === 'script' && (includesToken(signature.scriptPatterns, record.normalized) || urlHostMatches(record.safeValue, signature.hostPatterns))) {
      matches.push({ family, reason: 'known player script URL', weight: WEIGHTS.script });
      continue;
    }
    if (record.kind === 'iframe') {
      const hostMatch = urlHostMatches(record.safeValue, signature.hostPatterns);
      if (hostMatch) {
        const pathStrengthened = urlPathMatches(record.safeValue, signature.pathPatterns);
        matches.push({
          family,
          reason: pathStrengthened ? 'known iframe host and path' : 'known iframe host',
          weight: pathStrengthened ? WEIGHTS.iframe + 1 : WEIGHTS.iframe,
        });
      }
    }
  }
  return matches;
}

function includesToken(tokens, value) {
  const normalizedValue = String(value).toLowerCase();
  return tokens.some((token) => normalizedValue.includes(String(token).toLowerCase()));
}

function urlHostMatches(value, hosts) {
  const parsed = parseUrl(value);
  if (!parsed) {
    return includesToken(hosts, value.toLowerCase());
  }
  return hosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
}

function urlPathMatches(value, paths) {
  const parsed = parseUrl(value);
  if (!parsed) {
    return includesToken(paths, value.toLowerCase());
  }
  return paths.some((path) => parsed.pathname.toLowerCase().includes(path.toLowerCase()));
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

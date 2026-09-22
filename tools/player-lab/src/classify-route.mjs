const ROUTES = Object.freeze([
  'official-page browser-first',
  'embedded-player browser-first',
  'exact-native-promotion candidate',
  'authenticated flow',
  'unknown / further investigation',
]);

export { ROUTES };

export function classifyRoute(evidence = {}) {
  const reasons = [];
  const uncertainty = [];

  if (hasAuthenticatedEvidence(evidence)) {
    reasons.push('Login, subscription, entitlement, or password evidence is present.');
    return result('authenticated flow', 'high', reasons, uncertainty);
  }

  const exactNative = evidence.exactKnownNativeSource === true || evidence.exactNativeCandidate === true;
  if (exactNative && evidence.officialPageEvidence === true && evidence.manifestOnly !== true) {
    reasons.push('Evidence includes an exact known safe native source in official page context.');
    return result('exact-native-promotion candidate', 'medium', reasons, [
      'This is a cautious route hint only; provider-specific validation is still required.',
    ]);
  }

  if (hasEmbeddedEvidence(evidence)) {
    reasons.push('Known player iframe or embedded-player host evidence is present.');
    if (hasManifestEvidence(evidence)) {
      uncertainty.push('Manifest evidence was observed but is treated as diagnostic, not as native-promotion proof.');
    }
    return result('embedded-player browser-first', 'medium', reasons, uncertainty);
  }

  if (evidence.officialPageEvidence === true || evidence.sameOriginMainMedia === true || evidence.mediaElementCount > 0) {
    reasons.push('Official page or accessible page media evidence is present without a stronger embedded-player route.');
    if (hasManifestEvidence(evidence)) {
      uncertainty.push('Manifest evidence alone does not justify exact native promotion.');
    }
    return result('official-page browser-first', 'medium', reasons, uncertainty);
  }

  if (hasManifestEvidence(evidence)) {
    reasons.push('Only manifest-like diagnostic network evidence is present.');
    uncertainty.push('Manifest evidence alone must not produce an exact-native-promotion recommendation.');
    return result('unknown / further investigation', 'low', reasons, uncertainty);
  }

  return result('unknown / further investigation', 'low', ['Insufficient route evidence.'], uncertainty);
}

function result(route, confidence, evidence, uncertainty) {
  return { route, confidence, evidence, uncertainty };
}

function hasAuthenticatedEvidence(evidence) {
  if (evidence.authenticated === true) {
    return true;
  }
  const explicitSignals = (evidence.authSignals ?? []).map((value) => String(value).toLowerCase());
  return explicitSignals.some((value) => (
    value.includes('subscription required to watch') ||
    value.includes('sign in to continue watching') ||
    value.includes('login required for playback') ||
    value.includes('entitlement required') ||
    value.includes('authentication required') ||
    value.includes('must sign in to watch') ||
    value.includes('sign in required to watch')
  ));
}

function hasEmbeddedEvidence(evidence) {
  return Boolean(
    evidence.embeddedPlayerEvidence === true ||
      evidence.hostedPlayerEvidence === true ||
      (Array.isArray(evidence.playerHosts) && evidence.playerHosts.length > 0),
  );
}

function hasManifestEvidence(evidence) {
  if (evidence.manifestEvidence === true) {
    return true;
  }
  const urls = [...(evidence.manifestUrls ?? []), ...(evidence.networkUrls ?? []), ...(evidence.mediaUrls ?? [])];
  return urls.some((url) => {
    const value = String(url).toLowerCase();
    return value.includes('.m3u8') || value.includes('.mpd');
  });
}

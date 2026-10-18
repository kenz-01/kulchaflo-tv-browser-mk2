import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { startFixtureServer } from '../fixtures/server.mjs';
import { profileUrl, evidenceForClassifiers, hasMeaningfulEmbeddedEvidence } from './profile-url.mjs';

export { evidenceForClassifiers, hasMeaningfulEmbeddedEvidence };

export async function profileFixture(options = {}) {
  let fixture;
  try {
    fixture = await startFixtureServer();
    return await profileUrl({
      ...options,
      url: `${fixture.origin}/?token=fixture-secret#fixture-fragment`,
      providerId: options.providerId ?? 'local-fixture',
    });
  } finally {
    await fixture?.close().catch(() => {});
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = await profileFixture();
  console.log(result.outputDir);
}

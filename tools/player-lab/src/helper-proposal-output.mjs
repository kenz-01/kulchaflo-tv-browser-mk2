import { existsSync, lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { filesystemSafeTimestamp } from './output-directory.mjs';

export function createStagedHelperProposalOutputDirectory({ outputRoot, now = () => new Date() } = {}) {
  if (typeof outputRoot !== 'string' || outputRoot.trim() === '') throw new Error('Helper proposal output root is required.');
  const root = resolve(outputRoot);
  mkdirSync(root, { recursive: true });
  const timestamp = filesystemSafeTimestamp(now());
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const finalDir = resolve(root, `${timestamp}${suffix}`);
    const incompleteDir = resolve(root, `.incomplete-${timestamp}${suffix}`);
    if (!inside(finalDir, root) || !inside(incompleteDir, root)) throw new Error('Helper proposal output traversal rejected.');
    if (existsSync(finalDir) || existsSync(incompleteDir)) continue;
    mkdirSync(incompleteDir);
    let promoted = false;
    return Object.freeze({
      incompleteDir,
      finalDir,
      promote() {
        verifyHelperProposalArtifacts(incompleteDir);
        if (existsSync(finalDir)) throw new Error('Completed helper proposal directory already exists.');
        renameSync(incompleteDir, finalDir);
        promoted = true;
        return finalDir;
      },
      cleanup() {
        if (promoted) return;
        if (dirname(incompleteDir) !== root || !basename(incompleteDir).startsWith('.incomplete-')) {
          throw new Error('Refusing to remove non-staging helper proposal directory.');
        }
        rmSync(incompleteDir, { recursive: true, force: true });
      },
    });
  }
  throw new Error('Unable to allocate unique helper proposal output directory.');
}

export function writeHelperProposalJson(proposal, { outputDir } = {}) {
  const filePath = join(outputDir, 'helper-proposal.json');
  writeFileSync(filePath, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
  return { filePath };
}

export function writeHelperProposalMarkdown(proposal, { outputDir } = {}) {
  const lines = [
    '# Player Helper Proposal Review',
    '',
    `- Provider: ${safe(proposal.providerId)}`,
    `- Player family: ${safe(proposal.playerFamily)}`,
    `- Recommendation: ${safe(proposal.recommendationCategory)}`,
    `- Confidence: ${safe(proposal.confidence)}`,
    `- Reason: ${safe(proposal.recommendationReason)}`,
    '',
    '## Supported Capabilities',
    ...proposal.supportedCapabilities.map((item) => `- ${safe(item)}`),
    '',
    '## Unsupported Requirements',
    ...(proposal.unsupportedRequirements.length ? proposal.unsupportedRequirements.map((item) => `- ${safe(item)}`) : ['- none']),
    '',
    '## Policy Proposal',
    proposal.policyProposal ? `- Status: ${safe(proposal.policyProposal.proposalStatus)}\n- Policy ID: ${safe(proposal.policyProposal.id)}` : '- No policy proposal generated.',
    '',
    '## Review Warnings',
    ...proposal.reviewWarnings.map((item) => `- ${safe(item)}`),
    '',
  ];
  const filePath = join(outputDir, 'helper-proposal.md');
  writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  return { filePath };
}

export function verifyHelperProposalArtifacts(incompleteDir) {
  for (const name of ['helper-proposal.json', 'helper-proposal.md']) {
    const filePath = resolve(incompleteDir, name);
    if (dirname(filePath) !== incompleteDir || !inside(filePath, incompleteDir)) throw new Error('Helper proposal artifact traversal rejected.');
    let stat;
    try { stat = lstatSync(filePath); } catch { throw new Error(`Missing required helper proposal artifact: ${name}`); }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Invalid required helper proposal artifact: ${name}`);
  }
}

function inside(child, parent) {
  return child === parent || (child.startsWith(`${parent}/`) && !child.slice(parent.length).includes('..'));
}

function safe(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

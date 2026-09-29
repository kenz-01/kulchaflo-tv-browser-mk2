import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createReportModel } from './report-model.mjs';

export function renderReportMarkdown(reportInput) {
  const report = createReportModel(reportInput);
  const largestCoverage = largestViewportCoverage(report.mediaObservations);
  const mediaTimeAdvanced = report.mediaObservations.some((item) => item.timeAdvanced === true);
  const replacementDetected = report.mediaObservations.some((item) => item.replacementDetected === true || item.likelyReplacementAppeared === true);
  const visibleMedia = report.mediaObservations.filter((item) => item.computedVisibility === 'visible' || item.visible === true).length;
  const truncated = truncatedCategories(report.truncation);

  const lines = [
    '# Player Lab Report',
    '',
    '## Summary',
    `- Primary player family: ${safe(report.playerClassification.primaryFamily)}`,
    `- Confidence: ${safe(report.playerClassification.confidence)}`,
    `- Integration route: ${safe(report.routeClassification.route)}`,
    `- Frame count: ${report.frames.length}`,
    `- Visible media count: ${visibleMedia}`,
    `- Largest viewport coverage: ${largestCoverage.toFixed(3)}`,
    `- Media time advanced: ${mediaTimeAdvanced ? 'yes' : 'no'}`,
    `- Replacement detected: ${replacementDetected ? 'yes' : 'no'}`,
    `- Warnings: ${report.warnings.length > 0 ? report.warnings.map(safe).join('; ') : 'none'}`,
    `- Truncated categories: ${truncated.length > 0 ? truncated.map(safe).join(', ') : 'none'}`,
    '',
    '## Player Evidence',
    ...evidenceLines(report.playerClassification.supportingEvidence ?? []),
    '',
    '## Route Evidence',
    ...evidenceLines(report.routeClassification.evidence ?? []),
    '',
    '## Network Evidence',
    ...evidenceLines(report.networkEvidence.slice(0, 20)),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export function writeReportMarkdown(reportInput, { outputDir, providerId } = {}) {
  if (providerId !== undefined && providerId !== reportInput?.metadata?.providerId) {
    throw new Error('writeReportMarkdown providerId override must equal metadata.providerId.');
  }
  if (typeof outputDir !== 'string' || outputDir.trim() === '') {
    throw new Error('writeReportMarkdown requires an outputDir.');
  }
  const filePath = join(outputDir, 'report.md');
  mkdirSync(dirname(filePath), { recursive: true });
  const markdown = renderReportMarkdown(reportInput);
  writeFileSync(filePath, markdown, 'utf8');
  return { filePath, markdown };
}

function largestViewportCoverage(mediaObservations) {
  return mediaObservations.reduce((largest, item) => Math.max(largest, Number(item.viewportCoverageRatio ?? 0)), 0);
}

function truncatedCategories(truncation) {
  return Object.entries(truncation)
    .filter(([, state]) => state?.truncated === true)
    .map(([category]) => category);
}

function evidenceLines(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return ['- none'];
  }
  return items.slice(0, 20).map((item) => `- ${safe(typeof item === 'string' ? item : JSON.stringify(item))}`);
}

function safe(value) {
  return String(value ?? '')
    .replace(/\\r|\\n/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
    .replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]))
    .replace(/[*_`#[\]()>+\-.!|{}]/g, '\\$&');
}

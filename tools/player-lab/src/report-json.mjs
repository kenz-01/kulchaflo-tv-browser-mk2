import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createReportModel } from './report-model.mjs';

export function renderReportJson(reportInput) {
  const report = createReportModel(reportInput);
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function writeReportJson(reportInput, { outputDir, providerId } = {}) {
  if (providerId !== undefined && providerId !== reportInput?.metadata?.providerId) {
    throw new Error('writeReportJson providerId override must equal metadata.providerId.');
  }
  if (typeof outputDir !== 'string' || outputDir.trim() === '') {
    throw new Error('writeReportJson requires an outputDir.');
  }
  const filePath = join(outputDir, 'report.json');
  mkdirSync(dirname(filePath), { recursive: true });
  const json = renderReportJson(reportInput);
  writeFileSync(filePath, json, 'utf8');
  return { filePath, json };
}

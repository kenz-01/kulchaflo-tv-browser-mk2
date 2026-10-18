import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { renderReportJson, writeReportJson } from '../src/report-json.mjs';
import { renderReportMarkdown, writeReportMarkdown } from '../src/report-markdown.mjs';
import { sampleReportInput } from './report-fixtures.mjs';

test('report JSON output is stable, formatted, redacted and newline-terminated', () => {
  const json = renderReportJson(sampleReportInput());
  assert.equal(json.endsWith('\n'), true);
  assert.match(json, /"providerId": "fixture-provider"/);
  assert.doesNotMatch(json, /token=|#frag|#media|user:pass|message-secret|evidence-secret|life-secret|control-secret|warning-secret/);
  assert.equal(renderReportJson(sampleReportInput()), json);
});

test('report Markdown begins with compact summary and redacted evidence', () => {
  const markdown = renderReportMarkdown(sampleReportInput());
  assert.match(markdown, /^# Player Lab Report\n\n## Summary/);
  assert.match(markdown, /Primary player family: native\\-html5/);
  assert.match(markdown, /Integration route: official\\-page browser\\-first/);
  assert.match(markdown, /Largest viewport coverage: 0\.750/);
  assert.match(markdown, /Truncated categories: relevantNetworkRecords/);
  assert.doesNotMatch(markdown, /token=|#media|#script|user:pass|message-secret|evidence-secret|warning-secret/);
});

test('render functions reject unsafe metadata provider ids', () => {
  const input = sampleReportInput({ metadata: { providerId: '../evil', profilerVersion: 'x' } });
  assert.throws(() => renderReportJson(input), /Unsafe provider id/);
  assert.throws(() => renderReportMarkdown(input), /Unsafe provider id/);
});

test('writer provider id overrides must match metadata provider id', () => {
  assert.throws(() => writeReportJson(sampleReportInput(), {
    outputDir: tmpdir(),
    providerId: 'other-safe-id',
  }), /override must equal metadata\.providerId/);
  assert.throws(() => writeReportMarkdown(sampleReportInput(), {
    outputDir: tmpdir(),
    providerId: 'other-safe-id',
  }), /override must equal metadata\.providerId/);
});

test('Markdown evidence is single-line safe and redacted', () => {
  const markdown = renderReportMarkdown(sampleReportInput({
    playerClassification: {
      primaryFamily: 'native-html5',
      confidence: 'medium',
      supportingEvidence: [{
        value: 'Line 1\n# Injected heading\n- Injected list https://evil.example.test/a?token=markdown-secret#markdown-frag',
      }],
      contradictoryEvidence: [],
      uncertainty: [],
    },
  }));
  assert.doesNotMatch(markdown, /markdown-secret|#markdown-frag|Injected heading\n|\\n|Injected list https:\/\/evil\.example\.test\/a\?token/);
  assert.match(markdown, /Injected heading/);
  assert.match(markdown, /https:\/\/evil\\\.example\\\.test\/a/);
});

test('report writers create output directories safely', () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'player-lab-report-'));
  const nestedOutput = join(outputDir, 'nested', 'report');
  try {
    const jsonResult = writeReportJson(sampleReportInput(), { outputDir: nestedOutput });
    const markdownResult = writeReportMarkdown(sampleReportInput(), { outputDir: nestedOutput });
    assert.equal(readFileSync(jsonResult.filePath, 'utf8'), jsonResult.json);
    assert.equal(readFileSync(markdownResult.filePath, 'utf8'), markdownResult.markdown);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test('report writers reject unsafe provider ids', () => {
  const input = sampleReportInput({ metadata: { providerId: '../evil', profilerVersion: 'x' } });
  assert.throws(() => writeReportJson(input, { outputDir: tmpdir() }), /Unsafe provider id/);
  assert.throws(() => writeReportMarkdown(input, { outputDir: tmpdir() }), /Unsafe provider id/);
});

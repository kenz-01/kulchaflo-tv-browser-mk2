import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStagedProfileOutputDirectory } from '../src/output-directory.mjs';

test('staged output allocation creates only an incomplete directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'player-lab-output-'));
  try {
    const staged = createStagedProfileOutputDirectory({
      providerId: 'local-fixture',
      outputRoot: root,
      now: () => new Date('2026-07-19T05:00:00.000Z'),
    });
    assert.equal(existsSync(staged.incompleteDir), true);
    assert.equal(existsSync(staged.finalDir), false);
    assert.match(staged.incompleteDir, /local-fixture\/\.incomplete-2026-07-19T05-00-00-000Z$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('staged output allocates unique timestamped directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'player-lab-output-'));
  try {
    const now = () => new Date('2026-07-19T05:00:00.000Z');
    const first = createStagedProfileOutputDirectory({ providerId: 'local-fixture', outputRoot: root, now });
    const second = createStagedProfileOutputDirectory({ providerId: 'local-fixture', outputRoot: root, now });
    assert.notEqual(first.incompleteDir, second.incompleteDir);
    assert.match(second.incompleteDir, /-2$/);
    assert.equal(existsSync(first.finalDir), false);
    assert.equal(existsSync(second.finalDir), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('output directory rejects traversal provider ids', () => {
  const root = mkdtempSync(join(tmpdir(), 'player-lab-output-'));
  try {
    assert.throws(() => createStagedProfileOutputDirectory({ providerId: '../evil', outputRoot: root }), /Unsafe provider id/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('output directory does not overwrite existing completed report directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'player-lab-output-'));
  try {
    const providerDir = join(root, 'local-fixture');
    const completed = join(providerDir, '2026-07-19T05-00-00-000Z');
    mkdirSync(completed, { recursive: true });
    writeFileSync(join(completed, 'report.json'), '{}\n');
    const allocated = createStagedProfileOutputDirectory({
      providerId: 'local-fixture',
      outputRoot: root,
      now: () => new Date('2026-07-19T05:00:00.000Z'),
    });
    assert.notEqual(allocated.finalDir, completed);
    assert.equal(existsSync(join(completed, 'report.json')), true);
    assert.equal(existsSync(allocated.finalDir), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('staged output promotes exactly one final directory and removes incomplete on cleanup', () => {
  const root = mkdtempSync(join(tmpdir(), 'player-lab-output-'));
  try {
    const staged = createStagedProfileOutputDirectory({
      providerId: 'local-fixture',
      outputRoot: root,
      now: () => new Date('2026-07-19T05:00:00.000Z'),
    });
    assert.match(staged.incompleteDir, /\/\.incomplete-2026-07-19T05-00-00-000Z$/);
    assert.equal(existsSync(staged.incompleteDir), true);
    writeFileSync(join(staged.incompleteDir, 'report.json'), '{}\n');
    writeFileSync(join(staged.incompleteDir, 'report.md'), '# ok\n');
    writeFileSync(join(staged.incompleteDir, 'page.png'), 'png');
    const finalDir = staged.promote();
    assert.equal(finalDir, staged.finalDir);
    assert.equal(existsSync(staged.incompleteDir), false);
    assert.equal(existsSync(staged.finalDir), true);

    const abandoned = createStagedProfileOutputDirectory({
      providerId: 'local-fixture',
      outputRoot: root,
      now: () => new Date('2026-07-19T05:00:01.000Z'),
    });
    abandoned.cleanup();
    assert.equal(existsSync(abandoned.incompleteDir), false);
    assert.equal(existsSync(staged.finalDir), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, symlink, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { installSkill, destinationPlan, parseArgs, SKILL_NAME } from '../scripts/install.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'website-qa-install-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  const project = path.join(root, 'project');
  const userHome = path.join(root, 'profile');
  await mkdir(path.join(source, 'runtime/bin'), { recursive: true });
  await mkdir(project);
  await mkdir(userHome);
  await writeFile(path.join(source, 'SKILL.md'), `---\nname: ${SKILL_NAME}\ndescription: Test fixture.\n---\nRun runtime/bin/run.mjs.\n`);
  await writeFile(path.join(source, 'runtime/bin/run.mjs'), 'export const executableFixture = true;\n');
  await writeFile(path.join(source, 'runtime/package.json'), '{"private":true}\n');
  return { root, source, project, userHome };
}

test('all project platforms receive complete, independent runtime copies', async t => {
  const fixturePaths = await fixture(t);
  const result = await installSkill({ ...fixturePaths, platform: 'all' });
  assert.equal(result.installations.length, 4);
  const receipt=JSON.parse(await readFile(path.join(result.installations[0].destination,'.signalcheck-install.json'),'utf8'));
  assert.equal(receipt.repository,'russpage/signalcheck');
  assert.equal(receipt.branch,'main');
  assert.equal(receipt.installedCommit,null);
  assert.equal(result.files, 3);
  for (const item of result.installations) {
    assert.match(await readFile(path.join(item.destination, 'SKILL.md'), 'utf8'), /name: signalcheck/);
    assert.match(await readFile(path.join(item.destination, 'runtime/bin/run.mjs'), 'utf8'), /executableFixture/);
  }
  assert.equal(result.installations.find(item => item.platform === 'copilot').destination, path.join(fixturePaths.project, '.github/skills', SKILL_NAME));
});

test('global scope uses only injected temporary home and expected provider paths', async t => {
  const fixturePaths = await fixture(t);
  const result = await installSkill({ ...fixturePaths, platform: 'all', scope: 'user' });
  assert.deepEqual(result.installations.map(item => path.relative(fixturePaths.userHome, item.destination)), [
    `.claude/skills/${SKILL_NAME}`, `.copilot/skills/${SKILL_NAME}`, `.gemini/skills/${SKILL_NAME}`, `.agents/skills/${SKILL_NAME}`,
  ].map(relative => relative.split('/').join(path.sep)));
  assert.deepEqual(await readdir(fixturePaths.project), []);
});

test('dry run writes no provider directories', async t => {
  const fixturePaths = await fixture(t);
  const result = await installSkill({ ...fixturePaths, platform: 'all', dryRun: true });
  assert.equal(result.dryRun, true);
  assert.deepEqual(await readdir(fixturePaths.project), []);
  assert.deepEqual(await readdir(fixturePaths.userHome), []);
});

test('existing installation is preserved unless force is explicit', async t => {
  const fixturePaths = await fixture(t);
  const options = { ...fixturePaths, platform: 'claude' };
  const first = await installSkill(options);
  const marker = path.join(first.installations[0].destination, 'user-edit.txt');
  await writeFile(marker, 'keep me');
  await assert.rejects(installSkill(options), /Already installed/);
  assert.equal(await readFile(marker, 'utf8'), 'keep me');
  await installSkill({ ...options, force: true });
  await assert.rejects(access(marker), { code: 'ENOENT' });
  assert.deepEqual((await readdir(path.dirname(marker))).sort(), ['.signalcheck-install.json', 'SKILL.md', 'runtime']);
  assert.deepEqual(await readdir(path.dirname(first.installations[0].destination)), [SKILL_NAME]);
});

test('all-platform preflight prevents partial install on a later collision', async t => {
  const fixturePaths = await fixture(t);
  await installSkill({ ...fixturePaths, platform: 'gemini' });
  await assert.rejects(installSkill({ ...fixturePaths, platform: 'all' }), /Already installed/);
  await assert.rejects(access(path.join(fixturePaths.project, '.claude')), { code: 'ENOENT' });
  await assert.rejects(access(path.join(fixturePaths.project, '.github')), { code: 'ENOENT' });
});

test('force refuses symlinked destination and leaves external content intact', async t => {
  const fixturePaths = await fixture(t);
  const destination = destinationPlan({ ...fixturePaths, platform: 'codex' })[0].destination;
  const external = path.join(fixturePaths.root, 'external');
  await mkdir(external);
  await writeFile(path.join(external, 'valuable.txt'), 'untouched');
  await mkdir(path.dirname(destination), { recursive: true });
  await symlink(external, destination, 'dir');
  await assert.rejects(installSkill({ ...fixturePaths, platform: 'codex', force: true }), /Refusing symbolic link/);
  assert.equal(await readFile(path.join(external, 'valuable.txt'), 'utf8'), 'untouched');
});

test('symlinked destination ancestor is rejected before any write', async t => {
  const fixturePaths = await fixture(t);
  const external = path.join(fixturePaths.root, 'external');
  await mkdir(external);
  await symlink(external, path.join(fixturePaths.project, '.claude'), 'dir');
  await assert.rejects(installSkill({ ...fixturePaths, platform: 'claude', force: true }), /Refusing symbolic link/);
  assert.deepEqual(await readdir(external), []);
});

test('source symlinks are rejected; generated folders are excluded', async t => {
  const fixturePaths = await fixture(t);
  await symlink(path.join(fixturePaths.root, 'external'), path.join(fixturePaths.source, 'link'));
  await assert.rejects(installSkill({ ...fixturePaths, platform: 'copilot' }), /skill contains a symbolic link/);
  await rm(path.join(fixturePaths.source, 'link'));
  await mkdir(path.join(fixturePaths.source, 'node_modules'));
  await writeFile(path.join(fixturePaths.source, 'node_modules/big-file'), 'excluded');
  await mkdir(path.join(fixturePaths.source, 'reports'));
  await writeFile(path.join(fixturePaths.source, 'reports/private.json'), 'excluded');
  const result = await installSkill({ ...fixturePaths, platform: 'copilot' });
  await assert.rejects(access(path.join(result.installations[0].destination, 'node_modules')), { code: 'ENOENT' });
  await assert.rejects(access(path.join(result.installations[0].destination, 'reports')), { code: 'ENOENT' });
});

test('overlapping source and destination are rejected', async t => {
  const fixturePaths = await fixture(t);
  await assert.rejects(installSkill({ source: fixturePaths.source, project: fixturePaths.source, platform: 'claude' }), /must not contain one another/);
});

test('installer rejects missing metadata, unknown platform, scope, flags and empty values', async t => {
  const fixturePaths = await fixture(t);
  await writeFile(path.join(fixturePaths.source, 'SKILL.md'), '# No metadata');
  await assert.rejects(installSkill({ ...fixturePaths, platform: 'claude' }), /must declare name/);
  assert.throws(() => destinationPlan({ platform: 'microsoft365' }), /Choose --platform/);
  assert.throws(() => destinationPlan({ platform: 'claude', scope: 'admin' }), /Choose --scope/);
  assert.throws(() => parseArgs(['--platform']), /Missing value/);
  assert.throws(() => parseArgs(['--surprise']), /Unknown argument/);
  assert.equal(parseArgs(['--platform', 'all', '--global', '--dry-run']).scope, 'user');
});

test('CLI copies a selected fixture into a temporary project and prints its real location', async t => {
  const fixturePaths = await fixture(t);
  const script = fileURLToPath(new URL('../scripts/install.mjs', import.meta.url));
  const { stdout, stderr } = await promisify(execFile)(process.execPath, [script, '--platform', 'codex', '--source', fixturePaths.source, '--project', fixturePaths.project]);
  assert.equal(stderr, '');
  assert.match(stdout, /Installed codex:/);
  assert.ok(stdout.includes(path.join(fixturePaths.project, '.agents/skills', SKILL_NAME)));
  assert.match(await readFile(path.join(fixturePaths.project, '.agents/skills', SKILL_NAME, 'runtime/package.json'), 'utf8'), /private/);
});

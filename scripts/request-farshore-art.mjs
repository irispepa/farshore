import { spawn } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const usage = 'Usage: node scripts/request-farshore-art.mjs <brief.md> <art/farshore/output.png> [--reference <image>] [--model <available-model>] [--dry-run]';

async function exists(path) {
  try { await access(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

function projectPath(input, base = root) {
  const path = resolve(root, input);
  const rel = relative(base, path);
  if (!rel || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) {
    throw new Error(`Path must be inside ${relative(root, base) || 'the project'}: ${input}`);
  }
  return path;
}

async function main() {
  if (args.includes('--help')) { console.log(usage); return; }
  const positional = [];
  const references = [];
  let dryRun = false;
  let model;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--reference') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error('--reference needs an image path.');
      references.push(projectPath(value));
    } else if (args[i] === '--model') {
      model = args[++i];
      if (!model || model.startsWith('--')) throw new Error('--model needs an available CLI model.');
    } else if (args[i].startsWith('--')) throw new Error(`Unknown option: ${args[i]}`);
    else positional.push(args[i]);
  }
  if (positional.length !== 2) throw new Error(usage);
  const brief = projectPath(positional[0]);
  if (extname(brief) !== '.md') throw new Error('The brief must be a Markdown file.');
  const output = projectPath(positional[1], resolve(root, 'art/farshore'));
  if (extname(output) !== '.png') throw new Error('Use a versioned .png output path.');
  const report = output.slice(0, -4) + '.report.md';
  for (const path of [output, report]) {
    if (await exists(path)) throw new Error(`Refusing to overwrite ${relative(root, path)}.`);
  }
  const [direction, request] = await Promise.all([
    readFile(resolve(root, 'docs/README.md'), 'utf8'),
    readFile(brief, 'utf8'),
  ]);
  for (const path of references) await access(path);
  const task = [
    'Use $imagegen for one bounded Farshore art request. Read the imagegen skill before generating.',
    'Use the built-in image_gen tool only. Do not call an API/CLI image fallback or request credentials.',
    'If built-in image generation is unavailable, stop and report the missing capability.',
    `Working root: ${root}`,
    `Copy the generated PNG to ${output}. Keep the original generated file.`,
    'Do not overwrite an existing file. Do not edit code, docs, git state or any other project files.',
    'Do not commit or push. Do not treat a generated image as approved.',
    'Inspect supplied reference images before generating. Treat them as style references unless the brief explicitly specifies editing.',
    `Supplied references: ${references.length ? references.join(', ') : 'none'}`,
    'Return a concise report with success/blocked status, saved path, final exact prompt, tool/method and visual observations.',
    '\nPROJECT DIRECTION\n', direction,
    '\nASSET BRIEF\n', request,
    '\nOUTPUT AUTHORITY\n',
    `For this invocation, ${output} is the output destination; it supersedes historical output/status fields in the brief.`,
  ].join('\n');
  const cliArgs = ['exec', '--cd', root, '--sandbox', 'workspace-write', '--json', '--output-last-message', report];
  if (model) cliArgs.push('--model', model);
  for (const image of references) cliArgs.push('--image', image);
  cliArgs.push('-');
  if (dryRun) {
    console.log(JSON.stringify({ command: 'codex', args: cliArgs, brief: relative(root, brief), output: relative(root, output), references: references.map(path => relative(root, path)), promptCharacters: task.length }, null, 2));
    return;
  }
  await mkdir(dirname(output), { recursive: true });
  const code = await new Promise((accept, reject) => {
    const child = spawn('codex', cliArgs, { cwd: root, stdio: ['pipe', 'inherit', 'inherit'] });
    child.once('error', reject);
    child.once('close', (status, signal) => {
      if (signal) reject(new Error(`Art worker stopped by ${signal}.`));
      else accept(status);
    });
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') reject(error); });
    child.stdin.end(task);
  });
  if (code !== 0) throw new Error(`Art worker exited with status ${code}. Check ${relative(root, report)} if present.`);
  if (!(await exists(output))) throw new Error(`Worker did not produce ${relative(root, output)}. Read ${relative(root, report)}.`);
  const file = await readFile(output);
  if (!file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error(`Output is not a PNG: ${relative(root, output)}.`);
  }
  console.log(`Saved ${relative(root, output)}; review ${relative(root, report)} and the image before integration.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const electronPath = process.env.ATLAS_ELECTRON_EXECUTABLE || process.execPath;
const electronArgs = process.env.ATLAS_ELECTRON_EXECUTABLE
  ? []
  : [path.join(rootDir, 'node_modules', 'electron', 'cli.js'), '.'];
const userDataDir = process.env.ATLAS_VERIFY_USER_DATA ||
  path.join(rootDir, '.electron-smoke-user-data');
const resultPath = process.env.ATLAS_SMOKE_RESULT ||
  path.join(rootDir, '.electron-smoke-result.json');
const smokeArgs = ['--no-sandbox', `--user-data-dir=${userDataDir}`, '--atlas-smoke'];

async function main() {
  if (fs.existsSync(resultPath)) fs.unlinkSync(resultPath);

  const child = spawn(electronPath, [
    ...electronArgs,
    ...smokeArgs,
  ], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ATLAS_SMOKE_RESULT: resultPath },
  });

  let stdout = '';
  let stderr = '';
  let resolveResult;
  let rejectResult;
  const resultPromise = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  child.stdout.on('data', chunk => {
    stdout += chunk.toString();
    if (stdout.split(/\r?\n/).some(entry => entry.startsWith('[atlas-smoke] '))) {
      resolveResult(0);
      child.kill();
    }
  });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });

  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(resultPoll);
      child.kill();
      reject(new Error('Electron smoke check timed out'));
    }, 60000);
    const resultPoll = setInterval(() => {
      if (!fs.existsSync(resultPath)) return;
      try {
        JSON.parse(fs.readFileSync(resultPath, 'utf8'));
        clearInterval(resultPoll);
        clearTimeout(timer);
        child.kill();
        resolve(0);
      } catch {}
    }, 250);
    resultPromise.then(code => {
      clearInterval(resultPoll);
      clearTimeout(timer);
      resolve(code);
    }, error => {
      clearInterval(resultPoll);
      clearTimeout(timer);
      reject(error);
    });
    child.on('error', error => {
      rejectResult(error);
    });
    child.on('exit', code => {
      clearTimeout(timer);
      resolve(code);
    });
  });

  if (exitCode !== 0) {
    throw new Error(`Electron exited with ${exitCode}\n${stderr || stdout}`);
  }

  const line = stdout.split(/\r?\n/).find(entry => entry.startsWith('[atlas-smoke] '));
  const result = fs.existsSync(resultPath)
    ? JSON.parse(fs.readFileSync(resultPath, 'utf8'))
    : line && JSON.parse(line.replace('[atlas-smoke] ', ''));
  if (!result) throw new Error(`Smoke result was not written\n${stderr || stdout}`);
  if (result.error) throw new Error(result.error);
  if (result.protocol !== 'app:') throw new Error(`Expected app: protocol, got ${result.protocol}`);
  if (!result.atlasApi) throw new Error('window.atlas preload API was not exposed');
  if (result.expansions <= 0) throw new Error('Tracker data did not render');

  console.log(JSON.stringify(result));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

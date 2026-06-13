'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const electronPath = process.env.ATLAS_ELECTRON_EXECUTABLE ||
  path.join(rootDir, 'node_modules', 'electron', 'dist', 'electron.exe');
const electronArgs = process.env.ATLAS_ELECTRON_EXECUTABLE ? [] : ['.'];
const userDataDir = process.env.ATLAS_VERIFY_USER_DATA ||
  path.join(rootDir, '.electron-smoke-user-data');
const resultPath = process.env.ATLAS_SMOKE_RESULT ||
  path.join(rootDir, '.electron-smoke-result.json');

async function main() {
  const child = spawn(electronPath, [
    '--no-sandbox',
    '--atlas-smoke',
    `--user-data-dir=${userDataDir}`,
    ...electronArgs,
  ], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ATLAS_SMOKE_RESULT: resultPath },
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });

  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Electron smoke check timed out'));
    }, 60000);
    child.on('error', reject);
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

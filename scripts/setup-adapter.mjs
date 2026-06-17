import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const vendorDir = join(root, '.vendor', 'chat-sdk-adapter');
const distPath = join(vendorDir, 'dist', 'index.js');
const tmpDir = join(root, '.vendor', 'novu-tmp');
const branch = 'nv-8063-chat-adapter-novu';

if (existsSync(distPath)) {
  process.exit(0);
}

mkdirSync(join(root, '.vendor'), { recursive: true });

if (existsSync(tmpDir)) {
  rmSync(tmpDir, { recursive: true, force: true });
}

execSync(
  `git clone --depth 1 --branch ${branch} --filter=blob:none --sparse https://github.com/novuhq/novu.git "${tmpDir}"`,
  { stdio: 'inherit' },
);
execSync('git sparse-checkout set packages/chat-adapter', {
  cwd: tmpDir,
  stdio: 'inherit',
});

if (existsSync(vendorDir)) {
  rmSync(vendorDir, { recursive: true, force: true });
}

cpSync(join(tmpDir, 'packages', 'chat-adapter'), vendorDir, { recursive: true });
rmSync(tmpDir, { recursive: true, force: true });

execSync('npm install', { cwd: vendorDir, stdio: 'inherit' });
execSync('npm run build', { cwd: vendorDir, stdio: 'inherit' });

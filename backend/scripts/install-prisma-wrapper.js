const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const binDir = path.join(projectRoot, 'node_modules', '.bin');
const wrapperSource = path.join(projectRoot, 'prisma-cli', 'prisma.js');

const wrapperTargets = [
  path.join(binDir, 'prisma'),
  path.join(binDir, 'prisma.cmd'),
  path.join(binDir, 'prisma.ps1'),
];

function installWrapper() {
  if (!fs.existsSync(wrapperSource)) {
    return;
  }

  const jsWrapper = path.join(binDir, 'prisma.js');
  if (!fs.existsSync(jsWrapper)) {
    try {
      fs.copyFileSync(wrapperSource, jsWrapper);
      fs.chmodSync(jsWrapper, 0o755);
    } catch (e) {
    }
  }

  const cmdWrapper = path.join(binDir, 'prisma.cmd');
  const cmdContent = `@echo off
node "%~dp0\\prisma.js" %*
`;
  try {
    const original = fs.readFileSync(cmdWrapper, 'utf8');
    if (!original.includes('prisma.js')) {
      fs.writeFileSync(cmdWrapper, cmdContent);
    }
  } catch (e) {
    try {
      fs.writeFileSync(cmdWrapper, cmdContent);
    } catch (e2) {
    }
  }
}

try {
  installWrapper();
} catch (e) {
}

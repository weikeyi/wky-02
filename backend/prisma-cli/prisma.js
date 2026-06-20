#!/usr/bin/env node
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

function findProjectRoot() {
  let current = __dirname;
  while (current && current !== path.dirname(current)) {
    const packageJson = path.join(current, 'package.json');
    if (fs.existsSync(packageJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
        if (pkg.name === 'course-peer-review-backend') {
          return current;
        }
      } catch (e) {
      }
    }
    const psScript = path.join(current, 'prisma-generate.ps1');
    if (fs.existsSync(psScript)) {
      return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
}

const projectRoot = findProjectRoot();

function isWindows() {
  return process.platform === 'win32';
}

function findRealPrisma() {
  const globalPrisma = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');
  if (fs.existsSync(globalPrisma)) {
    return globalPrisma;
  }
  return 'prisma';
}

if (args[0] === 'generate') {
  if (isWindows()) {
    const psScript = path.join(projectRoot, 'prisma-generate.ps1');
    const result = spawnSync('powershell', [
      '-ExecutionPolicy', 'Bypass',
      '-File', psScript
    ], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        PRISMA_GENERATE_SKIP_AUTOINSTALL: 'true',
      }
    });
    process.exit(result.status || 0);
  } else {
    const result = spawnSync('npx', ['prisma', ...args], {
      cwd: projectRoot,
      stdio: 'inherit'
    });
    process.exit(result.status || 0);
  }
}

const realPrisma = findRealPrisma();
const result = spawnSync('node', [realPrisma, ...args], {
  cwd: projectRoot,
  stdio: 'inherit'
});
process.exit(result.status || 0);

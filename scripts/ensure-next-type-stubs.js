const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const appDirCandidates = [path.join(rootDir, 'src', 'app'), path.join(rootDir, 'app')];
const appDir = appDirCandidates.find(candidate => fs.existsSync(candidate));

if (!appDir) {
  process.exit(0);
}

const nextTypesDir = path.join(rootDir, '.next', 'types');
const nextTypesAppDir = path.join(nextTypesDir, 'app');
const routeFilePattern = /\.(ts|tsx)$/;

const ensureFile = (filePath, content = '') => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
};

const walk = currentDir => {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!routeFilePattern.test(entry.name)) {
      continue;
    }

    const relativePath = path.relative(appDir, fullPath);
    const stubRelativePath = relativePath.replace(/\.(ts|tsx)$/, '.ts');
    ensureFile(path.join(nextTypesAppDir, stubRelativePath), 'export {};\n');
  }
};

walk(appDir);

ensureFile(path.join(nextTypesDir, 'cache-life.d.ts'), 'export {};\n');

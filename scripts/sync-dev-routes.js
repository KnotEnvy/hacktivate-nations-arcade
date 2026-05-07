const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const marker = 'GENERATED DEV-ONLY ROUTE';
const routes = [
  {
    filePath: path.join(rootDir, 'src', 'app', 'dev', 'level-editor', 'page.tsx'),
    content: `// ${marker}: created by scripts/sync-dev-routes.js.
// Production verification commands remove this file before type-check/build.
export { default } from '@/dev/level-editor/LevelEditor';
`,
  },
];

const removeEmptyParents = (startDir, stopDir) => {
  let current = startDir;
  while (current.startsWith(stopDir) && current !== stopDir) {
    if (!fs.existsSync(current) || fs.readdirSync(current).length > 0) {
      return;
    }
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
};

const generate = () => {
  for (const route of routes) {
    fs.mkdirSync(path.dirname(route.filePath), { recursive: true });
    fs.writeFileSync(route.filePath, route.content, 'utf8');
  }
};

const clean = () => {
  const appDevDir = path.join(rootDir, 'src', 'app', 'dev');
  for (const route of routes) {
    if (!fs.existsSync(route.filePath)) {
      continue;
    }

    const existing = fs.readFileSync(route.filePath, 'utf8');
    if (!existing.includes(marker)) {
      throw new Error(`Refusing to remove non-generated dev route: ${route.filePath}`);
    }

    fs.unlinkSync(route.filePath);
    removeEmptyParents(path.dirname(route.filePath), appDevDir);
  }

  fs.rmSync(path.join(rootDir, '.next', 'types', 'app', 'dev'), {
    force: true,
    recursive: true,
  });
};

const command = process.argv[2];

if (command === 'generate') {
  generate();
} else if (command === 'clean') {
  clean();
} else {
  throw new Error('Usage: node scripts/sync-dev-routes.js <generate|clean>');
}

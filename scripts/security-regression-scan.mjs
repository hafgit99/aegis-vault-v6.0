import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const sourceRoot = join(root, 'src');

const rules = [
  {
    name: 'No persisted master password key',
    pattern: /aegis_master_password(?!_audit)/g,
  },
  {
    name: 'No demo unlock fallback',
    pattern: /demo1453|DEMOKEY|A3-DEMOKEY/gi,
  },
  {
    name: 'No production Math.random secret generation',
    pattern: /Math\.random\s*\(/g,
  },
  {
    name: 'No legacy ChaCha20 selector',
    pattern: /CHACHA20|POLY1305/g,
  },
  {
    name: 'Clipboard writes must use clipboard helper',
    pattern: /navigator\.clipboard\.writeText\s*\(/g,
    allow: (file) => file === 'src/lib/clipboard.ts',
  },
];

const ignoredDirs = new Set(['node_modules', 'dist', 'coverage', 'reports', 'playwright-report', 'test-results']);
const targetExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json']);

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (!ignoredDirs.has(entry)) {
        files.push(...walk(fullPath));
      }
      continue;
    }
    if ([...targetExtensions].some((extension) => fullPath.endsWith(extension))) {
      files.push(fullPath);
    }
  }
  return files;
}

const findings = [];

for (const filePath of walk(sourceRoot)) {
  const relativePath = relative(root, filePath).replaceAll('\\', '/');
  const content = readFileSync(filePath, 'utf8');
  for (const rule of rules) {
    if (rule.allow?.(relativePath)) continue;
    rule.pattern.lastIndex = 0;
    const matches = content.match(rule.pattern);
    if (matches) {
      findings.push(`${rule.name}: ${relativePath} (${matches.length})`);
    }
  }
}

if (findings.length > 0) {
  console.error('Security regression scan failed:');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log('Security regression scan passed.');

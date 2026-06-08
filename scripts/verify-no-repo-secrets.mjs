import { execFileSync } from 'node:child_process';

const forbiddenTrackedPatterns = [
  /^\.secrets(?:\/|$)/,
  /(?:^|\/).*\.jks$/i,
  /(?:^|\/).*\.keystore$/i,
  /(?:^|\/).*release-keystore\.properties$/i,
  /(?:^|\/).*\.p12$/i,
  /(?:^|\/).*\.pfx$/i,
];

let trackedFiles = [];
try {
  trackedFiles = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
} catch (error) {
  if (process.env.CI === 'true') {
    throw error;
  }
  console.warn(`Tracked signing secret verification skipped locally: ${error.message}`);
  console.warn('Run this check in CI or a shell where Node can spawn git.');
  process.exit(0);
}

const violations = trackedFiles.filter(filePath =>
  forbiddenTrackedPatterns.some(pattern => pattern.test(filePath.replaceAll('\\', '/'))),
);

if (violations.length > 0) {
  console.error('Tracked signing secret files are forbidden:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error('Move signing material outside the repository and store CI values only in GitHub Actions secrets.');
  process.exit(1);
}

console.log('Tracked signing secret verification passed.');

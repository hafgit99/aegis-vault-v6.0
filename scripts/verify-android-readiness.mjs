import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const warnings = [];

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function commandExists(command, args = ['--version']) {
  try {
    execFileSync(command, args, { stdio: 'ignore', shell: process.platform === 'win32' });
    return true;
  } catch {
    return false;
  }
}

const packageJson = readJson('package.json');
const tauriConfig = readJson('src-tauri/tauri.conf.json');
const cargoToml = readFileSync(join(root, 'src-tauri', 'Cargo.toml'), 'utf8');
const roadmapPath = join(root, 'docs', 'ANDROID_ROADMAP.md');
const androidIconPath = join(root, 'src-tauri', 'icons', 'android');
const androidProjectPath = join(root, 'src-tauri', 'gen', 'android');
const androidManifestPath = join(androidProjectPath, 'app', 'src', 'main', 'AndroidManifest.xml');
const androidActivityPath = join(
  androidProjectPath,
  'app',
  'src',
  'main',
  'java',
  'com',
  'aegisvault',
  'desktop',
  'MainActivity.kt',
);
const androidRootBuildGradlePath = join(androidProjectPath, 'build.gradle.kts');

for (const scriptName of [
  'tauri',
  'android:doctor',
  'android:init',
  'android:dev',
  'android:build',
  'android:build:apk:arm64',
  'android:build:apk',
  'android:build:aab',
]) {
  if (!packageJson.scripts?.[scriptName]) {
    failures.push(`package.json must define "${scriptName}".`);
  }
}

if (packageJson.scripts?.['android:build:apk']?.includes('build -- --apk')) {
  failures.push('android:build:apk must pass --apk to the Tauri CLI, not to the runner after "--".');
}

if (packageJson.scripts?.['android:build:aab']?.includes('build -- --aab')) {
  failures.push('android:build:aab must pass --aab to the Tauri CLI, not to the runner after "--".');
}

if (!cargoToml.includes('crate-type = ["staticlib", "cdylib", "rlib"]')) {
  failures.push('src-tauri/Cargo.toml must define Android-compatible library crate types.');
}

if (tauriConfig.identifier !== 'com.aegisvault.desktop') {
  failures.push('src-tauri/tauri.conf.json identifier must remain stable until Android package naming is intentionally migrated.');
}

const androidConfig = tauriConfig.bundle?.android;
if (!androidConfig) {
  failures.push('src-tauri/tauri.conf.json must define bundle.android for Android release metadata.');
} else {
  if (androidConfig.minSdkVersion < 28) {
    failures.push('bundle.android.minSdkVersion must be at least 28 for the planned Android biometric baseline.');
  }
  if (androidConfig.versionCode !== 6000000) {
    failures.push('bundle.android.versionCode must match v6.0.0 release code 6000000.');
  }
}

if (!existsSync(androidIconPath)) {
  failures.push('src-tauri/icons/android must exist before Android initialization.');
}

if (!existsSync(roadmapPath)) {
  failures.push('docs/ANDROID_ROADMAP.md must exist.');
} else {
  const roadmap = readFileSync(roadmapPath, 'utf8');
  for (const required of [
    'Android Keystore',
    'BiometricPrompt',
    'FLAG_SECURE',
    'Network Security Config',
    'HIBP k-anonymity',
    'Google Play',
  ]) {
    if (!roadmap.includes(required)) {
      failures.push(`docs/ANDROID_ROADMAP.md must document "${required}".`);
    }
  }
}

if (!existsSync(androidProjectPath)) {
  warnings.push('Android project scaffold is not present yet. Run "npm run android:init" after installing Android Studio, SDK, NDK, and Rust Android targets.');
} else {
  const manifest = existsSync(androidManifestPath) ? readFileSync(androidManifestPath, 'utf8') : '';
  const activity = existsSync(androidActivityPath) ? readFileSync(androidActivityPath, 'utf8') : '';
  const androidRootBuildGradle = existsSync(androidRootBuildGradlePath)
    ? readFileSync(androidRootBuildGradlePath, 'utf8')
    : '';

  if (!manifest.includes('android:allowBackup="false"')) {
    failures.push('AndroidManifest.xml must disable Android backup with android:allowBackup="false".');
  }
  if (!manifest.includes('android:fullBackupContent="false"')) {
    failures.push('AndroidManifest.xml must disable full backup with android:fullBackupContent="false".');
  }
  if (!manifest.includes('tools:replace="android:fullBackupContent"')) {
    failures.push('AndroidManifest.xml must keep android:fullBackupContent override active for dependency manifest merges.');
  }
  if (!activity.includes('WindowManager.LayoutParams.FLAG_SECURE')) {
    failures.push('MainActivity.kt must apply FLAG_SECURE to block sensitive screenshots and recent-app thumbnails.');
  }
  if (!androidRootBuildGradle.includes('org.jetbrains.kotlin:kotlin-gradle-plugin:2.1.0')) {
    failures.push('Android Gradle project must use Kotlin Gradle plugin 2.1.0 for current Tauri mobile plugin compatibility.');
  }
}

if (!process.env.JAVA_HOME) warnings.push('JAVA_HOME is not set in this shell.');
if (!process.env.ANDROID_HOME) warnings.push('ANDROID_HOME is not set in this shell.');
if (!process.env.NDK_HOME) warnings.push('NDK_HOME is not set in this shell.');
if (!commandExists('rustup')) warnings.push('rustup was not found in PATH.');
if (!commandExists('tauri')) warnings.push('tauri CLI was not found directly in PATH; npm scripts may still resolve it from node_modules.');

if (failures.length > 0) {
  console.error('Android readiness verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Android readiness verification passed.');
if (warnings.length > 0) {
  console.warn('Android readiness warnings:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

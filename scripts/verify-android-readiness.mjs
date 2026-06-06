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
const roadmapPath = join(root, 'docs', 'ANDROID_ROADMAP.md');
const androidIconPath = join(root, 'src-tauri', 'icons', 'android');
const androidProjectPath = join(root, 'src-tauri', 'gen', 'android');

for (const scriptName of [
  'android:doctor',
  'android:init',
  'android:dev',
  'android:build',
  'android:build:apk',
  'android:build:aab',
]) {
  if (!packageJson.scripts?.[scriptName]) {
    failures.push(`package.json must define "${scriptName}".`);
  }
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

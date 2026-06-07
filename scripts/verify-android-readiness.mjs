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
const androidSmokeChecklistPath = join(root, 'docs', 'ANDROID_SMOKE_CHECKLIST.md');
const androidSigningPath = join(root, 'docs', 'ANDROID_SIGNING.md');
const androidWorkflowPath = join(root, '.github', 'workflows', 'android-packaging.yml');
const androidIconPath = join(root, 'src-tauri', 'icons', 'android');
const androidProjectPath = join(root, 'src-tauri', 'gen', 'android');
const androidManifestPath = join(androidProjectPath, 'app', 'src', 'main', 'AndroidManifest.xml');
const androidNetworkSecurityConfigPath = join(androidProjectPath, 'app', 'src', 'main', 'res', 'xml', 'network_security_config.xml');
const androidAutofillConfigPath = join(androidProjectPath, 'app', 'src', 'main', 'res', 'xml', 'autofill_service.xml');
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
const androidAutofillServicePath = join(
  androidProjectPath,
  'app',
  'src',
  'main',
  'java',
  'com',
  'aegisvault',
  'desktop',
  'AegisAutofillService.kt',
);
const androidAutofillParserPath = join(
  androidProjectPath,
  'app',
  'src',
  'main',
  'java',
  'com',
  'aegisvault',
  'desktop',
  'AegisAutofillRequestParser.kt',
);
const androidRootBuildGradlePath = join(androidProjectPath, 'build.gradle.kts');
const androidAppBuildGradlePath = join(androidProjectPath, 'app', 'build.gradle.kts');
const tauriRustPath = join(root, 'src-tauri', 'src', 'lib.rs');
const vaultStorageAdapterPath = join(root, 'src', 'lib', 'vaultStorageAdapter.ts');

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

if (!existsSync(androidSmokeChecklistPath)) {
  failures.push('docs/ANDROID_SMOKE_CHECKLIST.md must exist.');
} else {
  const smokeChecklist = readFileSync(androidSmokeChecklistPath, 'utf8');
  for (const required of [
    'Android app-private storage',
    'Secure Share',
    'HIBP',
    'FLAG_SECURE',
    'unsigned community APK',
  ]) {
    if (!smokeChecklist.includes(required)) {
      failures.push(`docs/ANDROID_SMOKE_CHECKLIST.md must document "${required}".`);
    }
  }
}

if (!existsSync(androidWorkflowPath)) {
  failures.push('.github/workflows/android-packaging.yml must exist.');
} else {
  const androidWorkflow = readFileSync(androidWorkflowPath, 'utf8');
  for (const required of [
    'npm run android:doctor',
    'npm run android:build:apk:arm64',
    'npm run android:build:aab',
    'npm run android:checksums',
    'npm run android:stage',
    'package_type',
    'aegisvault-android',
  ]) {
    if (!androidWorkflow.includes(required)) {
      failures.push(`.github/workflows/android-packaging.yml must include "${required}".`);
    }
  }
}

if (!existsSync(androidSigningPath)) {
  failures.push('docs/ANDROID_SIGNING.md must exist.');
} else {
  const androidSigning = readFileSync(androidSigningPath, 'utf8');
  for (const required of [
    'ANDROID_RELEASE_KEYSTORE_BASE64',
    'RELEASE_STORE_PASSWORD',
    'RELEASE_KEY_ALIAS',
    'RELEASE_KEY_PASSWORD',
    'unsigned community APK',
  ]) {
    if (!androidSigning.includes(required)) {
      failures.push(`docs/ANDROID_SIGNING.md must document "${required}".`);
    }
  }
}

if (!existsSync(androidProjectPath)) {
  warnings.push('Android project scaffold is not present yet. Run "npm run android:init" after installing Android Studio, SDK, NDK, and Rust Android targets.');
} else {
  const manifest = existsSync(androidManifestPath) ? readFileSync(androidManifestPath, 'utf8') : '';
  const networkSecurityConfig = existsSync(androidNetworkSecurityConfigPath)
    ? readFileSync(androidNetworkSecurityConfigPath, 'utf8')
    : '';
  const autofillConfig = existsSync(androidAutofillConfigPath)
    ? readFileSync(androidAutofillConfigPath, 'utf8')
    : '';
  const activity = existsSync(androidActivityPath) ? readFileSync(androidActivityPath, 'utf8') : '';
  const autofillService = existsSync(androidAutofillServicePath)
    ? readFileSync(androidAutofillServicePath, 'utf8')
    : '';
  const autofillParser = existsSync(androidAutofillParserPath)
    ? readFileSync(androidAutofillParserPath, 'utf8')
    : '';
  const androidRootBuildGradle = existsSync(androidRootBuildGradlePath)
    ? readFileSync(androidRootBuildGradlePath, 'utf8')
    : '';
  const androidAppBuildGradle = existsSync(androidAppBuildGradlePath)
    ? readFileSync(androidAppBuildGradlePath, 'utf8')
    : '';
  const tauriRust = existsSync(tauriRustPath) ? readFileSync(tauriRustPath, 'utf8') : '';
  const vaultStorageAdapter = existsSync(vaultStorageAdapterPath)
    ? readFileSync(vaultStorageAdapterPath, 'utf8')
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
  if (!manifest.includes('android:networkSecurityConfig="@xml/network_security_config"')) {
    failures.push('AndroidManifest.xml must apply @xml/network_security_config.');
  }
  if (!manifest.includes('android.service.autofill.AutofillService')) {
    failures.push('AndroidManifest.xml must register the Android AutofillService entry point.');
  }
  if (!manifest.includes('android.permission.BIND_AUTOFILL_SERVICE')) {
    failures.push('Android AutofillService must be protected by android.permission.BIND_AUTOFILL_SERVICE.');
  }
  if (!networkSecurityConfig.includes('cleartextTrafficPermitted="false"')) {
    failures.push('network_security_config.xml must disable cleartext traffic.');
  }
  if (!autofillConfig.includes('autofill-service')) {
    failures.push('autofill_service.xml must define Android Autofill service metadata.');
  }
  if (!autofillService.includes('AutofillService')) {
    failures.push('AegisAutofillService.kt must implement the Android AutofillService boundary.');
  }
  if (!autofillService.includes('AegisAutofillRequestParser.parse')) {
    failures.push('AegisAutofillService.kt must parse fill requests before bridge/dataset work starts.');
  }
  if (!autofillParser.includes('AssistStructure')) {
    failures.push('AegisAutofillRequestParser.kt must parse AssistStructure field context.');
  }
  if (!autofillParser.includes('TYPE_TEXT_VARIATION_WEB_PASSWORD')) {
    failures.push('AegisAutofillRequestParser.kt must recognize web password input variations.');
  }
  if (!networkSecurityConfig.includes('api.pwnedpasswords.com')) {
    failures.push('network_security_config.xml must include the HIBP range API domain allowlist.');
  }
  if (!activity.includes('WindowManager.LayoutParams.FLAG_SECURE')) {
    failures.push('MainActivity.kt must apply FLAG_SECURE to block sensitive screenshots and recent-app thumbnails.');
  }
  if (!activity.includes('WebView.setWebContentsDebuggingEnabled(false)')) {
    failures.push('MainActivity.kt must disable Android WebView debugging for release hardening.');
  }
  if (!androidRootBuildGradle.includes('org.jetbrains.kotlin:kotlin-gradle-plugin:2.1.0')) {
    failures.push('Android Gradle project must use Kotlin Gradle plugin 2.1.0 for current Tauri mobile plugin compatibility.');
  }
  for (const required of [
    'releaseKeystoreProperties',
    'RELEASE_STORE_FILE',
    'RELEASE_STORE_PASSWORD',
    'RELEASE_KEY_ALIAS',
    'RELEASE_KEY_PASSWORD',
    'signingConfigs',
  ]) {
    if (!androidAppBuildGradle.includes(required)) {
      failures.push(`Android app build.gradle.kts must include release signing support for "${required}".`);
    }
  }
  for (const commandName of [
    'read_app_private_file',
    'write_app_private_file',
    'delete_app_private_file',
    'clear_app_private_sqlite_files',
  ]) {
    if (!tauriRust.includes(commandName)) {
      failures.push(`src-tauri/src/lib.rs must expose the Android storage command "${commandName}".`);
    }
    if (!vaultStorageAdapter.includes(commandName)) {
      failures.push(`src/lib/vaultStorageAdapter.ts must invoke the Android storage command "${commandName}".`);
    }
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

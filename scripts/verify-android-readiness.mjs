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
const autofillRoadmapPath = join(root, 'docs', 'AUTOFILL_ROADMAP.md');
const autofillSaveThreatModelPath = join(root, 'docs', 'AUTOFILL_SAVE_THREAT_MODEL.md');
const securityModelPath = join(root, 'docs', 'SECURITY_MODEL.md');
const threatModelPath = join(root, 'docs', 'THREAT_MODEL.md');
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
const androidAutofillAuthActivityPath = join(
  androidProjectPath,
  'app',
  'src',
  'main',
  'java',
  'com',
  'aegisvault',
  'desktop',
  'AutofillAuthActivity.kt',
);
const androidRootBuildGradlePath = join(androidProjectPath, 'build.gradle.kts');
const androidAppBuildGradlePath = join(androidProjectPath, 'app', 'build.gradle.kts');
const tauriRustPath = join(root, 'src-tauri', 'src', 'lib.rs');
const vaultStorageAdapterPath = join(root, 'src', 'lib', 'vaultStorageAdapter.ts');
const autofillNativeBridgePath = join(root, 'src', 'lib', 'autofillNativeBridge.ts');
const autofillProviderPath = join(root, 'src', 'lib', 'autofillProvider.ts');
const autofillMatcherPath = join(root, 'src', 'lib', 'autofillMatcher.ts');
const autofillHandoffHookPath = join(root, 'src', 'hooks', 'useAutofillHandoff.ts');

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
    'Android Autofill',
    'Fill with AegisVault',
    'Android Autofill framework',
    'wrong-domain',
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
    'Android Autofill regression gate',
    'test/unit/autofill-handoff-controller.test.tsx',
    'test/unit/autofill-native-bridge.test.ts',
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

if (!existsSync(autofillSaveThreatModelPath)) {
  failures.push('docs/AUTOFILL_SAVE_THREAT_MODEL.md must exist before Android Autofill save prompts are implemented.');
} else {
  const autofillSaveThreatModel = readFileSync(autofillSaveThreatModelPath, 'utf8');
  for (const required of [
    'No background save',
    'explicit in-app user confirmation',
    'short-lived, single-use',
    'pending_autofill_save_request.json',
    'Existing matching records',
    'native capture remains limited to Android app-private storage',
  ]) {
    if (!autofillSaveThreatModel.includes(required)) {
      failures.push(`docs/AUTOFILL_SAVE_THREAT_MODEL.md must document "${required}".`);
    }
  }
}

const docsWithAutofillSaveThreatModelReferences = [
  [autofillRoadmapPath, 'docs/AUTOFILL_ROADMAP.md'],
  [securityModelPath, 'docs/SECURITY_MODEL.md'],
  [threatModelPath, 'docs/THREAT_MODEL.md'],
];
for (const [path, label] of docsWithAutofillSaveThreatModelReferences) {
  const content = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (!content.includes('AUTOFILL_SAVE_THREAT_MODEL.md')) {
    failures.push(`${label} must reference docs/AUTOFILL_SAVE_THREAT_MODEL.md before Android Autofill save prompts are enabled.`);
  }
}

const androidBuildEvidencePath = join(root, 'docs', 'ANDROID_BUILD_EVIDENCE.md');
if (!existsSync(androidBuildEvidencePath)) {
  failures.push('docs/ANDROID_BUILD_EVIDENCE.md must exist.');
} else {
  const androidBuildEvidence = readFileSync(androidBuildEvidencePath, 'utf8');
  for (const required of [
    'Android Autofill regression tests',
    'Fill with AegisVault',
    'AutofillManager.EXTRA_AUTHENTICATION_RESULT',
    'RESULT_CANCELED',
    'test/unit/autofill-handoff-controller.test.tsx',
  ]) {
    if (!androidBuildEvidence.includes(required)) {
      failures.push(`docs/ANDROID_BUILD_EVIDENCE.md must document "${required}".`);
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
  const autofillAuthActivity = existsSync(androidAutofillAuthActivityPath)
    ? readFileSync(androidAutofillAuthActivityPath, 'utf8')
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
  const autofillNativeBridge = existsSync(autofillNativeBridgePath)
    ? readFileSync(autofillNativeBridgePath, 'utf8')
    : '';
  const autofillProvider = existsSync(autofillProviderPath)
    ? readFileSync(autofillProviderPath, 'utf8')
    : '';
  const autofillMatcher = existsSync(autofillMatcherPath)
    ? readFileSync(autofillMatcherPath, 'utf8')
    : '';
  const autofillHandoffHook = existsSync(autofillHandoffHookPath)
    ? readFileSync(autofillHandoffHookPath, 'utf8')
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
  if (!manifest.includes('.AutofillAuthActivity')) {
    failures.push('AndroidManifest.xml must register the Android Autofill authentication result activity.');
  }
  if (!manifest.includes('android:launchMode="singleTask"')) {
    failures.push('AndroidManifest.xml must keep MainActivity launchMode="singleTask" so AutofillAuthActivity can remain in the browser task while AegisVault opens in its own task.');
  }
  if (!manifest.includes('android:exported="false"') || !manifest.includes('android:excludeFromRecents="true"')) {
    failures.push('AndroidManifest.xml must keep AutofillAuthActivity non-exported and excluded from recents.');
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
  if (!autofillService.includes('setAuthentication')) {
    failures.push('AegisAutofillService.kt must use OS-mediated dataset authentication before returning fill data.');
  }
  if (!autofillService.includes('AutofillAuthActivity::class.java')) {
    failures.push('AegisAutofillService.kt must route authentication PendingIntents through AutofillAuthActivity.');
  }
  const authenticationResponseStart = autofillService.indexOf('private fun buildAuthenticationResponse');
  const authenticationPresentationStart = autofillService.indexOf('private fun authenticationPresentation');
  const authenticationResponseBlock =
    authenticationResponseStart >= 0 && authenticationPresentationStart > authenticationResponseStart
      ? autofillService.slice(authenticationResponseStart, authenticationPresentationStart)
      : '';
  if (authenticationResponseBlock.includes('Intent.FLAG_ACTIVITY_NEW_TASK')) {
    failures.push('AegisAutofillService.kt must not launch Autofill authentication as a new task because Android cancels authentication results for new-task launches.');
  }
  if (!autofillService.includes('putParcelableArrayListExtra("aegis_autofill_ids"')) {
    failures.push('AegisAutofillService.kt must pass AutofillId values to AutofillAuthActivity for framework result datasets.');
  }
  if (!autofillService.includes('.addDataset(dataset.build())')) {
    failures.push('AegisAutofillService.kt must return a dataset-level authentication response so SaveInfo remains visible for manually typed credentials.');
  }
  if (!autofillService.includes('aegis_autofill_request')) {
    failures.push('AegisAutofillService.kt must carry a scoped autofill request marker into MainActivity.');
  }
  if (!autofillService.includes('approved_autofill_payload.json')) {
    failures.push('AegisAutofillService.kt must consume one-time approved Android Autofill payloads.');
  }
  if (!autofillService.includes('AutofillValue.forText')) {
    failures.push('AegisAutofillService.kt must create Android Autofill values from approved payloads only.');
  }
  if (autofillService.includes('Unlock AegisVault for')) {
    failures.push('AegisAutofillService.kt must use a neutral Autofill presentation label because the service cannot know the live vault lock state.');
  }
  for (const required of [
    'SaveInfo.SAVE_DATA_TYPE_PASSWORD',
    'SaveInfo.FLAG_SAVE_ON_ALL_VIEWS_INVISIBLE',
    'setOptionalIds',
    'PENDING_AUTOFILL_SAVE_REQUEST_FILE',
    'SAVE_REQUEST_TTL_MS = 300_000L',
    'request.fillContexts.lastOrNull()',
    'password.isBlank()',
    'context.webDomain.isNullOrBlank() && context.packageName.isBlank()',
    'BROWSER_PACKAGES_REQUIRING_WEB_DOMAIN',
    'browser package did not expose a web domain',
    'requiredPasswordIds',
    'passwordIds.drop(1)',
    'buildSaveApprovalIntentSender',
    'aegis_autofill_save_request',
    'Autofill save request staged for explicit in-app approval',
  ]) {
    if (!autofillService.includes(required)) {
      failures.push(`AegisAutofillService.kt must implement guarded Autofill save capture with "${required}".`);
    }
  }
  if (autofillService.includes('Log.i(TAG, "Autofill save request staged') && autofillService.includes('username=$')) {
    failures.push('AegisAutofillService.kt must not log captured Autofill save usernames or passwords.');
  }
  if (!autofillParser.includes('val value: String? = null') || !autofillParser.includes('textValue(node)')) {
    failures.push('AegisAutofillRequestParser.kt must expose text values only for guarded Android Autofill save request staging.');
  }
  if (!autofillParser.includes('AssistStructure')) {
    failures.push('AegisAutofillRequestParser.kt must parse AssistStructure field context.');
  }
  if (!autofillParser.includes('TYPE_TEXT_VARIATION_WEB_PASSWORD')) {
    failures.push('AegisAutofillRequestParser.kt must recognize web password input variations.');
  }
  if (!autofillAuthActivity.includes('AutofillManager.EXTRA_AUTHENTICATION_RESULT')) {
    failures.push('AutofillAuthActivity.kt must return Dataset results through AutofillManager.EXTRA_AUTHENTICATION_RESULT.');
  }
  if (!autofillAuthActivity.includes('Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP')) {
    failures.push('AutofillAuthActivity.kt must launch MainActivity in the AegisVault task while the authentication result activity waits in the browser task.');
  }
  if (autofillAuthActivity.includes('FillResponse.Builder()')) {
    failures.push('AutofillAuthActivity.kt must return an authenticated Dataset, not a nested FillResponse, so the original SaveInfo stays active.');
  }
  if (!autofillAuthActivity.includes('dataset.build()')) {
    failures.push('AutofillAuthActivity.kt must return a populated Dataset for dataset-level authentication results.');
  }
  if (!autofillAuthActivity.includes('setResult(RESULT_OK')) {
    failures.push('AutofillAuthActivity.kt must call setResult(RESULT_OK, ...) after building an approved dataset.');
  }
  if (!autofillAuthActivity.includes('approved_autofill_payload.json')) {
    failures.push('AutofillAuthActivity.kt must consume the one-time approved Autofill payload.');
  }
  if (!autofillAuthActivity.includes('POLL_TIMEOUT_MS = 300_000L')) {
    failures.push('AutofillAuthActivity.kt must allow enough time for vault unlock and approval before canceling authentication.');
  }
  if (!autofillAuthActivity.includes('payload.optString("status", "") == "canceled"')) {
    failures.push('AutofillAuthActivity.kt must honor canceled Autofill payloads and return RESULT_CANCELED promptly.');
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
  if (!activity.includes('pending_autofill_request.json')) {
    failures.push('MainActivity.kt must persist Android Autofill handoff context into app-private storage.');
  }
  if (!activity.includes('aegis_autofill_request')) {
    failures.push('MainActivity.kt must detect scoped Android Autofill handoff intents.');
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
  for (const commandName of [
    'read_pending_autofill_request',
    'clear_pending_autofill_request',
    'write_approved_autofill_payload',
    'clear_approved_autofill_payload',
    'read_pending_autofill_save_request',
    'clear_pending_autofill_save_request',
  ]) {
    if (!tauriRust.includes(commandName)) {
      failures.push(`src-tauri/src/lib.rs must expose the Android Autofill handoff command "${commandName}".`);
    }
  }
  if (!tauriRust.includes('pending_autofill_save_request.json')) {
    failures.push('src-tauri/src/lib.rs must reserve the Android pending Autofill save request filename.');
  }
  if (!tauriRust.includes('/data/data/com.aegisvault.desktop/files')) {
    failures.push('src-tauri/src/lib.rs must route Android Autofill handoff files through the same app-private filesDir used by native Kotlin.');
  }
  if (!autofillNativeBridge.includes('writeCanceledAndroidAutofillPayload')) {
    failures.push('src/lib/autofillNativeBridge.ts must expose a canceled Autofill handoff payload writer.');
  }
  if (!autofillNativeBridge.includes('parsePendingAutofillSaveRequest')) {
    failures.push('src/lib/autofillNativeBridge.ts must parse pending Android Autofill save request payloads before any UI can consume them.');
  }
  if (!autofillNativeBridge.includes('readPendingAndroidAutofillSaveRequest') || !autofillNativeBridge.includes('clearPendingAndroidAutofillSaveRequest')) {
    failures.push('src/lib/autofillNativeBridge.ts must expose read and clear helpers for pending Android Autofill save requests.');
  }
  if (!autofillNativeBridge.includes("status: 'canceled'")) {
    failures.push('src/lib/autofillNativeBridge.ts must encode canceled Autofill payloads with status: "canceled".');
  }
  if (!autofillHandoffHook.includes('writeCanceledAndroidAutofillPayload')) {
    failures.push('src/hooks/useAutofillHandoff.ts must cancel pending native Autofill authentication when the user dismisses selection.');
  }
  if (!autofillHandoffHook.includes('selectionRequest')) {
    failures.push('src/hooks/useAutofillHandoff.ts must keep explicit selection state for multiple Autofill matches.');
  }
  if (!autofillProvider.includes('context.hasPasswordField === true') || !autofillProvider.includes('candidate.hasPassword')) {
    failures.push('src/lib/autofillProvider.ts must filter Android password-field results to candidates that actually contain passwords.');
  }
  if (!autofillProvider.includes("candidate.reason === 'exact-domain'") || !autofillProvider.includes("candidate.reason === 'subdomain'")) {
    failures.push('src/lib/autofillProvider.ts must reject weak title-only fallback matches when a web domain is available.');
  }
  if (!autofillMatcher.includes('GENERIC_PACKAGE_TOKENS') || !autofillMatcher.includes('packageTokens(packageName)')) {
    failures.push('src/lib/autofillMatcher.ts must use meaningful package tokens for package-only Android app Autofill matches.');
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

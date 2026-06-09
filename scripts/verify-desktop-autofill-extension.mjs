import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function requireFile(relativePath) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`${relativePath} must exist.`);
    return false;
  }
  return true;
}

const manifestPath = 'browser-extension/chromium/manifest.json';
const firefoxManifestPath = 'browser-extension/firefox/manifest.json';
const backgroundPath = 'browser-extension/chromium/src/background.js';
const contentPath = 'browser-extension/chromium/src/content-script.js';
const stylesPath = 'browser-extension/chromium/src/content-styles.css';
const iconPath = 'browser-extension/chromium/icons/aegisvault-128.png';
const icon16Path = 'browser-extension/chromium/icons/aegisvault-16.png';
const icon32Path = 'browser-extension/chromium/icons/aegisvault-32.png';
const icon48Path = 'browser-extension/chromium/icons/aegisvault-48.png';
const icon64Path = 'browser-extension/chromium/icons/aegisvault-64.png';
const firefoxBackgroundPath = 'browser-extension/firefox/src/background.js';
const firefoxContentPath = 'browser-extension/firefox/src/content-script.js';
const firefoxStylesPath = 'browser-extension/firefox/src/content-styles.css';
const firefoxIcon16Path = 'browser-extension/firefox/icons/aegisvault-16.png';
const firefoxIcon32Path = 'browser-extension/firefox/icons/aegisvault-32.png';
const firefoxIcon48Path = 'browser-extension/firefox/icons/aegisvault-48.png';
const firefoxIcon64Path = 'browser-extension/firefox/icons/aegisvault-64.png';
const firefoxIcon128Path = 'browser-extension/firefox/icons/aegisvault-128.png';
const nativeManifestPath = 'native-messaging/chromium/com.aegisvault.desktop.json';
const firefoxNativeManifestPath = 'native-messaging/firefox/com.aegisvault.desktop.json';
const docsPath = 'docs/DESKTOP_AUTOFILL_EXTENSION.md';
const nativeHostPath = 'src-tauri/src/bin/aegisvault_native_messaging_host.rs';
const cargoTomlPath = 'src-tauri/Cargo.toml';
const packageJsonPath = 'package.json';
const stageHostScriptPath = 'scripts/stage-desktop-autofill-host.mjs';
const stageExtensionScriptPath = 'scripts/stage-browser-extension.mjs';

if (requireFile(manifestPath)) {
  const manifest = readJson(manifestPath);
  if (manifest.manifest_version !== 3) failures.push('Chromium extension must use Manifest V3.');
  if (!manifest.key || manifest.key.length < 300) failures.push('Chromium extension must define a stable public key so unpacked installs keep the same extension ID.');
  if (!manifest.permissions?.includes('nativeMessaging')) failures.push('Extension must request nativeMessaging permission.');
  if (manifest.permissions?.includes('storage')) failures.push('Extension must not request storage permission for vault data.');
  if (!manifest.background?.service_worker?.includes('background.js')) failures.push('Extension must define a background service worker.');
  if (!manifest.action?.default_icon?.['16']?.includes('aegisvault-16.png') || !manifest.action?.default_icon?.['48']?.includes('aegisvault-48.png')) {
    failures.push('Chromium extension must define a toolbar action icon.');
  }
  if (!manifest.content_scripts?.[0]?.js?.some(value => value.includes('content-script.js'))) {
    failures.push('Extension must include the credential form content script.');
  }
}

if (requireFile(firefoxManifestPath)) {
  const firefoxManifest = readJson(firefoxManifestPath);
  if (firefoxManifest.manifest_version !== 2) failures.push('Firefox extension must use Manifest V2 for native messaging compatibility.');
  if (firefoxManifest.permissions?.includes('storage')) failures.push('Firefox extension must not request storage permission for vault data.');
  if (!firefoxManifest.permissions?.includes('nativeMessaging')) failures.push('Firefox extension must request nativeMessaging permission.');
  if (!firefoxManifest.applications?.gecko?.id?.includes('aegisvault-autofill')) {
    failures.push('Firefox extension must define a stable Gecko extension ID.');
  }
  if (!firefoxManifest.browser_specific_settings?.gecko?.id?.includes('aegisvault-autofill')) {
    failures.push('Firefox extension must define browser_specific_settings.gecko.id for modern Firefox builds.');
  }
  if (!firefoxManifest.background?.scripts?.some(value => value.includes('background.js'))) {
    failures.push('Firefox extension must define the shared background script.');
  }
  if (!firefoxManifest.browser_action?.default_icon?.['16']?.includes('aegisvault-16.png') || !firefoxManifest.browser_action?.default_icon?.['48']?.includes('aegisvault-48.png')) {
    failures.push('Firefox extension must define a toolbar browser_action icon.');
  }
  if (!firefoxManifest.content_scripts?.[0]?.js?.some(value => value.includes('content-script.js'))) {
    failures.push('Firefox extension must include the credential form content script.');
  }
}

if (requireFile(backgroundPath)) {
  const background = read(backgroundPath);
  for (const required of [
    "NATIVE_HOST = 'com.aegisvault.desktop'",
    "PROTOCOL = 'aegisvault.desktopAutofill.v1'",
    'runtimeApi.sendNativeMessage',
    "typeof browser !== 'undefined'",
    'sanitizeOrigin',
    'invalid-save-payload',
    'native-host-unavailable',
  ]) {
    if (!background.includes(required)) failures.push(`background.js must include "${required}".`);
  }
  if (background.includes('console.log') || background.includes('localStorage')) {
    failures.push('background.js must not log or store credential data.');
  }
}

if (requireFile(contentPath)) {
  const content = read(contentPath);
  for (const required of [
    'input[type="password"]',
    'sendRuntimeMessage',
    'requestFill',
    'stageSavePrompt',
    "channel: 'aegisvault-autofill'",
    "action: 'fill'",
    "action: 'save'",
    'setTimeout(clearPendingSave, 60_000)',
  ]) {
    if (!content.includes(required)) failures.push(`content-script.js must include "${required}".`);
  }
  if (content.includes('chrome.storage') || content.includes('localStorage') || content.includes('sessionStorage')) {
    failures.push('content-script.js must not persist credential data in browser storage.');
  }
}

requireFile(stylesPath);
requireFile(icon16Path);
requireFile(icon32Path);
requireFile(icon48Path);
requireFile(icon64Path);
requireFile(firefoxBackgroundPath);
requireFile(firefoxContentPath);
requireFile(firefoxStylesPath);
requireFile(firefoxIcon16Path);
requireFile(firefoxIcon32Path);
requireFile(firefoxIcon48Path);
requireFile(firefoxIcon64Path);
requireFile(firefoxIcon128Path);

if (requireFile(iconPath)) {
  if (statSync(join(root, iconPath)).size < 1024) {
    failures.push('Extension icon must be a real AegisVault PNG asset, not an empty placeholder.');
  }
}

if (requireFile(nativeManifestPath)) {
  const nativeManifest = readJson(nativeManifestPath);
  if (nativeManifest.name !== 'com.aegisvault.desktop') {
    failures.push('Native messaging manifest name must be com.aegisvault.desktop.');
  }
  if (nativeManifest.type !== 'stdio') failures.push('Native messaging manifest must use stdio.');
  if (!nativeManifest.path?.includes('AegisVaultNativeMessagingHost')) {
    failures.push('Native messaging manifest path must point to the packaged AegisVault native messaging host.');
  }
  if (!nativeManifest.allowed_origins?.[0]?.startsWith('chrome-extension://')) {
    failures.push('Native messaging manifest must restrict allowed_origins to extension IDs.');
  }
  if (!nativeManifest.allowed_origins?.includes('chrome-extension://cpocoejkonndmdedimnoklhhajkiccoc/')) {
    failures.push('Native messaging manifest must allow the stable Chromium extension ID.');
  }
  if (!nativeManifest.allowed_origins?.includes('chrome-extension://fbegblomolojcldifclfljlkddkcdehl/')) {
    failures.push('Native messaging manifest must keep the legacy Chromium extension ID during migration.');
  }
}

if (requireFile(firefoxNativeManifestPath)) {
  const firefoxNativeManifest = readJson(firefoxNativeManifestPath);
  if (firefoxNativeManifest.name !== 'com.aegisvault.desktop') {
    failures.push('Firefox native messaging manifest name must be com.aegisvault.desktop.');
  }
  if (firefoxNativeManifest.type !== 'stdio') failures.push('Firefox native messaging manifest must use stdio.');
  if (!firefoxNativeManifest.path?.includes('AegisVaultNativeMessagingHost')) {
    failures.push('Firefox native messaging manifest path must point to the packaged AegisVault native messaging host.');
  }
  if (!firefoxNativeManifest.allowed_extensions?.[0]?.includes('aegisvault-autofill')) {
    failures.push('Firefox native messaging manifest must restrict allowed_extensions to the Gecko extension ID.');
  }
}

if (requireFile(nativeHostPath)) {
  const host = read(nativeHostPath);
  for (const required of [
    'aegisvault.desktopAutofill.v1',
    'u32::from_le_bytes',
    'write_native_response',
    'pending_autofill_request.json',
    'pending_autofill_save_request.json',
    'approved_autofill_payload.json',
    'FILL_APPROVAL_TIMEOUT',
    'sanitize_origin',
    'launch_aegisvault',
  ]) {
    if (!host.includes(required)) failures.push(`native messaging host must include "${required}".`);
  }
  if (host.includes('println!') || host.includes('dbg!')) {
    failures.push('Native messaging host must not write debug output to stdout because Chrome native messaging uses stdout for protocol frames.');
  }
}

if (requireFile(cargoTomlPath)) {
  const cargoToml = read(cargoTomlPath);
  for (const required of ['serde =', 'serde_json =']) {
    if (!cargoToml.includes(required)) failures.push(`src-tauri/Cargo.toml must include "${required}" for the native messaging host.`);
  }
}

if (requireFile(packageJsonPath)) {
  const packageJson = readJson(packageJsonPath);
  for (const requiredScript of ['desktop:autofill:extension:stage', 'desktop:autofill:host:build', 'desktop:autofill:host:stage']) {
    if (!packageJson.scripts?.[requiredScript]) {
      failures.push(`package.json must define "${requiredScript}".`);
    }
  }
}

if (requireFile(stageExtensionScriptPath)) {
  const stageScript = read(stageExtensionScriptPath);
  for (const required of [
    'browser-extension',
    'desktop-autofill-extension',
    'firefox',
    'manifest.json',
    'allowedExtensions',
  ]) {
    if (!stageScript.includes(required)) failures.push(`stage-browser-extension.mjs must include "${required}".`);
  }
}

if (requireFile(stageHostScriptPath)) {
  const stageScript = read(stageHostScriptPath);
  for (const required of [
    'AEGISVAULT_CHROMIUM_EXTENSION_ID',
    'AEGISVAULT_FIREFOX_EXTENSION_ID',
    'cpocoejkonndmdedimnoklhhajkiccoc',
    'aegisvault-autofill@aegisvault.com',
    'fbegblomolojcldifclfljlkddkcdehl',
    'AegisVaultNativeMessagingHost.exe',
    'install-chrome-native-host.reg',
    'install-edge-native-host.reg',
    'install-brave-native-host.reg',
    'install-firefox-native-host.reg',
    'reg.exe add',
    '/ve /t REG_SZ',
    'Mozilla\\\\NativeMessagingHosts',
    'BraveSoftware\\\\Brave-Browser',
    'NativeMessagingHosts',
  ]) {
    if (!stageScript.includes(required)) failures.push(`stage-desktop-autofill-host.mjs must include "${required}".`);
  }
}

if (requireFile(docsPath)) {
  const docs = read(docsPath);
  for (const required of [
    'aegisvault.desktopAutofill.v1',
    'native messaging',
    'must not store',
    'user gesture',
    'explicit AegisVault approval',
    'desktop:autofill:host:stage',
    'desktop:autofill:extension:stage',
    'AEGISVAULT_CHROMIUM_EXTENSION_ID',
    'AEGISVAULT_FIREFOX_EXTENSION_ID',
    'Firefox',
  ]) {
    if (!docs.includes(required)) failures.push(`docs/DESKTOP_AUTOFILL_EXTENSION.md must document "${required}".`);
  }
}

if (failures.length > 0) {
  console.error('Desktop Autofill extension verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Desktop Autofill extension verification passed.');

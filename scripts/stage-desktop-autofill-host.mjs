import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stableChromiumExtensionId = 'cpocoejkonndmdedimnoklhhajkiccoc';
const legacyChromiumExtensionId = 'fbegblomolojcldifclfljlkddkcdehl';
const defaultChromiumExtensionId = stableChromiumExtensionId;
const defaultFirefoxExtensionId = 'aegisvault-autofill@aegisvault.com';
const extensionId = process.env.AEGISVAULT_CHROMIUM_EXTENSION_ID || process.argv[2] || defaultChromiumExtensionId;
const firefoxExtensionId = process.env.AEGISVAULT_FIREFOX_EXTENSION_ID || process.argv[3] || defaultFirefoxExtensionId;
const hostName = 'com.aegisvault.desktop';
const hostBinaryName = process.platform === 'win32'
  ? 'AegisVaultNativeMessagingHost.exe'
  : 'AegisVaultNativeMessagingHost';
const sourceBinaryName = process.platform === 'win32'
  ? 'aegisvault_native_messaging_host.exe'
  : 'aegisvault_native_messaging_host';
const sourceBinaryPath = path.join(root, 'src-tauri', 'target', 'debug', sourceBinaryName);
const stageRoot = path.join(root, 'desktop-autofill-host', process.platform);
const stagedBinaryPath = path.join(stageRoot, hostBinaryName);
const stagedManifestPath = path.join(stageRoot, `${hostName}.json`);
const stagedFirefoxManifestPath = path.join(stageRoot, `${hostName}.firefox.json`);
const stagedAppPathConfigPath = path.join(stageRoot, 'aegisvault-app-path.txt');
const chromeRegPath = path.join(stageRoot, 'install-chrome-native-host.reg');
const edgeRegPath = path.join(stageRoot, 'install-edge-native-host.reg');
const braveRegPath = path.join(stageRoot, 'install-brave-native-host.reg');
const firefoxRegPath = path.join(stageRoot, 'install-firefox-native-host.reg');
const browserRegistryKeys = [
  ['Chrome', 'Google\\Chrome'],
  ['Edge', 'Microsoft\\Edge'],
  ['Brave', 'BraveSoftware\\Brave-Browser'],
];

function chromeOrigin(id) {
  return `chrome-extension://${id}/`;
}

function uniqueOrigins(ids) {
  return [...new Set(ids.filter(Boolean).map(chromeOrigin))];
}

function resolveInstalledAppPath() {
  if (process.platform !== 'win32') return '';
  const candidates = [
    path.join(stageRoot, 'AegisVault.exe'),
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'AegisVault', 'AegisVault.exe') : '',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'AegisVault', 'AegisVault.exe') : '',
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'AegisVault', 'AegisVault.exe') : '',
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'AegisVault', 'AegisVault.exe') : '',
  ];
  return candidates.find(candidate => candidate && existsSync(candidate)) || '';
}

function registryFile(browserKey) {
  const escapedPath = stagedManifestPath.replaceAll('\\', '\\\\');
  return [
    'Windows Registry Editor Version 5.00',
    '',
    `[HKEY_CURRENT_USER\\Software\\${browserKey}\\NativeMessagingHosts\\${hostName}]`,
    `@="${escapedPath}"`,
    '',
  ].join('\r\n');
}

function firefoxRegistryFile() {
  const escapedPath = stagedFirefoxManifestPath.replaceAll('\\', '\\\\');
  return [
    'Windows Registry Editor Version 5.00',
    '',
    `[HKEY_CURRENT_USER\\Software\\Mozilla\\NativeMessagingHosts\\${hostName}]`,
    `@="${escapedPath}"`,
    '',
  ].join('\r\n');
}

function shellInstallSnippet(browserKey) {
  const registryPath = `HKCU\\Software\\${browserKey}\\NativeMessagingHosts\\${hostName}`;
  const userRegistryPath = `HKEY_USERS\\$currentUserSid\\Software\\${browserKey}\\NativeMessagingHosts\\${hostName}`;
  return [
    `# ${browserKey} native host registration`,
    `& reg.exe add "${registryPath}" /ve /t REG_SZ /d "${stagedManifestPath}" /f | Out-Null`,
    'if ($currentUserSid) {',
    `  & reg.exe add "${userRegistryPath}" /ve /t REG_SZ /d "${stagedManifestPath}" /f | Out-Null`,
    '}',
  ].join('\n');
}

function shellFirefoxInstallSnippet() {
  const registryPath = `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${hostName}`;
  const userRegistryPath = `HKEY_USERS\\$currentUserSid\\Software\\Mozilla\\NativeMessagingHosts\\${hostName}`;
  return [
    '# Firefox native host registration',
    `& reg.exe add "${registryPath}" /ve /t REG_SZ /d "${stagedFirefoxManifestPath}" /f | Out-Null`,
    'if ($currentUserSid) {',
    `  & reg.exe add "${userRegistryPath}" /ve /t REG_SZ /d "${stagedFirefoxManifestPath}" /f | Out-Null`,
    '}',
  ].join('\n');
}

function shellAppPathSnippet() {
  const escapedStageRoot = stageRoot.replaceAll('"', '`"');
  const escapedConfigPath = stagedAppPathConfigPath.replaceAll('"', '`"');
  return [
    '# Resolve the installed AegisVault desktop app so browser Autofill can open the vault automatically.',
    '$candidateAppPaths = @(',
    `  (Join-Path "${escapedStageRoot}" "AegisVault.exe"),`,
    '  (Join-Path $env:LOCALAPPDATA "AegisVault\\AegisVault.exe"),',
    '  (Join-Path $env:LOCALAPPDATA "Programs\\AegisVault\\AegisVault.exe"),',
    '  (Join-Path $env:ProgramFiles "AegisVault\\AegisVault.exe")',
    ')',
    'if ($env:ProgramFiles -and ${env:ProgramFiles(x86)}) {',
    '  $candidateAppPaths += Join-Path ${env:ProgramFiles(x86)} "AegisVault\\AegisVault.exe"',
    '}',
    '$installedAppPath = $candidateAppPaths | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1',
    'if ($installedAppPath) {',
    `  Set-Content -LiteralPath "${escapedConfigPath}" -Value $installedAppPath -Encoding UTF8`,
    '  Write-Host "AegisVault desktop app path recorded: $installedAppPath"',
    '} else {',
    '  Write-Warning "AegisVault.exe was not found in standard install paths. Autofill can still work after setting AEGISVAULT_DESKTOP_APP_PATH or placing aegisvault-app-path.txt next to the native host."',
    '}',
  ].join('\n');
}

async function assertBuiltHost() {
  try {
    const info = await stat(sourceBinaryPath);
    if (!info.isFile() || info.size < 1024) {
      throw new Error('Native host binary is too small.');
    }
  } catch {
    throw new Error(`Native host binary was not found at ${sourceBinaryPath}. Run "npm run desktop:autofill:host:build" first.`);
  }
}

await assertBuiltHost();
await rm(stageRoot, { recursive: true, force: true });
await mkdir(stageRoot, { recursive: true });
await copyFile(sourceBinaryPath, stagedBinaryPath);
await writeFile(stagedAppPathConfigPath, resolveInstalledAppPath());

const manifestTemplate = JSON.parse(await readFile(path.join(root, 'native-messaging', 'chromium', `${hostName}.json`), 'utf8'));
const manifest = {
  ...manifestTemplate,
  path: stagedBinaryPath,
  allowed_origins: uniqueOrigins([extensionId, stableChromiumExtensionId, legacyChromiumExtensionId]),
};
await writeFile(stagedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const firefoxManifestTemplate = JSON.parse(await readFile(path.join(root, 'native-messaging', 'firefox', `${hostName}.json`), 'utf8'));
const firefoxManifest = {
  ...firefoxManifestTemplate,
  path: stagedBinaryPath,
  allowed_extensions: [firefoxExtensionId],
};
await writeFile(stagedFirefoxManifestPath, `${JSON.stringify(firefoxManifest, null, 2)}\n`);

if (process.platform === 'win32') {
  await writeFile(chromeRegPath, registryFile('Google\\Chrome'));
  await writeFile(edgeRegPath, registryFile('Microsoft\\Edge'));
  await writeFile(braveRegPath, registryFile('BraveSoftware\\Brave-Browser'));
  await writeFile(firefoxRegPath, firefoxRegistryFile());
  await writeFile(path.join(stageRoot, 'install-native-host.ps1'), [
    '$ErrorActionPreference = "Stop"',
    '$currentUserSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
    shellAppPathSnippet(),
    ...browserRegistryKeys.map(([, browserKey]) => shellInstallSnippet(browserKey)),
    shellFirefoxInstallSnippet(),
    'Write-Host "AegisVault native messaging host registered for Chrome, Edge, Brave, and Firefox."',
    '',
  ].join('\n'));
}

console.log(`Staged desktop Autofill native host in ${stageRoot}`);
console.log(`- ${path.basename(stagedBinaryPath)}`);
console.log(`- ${path.basename(stagedManifestPath)}`);
console.log(`- ${path.basename(stagedFirefoxManifestPath)}`);
console.log(`- ${path.basename(stagedAppPathConfigPath)}`);
if (process.platform === 'win32') {
  console.log(`- ${path.basename(chromeRegPath)}`);
  console.log(`- ${path.basename(edgeRegPath)}`);
  console.log(`- ${path.basename(braveRegPath)}`);
  console.log(`- ${path.basename(firefoxRegPath)}`);
  console.log('- install-native-host.ps1');
}
console.log(`Allowed Chromium extension ID: ${extensionId}`);
console.log(`Allowed Firefox extension ID: ${firefoxExtensionId}`);

import {
  clearBiometricUnlockBundle,
  getBiometricUnlockBundle,
  getBiometricUnlockStatus,
  saveBiometricUnlockBundle,
  type BiometricUnlockBundle,
  type BiometricUnlockStatus,
} from './biometricUnlock';

export type SecurityRuntimePlatform = 'android' | 'desktop' | 'web';

export interface AndroidSecurityBridgeStatus {
  platform: SecurityRuntimePlatform;
  biometric: BiometricUnlockStatus;
  screenCaptureProtected: boolean;
  appBackupDisabled: boolean;
  networkAllowlistConfigured: boolean;
  keystoreBackedBiometricStore: boolean;
  warnings: string[];
}

function detectRuntimePlatform(): SecurityRuntimePlatform {
  if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
    return 'android';
  }

  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    return 'desktop';
  }

  return 'web';
}

export async function getAndroidSecurityBridgeStatus(): Promise<AndroidSecurityBridgeStatus> {
  const platform = detectRuntimePlatform();
  const biometric = await getBiometricUnlockStatus();
  const warnings: string[] = [];

  if (platform === 'android' && !biometric.isAvailable) {
    warnings.push('Android biometric hardware or enrollment is not available.');
  }

  if (platform === 'web') {
    warnings.push('Native Android security controls are not available in web preview mode.');
  }

  return {
    platform,
    biometric,
    screenCaptureProtected: platform === 'android',
    appBackupDisabled: platform === 'android',
    networkAllowlistConfigured: platform === 'android',
    keystoreBackedBiometricStore: biometric.isAvailable,
    warnings,
  };
}

export async function saveAndroidBiometricUnlockBundle(masterPassword: string, secretKey: string): Promise<void> {
  await saveBiometricUnlockBundle(masterPassword, secretKey);
}

export async function getAndroidBiometricUnlockBundle(reason: string): Promise<BiometricUnlockBundle> {
  return getBiometricUnlockBundle(reason);
}

export async function clearAndroidBiometricUnlockBundle(): Promise<void> {
  await clearBiometricUnlockBundle();
}

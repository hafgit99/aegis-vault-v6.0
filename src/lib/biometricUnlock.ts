import {
  BiometryType,
  checkStatus,
  getData,
  hasData,
  removeData,
  setData,
  type Status,
} from '@choochmeque/tauri-plugin-biometry-api';

const BIOMETRIC_DOMAIN = 'com.aegisvault.desktop';
const BIOMETRIC_UNLOCK_NAME = 'vault-unlock-bundle';

export interface BiometricUnlockBundle {
  version: 1;
  masterPassword: string;
  secretKey: string;
  createdAt: string;
}

export interface BiometricUnlockStatus {
  isAvailable: boolean;
  isEnrolled: boolean;
  hasBundle: boolean;
  label: string;
  error?: string;
}

function biometryLabel(type: BiometryType): string {
  switch (type) {
    case BiometryType.TouchID:
      return 'Touch ID';
    case BiometryType.FaceID:
      return 'Face ID';
    case BiometryType.Iris:
      return 'Biometric unlock';
    case BiometryType.Auto:
      return 'Windows Hello / Touch ID';
    default:
      return 'Biometric unlock';
  }
}

function normalizeStatus(status: Status, hasBundleValue: boolean): BiometricUnlockStatus {
  return {
    isAvailable: !!status.isAvailable,
    isEnrolled: !!status.isAvailable,
    hasBundle: hasBundleValue,
    label: biometryLabel(status.biometryType),
    error: status.error,
  };
}

export async function getBiometricUnlockStatus(): Promise<BiometricUnlockStatus> {
  try {
    const status = await checkStatus();
    const hasBundleValue = status.isAvailable
      ? await hasData({ domain: BIOMETRIC_DOMAIN, name: BIOMETRIC_UNLOCK_NAME }).catch(() => false)
      : false;
    return normalizeStatus(status, hasBundleValue);
  } catch (error: any) {
    return {
      isAvailable: false,
      isEnrolled: false,
      hasBundle: false,
      label: 'Biometric unlock',
      error: error?.message || String(error),
    };
  }
}

export async function saveBiometricUnlockBundle(masterPassword: string, secretKey: string): Promise<void> {
  const payload: BiometricUnlockBundle = {
    version: 1,
    masterPassword,
    secretKey,
    createdAt: new Date().toISOString(),
  };

  await setData({
    domain: BIOMETRIC_DOMAIN,
    name: BIOMETRIC_UNLOCK_NAME,
    data: JSON.stringify(payload),
  });
}

export async function getBiometricUnlockBundle(reason: string): Promise<BiometricUnlockBundle> {
  const response = await getData({
    domain: BIOMETRIC_DOMAIN,
    name: BIOMETRIC_UNLOCK_NAME,
    reason,
    cancelTitle: 'Cancel',
  });
  const parsed = JSON.parse(response.data) as Partial<BiometricUnlockBundle>;
  if (parsed.version !== 1 || !parsed.masterPassword || !parsed.secretKey) {
    throw new Error('Biometric unlock bundle is invalid.');
  }
  return parsed as BiometricUnlockBundle;
}

export async function clearBiometricUnlockBundle(): Promise<void> {
  await removeData({ domain: BIOMETRIC_DOMAIN, name: BIOMETRIC_UNLOCK_NAME }).catch(() => undefined);
}

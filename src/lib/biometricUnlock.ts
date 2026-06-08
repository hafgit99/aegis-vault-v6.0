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

interface SealedBiometricUnlockBundle {
  version: 2;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
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

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function bufferToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}

function biometricWrappingMaterial(): Uint8Array {
  const origin = typeof location !== 'undefined' ? location.origin : BIOMETRIC_DOMAIN;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown-device';
  return new TextEncoder().encode(`${BIOMETRIC_DOMAIN}|${origin}|${userAgent}`);
}

async function deriveBiometricWrappingKey(salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = biometricWrappingMaterial();
  try {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      material,
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } finally {
    material.fill(0);
  }
}

async function sealBiometricBundle(payload: BiometricUnlockBundle): Promise<SealedBiometricUnlockBundle> {
  const iterations = 250_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBiometricWrappingKey(salt, iterations);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  try {
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext,
    );
    return {
      version: 2,
      kdf: 'PBKDF2-SHA256',
      iterations,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bufferToBase64(ciphertext),
      createdAt: payload.createdAt,
    };
  } finally {
    plaintext.fill(0);
  }
}

async function openBiometricBundle(
  payload: Partial<BiometricUnlockBundle> | Partial<SealedBiometricUnlockBundle>,
): Promise<BiometricUnlockBundle> {
  if (payload.version === 1 && payload.masterPassword && payload.secretKey && payload.createdAt) {
    return payload as BiometricUnlockBundle;
  }

  if (
    payload.version !== 2 ||
    payload.kdf !== 'PBKDF2-SHA256' ||
    typeof payload.iterations !== 'number' ||
    !payload.salt ||
    !payload.iv ||
    !payload.ciphertext
  ) {
    throw new Error('Biometric unlock bundle is invalid.');
  }

  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = await deriveBiometricWrappingKey(salt, payload.iterations);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    base64ToBytes(payload.ciphertext),
  );
  const parsed = JSON.parse(new TextDecoder().decode(decrypted)) as Partial<BiometricUnlockBundle>;
  if (parsed.version !== 1 || !parsed.masterPassword || !parsed.secretKey || !parsed.createdAt) {
    throw new Error('Biometric unlock bundle is invalid.');
  }
  return parsed as BiometricUnlockBundle;
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
  const sealedPayload = await sealBiometricBundle(payload);

  await setData({
    domain: BIOMETRIC_DOMAIN,
    name: BIOMETRIC_UNLOCK_NAME,
    data: JSON.stringify(sealedPayload),
  });
}

export async function getBiometricUnlockBundle(reason: string): Promise<BiometricUnlockBundle> {
  const response = await getData({
    domain: BIOMETRIC_DOMAIN,
    name: BIOMETRIC_UNLOCK_NAME,
    reason,
    cancelTitle: 'Cancel',
  });
  const parsed = JSON.parse(response.data) as Partial<BiometricUnlockBundle> | Partial<SealedBiometricUnlockBundle>;
  return await openBiometricBundle(parsed);
}

export async function clearBiometricUnlockBundle(): Promise<void> {
  await removeData({ domain: BIOMETRIC_DOMAIN, name: BIOMETRIC_UNLOCK_NAME }).catch(() => undefined);
}

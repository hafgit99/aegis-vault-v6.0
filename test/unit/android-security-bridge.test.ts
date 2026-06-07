import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearBiometricUnlockBundle,
  getBiometricUnlockBundle,
  getBiometricUnlockStatus,
  saveBiometricUnlockBundle,
} from '../../src/lib/biometricUnlock';
import {
  clearAndroidBiometricUnlockBundle,
  getAndroidBiometricUnlockBundle,
  getAndroidSecurityBridgeStatus,
  saveAndroidBiometricUnlockBundle,
} from '../../src/lib/androidSecurityBridge';

vi.mock('../../src/lib/biometricUnlock', () => ({
  clearBiometricUnlockBundle: vi.fn(),
  getBiometricUnlockBundle: vi.fn(),
  getBiometricUnlockStatus: vi.fn(),
  saveBiometricUnlockBundle: vi.fn(),
}));

function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value,
  });
}

describe('androidSecurityBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUserAgent('Mozilla/5.0');
    vi.mocked(getBiometricUnlockStatus).mockResolvedValue({
      isAvailable: true,
      isEnrolled: true,
      hasBundle: false,
      label: 'Biometric unlock',
    });
  });

  it('reports Android native hardening capabilities when running on Android', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel) AppleWebKit/537.36');

    await expect(getAndroidSecurityBridgeStatus()).resolves.toMatchObject({
      platform: 'android',
      screenCaptureProtected: true,
      appBackupDisabled: true,
      networkAllowlistConfigured: true,
      keystoreBackedBiometricStore: true,
      warnings: [],
    });
  });

  it('reports web preview limitations without native security controls', async () => {
    vi.mocked(getBiometricUnlockStatus).mockResolvedValue({
      isAvailable: false,
      isEnrolled: false,
      hasBundle: false,
      label: 'Biometric unlock',
      error: 'not available',
    });

    const status = await getAndroidSecurityBridgeStatus();

    expect(status.platform).toBe('web');
    expect(status.screenCaptureProtected).toBe(false);
    expect(status.warnings).toContain('Native Android security controls are not available in web preview mode.');
  });

  it('delegates biometric bundle lifecycle to the keystore-backed biometry plugin store', async () => {
    vi.mocked(getBiometricUnlockBundle).mockResolvedValue({
      version: 1,
      masterPassword: 'MasterPassword123!',
      secretKey: 'A3-ANDROID-KEY01-KEY02-KEY03',
      createdAt: '2026-06-07T00:00:00.000Z',
    });

    await saveAndroidBiometricUnlockBundle('MasterPassword123!', 'A3-ANDROID-KEY01-KEY02-KEY03');
    await expect(getAndroidBiometricUnlockBundle('Unlock')).resolves.toMatchObject({
      secretKey: 'A3-ANDROID-KEY01-KEY02-KEY03',
    });
    await clearAndroidBiometricUnlockBundle();

    expect(saveBiometricUnlockBundle).toHaveBeenCalledWith('MasterPassword123!', 'A3-ANDROID-KEY01-KEY02-KEY03');
    expect(getBiometricUnlockBundle).toHaveBeenCalledWith('Unlock');
    expect(clearBiometricUnlockBundle).toHaveBeenCalled();
  });
});

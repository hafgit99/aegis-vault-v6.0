import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BiometryType,
  checkStatus,
  getData,
  hasData,
  removeData,
  setData,
} from '@choochmeque/tauri-plugin-biometry-api';
import {
  clearBiometricUnlockBundle,
  getBiometricUnlockBundle,
  getBiometricUnlockStatus,
  saveBiometricUnlockBundle,
} from '../../src/lib/biometricUnlock';

vi.mock('@choochmeque/tauri-plugin-biometry-api', () => ({
  BiometryType: {
    None: 0,
    Auto: 1,
    TouchID: 2,
    FaceID: 3,
    Iris: 4,
  },
  checkStatus: vi.fn(),
  getData: vi.fn(),
  hasData: vi.fn(),
  removeData: vi.fn(),
  setData: vi.fn(),
}));

describe('biometricUnlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports available hardware biometrics and existing unlock data', async () => {
    vi.mocked(checkStatus).mockResolvedValue({
      isAvailable: true,
      biometryType: BiometryType.TouchID,
    });
    vi.mocked(hasData).mockResolvedValue(true);

    await expect(getBiometricUnlockStatus()).resolves.toEqual({
      isAvailable: true,
      isEnrolled: true,
      hasBundle: true,
      label: 'Touch ID',
      error: undefined,
    });
  });

  it('hides biometric unlock when the platform check fails', async () => {
    vi.mocked(checkStatus).mockRejectedValue(new Error('not available'));

    await expect(getBiometricUnlockStatus()).resolves.toMatchObject({
      isAvailable: false,
      isEnrolled: false,
      hasBundle: false,
      label: 'Biometric unlock',
      error: 'not available',
    });
    expect(hasData).not.toHaveBeenCalled();
  });

  it('stores and reads the biometric unlock bundle through the plugin store', async () => {
    let storedData = '';
    vi.mocked(getData).mockResolvedValue({
      domain: 'com.aegisvault.desktop',
      name: 'vault-unlock-bundle',
      get data() {
        return storedData;
      },
    });
    vi.mocked(setData).mockImplementation(async ({ data }) => {
      storedData = data;
    });

    await saveBiometricUnlockBundle('MasterPassword123!', 'A3-BIOMET-BUNDLE-KEY01-KEY02');

    expect(setData).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'com.aegisvault.desktop',
      name: 'vault-unlock-bundle',
      data: expect.not.stringContaining('MasterPassword123!'),
    }));
    expect(storedData).not.toContain('A3-BIOMET-BUNDLE-KEY01-KEY02');
    await expect(getBiometricUnlockBundle('Unlock vault')).resolves.toMatchObject({
      version: 1,
      masterPassword: 'MasterPassword123!',
      secretKey: 'A3-BIOMET-BUNDLE-KEY01-KEY02',
    });
  });

  it('keeps legacy plaintext biometric bundles readable for migration', async () => {
    vi.mocked(getData).mockResolvedValue({
      domain: 'com.aegisvault.desktop',
      name: 'vault-unlock-bundle',
      data: JSON.stringify({
        version: 1,
        masterPassword: 'MasterPassword123!',
        secretKey: 'A3-BIOMET-BUNDLE-KEY01-KEY02',
        createdAt: '2026-05-29T00:00:00.000Z',
      }),
    });

    await expect(getBiometricUnlockBundle('Unlock vault')).resolves.toMatchObject({
      masterPassword: 'MasterPassword123!',
      secretKey: 'A3-BIOMET-BUNDLE-KEY01-KEY02',
    });
  });

  it('rejects malformed biometric unlock payloads and tolerates cleanup misses', async () => {
    vi.mocked(getData).mockResolvedValue({
      domain: 'com.aegisvault.desktop',
      name: 'vault-unlock-bundle',
      data: JSON.stringify({ version: 1, masterPassword: '' }),
    });
    vi.mocked(removeData).mockRejectedValue(new Error('already removed'));

    await expect(getBiometricUnlockBundle('Unlock vault')).rejects.toThrow('Biometric unlock bundle is invalid.');
    await expect(clearBiometricUnlockBundle()).resolves.toBeUndefined();
  });
});

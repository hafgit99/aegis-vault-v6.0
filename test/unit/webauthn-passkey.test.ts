import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatePasskey, isWebAuthnAvailable, registerPasskey } from '../../src/lib/webauthnPasskey';

const installWebAuthnMock = () => {
  const rawId = new Uint8Array([1, 2, 3, 4]).buffer;
  const clientDataJSON = new Uint8Array([5, 6, 7, 8]).buffer;
  const publicKey = new Uint8Array([9, 10, 11, 12]).buffer;
  const authenticatorData = new Uint8Array(60);
  authenticatorData.set([0xad, 0xce, 0x00, 0x02, 0x35, 0xbc, 0xc6, 0x0a, 0x2b, 0x7b, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab], 37);

  const create = vi.fn(async () => ({
    type: 'public-key',
    rawId,
    response: {
      clientDataJSON,
      getPublicKey: () => publicKey,
      getPublicKeyAlgorithm: () => -7,
      getAuthenticatorData: () => authenticatorData.buffer,
      getTransports: () => ['internal', 'hybrid'],
    },
  }));
  const get = vi.fn(async () => ({
    type: 'public-key',
    rawId,
    response: {
      authenticatorData: authenticatorData.buffer,
      clientDataJSON,
      signature: new Uint8Array([13, 14, 15]).buffer,
      userHandle: new Uint8Array([16, 17]).buffer,
    },
  }));

  vi.stubGlobal('PublicKeyCredential', vi.fn());
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { create, get },
  });

  return { create, get };
};

describe('webauthnPasskey', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: undefined,
    });
  });

  it('reports availability only when browser credentials and PublicKeyCredential exist', () => {
    expect(isWebAuthnAvailable()).toBe(false);

    installWebAuthnMock();

    expect(isWebAuthnAvailable()).toBe(true);
  });

  it('registers a real WebAuthn credential and normalizes attestation metadata', async () => {
    const { create } = installWebAuthnMock();

    const credential = await registerPasskey('github.com', 'octo@example.com');

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      publicKey: expect.objectContaining({
        rp: { name: 'AegisVault' },
        attestation: 'none',
        authenticatorSelection: expect.objectContaining({ residentKey: 'preferred' }),
      }),
    }));
    expect(credential).toEqual({
      credentialId: 'AQIDBA',
      publicKey: 'CQoLDA',
      publicKeyAlgorithm: -7,
      aaguid: 'adce0002-35bc-c60a-2b7b-1234567890ab',
      authenticatorData: expect.any(String),
      clientDataJSON: 'BQYHCA',
      transports: ['internal', 'hybrid'],
    });
  });

  it('authenticates a stored passkey credential id with an assertion request', async () => {
    const { get } = installWebAuthnMock();

    const assertion = await authenticatePasskey('AQIDBA');

    const request = (get as any).mock.calls[0][0] as CredentialRequestOptions;
    const allowCredential = request.publicKey?.allowCredentials?.[0];
    expect(Array.from(new Uint8Array(allowCredential?.id as ArrayBuffer))).toEqual([1, 2, 3, 4]);
    expect(assertion).toEqual({
      credentialId: 'AQIDBA',
      authenticatorData: expect.any(String),
      clientDataJSON: 'BQYHCA',
      signature: 'DQ4P',
      userHandle: 'EBE',
    });
  });

  it('uses stable fallbacks when optional attestation helpers are missing', async () => {
    const rawId = new Uint8Array([1, 2, 3, 4]).buffer;
    const clientDataJSON = new Uint8Array([5, 6, 7, 8]).buffer;
    vi.stubGlobal('PublicKeyCredential', vi.fn());
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: vi.fn(async () => ({
          type: 'public-key',
          rawId,
          response: { clientDataJSON },
        })),
        get: vi.fn(),
      },
    });

    await expect(registerPasskey('', '')).resolves.toEqual({
      credentialId: 'AQIDBA',
      publicKey: 'managed-by-authenticator',
      publicKeyAlgorithm: undefined,
      aaguid: undefined,
      authenticatorData: undefined,
      clientDataJSON: 'BQYHCA',
      transports: undefined,
    });
  });

  it('rejects unexpected credential results from the WebAuthn API', async () => {
    vi.stubGlobal('PublicKeyCredential', vi.fn());
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: vi.fn(async () => null),
        get: vi.fn(async () => ({ type: 'password' })),
      },
    });

    await expect(registerPasskey('github.com', 'octo@example.com')).rejects.toThrow(/not created/);
    await expect(authenticatePasskey('AQIDBA')).rejects.toThrow(/assertion was not returned/);
  });

  it('rejects registration and authentication when WebAuthn is unavailable', async () => {
    await expect(registerPasskey('github.com', 'octo@example.com')).rejects.toThrow(/WebAuthn is not available/);
    await expect(authenticatePasskey('AQIDBA')).rejects.toThrow(/WebAuthn is not available/);
  });
});

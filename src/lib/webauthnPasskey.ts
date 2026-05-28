import { bufferToBase64Url, generateRandomBytes } from './crypto-types';

export interface RegisteredPasskey {
  credentialId: string;
  publicKey: string;
  publicKeyAlgorithm?: number;
  aaguid?: string;
  authenticatorData?: string;
  clientDataJSON: string;
  transports?: string[];
}

export interface PasskeyAssertion {
  credentialId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
  userHandle?: string;
}

type AttestationResponseWithHelpers = AuthenticatorAttestationResponse & {
  getPublicKey?: () => ArrayBuffer | null;
  getPublicKeyAlgorithm?: () => number;
  getTransports?: () => string[];
  getAuthenticatorData?: () => ArrayBuffer;
};

const AEGIS_VAULT_RP_NAME = 'AegisVault';

export function isWebAuthnAvailable(): boolean {
  return typeof window !== 'undefined'
    && typeof PublicKeyCredential !== 'undefined'
    && !!navigator.credentials
    && typeof navigator.credentials.create === 'function'
    && typeof navigator.credentials.get === 'function';
}

function domainToUserName(domain: string, userName: string): string {
  const cleanDomain = domain.trim() || window.location.hostname || 'local-vault';
  const cleanUser = userName.trim() || 'vault-user';
  return `${cleanUser} @ ${cleanDomain}`;
}

function parseAaguid(authenticatorData?: ArrayBuffer): string | undefined {
  if (!authenticatorData || authenticatorData.byteLength < 53) return undefined;
  const bytes = new Uint8Array(authenticatorData.slice(37, 53));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function base64UrlToBuffer(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export async function registerPasskey(domain: string, userName: string): Promise<RegisteredPasskey> {
  if (!isWebAuthnAvailable()) {
    throw new Error('WebAuthn is not available in this browser or desktop shell.');
  }

  const displayName = domainToUserName(domain, userName);
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: generateRandomBytes(32),
      rp: { name: AEGIS_VAULT_RP_NAME },
      user: {
        id: generateRandomBytes(32),
        name: displayName,
        displayName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      attestation: 'none',
      timeout: 60_000,
    },
  }) as PublicKeyCredential | null;

  if (!credential || credential.type !== 'public-key') {
    throw new Error('A passkey credential was not created.');
  }

  const response = credential.response as AttestationResponseWithHelpers;
  const publicKey = response.getPublicKey?.() || null;
  const authenticatorData = response.getAuthenticatorData?.();

  return {
    credentialId: bufferToBase64Url(credential.rawId),
    publicKey: publicKey ? bufferToBase64Url(publicKey) : 'managed-by-authenticator',
    publicKeyAlgorithm: response.getPublicKeyAlgorithm?.(),
    aaguid: parseAaguid(authenticatorData),
    authenticatorData: authenticatorData ? bufferToBase64Url(authenticatorData) : undefined,
    clientDataJSON: bufferToBase64Url(response.clientDataJSON),
    transports: response.getTransports?.(),
  };
}

export async function authenticatePasskey(credentialId: string): Promise<PasskeyAssertion> {
  if (!isWebAuthnAvailable()) {
    throw new Error('WebAuthn is not available in this browser or desktop shell.');
  }

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: generateRandomBytes(32),
      allowCredentials: [{
        type: 'public-key',
        id: base64UrlToBuffer(credentialId),
      }],
      userVerification: 'preferred',
      timeout: 60_000,
    },
  }) as PublicKeyCredential | null;

  if (!assertion || assertion.type !== 'public-key') {
    throw new Error('A passkey assertion was not returned.');
  }

  const response = assertion.response as AuthenticatorAssertionResponse;
  return {
    credentialId: bufferToBase64Url(assertion.rawId),
    authenticatorData: bufferToBase64Url(response.authenticatorData),
    clientDataJSON: bufferToBase64Url(response.clientDataJSON),
    signature: bufferToBase64Url(response.signature),
    userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : undefined,
  };
}

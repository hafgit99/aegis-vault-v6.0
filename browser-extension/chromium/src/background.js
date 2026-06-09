const NATIVE_HOST = 'com.aegisvault.desktop';
const PROTOCOL = 'aegisvault.desktopAutofill.v1';
const MAX_PASSWORD_LENGTH = 4096;
const usesPromiseRuntime = typeof browser !== 'undefined';
const runtimeApi = usesPromiseRuntime ? browser.runtime : chrome.runtime;

function randomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

function sanitizeOrigin(origin) {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function sanitizeCredentialPayload(payload) {
  const origin = sanitizeOrigin(payload?.origin || '');
  if (!origin) return null;

  const username = typeof payload.username === 'string' ? payload.username.slice(0, 512) : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  if (password.length === 0 || password.length > MAX_PASSWORD_LENGTH) return null;

  return {
    origin,
    url: typeof payload.url === 'string' ? payload.url.slice(0, 2048) : origin,
    username,
    password,
    formSignature: typeof payload.formSignature === 'string' ? payload.formSignature.slice(0, 256) : '',
  };
}

function sendNativeMessage(message) {
  return new Promise(resolve => {
    if (usesPromiseRuntime) {
      runtimeApi.sendNativeMessage(NATIVE_HOST, message)
        .then(response => resolve(response || { ok: false, status: 'empty-native-response' }))
        .catch(error => resolve({
          ok: false,
          status: 'native-host-unavailable',
          error: error?.message || 'Native messaging host is unavailable.',
        }));
      return;
    }

    runtimeApi.sendNativeMessage(NATIVE_HOST, message, response => {
      const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : null;
      if (lastError) {
        resolve({
          ok: false,
          status: 'native-host-unavailable',
          error: lastError.message,
        });
        return;
      }
      resolve(response || { ok: false, status: 'empty-native-response' });
    });
  });
}

async function handleFillRequest(payload) {
  const origin = sanitizeOrigin(payload?.origin || '');
  if (!origin) return { ok: false, status: 'unsupported-origin' };

  return sendNativeMessage({
    protocol: PROTOCOL,
    id: randomId(),
    type: 'fill',
    origin,
    url: typeof payload.url === 'string' ? payload.url.slice(0, 2048) : origin,
    formSignature: typeof payload.formSignature === 'string' ? payload.formSignature.slice(0, 256) : '',
    fields: {
      hasUsernameField: payload?.hasUsernameField === true,
      hasPasswordField: payload?.hasPasswordField === true,
    },
  });
}

async function handleSaveRequest(payload) {
  const credential = sanitizeCredentialPayload(payload);
  if (!credential) return { ok: false, status: 'invalid-save-payload' };

  return sendNativeMessage({
    protocol: PROTOCOL,
    id: randomId(),
    type: 'save',
    ...credential,
  });
}

runtimeApi.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.channel !== 'aegisvault-autofill') return false;

  const action = message.action;
  const payload = message.payload || {};
  const handler = action === 'fill' ? handleFillRequest : action === 'save' ? handleSaveRequest : null;
  if (!handler) {
    sendResponse({ ok: false, status: 'unsupported-action' });
    return false;
  }

  handler(payload).then(sendResponse);
  return true;
});

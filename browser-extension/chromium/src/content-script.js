(() => {
  const PROMPT_ID = 'aegisvault-autofill-prompt';
  const BUTTON_CLASS = 'aegisvault-autofill-button';
  const FIELD_SELECTOR = [
    'input[type="password"]',
    'input[autocomplete="current-password"]',
    'input[autocomplete="new-password"]',
  ].join(',');

  let activePrompt = null;
  let pendingSave = null;
  let pendingSaveTimer = null;
  const usesPromiseRuntime = typeof browser !== 'undefined';
  const runtimeApi = usesPromiseRuntime ? browser.runtime : chrome.runtime;

  function sendRuntimeMessage(message) {
    return new Promise(resolve => {
      if (usesPromiseRuntime) {
        runtimeApi.sendMessage(message)
          .then(response => resolve(response || { ok: false, status: 'empty-extension-response' }))
          .catch(error => resolve({
            ok: false,
            status: error?.message || 'AegisVault extension bridge unavailable',
          }));
        return;
      }

      runtimeApi.sendMessage(message, response => {
        const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : null;
        if (lastError) {
          resolve({ ok: false, status: lastError.message || 'AegisVault extension bridge unavailable' });
          return;
        }
        resolve(response || { ok: false, status: 'empty-extension-response' });
      });
    });
  }

  function isVisibleInput(input) {
    const rect = input.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && !input.disabled && !input.readOnly;
  }

  function findPasswordField(root) {
    const fields = Array.from(root.querySelectorAll(FIELD_SELECTOR));
    return fields.find(isVisibleInput) || null;
  }

  function findUsernameField(form, passwordField) {
    const candidates = Array.from((form || document).querySelectorAll('input'))
      .filter(input => input !== passwordField)
      .filter(isVisibleInput)
      .filter(input => {
        const type = (input.getAttribute('type') || 'text').toLowerCase();
        const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
        const name = `${input.name || ''} ${input.id || ''} ${input.getAttribute('aria-label') || ''}`.toLowerCase();
        return type === 'email' ||
          type === 'text' ||
          autocomplete.includes('username') ||
          autocomplete.includes('email') ||
          name.includes('user') ||
          name.includes('email') ||
          name.includes('login');
      });
    return candidates[candidates.length - 1] || null;
  }

  function formSignature(form, passwordField, usernameField) {
    const parts = [
      location.hostname,
      form?.id || '',
      form?.name || '',
      usernameField?.name || usernameField?.id || '',
      passwordField?.name || passwordField?.id || '',
    ];
    return parts.join('|').slice(0, 256);
  }

  function dispatchInput(input, value) {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function removePrompt() {
    activePrompt?.remove();
    activePrompt = null;
  }

  function statusMessage(response, fallback) {
    if (!response) return fallback;
    return response.error ? `${response.status || fallback}: ${response.error}` : response.status || fallback;
  }

  function showInlineButton(passwordField) {
    if (document.querySelector(`.${BUTTON_CLASS}`)) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASS;
    button.textContent = 'AegisVault';
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => requestFill(passwordField));

    const parent = passwordField.parentElement || document.body;
    parent.appendChild(button);
  }

  async function requestFill(passwordField) {
    const form = passwordField.form;
    const usernameField = findUsernameField(form, passwordField);
    const response = await sendRuntimeMessage({
      channel: 'aegisvault-autofill',
      action: 'fill',
      payload: {
        origin: location.origin,
        url: location.href,
        hasUsernameField: Boolean(usernameField),
        hasPasswordField: true,
        formSignature: formSignature(form, passwordField, usernameField),
      },
    });

    if (!response?.ok || !response.credential?.password) {
      showStatus(statusMessage(response, 'AegisVault unavailable'));
      return;
    }

    if (usernameField && response.credential.username) {
      dispatchInput(usernameField, response.credential.username);
    }
    dispatchInput(passwordField, response.credential.password);
  }

  function showStatus(message) {
    removePrompt();
    const prompt = document.createElement('div');
    prompt.id = PROMPT_ID;
    prompt.textContent = message;
    document.documentElement.appendChild(prompt);
    activePrompt = prompt;
    window.setTimeout(removePrompt, 3000);
  }

  function clearPendingSave() {
    pendingSave = null;
    if (pendingSaveTimer) window.clearTimeout(pendingSaveTimer);
    pendingSaveTimer = null;
  }

  function stageSavePrompt(passwordField) {
    const password = passwordField.value;
    if (!password) return;

    const form = passwordField.form;
    const usernameField = findUsernameField(form, passwordField);
    pendingSave = {
      origin: location.origin,
      url: location.href,
      username: usernameField?.value || '',
      password,
      formSignature: formSignature(form, passwordField, usernameField),
    };

    if (pendingSaveTimer) window.clearTimeout(pendingSaveTimer);
    pendingSaveTimer = window.setTimeout(clearPendingSave, 60_000);
    showSavePrompt();
  }

  function showSavePrompt() {
    removePrompt();
    if (!pendingSave) return;

    const prompt = document.createElement('div');
    prompt.id = PROMPT_ID;

    const label = document.createElement('span');
    label.textContent = `Save password for ${location.hostname}?`;
    prompt.appendChild(label);

    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Save';
    save.addEventListener('click', async () => {
      const payload = pendingSave;
      clearPendingSave();
      removePrompt();
      const response = await sendRuntimeMessage({
        channel: 'aegisvault-autofill',
        action: 'save',
        payload,
      });
      showStatus(response?.ok ? 'Open AegisVault to confirm save.' : statusMessage(response, 'Save failed'));
    });
    prompt.appendChild(save);

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', () => {
      clearPendingSave();
      removePrompt();
    });
    prompt.appendChild(dismiss);

    document.documentElement.appendChild(prompt);
    activePrompt = prompt;
  }

  function bindForm(form) {
    if (form.dataset.aegisvaultAutofillBound === 'true') return;
    form.dataset.aegisvaultAutofillBound = 'true';
    form.addEventListener('submit', () => {
      const passwordField = findPasswordField(form);
      if (passwordField) stageSavePrompt(passwordField);
    }, true);
  }

  function scan() {
    for (const passwordField of document.querySelectorAll(FIELD_SELECTOR)) {
      if (!isVisibleInput(passwordField)) continue;
      showInlineButton(passwordField);
      if (passwordField.form) bindForm(passwordField.form);
      passwordField.addEventListener('blur', () => {
        if (passwordField.value) stageSavePrompt(passwordField);
      }, { once: false });
    }
  }

  scan();
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();

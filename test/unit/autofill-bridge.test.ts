import { describe, expect, it } from 'vitest';
import {
  createAndroidAutofillMatchRequest,
  createDesktopAutofillMatchRequest,
} from '../../src/lib/autofillBridge';

describe('autofillBridge', () => {
  it('converts Android native autofill context into a matcher request', () => {
    expect(createAndroidAutofillMatchRequest({
      platform: 'android',
      webDomain: ' login.example.com ',
      packageName: ' com.android.chrome ',
      formHints: [' username ', '', 'password'],
      hasUsernameField: true,
      hasPasswordField: true,
    })).toEqual({
      platform: 'android',
      webDomain: 'login.example.com',
      origin: 'login.example.com',
      packageName: 'com.android.chrome',
      formHints: ['username', 'password'],
    });
  });

  it('rejects Android contexts without credential fields or app/web identity', () => {
    expect(createAndroidAutofillMatchRequest({
      platform: 'android',
      webDomain: 'example.com',
      hasUsernameField: false,
      hasPasswordField: false,
    })).toBeNull();

    expect(createAndroidAutofillMatchRequest({
      platform: 'android',
      hasUsernameField: true,
      hasPasswordField: false,
    })).toBeNull();
  });

  it('creates desktop matcher requests from quick-fill queries', () => {
    expect(createDesktopAutofillMatchRequest(' https://example.com/login ')).toEqual({
      platform: 'desktop',
      origin: 'https://example.com/login',
      formHints: ['username', 'password'],
    });
    expect(createDesktopAutofillMatchRequest('')).toBeNull();
  });
});

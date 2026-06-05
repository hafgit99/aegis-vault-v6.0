export const MASTER_PASSWORD_MIN_LENGTH = 12;

export type PasswordPolicyFailure =
  | 'minLength'
  | 'uppercase'
  | 'lowercase'
  | 'number'
  | 'symbol';

export interface PasswordPolicyResult {
  valid: boolean;
  failures: PasswordPolicyFailure[];
}

export function validateMasterPasswordPolicy(password: string): PasswordPolicyResult {
  const failures: PasswordPolicyFailure[] = [];

  if (password.length < MASTER_PASSWORD_MIN_LENGTH) failures.push('minLength');
  if (!/[A-Z]/.test(password)) failures.push('uppercase');
  if (!/[a-z]/.test(password)) failures.push('lowercase');
  if (!/[0-9]/.test(password)) failures.push('number');
  if (!/[^A-Za-z0-9]/.test(password)) failures.push('symbol');

  return {
    valid: failures.length === 0,
    failures,
  };
}

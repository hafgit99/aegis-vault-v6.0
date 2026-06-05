import {
  assessTurkishPasswordPatterns,
  getTurkishPasswordUserInputs,
} from './passwordLocaleDictionaries';

export type PasswordStrengthLabel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrengthAnalysis {
  score: number;
  zxcvbnScore: number;
  label: PasswordStrengthLabel;
  length: number;
  guessesLog10: number;
  warning?: string;
  suggestions: string[];
}

export interface MasterPasswordAuditMetadata {
  score: number;
  zxcvbnScore: number;
  label: PasswordStrengthLabel;
  length: number;
  updatedAt: string;
}

export const MASTER_PASSWORD_AUDIT_KEY = 'aegis_master_password_audit';

function scorePasswordFallback(password: string): PasswordStrengthAnalysis {
  if (!password) {
    return {
      score: 0,
      zxcvbnScore: 0,
      label: 'empty',
      length: 0,
      guessesLog10: 0,
      suggestions: [],
    };
  }

  let score = 0;
  if (password.length >= 12) score += 25;
  if (password.length >= 16) score += 20;
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;
  if (!/(.)\1{2,}/.test(password)) score += 10;
  const normalized = Math.min(100, score);
  const zxcvbnScore = normalized >= 90 ? 4 : normalized >= 75 ? 3 : normalized >= 50 ? 2 : normalized >= 25 ? 1 : 0;
  const label: PasswordStrengthLabel =
    zxcvbnScore >= 4 ? 'strong' :
    zxcvbnScore === 3 ? 'good' :
    zxcvbnScore === 2 ? 'fair' :
    'weak';

  return {
    score: normalized,
    zxcvbnScore,
    label,
    length: password.length,
    guessesLog10: 0,
    suggestions: [],
  };
}

export function analyzePasswordStrength(password: string): PasswordStrengthAnalysis {
  return scorePasswordFallback(password);
}

export async function analyzePasswordStrengthWithZxcvbn(password: string): Promise<PasswordStrengthAnalysis> {
  if (!password) {
    return scorePasswordFallback(password);
  }

  const zxcvbnModule = await import('zxcvbn');
  const zxcvbn = (zxcvbnModule.default || zxcvbnModule) as unknown as (password: string, userInputs?: string[]) => {
    score: number;
    guesses_log10: number;
    feedback?: { warning?: string; suggestions?: string[] };
  };
  const localeAssessment = assessTurkishPasswordPatterns(password);
  const result = zxcvbn(password, getTurkishPasswordUserInputs(password));
  const rawZxcvbnScore = Math.max(0, Math.min(4, result.score));
  const zxcvbnScore = localeAssessment.maxZxcvbnScore === undefined
    ? rawZxcvbnScore
    : Math.min(rawZxcvbnScore, localeAssessment.maxZxcvbnScore);
  const score = Math.min(100, Math.round((zxcvbnScore / 4) * 100));
  const label: PasswordStrengthLabel =
    zxcvbnScore >= 4 ? 'strong' :
    zxcvbnScore === 3 ? 'good' :
    zxcvbnScore === 2 ? 'fair' :
    'weak';

  return {
    score,
    zxcvbnScore,
    label,
    length: password.length,
    guessesLog10: Number(result.guesses_log10 || 0),
    warning: result.feedback?.warning || undefined,
    suggestions: Array.from(new Set([
      ...localeAssessment.suggestions,
      ...(result.feedback?.suggestions || []),
    ])),
  };
}

export async function persistMasterPasswordAudit(password: string): Promise<MasterPasswordAuditMetadata> {
  const analysis = await analyzePasswordStrengthWithZxcvbn(password);
  const metadata: MasterPasswordAuditMetadata = {
    score: analysis.score,
    zxcvbnScore: analysis.zxcvbnScore,
    label: analysis.label,
    length: analysis.length,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(MASTER_PASSWORD_AUDIT_KEY, JSON.stringify(metadata));
  return metadata;
}

export function readMasterPasswordAudit(): MasterPasswordAuditMetadata | null {
  try {
    const raw = localStorage.getItem(MASTER_PASSWORD_AUDIT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MasterPasswordAuditMetadata>;
    if (typeof parsed.score !== 'number' || typeof parsed.length !== 'number') return null;
    return {
      score: parsed.score,
      zxcvbnScore: Number(parsed.zxcvbnScore || 0),
      label: parsed.label || 'weak',
      length: parsed.length,
      updatedAt: parsed.updatedAt || new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

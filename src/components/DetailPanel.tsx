import { useState, useEffect, useRef, ChangeEvent, ReactNode } from 'react';
import { 
  X, ShieldCheck, Key, Globe, Eye, EyeOff, 
  CreditCard, FileText, Calendar, Lock, Check, Copy, Trash2, Shield, Edit3, Save, Sparkles,
  Paperclip, Download, Upload, AlertCircle, RefreshCw, Fingerprint, IdCard, ChevronRight, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { VaultEntry, AttachmentFile } from '../types';
import { getEncryptedFile, saveEncryptedFile } from '../lib/fileStore';
import { VaultCryptoService } from '../lib/vault/VaultCryptoService';
import { generateRandomString } from '../lib/crypto-types';
import { writeClipboardSecret } from '../lib/clipboard';
import { authenticatePasskey, registerPasskey } from '../lib/webauthnPasskey';
import { generateTOTP, generateTotpSecret, getTotpRemainingSeconds, TotpAlgorithm } from '../lib/totp';
import { createSecureShareBundle } from '../lib/secureShareBundle';

interface DetailPanelProps {
  entry: VaultEntry | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdate?: (updatedEntry: VaultEntry) => void;
}

export default function DetailPanel({ entry, onClose, onDelete, onUpdate }: DetailPanelProps) {
  const { t, i18n } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePassword, setSharePassword] = useState('');
  const [shareConfirmPassword, setShareConfirmPassword] = useState('');
  const [shareExpiryDays, setShareExpiryDays] = useState<'1' | '7' | '30' | 'never'>('7');
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Edit states
  const [editTitle, setEditTitle] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editTotpSecret, setEditTotpSecret] = useState('');
  const [editTotpIssuer, setEditTotpIssuer] = useState('');
  const [editTotpAlgorithm, setEditTotpAlgorithm] = useState<TotpAlgorithm>('SHA-1');
  const [editTotpDigits, setEditTotpDigits] = useState(6);
  const [editTotpPeriod, setEditTotpPeriod] = useState(30);
  const [totpCode, setTotpCode] = useState('');
  const [totpRemaining, setTotpRemaining] = useState(30);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [editCardholder, setEditCardholder] = useState('');
  const [editCardNumber, setEditCardNumber] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editCvv, setEditCvv] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Passkey
  const [editPasskeyDomain, setEditPasskeyDomain] = useState('');
  const [editPasskeyUser, setEditPasskeyUser] = useState('');
  const [editPasskeyCredentialId, setEditPasskeyCredentialId] = useState('');
  const [editPasskeyPublicKey, setEditPasskeyPublicKey] = useState('');
  const [editPasskeyAAGUID, setEditPasskeyAAGUID] = useState('');
  const [editPasskeyPublicKeyAlgorithm, setEditPasskeyPublicKeyAlgorithm] = useState<number | undefined>(undefined);
  const [editPasskeyAuthenticatorData, setEditPasskeyAuthenticatorData] = useState('');
  const [editPasskeyClientDataJSON, setEditPasskeyClientDataJSON] = useState('');
  const [editPasskeyTransports, setEditPasskeyTransports] = useState<string[]>([]);
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);
  const [isVerifyingPasskey, setIsVerifyingPasskey] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);

  // Identity
  const [editIdFullName, setEditIdFullName] = useState('');
  const [editIdNumber, setEditIdNumber] = useState('');
  const [editIdSerial, setEditIdSerial] = useState('');
  const [editIdExpiry, setEditIdExpiry] = useState('');
  const [editIdNationality, setEditIdNationality] = useState('');
  const [editIdGender, setEditIdGender] = useState('');
  const [editIdBirthDate, setEditIdBirthDate] = useState('');

  // File Attachment
  const [attachment, setAttachment] = useState<AttachmentFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (entry) {
      setEditTitle(entry.title || '');
      setEditUsername(entry.username || '');
      setEditPassword(entry.password || '');
      setEditUrl(entry.url || '');
      setEditTotpSecret(entry.totpSecret || '');
      setEditTotpIssuer(entry.totpIssuer || '');
      setEditTotpAlgorithm(entry.totpAlgorithm || 'SHA-1');
      setEditTotpDigits(entry.totpDigits || 6);
      setEditTotpPeriod(entry.totpPeriod || 30);
      setEditCardholder(entry.cardholder || '');
      setEditCardNumber(entry.cardNumber || '');
      setEditExpiryDate(entry.expiryDate || '');
      setEditCvv(entry.cvv || '');
      setEditNotes(entry.notes || '');
      setAttachment(entry.attachment || null);

      setEditPasskeyDomain(entry.passkeyDomain || '');
      setEditPasskeyUser(entry.passkeyUser || '');
      setEditPasskeyCredentialId(entry.passkeyCredentialId || '');
      setEditPasskeyPublicKey(entry.passkeyPublicKey || '');
      setEditPasskeyAAGUID(entry.passkeyAAGUID || '');
      setEditPasskeyPublicKeyAlgorithm(entry.passkeyPublicKeyAlgorithm);
      setEditPasskeyAuthenticatorData(entry.passkeyAuthenticatorData || '');
      setEditPasskeyClientDataJSON(entry.passkeyClientDataJSON || '');
      setEditPasskeyTransports(entry.passkeyTransports || []);
      setPasskeyMessage(null);

      setEditIdFullName(entry.idFullName || '');
      setEditIdNumber(entry.idNumber || '');
      setEditIdSerial(entry.idSerial || '');
      setEditIdExpiry(entry.idExpiry || '');
      setEditIdNationality(entry.idNationality || t('app.detail.fields.defaultNationality'));
      setEditIdGender(normalizeGender(entry.idGender));
      setEditIdBirthDate(entry.idBirthDate || '');
    }
    setIsEditing(false);
    setShowPassword(false);
    setFileError(null);
    setIsUploading(false);
    setUploadProgress(0);
    setIsDownloading(false);
  }, [entry]);

  useEffect(() => {
    if (!entry?.totpSecret) {
      setTotpCode('');
      setTotpError(null);
      return;
    }

    let cancelled = false;
    const refreshTotp = async () => {
      try {
        const code = await generateTOTP({
          secret: entry.totpSecret || '',
          algorithm: entry.totpAlgorithm || 'SHA-1',
          digits: entry.totpDigits || 6,
          period: entry.totpPeriod || 30,
        });
        if (!cancelled) {
          setTotpCode(code);
          setTotpRemaining(getTotpRemainingSeconds(entry.totpPeriod || 30));
          setTotpError(null);
        }
      } catch (error: any) {
        if (!cancelled) {
          setTotpCode('');
          setTotpError(error?.message || t('app.detail.fields.totpInvalid'));
        }
      }
    };

    refreshTotp();
    const interval = window.setInterval(refreshTotp, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [entry?.totpSecret, entry?.totpAlgorithm, entry?.totpDigits, entry?.totpPeriod]);

  if (!entry) return null;

  const handleCopy = (text: string, fieldName: string) => {
    writeClipboardSecret(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const resetShareState = () => {
    setShowShareModal(false);
    setSharePassword('');
    setShareConfirmPassword('');
    setShareExpiryDays('7');
    setShareError(null);
    setIsSharing(false);
  };

  const handleCreateSecureShare = async () => {
    const password = sharePassword.trim();
    const confirmPassword = shareConfirmPassword.trim();
    if (!password || password.length < 4) {
      setShareError(t('app.detail.secureShare.passwordRequired'));
      return;
    }
    if (password !== confirmPassword) {
      setShareError(t('app.detail.secureShare.passwordMismatch'));
      return;
    }

    setIsSharing(true);
    setShareError(null);
    try {
      const expiresAt = shareExpiryDays === 'never'
        ? undefined
        : new Date(Date.now() + Number(shareExpiryDays) * 24 * 60 * 60 * 1000).toISOString();
      const bundle = await createSecureShareBundle([entry], password, expiresAt);
      const fileData = JSON.stringify(bundle, null, 2);
      const blob = new Blob([fileData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeTitle = (entry.title || 'record').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'record';
      link.href = url;
      link.download = `AegisVault_Secure_Share_${safeTitle}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      resetShareState();
    } catch (error: any) {
      setShareError(error?.message || t('app.detail.secureShare.failed'));
      setIsSharing(false);
    }
  };

  const normalizeGender = (value?: string) => {
    if (value === 'Erkek' || value === 'male') return 'male';
    if (value === 'Kad\u0131n' || value === 'female') return 'female';
    return 'other';
  };

  const getGenderLabel = (value?: string) => {
    const normalized = normalizeGender(value);
    if (normalized === 'male') return t('app.detail.fields.male');
    if (normalized === 'female') return t('app.detail.fields.female');
    return t('app.detail.fields.other');
  };

  const triggerInlineGenerate = () => {
    const gen = VaultCryptoService.generateSecurePassword();
    setEditPassword(gen);
  };

  const getPasswordStrength = (pass: string): 'EXCELLENT' | 'GOOD' | 'IMMUTABLE' => {
    if (pass.length > 16) return 'IMMUTABLE';
    if (pass.length > 12) return 'EXCELLENT';
    return 'GOOD';
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    const MAX_SIZE = 200 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setFileError(t('app.detail.fileErrors.tooLarge'));
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const interval = setInterval(() => {
        setUploadProgress(p => {
          if (p >= 90) { clearInterval(interval); return 90; }
          return p + 15;
        });
      }, 150);

      const fileId = `file-${generateRandomString(18, 'abcdefghijklmnopqrstuvwxyz0123456789')}`;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const encryptedBlob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
          await saveEncryptedFile(fileId, encryptedBlob);
          clearInterval(interval);
          setUploadProgress(100);
          setAttachment({ id: fileId, name: file.name, size: file.size, type: file.type || 'application/octet-stream' });
          setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 400);
        } catch (err) {
          clearInterval(interval);
          setFileError(t('app.detail.fileErrors.saveFailed'));
          setIsUploading(false);
        }
      };
      reader.onerror = () => { clearInterval(interval); setFileError(t('app.detail.fileErrors.readFailed')); setIsUploading(false); };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      setFileError(t('app.detail.fileErrors.uploadFailed'));
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = () => { setAttachment(null); setFileError(null); };

  const handleDownload = async () => {
    if (!attachment) return;
    setIsDownloading(true);
    try {
      const blob = await getEncryptedFile(attachment.id);
      if (!blob) { alert(t('app.detail.encryptedFileMissing')); setIsDownloading(false); return; }
      const downloadBlob = new Blob([blob], { type: attachment.type });
      const url = URL.createObjectURL(downloadBlob);
      const a = document.createElement('a');
      a.href = url; a.download = attachment.name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) { alert(t('app.detail.decryptFailed')); }
    finally { setIsDownloading(false); }
  };

  const handleSave = () => {
    if (!editTitle.trim() || !onUpdate) return;
    const strength = entry.type === 'passkey' ? 'IMMUTABLE' : entry.type === 'identity' ? 'IMMUTABLE' : getPasswordStrength(editPassword);
    const themeColor = strength === 'IMMUTABLE' ? 'tertiary' : strength === 'EXCELLENT' ? 'tertiary' : 'secondary';
    const updated: VaultEntry = {
      ...entry,
      title: editTitle,
      username: entry.type === 'login' ? editUsername : entry.type === 'passkey' ? editPasskeyUser : editIdFullName,
      password: entry.type === 'login' ? editPassword : undefined,
      url: entry.type === 'login' ? editUrl : undefined,
      totpSecret: entry.type === 'login' && editTotpSecret ? editTotpSecret : undefined,
      totpIssuer: entry.type === 'login' && editTotpSecret ? (editTotpIssuer || editTitle) : undefined,
      totpAlgorithm: entry.type === 'login' && editTotpSecret ? editTotpAlgorithm : undefined,
      totpDigits: entry.type === 'login' && editTotpSecret ? editTotpDigits : undefined,
      totpPeriod: entry.type === 'login' && editTotpSecret ? editTotpPeriod : undefined,
      cardholder: entry.type === 'card' ? editCardholder : undefined,
      cardNumber: entry.type === 'card' ? editCardNumber : undefined,
      expiryDate: entry.type === 'card' ? editExpiryDate : undefined,
      cvv: entry.type === 'card' ? editCvv : undefined,
      passkeyDomain: entry.type === 'passkey' ? editPasskeyDomain : undefined,
      passkeyUser: entry.type === 'passkey' ? editPasskeyUser : undefined,
      passkeyCredentialId: entry.type === 'passkey' ? editPasskeyCredentialId : undefined,
      passkeyPublicKey: entry.type === 'passkey' ? editPasskeyPublicKey : undefined,
      passkeyAAGUID: entry.type === 'passkey' ? editPasskeyAAGUID : undefined,
      passkeyPublicKeyAlgorithm: entry.type === 'passkey' ? editPasskeyPublicKeyAlgorithm : undefined,
      passkeyAuthenticatorData: entry.type === 'passkey' ? editPasskeyAuthenticatorData : undefined,
      passkeyClientDataJSON: entry.type === 'passkey' ? editPasskeyClientDataJSON : undefined,
      passkeyTransports: entry.type === 'passkey' ? editPasskeyTransports : undefined,
      idFullName: entry.type === 'identity' ? editIdFullName : undefined,
      idNumber: entry.type === 'identity' ? editIdNumber : undefined,
      idSerial: entry.type === 'identity' ? editIdSerial : undefined,
      idExpiry: entry.type === 'identity' ? editIdExpiry : undefined,
      idNationality: entry.type === 'identity' ? editIdNationality : undefined,
      idGender: entry.type === 'identity' ? editIdGender : undefined,
      idBirthDate: entry.type === 'identity' ? editIdBirthDate : undefined,
      notes: editNotes,
      strength,
      themeColor,
      subtitle: entry.type === 'login' 
        ? editUsername 
        : entry.type === 'card' 
        ? '•••• •••• •••• ' + editCardNumber.slice(-4) 
        : entry.type === 'passkey'
        ? t('app.addEntry.subtitle.passkey', { domain: editPasskeyDomain || 'WebAuthn' })
        : entry.type === 'identity'
        ? t('app.addEntry.subtitle.identity', { name: editIdFullName || editIdNumber || t('app.addEntry.subtitle.identityFallback') })
        : t('app.addEntry.subtitle.secureNote'),
      attachment: attachment || undefined
    };
    onUpdate(updated);
    setIsEditing(false);
  };

  const handleRegisterEditPasskey = async () => {
    setPasskeyMessage(null);
    setIsRegisteringPasskey(true);
    try {
      const credential = await registerPasskey(editPasskeyDomain, editPasskeyUser);
      setEditPasskeyCredentialId(credential.credentialId);
      setEditPasskeyPublicKey(credential.publicKey);
      setEditPasskeyAAGUID(credential.aaguid || 'authenticator-managed');
      setEditPasskeyPublicKeyAlgorithm(credential.publicKeyAlgorithm);
      setEditPasskeyAuthenticatorData(credential.authenticatorData || '');
      setEditPasskeyClientDataJSON(credential.clientDataJSON);
      setEditPasskeyTransports(credential.transports || []);
      setPasskeyMessage(t('app.detail.fields.passkeyRegistered'));
    } catch (error: any) {
      setPasskeyMessage(error?.message || t('app.detail.fields.passkeyRegistrationFailed'));
    } finally {
      setIsRegisteringPasskey(false);
    }
  };

  const handleVerifyPasskey = async () => {
    if (!entry.passkeyCredentialId) return;
    setPasskeyMessage(null);
    setIsVerifyingPasskey(true);
    try {
      await authenticatePasskey(entry.passkeyCredentialId);
      setPasskeyMessage(t('app.detail.fields.passkeyVerified'));
    } catch (error: any) {
      setPasskeyMessage(error?.message || t('app.detail.fields.passkeyVerificationFailed'));
    } finally {
      setIsVerifyingPasskey(false);
    }
  };

  const typeLabel = entry.type === 'login' ? t('app.detail.types.login') : entry.type === 'card' ? t('app.detail.types.card') : entry.type === 'passkey' ? t('app.detail.types.passkey') : entry.type === 'identity' ? t('app.detail.types.identity') : t('app.detail.types.note');
  const strengthLabel = entry.strength === 'IMMUTABLE' ? t('app.detail.strength.immutable') : entry.strength === 'EXCELLENT' ? t('app.detail.strength.excellent') : t('app.detail.strength.good');
  const typeIcon = entry.type === 'login' ? <Key className="w-6 h-6" /> : entry.type === 'card' ? <CreditCard className="w-6 h-6" /> : entry.type === 'passkey' ? <Fingerprint className="w-6 h-6" /> : entry.type === 'identity' ? <IdCard className="w-6 h-6" /> : <FileText className="w-6 h-6" />;
  const typeColorClass = entry.type === 'login' ? 'bg-tertiary/10 border-tertiary/25 text-tertiary' : entry.type === 'card' ? 'bg-secondary/10 border-secondary/25 text-secondary' : 'bg-primary/10 border-primary/25 text-primary';

  // Field row helper component
  const FieldRow = ({ label, value, fieldKey, isPassword = false, children }: { label: string; value?: string; fieldKey: string; isPassword?: boolean; children?: ReactNode }) => (
    <div className="bg-surface-container-high/40 border border-white/5 p-4 rounded-xl flex items-center justify-between group hover:border-white/10 transition-colors">
      <div className="min-w-0 pr-4 flex-1">
        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{label}</span>
        {children || (
          <span className={`text-[15px] text-on-surface font-semibold truncate block select-all ${isPassword ? 'font-geist-mono' : ''}`}>
            {isPassword ? (showPassword ? value : '••••••••••••••••') : (value || t('app.detail.notSpecified'))}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isPassword && (
          <button
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? t('app.detail.fields.hidePassword') : t('app.detail.fields.showPassword')}
            className="p-2 hover:bg-white/5 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
        {value && (
          <button
            onClick={() => handleCopy(value, fieldKey)}
            aria-label={t('app.generator.copy')}
            className="p-2 hover:bg-white/5 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            {copiedField === fieldKey ? <Check className="w-4 h-4 text-tertiary" /> : <Copy className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
      className="relative h-full flex flex-col bg-surface-container-lowest border-l border-outline-variant/20"
    >
      {/* Panel Header */}
      <div className="p-6 border-b border-white/5 bg-surface-container/30 shrink-0">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className={`p-3 rounded-xl border shrink-0 ${typeColorClass}`}>
              {typeIcon}
            </div>
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="font-outfit text-xl font-bold text-on-surface bg-white/5 border border-white/10 rounded px-3 py-1 outline-none focus:border-tertiary/40 w-full"
                  placeholder={t('app.detail.titlePlaceholder')}
                />
              ) : (
                <h3 className="font-outfit text-xl font-bold text-on-surface truncate">{entry.title}</h3>
              )}
              <span className="text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-widest block mt-1">
                {typeLabel}
              </span>
            </div>
          </div>
          {/* Favorite Toggle Button */}
          {onUpdate && (
            <button 
              onClick={() => {
                onUpdate({ ...entry, favorite: !entry.favorite });
              }}
              aria-label={entry.favorite ? t('app.detail.removeFavorite') : t('app.detail.addFavorite')}
              className={`p-2 hover:bg-white/5 rounded-lg transition-all active:scale-[0.85] cursor-pointer shrink-0 ml-2 ${
                entry.favorite 
                  ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]' 
                  : 'text-on-surface-variant/40 hover:text-yellow-400/80'
              }`}
              title={entry.favorite ? t('app.detail.removeFavorite') : t('app.detail.addFavorite')}
            >
              <Star className={`w-5 h-5 ${entry.favorite ? 'fill-yellow-400' : ''}`} />
            </button>
          )}

          <button 
            onClick={onClose} 
            aria-label={t('app.profile.close')}
            className="p-2 hover:bg-white/5 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Buttons in Header */}
        {!isEditing && (
          <div className="flex gap-2">
            {onUpdate && (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex-1 py-2.5 px-4 bg-secondary/10 border border-secondary/20 hover:bg-secondary/20 text-secondary rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm cursor-pointer select-none"
              >
                <Edit3 className="w-4 h-4" />
                {t('app.detail.edit')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="flex-1 py-2.5 px-4 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm cursor-pointer select-none"
            >
              <Download className="w-4 h-4" />
              {t('app.detail.secureShare.action')}
            </button>
            <button 
              onClick={() => {
                if (confirm(t('app.detail.moveToTrashConfirm', { title: entry.title }))) {
                  onDelete(entry.id);
                  onClose();
                }
              }}
              className="flex-1 py-2.5 px-4 bg-error-container/20 hover:bg-error-container/40 border border-error/15 text-error rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm cursor-pointer select-none"
            >
              <Trash2 className="w-4 h-4" />
              {t('app.detail.moveToTrash')}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showShareModal && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface-container-high shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-on-surface font-outfit">{t('app.detail.secureShare.title')}</h4>
                  <p className="text-[11px] text-on-surface-variant/75 leading-relaxed mt-1">
                    {t('app.detail.secureShare.description', { title: entry.title })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetShareState}
                  aria-label={t('app.profile.close')}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t('app.detail.secureShare.password')}</label>
                  <input
                    type="password"
                    value={sharePassword}
                    onChange={(event) => setSharePassword(event.target.value)}
                    placeholder={t('app.detail.secureShare.placeholder')}
                    className="w-full bg-surface-container-highest/70 border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2.5 text-xs outline-none text-on-surface"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t('app.detail.secureShare.confirmPassword')}</label>
                  <input
                    type="password"
                    value={shareConfirmPassword}
                    onChange={(event) => setShareConfirmPassword(event.target.value)}
                    placeholder={t('app.detail.secureShare.confirmPlaceholder')}
                    className="w-full bg-surface-container-highest/70 border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2.5 text-xs outline-none text-on-surface"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t('app.detail.secureShare.expires')}</label>
                  <select
                    value={shareExpiryDays}
                    onChange={(event) => setShareExpiryDays(event.target.value as typeof shareExpiryDays)}
                    className="w-full bg-surface-container-highest/70 border border-white/10 focus:border-primary/40 rounded-xl px-3 py-2.5 text-xs outline-none text-on-surface"
                  >
                    <option value="1">{t('app.detail.secureShare.expireOneDay')}</option>
                    <option value="7">{t('app.detail.secureShare.expireSevenDays')}</option>
                    <option value="30">{t('app.detail.secureShare.expireThirtyDays')}</option>
                    <option value="never">{t('app.detail.secureShare.expireNever')}</option>
                  </select>
                  <p className="text-[10px] text-on-surface-variant/60">{t('app.detail.secureShare.expiresHint')}</p>
                </div>
              </div>

              {shareError && (
                <div className="rounded-xl border border-error/20 bg-error/10 p-3 text-[11px] text-error">
                  {shareError}
                </div>
              )}

              <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-[11px] leading-relaxed text-on-surface-variant/80">
                {t('app.detail.secureShare.warning')}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetShareState}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                >
                  {t('app.detail.cancel')}
                </button>
                <button
                  type="button"
                  disabled={isSharing}
                  onClick={handleCreateSecureShare}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-[#02050A] text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isSharing ? t('app.detail.secureShare.creating') : t('app.detail.secureShare.create')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto vault-scroll p-6 space-y-4">
        
        {/* ===== LOGIN ===== */}
        {entry.type === 'login' && !isEditing && (
          <div className="space-y-3">
            <FieldRow label={t('app.detail.fields.username')} value={entry.username} fieldKey="username" />
            <FieldRow label={t('app.detail.fields.password')} value={entry.password} fieldKey="password" isPassword />
            <FieldRow label={t('app.detail.fields.website')} value={entry.url} fieldKey="url">
              {entry.url ? (
                <a href={entry.url} target="_blank" rel="noreferrer" className="text-sm text-secondary hover:underline font-semibold flex items-center gap-1.5 truncate">
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  {entry.url}
                </a>
              ) : (
                <span className="text-sm text-on-surface-variant/40 italic">{t('app.detail.fields.processAddressMissing')}</span>
              )}
            </FieldRow>
            {entry.totpSecret && (
              <div className="bg-surface-container-high/40 border border-tertiary/20 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.totpCode')}</span>
                  {totpError ? (
                    <span className="text-xs text-error">{totpError}</span>
                  ) : (
                    <span className="text-2xl font-geist-mono font-bold text-tertiary tracking-[0.25em]">{totpCode}</span>
                  )}
                  <span className="text-[10px] text-on-surface-variant/60 block mt-1">
                    {entry.totpIssuer || entry.title} · {totpRemaining}s
                  </span>
                </div>
                {totpCode && (
                  <button
                    onClick={() => handleCopy(totpCode, 'totp')}
                    aria-label={t('app.generator.copy')}
                    className="p-2 hover:bg-white/5 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  >
                    {copiedField === 'totp' ? <Check className="w-4 h-4 text-tertiary" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {entry.type === 'login' && isEditing && (
          <div className="space-y-3">
            <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.username')}</span>
              <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-on-surface outline-none focus:border-tertiary/45 font-semibold" placeholder={t('app.detail.fields.usernamePlaceholder')} />
            </div>
            <div className="bg-surface-container-high/40 border border-white/5 p-4 rounded-xl">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.password')}</span>
              <div className="relative w-full flex items-center gap-2">
                <input type={showPassword ? "text" : "password"} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded pl-3 pr-3 py-2 text-[15px] text-on-surface font-geist-mono outline-none focus:border-tertiary/45 font-semibold" placeholder={t('app.detail.fields.passwordPlaceholder')} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-2 hover:bg-white/5 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0" title={showPassword ? t('app.detail.fields.hidePassword') : t('app.detail.fields.showPassword')}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button type="button" onClick={triggerInlineGenerate} className="p-2 hover:bg-tertiary/10 rounded-lg text-tertiary hover:scale-110 transition-all cursor-pointer shrink-0" title={t('app.detail.fields.generatePassword')}>
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.website')}</span>
              <input type="url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-on-surface outline-none focus:border-tertiary/45 font-semibold" placeholder="https://example.com" />
            </div>
            <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('app.detail.fields.totpSecret')}</span>
                <button type="button" onClick={() => setEditTotpSecret(generateTotpSecret())} className="py-1 px-2 bg-tertiary/15 hover:bg-tertiary/25 text-tertiary text-[10px] font-bold rounded-lg border border-tertiary/10 flex items-center gap-1 transition-all cursor-pointer">
                  <Sparkles className="w-3 h-3" /> {t('app.detail.fields.generateTotpSecret')}
                </button>
              </div>
              <input type="text" value={editTotpSecret} onChange={(e) => setEditTotpSecret(e.target.value.toUpperCase())} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs text-on-surface font-geist-mono outline-none focus:border-tertiary/45" placeholder={t('app.detail.fields.totpSecretPlaceholder')} />
              {editTotpSecret && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <input type="text" value={editTotpIssuer} onChange={(e) => setEditTotpIssuer(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-on-surface outline-none focus:border-tertiary/45" placeholder={t('app.detail.fields.totpIssuerPlaceholder')} />
                  <select value={editTotpAlgorithm} onChange={(e) => setEditTotpAlgorithm(e.target.value as TotpAlgorithm)} className="bg-[#121625] border border-white/10 rounded px-2 py-1 text-xs text-on-surface outline-none focus:border-tertiary/45">
                    <option value="SHA-1">SHA-1</option>
                    <option value="SHA-256">SHA-256</option>
                    <option value="SHA-512">SHA-512</option>
                  </select>
                  <select value={editTotpDigits} onChange={(e) => setEditTotpDigits(Number(e.target.value))} className="bg-[#121625] border border-white/10 rounded px-2 py-1 text-xs text-on-surface outline-none focus:border-tertiary/45">
                    <option value={6}>6 digits</option>
                    <option value={8}>8 digits</option>
                  </select>
                  <select value={editTotpPeriod} onChange={(e) => setEditTotpPeriod(Number(e.target.value))} className="bg-[#121625] border border-white/10 rounded px-2 py-1 text-xs text-on-surface outline-none focus:border-tertiary/45">
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== CARD ===== */}
        {entry.type === 'card' && !isEditing && (
          <div className="space-y-3">
            <FieldRow label={t('app.detail.fields.cardholder')} value={entry.cardholder} fieldKey="cardholder" />
            <FieldRow label={t('app.detail.fields.cardNumber')} value={entry.cardNumber} fieldKey="cardnum" />
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label={t('app.detail.fields.expiryShort')} value={entry.expiryDate} fieldKey="expiry" />
              <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl flex items-center justify-between group hover:border-white/10 transition-colors">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">CVC / CVV</span>
                  <span className="text-sm text-on-surface font-semibold font-geist-mono block">{showPassword ? entry.cvv : '•••'}</span>
                </div>
                <button onClick={() => setShowPassword(!showPassword)} className="p-1.5 hover:bg-white/5 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {entry.type === 'card' && isEditing && (
          <div className="space-y-3">
            <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.cardholder')}</span>
              <input type="text" value={editCardholder} onChange={(e) => setEditCardholder(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-on-surface uppercase outline-none focus:border-tertiary/45 font-semibold" placeholder={t('app.detail.fields.cardholderName')} />
            </div>
            <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.cardNumber')}</span>
              <input type="text" value={editCardNumber} onChange={(e) => setEditCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())} maxLength={19} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-on-surface outline-none focus:border-tertiary/45 font-semibold font-geist-mono" placeholder="0000 0000 0000 0000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.expiryShort')}</span>
                <input type="text" value={editExpiryDate} onChange={(e) => setEditExpiryDate(e.target.value)} maxLength={5} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-center text-sm text-on-surface outline-none focus:border-tertiary/45 font-semibold font-geist-mono" placeholder="AA/YY" />
              </div>
              <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">CVC / CVV</span>
                <input type="password" value={editCvv} onChange={(e) => setEditCvv(e.target.value)} maxLength={4} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-center text-sm text-on-surface outline-none focus:border-tertiary/45 font-semibold font-geist-mono" placeholder="***" />
              </div>
            </div>
          </div>
        )}

        {/* ===== PASSKEY ===== */}
        {entry.type === 'passkey' && !isEditing && (
          <div className="space-y-3">
            <FieldRow label={t('app.detail.fields.passkeyDomain')} value={entry.passkeyDomain} fieldKey="passkeyDomain" />
            <FieldRow label={t('app.detail.fields.usernameOrEmail')} value={entry.passkeyUser} fieldKey="passkeyUser" />
            <div className="p-3.5 bg-tertiary/5 rounded-xl border border-tertiary/20 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-tertiary" />
                  <span className="text-xs font-bold text-on-surface">{t('app.detail.fields.passkeySecrets')}</span>
                </div>
                <button
                  type="button"
                  onClick={handleVerifyPasskey}
                  disabled={!entry.passkeyCredentialId || isVerifyingPasskey}
                  className="py-1 px-2 bg-tertiary/15 hover:bg-tertiary/25 text-tertiary text-[10px] font-bold rounded-lg border border-tertiary/10 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Fingerprint className="w-3 h-3" /> {isVerifyingPasskey ? t('app.detail.fields.verifyingPasskey') : t('app.detail.fields.verifyPasskey')}
                </button>
              </div>
              {passkeyMessage && (
                <div className="p-2 bg-surface-container-high/50 border border-white/5 rounded-lg text-[11px] text-on-surface-variant">
                  {passkeyMessage}
                </div>
              )}
              <div className="space-y-2 text-[11px] font-mono leading-relaxed text-on-surface-variant border-t border-white/5 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant/50 block">Cred ID</span>
                    <span className="text-on-surface truncate block pr-2 cursor-pointer select-all" title={entry.passkeyCredentialId}>{entry.passkeyCredentialId || t('app.detail.notSpecified')}</span>
                  </div>
                  {entry.passkeyCredentialId && (
                    <button onClick={() => handleCopy(entry.passkeyCredentialId || '', 'credid')} className="p-1 hover:bg-white/5 rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0">
                      {copiedField === 'credid' ? <Check className="w-3 h-3 text-tertiary" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant/50 block">Public Key</span>
                    <span className="text-on-surface truncate block pr-2 cursor-pointer select-all" title={entry.passkeyPublicKey}>{entry.passkeyPublicKey || t('app.detail.notSpecified')}</span>
                  </div>
                  {entry.passkeyPublicKey && (
                    <button onClick={() => handleCopy(entry.passkeyPublicKey || '', 'pubkey')} className="p-1 hover:bg-white/5 rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0">
                      {copiedField === 'pubkey' ? <Check className="w-3 h-3 text-tertiary" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] uppercase font-bold text-on-surface-variant/50 block">AAGUID</span>
                    <span className="text-on-surface truncate block pr-2 cursor-pointer select-all" title={entry.passkeyAAGUID}>{entry.passkeyAAGUID || t('app.detail.notSpecified')}</span>
                  </div>
                  {entry.passkeyAAGUID && (
                    <button onClick={() => handleCopy(entry.passkeyAAGUID || '', 'aaguid')} className="p-1 hover:bg-white/5 rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0">
                      {copiedField === 'aaguid' ? <Check className="w-3 h-3 text-tertiary" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {entry.type === 'passkey' && isEditing && (
          <div className="space-y-3">
            <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.passkeyDomain')}</span>
              <input type="text" value={editPasskeyDomain} onChange={(e) => setEditPasskeyDomain(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-on-surface outline-none focus:border-tertiary/45 font-semibold" placeholder="google.com" />
            </div>
            <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.usernameOrEmail')}</span>
              <input type="text" value={editPasskeyUser} onChange={(e) => setEditPasskeyUser(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-on-surface outline-none focus:border-tertiary/45 font-semibold" placeholder={t('app.detail.fields.usernamePlaceholder')} />
            </div>
            <div className="p-3.5 bg-tertiary/5 rounded-xl border border-tertiary/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-tertiary" />
                  <span className="text-xs font-bold text-on-surface">{t('app.detail.fields.passkeySecrets')}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRegisterEditPasskey}
                  disabled={isRegisteringPasskey}
                  className="py-1 px-2 bg-tertiary/15 hover:bg-tertiary/25 text-tertiary text-[10px] font-bold rounded-lg border border-tertiary/10 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Fingerprint className="w-3 h-3" /> {isRegisteringPasskey ? t('app.detail.fields.registeringPasskey') : t('app.detail.fields.refreshKeys')}
                </button>
              </div>
              {passkeyMessage && (
                <div className="p-2 bg-surface-container-high/50 border border-white/5 rounded-lg text-[11px] text-on-surface-variant">
                  {passkeyMessage}
                </div>
              )}
              <div className="space-y-2 border-t border-white/5 pt-2">
                <div><span className="text-[9px] uppercase font-bold text-on-surface-variant/50 block mb-1">Cred ID</span><input type="text" value={editPasskeyCredentialId} onChange={(e) => setEditPasskeyCredentialId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-on-surface font-mono outline-none focus:border-tertiary/45" /></div>
                <div><span className="text-[9px] uppercase font-bold text-on-surface-variant/50 block mb-1">Public Key</span><input type="text" value={editPasskeyPublicKey} onChange={(e) => setEditPasskeyPublicKey(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-on-surface font-mono outline-none focus:border-tertiary/45" /></div>
                <div><span className="text-[9px] uppercase font-bold text-on-surface-variant/50 block mb-1">AAGUID</span><input type="text" value={editPasskeyAAGUID} onChange={(e) => setEditPasskeyAAGUID(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-on-surface font-mono outline-none focus:border-tertiary/45" /></div>
              </div>
            </div>
          </div>
        )}

        {/* ===== IDENTITY ===== */}
        {entry.type === 'identity' && !isEditing && (
          <div className="space-y-3">
            <FieldRow label={t('app.detail.fields.fullName')} value={entry.idFullName} fieldKey="idFullName" />
            <FieldRow label={t('app.detail.fields.idNumber')} value={entry.idNumber} fieldKey="idNumber" />
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label={t('app.detail.fields.serialNo')} value={entry.idSerial} fieldKey="idSerial" />
              <FieldRow label={t('app.detail.fields.birthDate')} value={entry.idBirthDate ? new Date(entry.idBirthDate).toLocaleDateString(i18n.language) : undefined} fieldKey="idBirthDate" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">{t('app.detail.fields.nationality')}</span>
                <span className="text-sm text-on-surface font-bold block text-center uppercase">{entry.idNationality || 'T.C.'}</span>
              </div>
              <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">{t('app.detail.fields.gender')}</span>
                <span className="text-sm text-on-surface font-semibold block text-center">{getGenderLabel(entry.idGender)}</span>
              </div>
              <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">{t('app.detail.fields.validUntil')}</span>
                <span className="text-sm text-on-surface font-semibold block text-center font-geist-mono">{entry.idExpiry || t('app.detail.fields.neverExpires')}</span>
              </div>
            </div>
          </div>
        )}

        {entry.type === 'identity' && isEditing && (
          <div className="space-y-3">
            <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.fullName')}</span>
              <input type="text" value={editIdFullName} onChange={(e) => setEditIdFullName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-on-surface outline-none focus:border-tertiary/45 font-semibold" placeholder={t('app.detail.fields.fullNamePlaceholder')} />
            </div>
            <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.idNumber')}</span>
              <input type="text" value={editIdNumber} maxLength={11} onChange={(e) => setEditIdNumber(e.target.value.replace(/\D/g, ''))} className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-on-surface outline-none focus:border-tertiary/45 font-semibold font-geist-mono" placeholder={t('app.detail.fields.idNumberPlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.serialNo')}</span>
                <input type="text" value={editIdSerial} onChange={(e) => setEditIdSerial(e.target.value.toUpperCase())} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-on-surface font-mono outline-none focus:border-tertiary/45" />
              </div>
              <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.birthDate')}</span>
                <input type="date" value={editIdBirthDate} onChange={(e) => setEditIdBirthDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-on-surface outline-none focus:border-tertiary/45" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.nationality')}</span>
                <input type="text" value={editIdNationality} onChange={(e) => setEditIdNationality(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-on-surface outline-none focus:border-tertiary/45 text-center font-bold" />
              </div>
              <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.gender')}</span>
                <select value={editIdGender} onChange={(e) => setEditIdGender(e.target.value)} className="w-full bg-surface-container/80 border border-white/10 rounded px-1.5 py-1 text-xs text-on-surface outline-none focus:border-tertiary/45 text-center font-semibold bg-[#121625]">
                  <option value="male">{t('app.detail.fields.male')}</option>
                  <option value="female">{t('app.detail.fields.female')}</option>
                  <option value="other">{t('app.detail.fields.other')}</option>
                </select>
              </div>
              <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">{t('app.detail.fields.validUntil')}</span>
                <input type="text" value={editIdExpiry} onChange={(e) => setEditIdExpiry(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-on-surface outline-none focus:border-tertiary/45 text-center" />
              </div>
            </div>
          </div>
        )}

        {/* ===== NOTES (for all types) ===== */}
        <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-2">{t('app.detail.fields.secureNotes')}</span>
          {isEditing ? (
            <textarea 
              value={editNotes} 
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-on-surface-variant leading-relaxed outline-none focus:border-tertiary/45 font-geist h-28 resize-none"
              placeholder={t('app.detail.fields.notesPlaceholder')}
            />
          ) : (
            entry.notes ? (
              <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap select-all bg-black/10 p-2.5 rounded-lg border border-white/5 font-geist">
                {entry.notes}
              </p>
            ) : (
              <span className="text-xs text-on-surface-variant/40 italic block py-1">{t('app.detail.fields.noNotes')}</span>
            )
          )}
        </div>

        {/* ===== FILE ATTACHMENT ===== */}
        <div className="bg-surface-container-high/40 border border-white/5 p-3.5 rounded-xl space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t('app.detail.fields.attachment')}</span>
            <span className="text-[9px] text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-lg border border-tertiary/15 font-mono">SANDBOX</span>
          </div>

          {!isEditing ? (
            attachment ? (
              <div className="bg-[#121625] border border-tertiary/20 rounded-xl p-3 flex items-center justify-between shadow-inner">
                <div className="min-w-0 pr-2 flex-1 flex items-center gap-2.5">
                  <div className="p-1.5 bg-tertiary/10 rounded-lg text-tertiary border border-tertiary/20 shrink-0">
                    <Paperclip className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-on-surface truncate block" title={attachment.name}>{attachment.name}</span>
                    <span className="text-[9px] text-on-surface-variant/70 block mt-0.5">{(attachment.size / (1024 * 1024)).toFixed(2)} MB • <span className="text-tertiary font-mono">AES-256</span></span>
                  </div>
                </div>
                <button type="button" onClick={handleDownload} disabled={isDownloading} className="py-1.5 px-2.5 bg-tertiary hover:bg-tertiary/90 text-on-tertiary text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all active:scale-95 disabled:opacity-55 cursor-pointer shrink-0">
                  {isDownloading ? <><RefreshCw className="w-3 h-3 animate-spin" /> {t('app.detail.fields.opening')}</> : <><Download className="w-3 h-3" /> {t('app.detail.fields.download')}</>}
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-on-surface-variant/40 italic block py-1">{t('app.detail.fields.noAttachment')}</span>
            )
          ) : (
            <div className="space-y-2.5">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              {!attachment && !isUploading && (
                <div onClick={() => fileInputRef.current?.click()} className="border border-dashed border-white/10 hover:border-tertiary/35 bg-white/5 hover:bg-white/10 rounded-xl p-3 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 group">
                  <Upload className="w-4 h-4 text-on-surface-variant group-hover:text-tertiary transition-colors" />
                  <span className="text-xs font-semibold text-on-surface block">{t('app.detail.fields.encryptNewFile')}</span>
                  <span className="text-[9px] text-on-surface-variant/50 block">{t('app.detail.fields.allTypesMax')}</span>
                </div>
              )}
              {isUploading && (
                <div className="bg-[#121625] border border-white/5 rounded-xl p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5 text-tertiary animate-spin" /><span className="text-[10px] font-bold text-on-surface">{t('app.detail.fields.encrypting')}</span></div>
                    <span className="text-[10px] font-bold text-tertiary font-mono">%{uploadProgress}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1"><div className="bg-tertiary h-1 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} /></div>
                </div>
              )}
              {attachment && (
                <div className="bg-[#121625] border border-tertiary/20 rounded-xl p-2.5 flex items-center justify-between">
                  <div className="min-w-0 pr-2 flex items-center gap-2">
                    <Paperclip className="w-3.5 h-3.5 text-tertiary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-on-surface truncate block" title={attachment.name}>{attachment.name}</span>
                      <span className="text-[9px] text-on-surface-variant/60 block mt-0.5">{(attachment.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                  </div>
                  <button type="button" onClick={handleRemoveAttachment} className="p-1.5 hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 rounded-lg transition-colors cursor-pointer shrink-0" title={t('app.detail.fields.removeAttachment')}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              {fileError && (
                <div className="p-2 bg-red-500/10 text-red-400 text-[10px] rounded-lg border border-red-500/20 flex gap-1.5 items-center">
                  <AlertCircle className="w-3 h-3 shrink-0" /><span>{fileError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Security badge */}
        <div className="p-3.5 bg-primary-container/20 rounded-xl border border-primary-container-highest/20 flex gap-2.5">
          <Shield className="text-primary w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-[11px] text-on-surface-variant/90 leading-relaxed">
            {t('app.detail.protectedDescription')}
          </p>
        </div>

        {/* Strength badge */}
        <div className="flex items-center gap-2 py-1">
          <ShieldCheck className={`w-4 h-4 ${entry.strength === 'IMMUTABLE' ? 'text-tertiary' : entry.strength === 'EXCELLENT' ? 'text-tertiary' : 'text-secondary'}`} />
          <span className={`text-[10px] font-geist font-extrabold uppercase tracking-[0.15em] ${entry.strength === 'IMMUTABLE' ? 'text-tertiary' : entry.strength === 'EXCELLENT' ? 'text-tertiary' : 'text-secondary'}`}>
            {t('app.detail.resistance')} {strengthLabel}
          </span>
        </div>

        {/* Created date */}
        {entry.createdAt && (
          <div className="flex items-center gap-2 text-on-surface-variant/50 pb-2">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-[10px] font-geist-mono">
              {t('app.detail.created')} {new Date(entry.createdAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        )}
      </div>

      {/* Panel Footer Actions */}
      <div className="p-5 border-t border-white/5 bg-surface-container/30 shrink-0">
        {isEditing ? (
          <div className="flex gap-3">
            <button 
              onClick={() => setIsEditing(false)}
              className="flex-1 py-3 px-4 bg-transparent hover:bg-white/5 border border-white/10 text-on-surface-variant hover:text-on-surface rounded-xl font-bold transition-all active:scale-[0.98] text-sm cursor-pointer select-none"
            >
              {t('app.detail.cancel')}
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 py-3 px-4 bg-tertiary text-on-tertiary rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm cursor-pointer select-none shadow-lg shadow-tertiary/20"
            >
              <Save className="w-4 h-4" />
              {t('app.detail.saveChanges')}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-on-surface-variant/50">
              <Shield className="w-4 h-4" />
              <span className="text-[11px] font-geist-mono">{t('app.detail.aesProtected')}</span>
            </div>
            <div className={`flex items-center gap-1.5 ${entry.strength === 'IMMUTABLE' ? 'text-tertiary' : entry.strength === 'EXCELLENT' ? 'text-tertiary' : 'text-secondary'}`}>
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em]">
                {strengthLabel}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

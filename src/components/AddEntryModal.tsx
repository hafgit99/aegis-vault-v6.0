import React, { useState, useRef } from 'react';
import { 
  X, ShieldAlert, Key, Globe, Eye, EyeOff, 
  CreditCard, FileText, Lock, Sparkles, Check, Copy,
  Paperclip, Trash2, Upload, AlertCircle, RefreshCw, Fingerprint, IdCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { VaultEntry, EntryType } from '../types';
import { saveEncryptedFile } from '../lib/fileStore';
import { VaultCryptoService } from '../lib/vault/VaultCryptoService';
import { generateRandomString } from '../lib/crypto-types';
import { registerPasskey } from '../lib/webauthnPasskey';
import { generateTotpSecret, TotpAlgorithm } from '../lib/totp';

interface AddEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: VaultEntry) => void;
}

export default function AddEntryModal({ isOpen, onClose, onSave }: AddEntryModalProps) {
  const { t } = useTranslation();
  const [type, setType] = useState<EntryType>('login');
  const [title, setTitle] = useState('');
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpIssuer, setTotpIssuer] = useState('');
  const [totpAlgorithm, setTotpAlgorithm] = useState<TotpAlgorithm>('SHA-1');
  const [totpDigits, setTotpDigits] = useState(6);
  const [totpPeriod, setTotpPeriod] = useState(30);
  
  // Card specific fields
  const [cardholder, setCardholder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');

  // Passkey Specific fields
  const [passkeyDomain, setPasskeyDomain] = useState('');
  const [passkeyUser, setPasskeyUser] = useState('');
  const [passkeyCredentialId, setPasskeyCredentialId] = useState('');
  const [passkeyPublicKey, setPasskeyPublicKey] = useState('');
  const [passkeyAAGUID, setPasskeyAAGUID] = useState('');
  const [passkeyPublicKeyAlgorithm, setPasskeyPublicKeyAlgorithm] = useState<number | undefined>(undefined);
  const [passkeyAuthenticatorData, setPasskeyAuthenticatorData] = useState('');
  const [passkeyClientDataJSON, setPasskeyClientDataJSON] = useState('');
  const [passkeyTransports, setPasskeyTransports] = useState<string[]>([]);
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  // Identity Card fields
  const [idFullName, setIdFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idSerial, setIdSerial] = useState('');
  const [idExpiry, setIdExpiry] = useState('');
  const [idNationality, setIdNationality] = useState(t('app.addEntry.defaultNationality'));
  const [idGender, setIdGender] = useState('other');
  const [idBirthDate, setIdBirthDate] = useState('');

  // File Attachment fields
  const [attachment, setAttachment] = useState<{ id: string; name: string; size: number; type: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    const MAX_SIZE = 200 * 1024 * 1024; // 200MB limit
    if (file.size > MAX_SIZE) {
      setFileError(t('app.addEntry.fileErrors.tooLarge'));
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const interval = setInterval(() => {
        setUploadProgress(p => {
          if (p >= 90) {
            clearInterval(interval);
            return 90;
          }
          return p + 15;
        });
      }, 150);

      const fileId = `file-${generateRandomString(18, 'abcdefghijklmnopqrstuvwxyz0123456789')}`;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          // Store the local attachment payload in the same offline file container path.
          const encryptedBlob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
          
          await saveEncryptedFile(fileId, encryptedBlob);
          
          clearInterval(interval);
          setUploadProgress(100);
          
          setAttachment({
            id: fileId,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream'
          });
          
          setTimeout(() => {
            setIsUploading(false);
            setUploadProgress(0);
          }, 400);
        } catch (err) {
          clearInterval(interval);
          setFileError(t('app.addEntry.fileErrors.encryptFailed'));
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        clearInterval(interval);
        setFileError(t('app.addEntry.fileErrors.readFailed'));
        setIsUploading(false);
      };

      reader.readAsArrayBuffer(file);

    } catch (err) {
      setFileError(t('app.addEntry.fileErrors.uploadUnexpected'));
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Password Generator inline helper
  const triggerInlineGenerate = () => {
    const gen = VaultCryptoService.generateSecurePassword();
    setPassword(gen);
  };

  const getPasswordStrength = (pass: string): 'EXCELLENT' | 'GOOD' | 'IMMUTABLE' => {
    if (pass.length > 16) return 'IMMUTABLE';
    if (pass.length > 12) return 'EXCELLENT';
    return 'GOOD';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const strength = type === 'passkey' ? 'IMMUTABLE' : type === 'identity' ? 'IMMUTABLE' : getPasswordStrength(password);
    const themeColor = strength === 'IMMUTABLE' ? 'tertiary' : strength === 'EXCELLENT' ? 'tertiary' : 'secondary';

    const newEntry: VaultEntry = {
      id: (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) 
      ? window.crypto.randomUUID() 
      : (Date.now().toString() + generateRandomString(14, 'abcdefghijklmnopqrstuvwxyz0123456789')),
      title,
      type,
      subtitle: type === 'login' 
        ? username 
        : type === 'card' 
        ? '•••• •••• •••• ' + cardNumber.slice(-4) 
        : type === 'passkey'
        ? t('app.addEntry.subtitle.passkey', { domain: passkeyDomain || 'WebAuthn' })
        : type === 'identity'
        ? t('app.addEntry.subtitle.identity', { name: idFullName || idNumber || t('app.addEntry.subtitle.identityFallback') })
        : t('app.addEntry.subtitle.secureNote'),
      username: type === 'login' ? username : type === 'passkey' ? passkeyUser : idFullName,
      password: type === 'login' ? password : undefined,
      url: type === 'login' ? url : undefined,
      totpSecret: type === 'login' && totpSecret ? totpSecret : undefined,
      totpIssuer: type === 'login' && totpSecret ? (totpIssuer || title) : undefined,
      totpAlgorithm: type === 'login' && totpSecret ? totpAlgorithm : undefined,
      totpDigits: type === 'login' && totpSecret ? totpDigits : undefined,
      totpPeriod: type === 'login' && totpSecret ? totpPeriod : undefined,
      notes,
      strength,
      themeColor,
      createdAt: new Date().toISOString(),
      cardholder: type === 'card' ? cardholder : undefined,
      cardNumber: type === 'card' ? cardNumber : undefined,
      expiryDate: type === 'card' ? expiryDate : undefined,
      cvv: type === 'card' ? cvv : undefined,
      
      // Passkey
      passkeyDomain: type === 'passkey' ? passkeyDomain : undefined,
      passkeyUser: type === 'passkey' ? passkeyUser : undefined,
      passkeyCredentialId: type === 'passkey' ? passkeyCredentialId : undefined,
      passkeyPublicKey: type === 'passkey' ? passkeyPublicKey : undefined,
      passkeyAAGUID: type === 'passkey' ? passkeyAAGUID : undefined,
      passkeyPublicKeyAlgorithm: type === 'passkey' ? passkeyPublicKeyAlgorithm : undefined,
      passkeyAuthenticatorData: type === 'passkey' ? passkeyAuthenticatorData : undefined,
      passkeyClientDataJSON: type === 'passkey' ? passkeyClientDataJSON : undefined,
      passkeyTransports: type === 'passkey' ? passkeyTransports : undefined,

      // Identity Card
      idFullName: type === 'identity' ? idFullName : undefined,
      idNumber: type === 'identity' ? idNumber : undefined,
      idSerial: type === 'identity' ? idSerial : undefined,
      idExpiry: type === 'identity' ? idExpiry : undefined,
      idNationality: type === 'identity' ? idNationality : undefined,
      idGender: type === 'identity' ? idGender : undefined,
      idBirthDate: type === 'identity' ? idBirthDate : undefined,

      attachment: attachment || undefined,
    };

    onSave(newEntry);
    
    // Reset state
    setTitle('');
    setTitleManuallyEdited(false);
    setUsername('');
    setPassword('');
    setUrl('');
    setTotpSecret('');
    setTotpIssuer('');
    setTotpAlgorithm('SHA-1');
    setTotpDigits(6);
    setTotpPeriod(30);
    setNotes('');
    setCardholder('');
    setCardNumber('');
    setExpiryDate('');
    setCvv('');
    
    setPasskeyDomain('');
    setPasskeyUser('');
    setPasskeyCredentialId('');
    setPasskeyPublicKey('');
    setPasskeyAAGUID('');
    setPasskeyPublicKeyAlgorithm(undefined);
    setPasskeyAuthenticatorData('');
    setPasskeyClientDataJSON('');
    setPasskeyTransports([]);
    setPasskeyError(null);

    setIdFullName('');
    setIdNumber('');
    setIdSerial('');
    setIdExpiry('');
    setIdNationality(t('app.addEntry.defaultNationality'));
    setIdGender('other');
    setIdBirthDate('');

    setAttachment(null);
    setFileError(null);
    
    onClose();
  };

  const handleRegisterPasskey = async () => {
    setPasskeyError(null);
    setIsRegisteringPasskey(true);
    try {
      const credential = await registerPasskey(passkeyDomain, passkeyUser);
      setPasskeyCredentialId(credential.credentialId);
      setPasskeyPublicKey(credential.publicKey);
      setPasskeyAAGUID(credential.aaguid || 'authenticator-managed');
      setPasskeyPublicKeyAlgorithm(credential.publicKeyAlgorithm);
      setPasskeyAuthenticatorData(credential.authenticatorData || '');
      setPasskeyClientDataJSON(credential.clientDataJSON);
      setPasskeyTransports(credential.transports || []);
    } catch (error: any) {
      setPasskeyError(error?.message || t('app.addEntry.passkeyRegistrationFailed'));
    } finally {
      setIsRegisteringPasskey(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative w-full max-w-2xl bg-surface-container border border-outline-variant/30 rounded-[1.25rem] overflow-hidden shadow-2xl z-10 select-none flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-surface-container-high/65">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-lg">
                  <Lock className="text-primary w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-outfit text-headline-md text-on-surface">{t('app.addEntry.title')}</h3>
                  <p className="text-xs text-on-surface-variant/70">{t('app.addEntry.description')}</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-1.5 hover:bg-white/5 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Category selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.entryType')}</label>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                  {[
                    { id: 'login', label: t('app.addEntry.categories.login'), icon: <Key className="w-3.5 h-3.5" /> },
                    { id: 'card', label: t('app.addEntry.categories.card'), icon: <CreditCard className="w-3.5 h-3.5" /> },
                    { id: 'note', label: t('app.addEntry.categories.note'), icon: <FileText className="w-3.5 h-3.5" /> },
                    { id: 'passkey', label: t('app.addEntry.categories.passkey'), icon: <Fingerprint className="w-3.5 h-3.5" /> },
                    { id: 'identity', label: t('app.addEntry.categories.identity'), icon: <IdCard className="w-3.5 h-3.5" /> },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setType(cat.id as EntryType)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        type === cat.id 
                          ? 'bg-secondary-container/45 text-secondary border-secondary/60 shadow shadow-secondary/10' 
                          : 'bg-transparent border-white/5 text-on-surface-variant hover:text-on-surface hover:border-white/10'
                      }`}
                    >
                      {cat.icon}
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title input common to all */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.itemTitle')}</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleManuallyEdited(true);
                  }}
                  placeholder={t('app.addEntry.itemTitlePlaceholder')}
                  required
                  className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[15px] outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                />
              </div>

              {/* Category-Specific fields layout */}
              {type === 'login' && (
                <div className="space-y-4">
                  {/* Username/Email */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.usernameOrEmail')}</label>
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('app.addEntry.usernamePlaceholder')}
                      className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[15px] outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                    />
                  </div>

                  {/* Password field with inline generator shortcut */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex justify-between">
                      <span>{t('app.addEntry.password')}</span>
                      {password && (
                        <span className={`text-[11px] font-bold ${
                          password.length > 16 ? 'text-tertiary' : password.length > 12 ? 'text-primary' : 'text-secondary'
                        }`}>
                          {password.length > 16 ? t('app.addEntry.strength.immutable') : password.length > 12 ? t('app.addEntry.strength.excellent') : t('app.addEntry.strength.good')}
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('app.addEntry.passwordPlaceholder')}
                        className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl pl-4 pr-24 py-3 text-[15px] font-geist-mono outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 hover:bg-white/5 text-on-surface-variant hover:text-on-surface rounded-lg transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button 
                          type="button"
                          onClick={triggerInlineGenerate}
                          className="p-1.5 hover:bg-white/5 text-tertiary hover:text-tertiary-container rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                          title={t('app.addEntry.generateStrongPassword')}
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* URL */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.websiteUrl')}</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60" />
                      <input 
                        type="url" 
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl pl-10 pr-4 py-3 text-[15px] outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 bg-[#121625]/20 p-3 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.totpSecret')}</label>
                      <button
                        type="button"
                        onClick={() => setTotpSecret(generateTotpSecret())}
                        className="py-1 px-2 bg-tertiary/15 hover:bg-tertiary/25 text-tertiary text-[10px] font-bold rounded-lg border border-tertiary/10 flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        {t('app.addEntry.generateTotpSecret')}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={totpSecret}
                      onChange={(e) => setTotpSecret(e.target.value.toUpperCase())}
                      placeholder={t('app.addEntry.totpSecretPlaceholder')}
                      className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[13px] font-geist-mono outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                    />
                    {totpSecret && (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        <input
                          type="text"
                          value={totpIssuer}
                          onChange={(e) => setTotpIssuer(e.target.value)}
                          placeholder={t('app.addEntry.totpIssuerPlaceholder')}
                          className="lg:col-span-1 bg-surface-container-high/60 border border-white/5 rounded-lg px-2.5 py-2 text-xs text-on-surface outline-none focus:border-tertiary/40"
                        />
                        <select value={totpAlgorithm} onChange={(e) => setTotpAlgorithm(e.target.value as TotpAlgorithm)} className="bg-[#121625] border border-white/5 rounded-lg px-2.5 py-2 text-xs text-on-surface outline-none focus:border-tertiary/40">
                          <option value="SHA-1">SHA-1</option>
                          <option value="SHA-256">SHA-256</option>
                          <option value="SHA-512">SHA-512</option>
                        </select>
                        <select value={totpDigits} onChange={(e) => setTotpDigits(Number(e.target.value))} className="bg-[#121625] border border-white/5 rounded-lg px-2.5 py-2 text-xs text-on-surface outline-none focus:border-tertiary/40">
                          <option value={6}>6 digits</option>
                          <option value={8}>8 digits</option>
                        </select>
                        <select value={totpPeriod} onChange={(e) => setTotpPeriod(Number(e.target.value))} className="bg-[#121625] border border-white/5 rounded-lg px-2.5 py-2 text-xs text-on-surface outline-none focus:border-tertiary/40">
                          <option value={30}>30s</option>
                          <option value={60}>60s</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {type === 'card' && (
                <div className="space-y-4">
                  {/* Card holder */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.cardholder')}</label>
                    <input 
                      type="text" 
                      value={cardholder}
                      onChange={(e) => setCardholder(e.target.value)}
                      placeholder={t('app.addEntry.cardholderPlaceholder')}
                      className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[15px] uppercase outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                    />
                  </div>

                  {/* Card Number */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.cardNumber')}</label>
                    <input 
                      type="text" 
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                      className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[15px] font-geist-mono outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                    />
                  </div>

                  {/* Expiry & CVV */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.expiryDate')}</label>
                      <input 
                        type="text" 
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        placeholder="AA/YY"
                        maxLength={5}
                        className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[15px] font-geist-mono text-center outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.securityCode')}</label>
                      <input 
                        type="password" 
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value)}
                        placeholder="***"
                        maxLength={4}
                        className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[15px] font-geist-mono text-center outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                      />
                    </div>
                  </div>
                </div>
              )}

              {type === 'passkey' && (
                <div className="space-y-4">
                  {/* Passkey Domain */}
                  <div className="space-y-2 bg-[#121625]/20 p-2.5 rounded-xl border border-white/5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.passkeyDomain')}</label>
                    <input 
                      type="text" 
                      value={passkeyDomain}
                      onChange={(e) => setPasskeyDomain(e.target.value)}
                      placeholder={t('app.addEntry.passkeyDomainPlaceholder')}
                      className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[15px] outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                    />
                  </div>

                  {/* Passkey User */}
                  <div className="space-y-2 bg-[#121625]/20 p-2.5 rounded-xl border border-white/5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.usernameOrEmail')}</label>
                    <input 
                      type="text" 
                      value={passkeyUser}
                      onChange={(e) => setPasskeyUser(e.target.value)}
                      placeholder={t('app.addEntry.usernamePlaceholder')}
                      className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[15px] outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                    />
                  </div>

                  {/* Helper/Generator to establish Passkey Credentials */}
                  <div className="p-4 bg-tertiary/5 rounded-xl border border-tertiary/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Fingerprint className="w-5 h-5 text-tertiary" />
                        <div>
                          <span className="text-xs font-bold text-on-surface block">{t('app.addEntry.cryptoPasskeySecrets')}</span>
                          <span className="text-[10px] text-on-surface-variant/70">{t('app.addEntry.cryptoPasskeyDescription')}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRegisterPasskey}
                        disabled={isRegisteringPasskey}
                        className="py-1.5 px-3 bg-tertiary/15 hover:bg-tertiary/25 text-tertiary text-[11px] font-bold rounded-lg border border-tertiary/10 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Fingerprint className="w-3.5 h-3.5" />
                        {isRegisteringPasskey ? t('app.addEntry.passkeyRegistering') : t('app.addEntry.generateSecureKey')}
                      </button>
                    </div>

                    {passkeyError && (
                      <div className="p-2 bg-error/10 text-error text-[11px] rounded-lg border border-error/20">
                        {passkeyError}
                      </div>
                    )}

                    {passkeyCredentialId && (
                      <div className="space-y-2 text-[11px] font-mono leading-relaxed text-on-surface-variant border-t border-white/5 pt-2">
                        <div className="grid grid-cols-4 gap-1">
                          <span className="text-[10px] uppercase font-bold text-on-surface-variant/50">Cred ID:</span>
                          <span className="col-span-3 text-on-surface truncate pr-2 select-all">{passkeyCredentialId}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          <span className="text-[10px] uppercase font-bold text-on-surface-variant/50">Public Key:</span>
                          <span className="col-span-3 text-on-surface truncate pr-2 select-all">{passkeyPublicKey}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          <span className="text-[10px] uppercase font-bold text-on-surface-variant/50">AAGUID:</span>
                          <span className="col-span-3 text-on-surface truncate pr-2 select-all">{passkeyAAGUID}</span>
                        </div>
                        {passkeyTransports.length > 0 && (
                          <div className="grid grid-cols-4 gap-1">
                            <span className="text-[10px] uppercase font-bold text-on-surface-variant/50">Transport:</span>
                            <span className="col-span-3 text-on-surface truncate pr-2 select-all">{passkeyTransports.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {type === 'identity' && (
                <div className="space-y-4">
                  {/* Full Name */}
                  <div className="space-y-2 bg-[#121625]/20 p-2.5 rounded-xl border border-white/5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.fullName')}</label>
                    <input 
                      type="text" 
                      value={idFullName}
                      onChange={(e) => {
                        const nextFullName = e.target.value;
                        setIdFullName(nextFullName);
                        if (!titleManuallyEdited) {
                          setTitle(nextFullName ? `${nextFullName} ${t('app.addEntry.categories.identity')}` : '');
                        }
                      }}
                      placeholder={t('app.addEntry.fullNamePlaceholder')}
                      className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[15px] outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                    />
                  </div>

                  {/* ID Number */}
                  <div className="space-y-2 bg-[#121625]/20 p-2.5 rounded-xl border border-white/5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.idNumber')}</label>
                    <input 
                      type="text" 
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ''))}
                      maxLength={11}
                      placeholder={t('app.addEntry.idNumberPlaceholder')}
                      className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[15px] font-geist-mono outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                    />
                  </div>

                  {/* Serial No & Date of Birth */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 bg-[#121625]/20 p-2.5 rounded-xl border border-white/5">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.serialNo')}</label>
                      <input 
                        type="text" 
                        value={idSerial}
                        onChange={(e) => setIdSerial(e.target.value.toUpperCase())}
                        placeholder={t('app.addEntry.serialPlaceholder')}
                        className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[15px] font-geist-mono text-center outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                      />
                    </div>
                    <div className="space-y-2 bg-[#121625]/20 p-2.5 rounded-xl border border-white/5">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider font-semibold">{t('app.addEntry.birthDate')}</label>
                      <input 
                        type="date" 
                        value={idBirthDate}
                        onChange={(e) => setIdBirthDate(e.target.value)}
                        className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-2.5 text-[14px] outline-none text-on-surface transition-all text-center"
                      />
                    </div>
                  </div>

                  {/* Nationality & Expiry & Gender */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 bg-[#121625]/20 p-2.5 rounded-xl border border-white/5">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.nationality')}</label>
                      <input 
                        type="text" 
                        value={idNationality}
                        onChange={(e) => setIdNationality(e.target.value)}
                        placeholder={t('app.addEntry.nationalityPlaceholder')}
                        className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[14px] text-center outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                      />
                    </div>
                    <div className="space-y-2 bg-[#121625]/20 p-2.5 rounded-xl border border-white/5">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.gender')}</label>
                      <select 
                        value={idGender}
                        onChange={(e) => setIdGender(e.target.value)}
                        className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-2 py-3.5 text-xs text-center outline-none text-on-surface transition-all bg-[#121625]"
                      >
                        <option value="male">{t('app.addEntry.male')}</option>
                        <option value="female">{t('app.addEntry.female')}</option>
                        <option value="other">{t('app.addEntry.other')}</option>
                      </select>
                    </div>
                    <div className="space-y-2 bg-[#121625]/20 p-2.5 rounded-xl border border-white/5">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.expiry')}</label>
                      <input 
                        type="text" 
                        value={idExpiry}
                        onChange={(e) => setIdExpiry(e.target.value)}
                        placeholder={t('app.addEntry.expiryPlaceholder')}
                        maxLength={10}
                        className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[14px] font-geist-mono text-center outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Secure file attachment area */}
              <div className="space-y-2 border-t border-white/5 pt-5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex justify-between items-center">
                  <span>{t('app.addEntry.secureFileAttachment')}</span>
                  <span className="text-[10px] text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-lg border border-tertiary/10 font-mono">CLIENT-SIDE AES-256</span>
                </label>
                
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!attachment && !isUploading && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/5 hover:border-tertiary/35 bg-surface-container-high/40 hover:bg-surface-container-high/65 rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                  >
                    <div className="p-2.5 bg-white/5 rounded-full text-on-surface-variant group-hover:text-tertiary group-hover:bg-tertiary/10 transition-all">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-on-surface block">{t('app.addEntry.dropFileTitle')}</span>
                      <span className="text-[11px] text-on-surface-variant/50 mt-1 block">{t('app.addEntry.dropFileDescription')}</span>
                    </div>
                  </div>
                )}

                {isUploading && (
                  <div className="bg-surface-container-high/60 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <RefreshCw className="w-5 h-5 text-tertiary animate-spin" />
                        <div>
                          <span className="text-xs font-bold text-on-surface block">{t('app.addEntry.encryptingFile')}</span>
                          <span className="text-[11px] text-on-surface-variant/60">{t('app.addEntry.encryptingFileDescription')}</span>
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono text-tertiary">%{uploadProgress}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-tertiary h-1.5 rounded-full transition-all duration-150"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {attachment && (
                  <div className="bg-[#121625] border border-tertiary/20 rounded-xl p-4 flex items-center justify-between shadow-inner">
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="p-2.5 bg-tertiary/10 rounded-lg text-tertiary border border-tertiary/20">
                        <Paperclip className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-on-surface truncate block" title={attachment.name}>
                          {attachment.name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-on-surface-variant/70 mt-0.5">
                          <span>{(attachment.size / (1024 * 1024)).toFixed(2)} MB</span>
                          <span className="h-1 w-1 rounded-full bg-white/10" />
                          <span className="font-mono text-tertiary/80">{t('app.addEntry.protectedAes')}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="p-1.5 hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 rounded-lg transition-colors cursor-pointer shrink-0"
                      title={t('app.addEntry.removeAttachment')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {fileError && (
                  <div className="p-3 bg-red-500/10 text-red-400 text-xs rounded-xl border border-red-500/20 flex gap-2 items-center">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>

              {/* Secure Notes/Description block */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{t('app.addEntry.notes')}</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('app.addEntry.notesPlaceholder')}
                  rows={4}
                  className="w-full bg-surface-container-high/60 border border-white/5 focus:border-tertiary/40 focus:ring-1 focus:ring-tertiary/50 rounded-xl px-4 py-3 text-[15px] outline-none text-on-surface transition-all placeholder:text-on-surface-variant/40 resize-none"
                />
              </div>

            </form>

            {/* Footer Actions */}
            <div className="p-6 border-t border-white/5 flex gap-3 justify-end bg-surface-container-high/65">
              <button 
                type="button"
                onClick={onClose}
                className="py-3 px-5 border border-white/5 hover:border-white/10 hover:bg-white/5 text-on-surface-variant hover:text-on-surface rounded-xl font-semibold transition-all active:scale-95 cursor-pointer text-sm"
              >
                {t('app.addEntry.cancel')}
              </button>
              <button 
                onClick={handleSubmit}
                disabled={!title.trim()}
                className="py-3 px-6 bg-primary hover:bg-primary/95 disabled:opacity-40 disabled:cursor-not-allowed text-on-primary rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/10 cursor-pointer text-sm"
              >
                {t('app.addEntry.save')}
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

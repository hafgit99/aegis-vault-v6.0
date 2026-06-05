import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, KeyRound, Smartphone, BadgeCheck, Pencil, Check, RefreshCw, Camera, Link, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AVATAR_PRESETS } from '../lib/avatarPresets';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onUpdateUserName: (name: string) => void;
  avatarUrl: string;
  onUpdateAvatarUrl: (url: string) => void;
}

export default function ProfileModal({
  isOpen,
  onClose,
  userName,
  onUpdateUserName,
  avatarUrl,
  onUpdateAvatarUrl
}: ProfileModalProps) {
  const { t } = useTranslation();
  const [tempName, setTempName] = useState(userName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [customUrl, setCustomUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize initial input values when they change
  useEffect(() => {
    setTempName(userName);
  }, [userName]);

  // Track session duration (simulated administrative secure uptime)
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} ${t('app.profile.minutesShort')}`;
  };

  const handleSaveName = () => {
    if (tempName.trim()) {
      onUpdateUserName(tempName.trim());
      setIsEditingName(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas of 150x150 to compress and downscale nicely
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Centered cover cropping calculation
          const size = Math.min(img.width, img.height);
          const x = (img.width - size) / 2;
          const y = (img.height - size) / 2;
          ctx.drawImage(img, x, y, size, size, 0, 0, 150, 150);
          
          // Generate lightweight base64 JPEG
          const compressedUrl = canvas.toDataURL('image/jpeg', 0.85);
          onUpdateAvatarUrl(compressedUrl);
        } else {
          onUpdateAvatarUrl(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = () => {
    if (customUrl.trim() && customUrl.startsWith('http')) {
      onUpdateAvatarUrl(customUrl.trim());
      setCustomUrl('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="profile-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-surface-container-high border border-white/10 rounded-[1.5rem] shadow-2xl p-6 overflow-hidden z-10"
          >
            {/* Header decor ambient flare */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

            {/* Title Bar */}
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <Shield className="text-primary w-5 h-5" />
                <h3 className="text-title-medium font-outfit text-on-surface font-semibold">{t('app.profile.title')}</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/10 text-on-surface-variant transition-colors"
                aria-label={t('app.profile.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Detail Content */}
            <div className="space-y-6 relative z-10">
              {/* Profile Card Block */}
              <div className="flex flex-col items-center text-center p-4 bg-surface-container/60 rounded-xl border border-white/5">
                
                {/* Avatar with dynamic outline */}
                <div 
                  className="relative mb-3 group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  title={t('app.profile.choosePhoto')}
                >
                  <div className="relative">
                    <img
                      alt={t('app.profile.avatarAlt')}
                      className="w-20 h-20 rounded-full border-2 border-primary object-cover transition-all group-hover:brightness-75"
                      src={avatarUrl}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 right-0 w-5 h-5 bg-tertiary border-2 border-surface-container-high rounded-full flex items-center justify-center">
                    <BadgeCheck className="w-3.5 h-3.5 text-on-tertiary font-bold" />
                  </div>
                </div>

                {/* Hidden input to handle file uploading */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Name Editing Area */}
                <div className="w-full max-w-[240px] flex items-center justify-center gap-2 mb-1">
                  {isEditingName ? (
                    <div className="flex items-center gap-1.5 w-full bg-surface-container-lowest/80 border border-primary/30 rounded-lg px-2 py-1">
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                        className="bg-transparent text-sm text-on-surface focus:outline-none w-full"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        aria-label={t('app.profile.confirm')}
                        className="text-tertiary hover:bg-tertiary/10 p-1 rounded transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h4 className="text-on-surface font-outfit font-semibold text-base truncate">{userName}</h4>
                      <button
                        onClick={() => setIsEditingName(true)}
                        aria-label={t('app.profile.editName')}
                        className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded"
                        title={t('app.profile.editName')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
                <span className="text-mono-data text-xs text-primary font-bold tracking-widest uppercase">{t('app.profile.owner')}</span>

                {/* Avatar Presets and Custom Upload */}
                <div className="mt-4 w-full space-y-3.5">
                  <div>
                    <p className="text-[10px] text-on-surface-variant/75 font-semibold uppercase tracking-wider mb-2">{t('app.profile.avatarPicker')}</p>
                    <div className="flex justify-center items-center gap-3">
                      {/* Presets */}
                      {AVATAR_PRESETS.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => onUpdateAvatarUrl(url)}
                          aria-label={t('app.profile.presetAvatar', { number: i + 1 })}
                          className={`relative w-10 h-10 rounded-full overflow-hidden border-2 transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                            avatarUrl === url ? 'border-primary shadow-sm shadow-primary/30' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                          title={t('app.profile.presetAvatar', { number: i + 1 })}
                        >
                          <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          {avatarUrl === url && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white drop-shadow-md" />
                            </div>
                          )}
                        </button>
                      ))}

                      {/* Custom Upload Button Icon */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        aria-label={t('app.profile.chooseFromDevice')}
                        className="w-10 h-10 rounded-full border border-dashed border-white/25 hover:border-primary/50 text-on-surface-variant hover:text-primary transition-all flex items-center justify-center bg-white/[0.02] hover:bg-primary/5 cursor-pointer animate-pulse"
                        style={{ animationDuration: '3s' }}
                        title={t('app.profile.chooseFromDevice')}
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Web URL Input block */}
                  <div className="text-left">
                    <p className="text-[9px] text-on-surface-variant/65 font-bold uppercase tracking-wider mb-1.5 px-1">{t('app.profile.imageUrl')}</p>
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center gap-1.5 bg-surface-container-lowest/80 border border-white/5 focus-within:border-primary/30 rounded-lg px-2.5 py-1.5 transition-colors">
                        <Link className="w-3.5 h-3.5 text-on-surface-variant/70 shrink-0" />
                        <input
                          type="url"
                          placeholder={t('app.profile.imageUrlPlaceholder')}
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleApplyCustomUrl()}
                          className="bg-transparent text-xs text-on-surface focus:outline-none w-full"
                        />
                      </div>
                      <button
                        onClick={handleApplyCustomUrl}
                        disabled={!customUrl.trim() || !customUrl.startsWith('http')}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/25 border border-primary/20 text-primary font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {t('app.profile.add')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Administrative Session Indicators */}
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-surface-container/40 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                    <KeyRound className="w-4 h-4 text-secondary" />
                    <span>{t('app.profile.sessionEncryption')}</span>
                  </div>
                  <span className="text-xs bg-secondary/15 text-secondary border border-secondary/20 px-2 py-0.5 rounded-md font-mono font-bold">AES-256-GCM</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-surface-container/40 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                    <Smartphone className="w-4 h-4 text-tertiary" />
                    <span>{t('app.profile.securityLicense')}</span>
                  </div>
                  <span className="text-xs bg-tertiary/15 text-tertiary border border-tertiary/20 px-2 py-0.5 rounded-md font-bold">{t('app.profile.eliteLocalLicense')}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-surface-container/40 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                    <RefreshCw className="w-4 h-4 text-primary animate-spin" style={{ animationDuration: '3s' }} />
                    <span>{t('app.profile.uptime')}</span>
                  </div>
                  <span className="text-xs text-on-surface font-mono font-bold">{formatUptime(sessionTime)}</span>
                </div>
              </div>

              <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl text-center">
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  {t('app.profile.secureStorageNotice')}
                </p>
              </div>

              {/* Close Button Trigger */}
              <button
                onClick={onClose}
                className="w-full py-3 bg-primary text-on-primary hover:bg-primary/95 font-bold rounded-xl text-sm transition-all shadow-md shadow-primary/10 hover:shadow-primary/20 active:scale-95 cursor-pointer mt-2"
              >
                {t('app.profile.confirm')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

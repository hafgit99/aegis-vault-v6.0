import React, { useState } from 'react';
import { Copy, Eye, EyeOff, Trash2, Check, CreditCard, FileText, Key, ShieldCheck, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { VaultEntry } from '../types';

interface VaultItemProps {
  entry: VaultEntry;
  onDelete?: (id: string) => void;
  onClick?: () => void;
  onToggleFavorite?: (id: string) => void;
  delay?: number;
  isActive?: boolean;
  key?: any;
}

export default function VaultItem({ entry, onDelete, onClick, onToggleFavorite, delay = 0, isActive = false }: VaultItemProps) {
  const { t } = useTranslation();
  const [isRevealed, setIsRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const colors = {
    tertiary: {
      bg: 'bg-tertiary',
      activeText: 'text-tertiary',
      hoverBorder: 'hover:border-tertiary/40'
    },
    secondary: {
      bg: 'bg-secondary',
      activeText: 'text-secondary',
      hoverBorder: 'hover:border-secondary/40'
    },
    primary: {
      bg: 'bg-primary',
      activeText: 'text-primary',
      hoverBorder: 'hover:border-primary/40'
    }
  };

  const themeVars = colors[entry.themeColor] || colors.primary;

  // Mask string representation
  const maskedString = "••••••••••••••••";
  const displayPassword = entry.password || t('app.vaultItem.fallbackPassword');

  const typeLabel = entry.type === 'login'
    ? t('app.vaultItem.typeLogin')
    : entry.type === 'card'
      ? t('app.vaultItem.typeCard')
      : t('app.vaultItem.typeNote');

  const strengthLabel = entry.strength === 'IMMUTABLE'
    ? t('app.vaultItem.strength.immutable')
    : entry.strength === 'EXCELLENT'
      ? t('app.vaultItem.strength.excellent')
      : t('app.vaultItem.strength.good');

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    let textToCopy = displayPassword;
    if (entry.type === 'card' && entry.cardNumber) {
      textToCopy = `${entry.cardNumber} | ${entry.expiryDate} | ${entry.cvv}`;
    }
    
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Icon picking by type
  const getIcon = () => {
    switch (entry.type) {
      case 'card':
        return <CreditCard className="text-secondary w-5 h-5" />;
      case 'note':
        return <FileText className="text-primary w-5 h-5" />;
      case 'crypto':
      case 'login':
      default:
        return <Key className="text-tertiary w-5 h-5" />;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay, duration: 0.3 }}
      onClick={onClick}
      className={`glass-panel p-4 rounded-xl flex items-center justify-between gap-4 transition-all duration-300 group cursor-pointer ${themeVars.hoverBorder} ${
        isActive ? `border-l-2 !border-l-${entry.themeColor} bg-white/[0.04] shadow-lg shadow-${entry.themeColor}/5` : ''
      }`}
      style={isActive ? { borderLeftColor: `var(--color-${entry.themeColor})`, borderLeftWidth: '3px', backgroundColor: 'rgba(255,255,255,0.04)' } : {}}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className={`w-1 h-10 ${themeVars.bg} rounded-full`} />
        
        <div className="w-11 h-11 flex-shrink-0 rounded-lg bg-surface-container border border-white/5 flex items-center justify-center">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-item-title text-on-surface truncate font-semibold">{entry.title}</h4>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
              entry.type === 'login' 
                ? 'bg-tertiary/10 text-tertiary border border-tertiary/10' 
                : entry.type === 'card' 
                  ? 'bg-secondary/10 text-secondary border border-secondary/10' 
                  : 'bg-primary/10 text-primary border border-primary/10'
            }`}>
              {typeLabel}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant font-geist-mono truncate mt-0.5">{entry.subtitle}</p>
        </div>
      </div>
      
      {/* Detail elements / copy reveals */}
      <div className="flex items-center gap-2">
        
        {/* Passwords reveal block for non-notes */}
        {entry.type !== 'note' && (
          <div className="hidden md:flex flex-col items-end mr-2">
            <div className="flex items-center gap-1.5">
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRevealed(!isRevealed);
                }}
                className={`text-mono-data tracking-widest cursor-pointer text-xs transition-colors px-2 py-1 rounded hover:bg-white/5 ${
                  isRevealed ? themeVars.activeText : 'text-on-surface-variant'
                }`}
                title={isRevealed ? t('app.vaultItem.hide') : t('app.vaultItem.show')}
              >
                {isRevealed ? displayPassword : maskedString}
              </span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRevealed(!isRevealed);
                }}
                className="text-on-surface-variant hover:text-on-surface p-1 transition-colors cursor-pointer"
              >
                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            
            <span className={`text-[9px] font-geist font-extrabold uppercase tracking-[0.15em] mt-0.5 ${themeVars.activeText}`}>
              {t('app.vaultItem.resistance')} {strengthLabel}
            </span>
          </div>
        )}

        {/* Favorite Star Button */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(entry.id);
            }}
            className={`p-2 hover:bg-surface-variant rounded-lg transition-all active:scale-[0.85] cursor-pointer focus:outline-none shrink-0 ${
              entry.favorite 
                ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]' 
                : 'text-on-surface-variant/40 hover:text-yellow-400/80'
            }`}
            title={entry.favorite ? t('app.vaultItem.removeFavorite') : t('app.vaultItem.addFavorite')}
          >
            <Star className={`w-4 h-4 ${entry.favorite ? 'fill-yellow-400' : ''}`} />
          </button>
        )}

        {/* Copy Button */}
        <button 
          onClick={handleCopy}
          className="p-2 hover:bg-surface-variant rounded-lg transition-colors active:scale-95 text-on-surface-variant hover:text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
          title={entry.type === 'card' ? t('app.vaultItem.copyCard') : t('app.vaultItem.copyPassword')}
        >
          {copied ? <Check className="w-4 h-4 text-tertiary animate-pulse" /> : <Copy className="w-4 h-4" />}
        </button>

        {/* Delete Button */}
        {onDelete && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(t('app.vaultItem.moveToTrashConfirm', { title: entry.title }))) {
                onDelete(entry.id);
              }
            }}
            className="p-2 hover:bg-error-container/20 hover:text-error rounded-lg opacity-40 group-hover:opacity-100 transition-all active:scale-95 text-on-surface-variant focus:outline-none cursor-pointer"
            title={t('app.vaultItem.moveToTrash')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

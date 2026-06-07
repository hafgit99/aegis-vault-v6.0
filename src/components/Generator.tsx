import { useState, useEffect } from 'react';
import { Copy, RefreshCw, Check, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { VaultCryptoService } from '../lib/vault/VaultCryptoService';
import { writeClipboardSecret } from '../lib/clipboard';
import { generateRandomString } from '../lib/crypto-types';
import {
  DICEWARE_DEFAULT_SEPARATOR,
  DICEWARE_DEFAULT_WORDS,
  DICEWARE_DEFAULT_WORDLIST_MODE,
  DICEWARE_MAX_WORDS,
  DICEWARE_MIN_WORDS,
  type DicewareLanguage,
  type DicewareWordlistMode,
  generateDicewarePassphrase,
} from '../lib/diceware';

type GeneratorMode = 'characters' | 'diceware';

export default function Generator() {
  const { t } = useTranslation();
  const selectOneMessage = t('app.generator.selectOne');
  const [mode, setMode] = useState<GeneratorMode>(() => {
    try {
      const stored = localStorage.getItem('aegis_gen_mode');
      return stored === 'diceware' ? 'diceware' : 'characters';
    } catch (e) {
      return 'characters';
    }
  });
  const [length, setLength] = useState(() => {
    try {
      const stored = localStorage.getItem('aegis_gen_length');
      return stored !== null ? Number(stored) : 16;
    } catch (e) {
      return 16;
    }
  });

  const [includeUppercase, setIncludeUppercase] = useState(() => {
    try {
      const stored = localStorage.getItem('aegis_gen_uppercase');
      return stored !== null ? stored === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  const [includeLowercase, setIncludeLowercase] = useState(() => {
    try {
      const stored = localStorage.getItem('aegis_gen_lowercase');
      return stored !== null ? stored === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  const [includeNumbers, setIncludeNumbers] = useState(() => {
    try {
      const stored = localStorage.getItem('aegis_gen_numbers');
      return stored !== null ? stored === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  const [includeSymbols, setIncludeSymbols] = useState(() => {
    try {
      const stored = localStorage.getItem('aegis_gen_symbols');
      return stored !== null ? stored === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  const [dicewareLanguage, setDicewareLanguage] = useState<DicewareLanguage>(() => {
    try {
      const stored = localStorage.getItem('aegis_gen_diceware_language');
      return stored === 'tr' ? 'tr' : 'en';
    } catch (e) {
      return 'en';
    }
  });

  const [dicewareWordCount, setDicewareWordCount] = useState(() => {
    try {
      const stored = localStorage.getItem('aegis_gen_diceware_words');
      const parsed = stored !== null ? Number(stored) : DICEWARE_DEFAULT_WORDS;
      return Number.isInteger(parsed) ? Math.min(DICEWARE_MAX_WORDS, Math.max(DICEWARE_MIN_WORDS, parsed)) : DICEWARE_DEFAULT_WORDS;
    } catch (e) {
      return DICEWARE_DEFAULT_WORDS;
    }
  });

  const [dicewareWordlistMode, setDicewareWordlistMode] = useState<DicewareWordlistMode>(() => {
    try {
      const stored = localStorage.getItem('aegis_gen_diceware_wordlist_mode');
      return stored === 'full' ? 'full' : DICEWARE_DEFAULT_WORDLIST_MODE;
    } catch (e) {
      return DICEWARE_DEFAULT_WORDLIST_MODE;
    }
  });

  const [password, setPassword] = useState("Aeg1s_P@ss_2026_!");
  const [dicewareEntropyBits, setDicewareEntropyBits] = useState(0);
  const [dicewareWordlistSize, setDicewareWordlistSize] = useState(0);
  const [copied, setCopied] = useState(false);

  const generatePassword = () => {
    if (mode === 'characters' && !includeUppercase && !includeLowercase && !includeNumbers && !includeSymbols) {
      setPassword(selectOneMessage);
      return;
    }

    try {
      localStorage.setItem('aegis_gen_mode', mode);
      localStorage.setItem('aegis_gen_length', String(length));
      localStorage.setItem('aegis_gen_uppercase', String(includeUppercase));
      localStorage.setItem('aegis_gen_lowercase', String(includeLowercase));
      localStorage.setItem('aegis_gen_numbers', String(includeNumbers));
      localStorage.setItem('aegis_gen_symbols', String(includeSymbols));
      localStorage.setItem('aegis_gen_diceware_language', dicewareLanguage);
      localStorage.setItem('aegis_gen_diceware_words', String(dicewareWordCount));
      localStorage.setItem('aegis_gen_diceware_wordlist_mode', dicewareWordlistMode);
    } catch (e) {}

    if (mode === 'diceware') {
      const generated = generateDicewarePassphrase({
        language: dicewareLanguage,
        wordCount: dicewareWordCount,
        wordlistMode: dicewareWordlistMode,
        separator: DICEWARE_DEFAULT_SEPARATOR,
      });
      setPassword(generated.value);
      setDicewareEntropyBits(generated.entropyBits);
      setDicewareWordlistSize(generated.wordlistSize);
      setCopied(false);
      return;
    }

    let charset = "";
    if (includeUppercase) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (includeLowercase) charset += "abcdefghijklmnopqrstuvwxyz";
    if (includeNumbers) charset += "0123456789";
    if (includeSymbols) charset += "!@#$%^&*()_+~`|}{[]:;?><,./-=";

    const generated = charset ? generateRandomString(length, charset) : VaultCryptoService.generateSecurePassword();
    setDicewareEntropyBits(0);
    setDicewareWordlistSize(0);
    setPassword(generated);
    setCopied(false);
  };

  useEffect(() => {
    generatePassword();
  }, [mode, length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, dicewareLanguage, dicewareWordCount, dicewareWordlistMode]);

  const copyToClipboard = () => {
    if (password === selectOneMessage) return;
    writeClipboardSecret(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate dynamic security score (simple check)
  const calculateStrength = () => {
    if (password === selectOneMessage) return { text: t('app.generator.strength.insufficient'), color: "text-error", bg: "bg-error" };
    if (mode === 'diceware') {
      if (dicewareEntropyBits >= 100) return { text: t('app.generator.strength.perfect'), color: "text-tertiary", bg: "bg-tertiary" };
      if (dicewareEntropyBits >= 75) return { text: t('app.generator.strength.strong'), color: "text-secondary", bg: "bg-secondary" };
      return { text: t('app.generator.strength.weak'), color: "text-error", bg: "bg-error" };
    }
    let score = 0;
    if (length >= 12) score += 1;
    if (length >= 16) score += 1;
    if (includeUppercase) score += 1;
    if (includeLowercase) score += 1;
    if (includeNumbers) score += 1;
    if (includeSymbols) score += 1;

    if (score <= 3) return { text: t('app.generator.strength.weak'), color: "text-error", bg: "bg-error" };
    if (score === 4 || score === 5) return { text: t('app.generator.strength.strong'), color: "text-secondary", bg: "bg-secondary" };
    return { text: t('app.generator.strength.perfect'), color: "text-tertiary", bg: "bg-tertiary" };
  };

  const strength = calculateStrength();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 md:space-y-8"
    >
      <div>
        <h2 className="text-display-lg text-on-surface mb-2 font-outfit tracking-tight">{t('app.generator.title')}</h2>
        <p className="text-body-base text-on-surface-variant/80">
          {t('app.generator.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 md:gap-8">
        
        {/* Main Generator Console */}
        <div className="xl:col-span-8 space-y-5 md:space-y-6">
          
          {/* Result Panel */}
          <div className="glass-panel p-4 md:p-6 rounded-[1.25rem] flex flex-col sm:flex-row items-center gap-4 justify-between border-white/10">
            <div className="flex-1 min-w-0 w-full">
              <span className="text-xs text-on-surface-variant/50 font-semibold block mb-1 uppercase tracking-widest">{t('app.generator.generatedPassword')}</span>
              <div className="text-xl md:text-2xl font-geist-mono text-on-surface select-all truncate break-all selection:bg-primary/30">
                {password}
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button 
                onClick={generatePassword}
                aria-label={t('app.generator.regenerate')}
                className="p-3 bg-surface-container hover:bg-surface-variant/50 rounded-xl border border-white/5 text-on-surface-variant hover:text-on-surface transition-all active:scale-95"
                title={t('app.generator.regenerate')}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              
              <button 
                onClick={copyToClipboard}
                className="flex-1 sm:flex-none py-3 px-5 bg-primary hover:bg-primary/90 text-on-primary rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/10"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copied ? t('app.generator.copied') : t('app.generator.copy')}
              </button>
            </div>
          </div>

            {/* Configuration Form */}
            <div className="glass-panel p-4 md:p-8 rounded-[1.25rem] space-y-5 md:space-y-6">

            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-surface-container/25 p-1">
              <button
                type="button"
                onClick={() => setMode('characters')}
                className={`rounded-xl px-4 py-3 text-sm font-bold transition-all ${mode === 'characters' ? 'bg-primary text-on-primary shadow-lg shadow-primary/10' : 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface'}`}
              >
                {t('app.generator.modeCharacters')}
              </button>
              <button
                type="button"
                onClick={() => setMode('diceware')}
                className={`rounded-xl px-4 py-3 text-sm font-bold transition-all ${mode === 'diceware' ? 'bg-primary text-on-primary shadow-lg shadow-primary/10' : 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface'}`}
              >
                {t('app.generator.modeDiceware')}
              </button>
            </div>
            
            {mode === 'characters' ? (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-item-title text-on-surface select-none">{t('app.generator.length')}</span>
                    <span className="text-lg font-geist-mono font-bold text-tertiary select-none">{length}</span>
                  </div>
                  <input 
                    type="range" 
                    min="8" 
                    max="64" 
                    value={length}
                    onChange={(e) => setLength(parseInt(e.target.value))}
                    className="w-full accent-tertiary h-1.5 bg-surface-container rounded-lg cursor-pointer transition-all focus:outline-none"
                  />
                  <div className="flex justify-between text-xs text-on-surface-variant/40 select-none">
                    <span>{t('app.generator.characters', { count: 8 })}</span>
                    <span>{t('app.generator.characters', { count: 32 })}</span>
                    <span>{t('app.generator.characters', { count: 64 })}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4 pt-2">
                  
                  <label className="flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-surface-container/30 hover:bg-surface-container/50 rounded-xl border border-white/5 cursor-pointer select-none transition-colors group">
                    <input 
                      type="checkbox" 
                      checked={includeUppercase} 
                      onChange={(e) => setIncludeUppercase(e.target.checked)}
                      className="w-5 h-5 accent-tertiary rounded border-none bg-surface-container-highest"
                    />
                    <div>
                      <span className="text-sm font-semibold text-on-surface block group-hover:text-tertiary transition-colors">{t('app.generator.uppercase')}</span>
                      <span className="text-[11px] text-on-surface-variant/60">{t('app.generator.uppercaseDescription')}</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-surface-container/30 hover:bg-surface-container/50 rounded-xl border border-white/5 cursor-pointer select-none transition-colors group">
                    <input 
                      type="checkbox" 
                      checked={includeLowercase} 
                      onChange={(e) => setIncludeLowercase(e.target.checked)}
                      className="w-5 h-5 accent-tertiary rounded border-none bg-surface-container-highest"
                    />
                    <div>
                      <span className="text-sm font-semibold text-on-surface block group-hover:text-tertiary transition-colors">{t('app.generator.lowercase')}</span>
                      <span className="text-[11px] text-on-surface-variant/60">{t('app.generator.lowercaseDescription')}</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-surface-container/30 hover:bg-surface-container/50 rounded-xl border border-white/5 cursor-pointer select-none transition-colors group">
                    <input 
                      type="checkbox" 
                      checked={includeNumbers} 
                      onChange={(e) => setIncludeNumbers(e.target.checked)}
                      className="w-5 h-5 accent-tertiary rounded border-none bg-surface-container-highest"
                    />
                    <div>
                      <span className="text-sm font-semibold text-on-surface block group-hover:text-tertiary transition-colors">{t('app.generator.numbers')}</span>
                      <span className="text-[11px] text-on-surface-variant/60">{t('app.generator.numbersDescription')}</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-surface-container/30 hover:bg-surface-container/50 rounded-xl border border-white/5 cursor-pointer select-none transition-colors group">
                    <input 
                      type="checkbox" 
                      checked={includeSymbols} 
                      onChange={(e) => setIncludeSymbols(e.target.checked)}
                      className="w-5 h-5 accent-tertiary rounded border-none bg-surface-container-highest"
                    />
                    <div>
                      <span className="text-sm font-semibold text-on-surface block group-hover:text-tertiary transition-colors">{t('app.generator.symbols')}</span>
                      <span className="text-[11px] text-on-surface-variant/60">{t('app.generator.symbolsDescription')}</span>
                    </div>
                  </label>

                </div>
              </>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
                  <label className="space-y-2">
                    <span className="text-item-title text-on-surface select-none">{t('app.generator.dicewareLanguage')}</span>
                    <select
                      value={dicewareLanguage}
                      onChange={(e) => setDicewareLanguage(e.target.value as DicewareLanguage)}
                      className="w-full rounded-xl border border-white/10 bg-[#121722] px-4 py-3 text-sm font-semibold text-on-surface outline-none focus:border-tertiary/60"
                    >
                      <option value="en">{t('app.generator.dicewareEnglish')}</option>
                      <option value="tr">{t('app.generator.dicewareTurkish')}</option>
                    </select>
                  </label>

                  <div className="rounded-xl border border-white/10 bg-surface-container/25 p-4">
                    <span className="text-xs text-on-surface-variant/50 uppercase tracking-widest">{t('app.generator.wordlistSize')}</span>
                    <div className="mt-1 text-lg font-geist-mono font-bold text-tertiary">
                      {dicewareWordlistSize || 7776}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-item-title text-on-surface select-none">{t('app.generator.wordlistMode')}</span>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-surface-container/25 p-1">
                    <button
                      type="button"
                      onClick={() => setDicewareWordlistMode('clean')}
                      className={`rounded-xl px-4 py-3 text-sm font-bold transition-all ${dicewareWordlistMode === 'clean' ? 'bg-secondary text-on-secondary shadow-lg shadow-secondary/10' : 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface'}`}
                    >
                      {t('app.generator.cleanWordlist')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDicewareWordlistMode('full')}
                      className={`rounded-xl px-4 py-3 text-sm font-bold transition-all ${dicewareWordlistMode === 'full' ? 'bg-secondary text-on-secondary shadow-lg shadow-secondary/10' : 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface'}`}
                    >
                      {t('app.generator.fullWordlist')}
                    </button>
                  </div>
                  <p className="text-xs text-on-surface-variant/60 leading-relaxed">
                    {dicewareWordlistMode === 'clean'
                      ? t('app.generator.cleanWordlistDescription')
                      : t('app.generator.fullWordlistDescription')}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-item-title text-on-surface select-none">{t('app.generator.wordCount')}</span>
                    <span className="text-lg font-geist-mono font-bold text-tertiary select-none">{dicewareWordCount}</span>
                  </div>
                  <input
                    type="range"
                    min={DICEWARE_MIN_WORDS}
                    max={DICEWARE_MAX_WORDS}
                    value={dicewareWordCount}
                    onChange={(e) => setDicewareWordCount(parseInt(e.target.value))}
                    className="w-full accent-tertiary h-1.5 bg-surface-container rounded-lg cursor-pointer transition-all focus:outline-none"
                  />
                  <div className="flex justify-between text-xs text-on-surface-variant/40 select-none">
                    <span>{t('app.generator.words', { count: DICEWARE_MIN_WORDS })}</span>
                    <span>{t('app.generator.words', { count: DICEWARE_DEFAULT_WORDS })}</span>
                    <span>{t('app.generator.words', { count: DICEWARE_MAX_WORDS })}</span>
                  </div>
                </div>

                <p className="rounded-xl border border-tertiary/15 bg-tertiary/10 p-4 text-xs leading-relaxed text-on-surface-variant/80">
                  {t('app.generator.dicewareDescription')}
                </p>
              </div>
            )}

          </div>

        </div>

        {/* Dynamic Strength Info Rail */}
        <div className="xl:col-span-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-5 md:gap-6">
          
          <div className="glass-panel p-4 md:p-6 rounded-[1.25rem] space-y-4">
            <h3 className="text-item-title text-on-surface font-outfit select-none">{t('app.generator.analysis')}</h3>
            
            <div className="space-y-1">
              <span className="text-xs text-on-surface-variant/50 uppercase tracking-widest">{t('app.generator.securityLevel')}</span>
              <div className={`text-base font-extrabold font-geist ${strength.color}`}>
                {strength.text}
              </div>
            </div>

            <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
              <div className={`h-full ${strength.bg} transition-all duration-500`} style={{
                width: password === selectOneMessage 
                  ? '0%' 
                  : mode === 'diceware'
                    ? `${Math.min(100, (dicewareEntropyBits / 100) * 100)}%`
                    : `${Math.min(100, (length / 32) * 50 + (includeSymbols ? 20 : 0) + (includeNumbers ? 15 : 0) + (includeUppercase ? 15 : 0))}%`
              }} />
            </div>

            <p className="text-xs text-on-surface-variant/70 leading-relaxed">
              {mode === 'diceware'
                ? t('app.generator.dicewareEntropy', { bits: dicewareEntropyBits.toFixed(1) })
                : t('app.generator.strengthDescription')}
            </p>
          </div>

          <div className="security-gradient p-4 md:p-6 rounded-[1.25rem] border border-primary/10 flex gap-3">
            <ShieldAlert className="text-tertiary w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-widest mb-1">{t('app.generator.warningTitle')}</h4>
              <p className="text-xs text-on-surface-variant/80 leading-relaxed">
                {t('app.generator.warningDescription')}
              </p>
            </div>
          </div>

        </div>

      </div>
    </motion.div>
  );
}

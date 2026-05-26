type SupportedRuntimeLanguage = 'tr' | 'en' | 'zh-CN';

type MessageKey =
  | 'airgapActive'
  | 'networkBlocked'
  | 'airgapError'
  | 'encryptionFailed'
  | 'decryptionFailed'
  | 'dbConfigMissing'
  | 'invalidMasterPassword'
  | 'dbLocked'
  | 'dbAuthMissing'
  | 'oldMasterInvalid'
  | 'backupImportError';

const runtimeMessages: Record<SupportedRuntimeLanguage, Record<MessageKey, string>> = {
  tr: {
    airgapActive: '[AegisVault Air-Gap] Arttırılmış Çevrimdışı Modu (Air-Gap) aktif. Tüm dış ağ istekleri engelleniyor.',
    networkBlocked: 'Ağ isteği AegisVault Çevrimdışı Modu (Air-Gap) tarafından engellendi.',
    airgapError: '[AegisVault Air-Gap] Hata:',
    encryptionFailed: 'Şifreleme işlemi başarısız oldu.',
    decryptionFailed: 'Parola yanlış veya yedek dosyası bozuk.',
    dbConfigMissing: 'Veritabanı yapılandırması bulunamadı. Lütfen yeni bir kasa oluşturun.',
    invalidMasterPassword: 'Hatalı Master Şifre!',
    dbLocked: 'Veritabanı kilidi açık değil',
    dbAuthMissing: 'Veritabanı kimlik doğrulaması bulunamadı.',
    oldMasterInvalid: 'Eski Master Şifre hatalı!',
    backupImportError: 'Yedek aktarım hatası:'
  },
  en: {
    airgapActive: '[AegisVault Air-Gap] Enhanced Offline Mode (Air-Gap) is active. All external network requests are blocked.',
    networkBlocked: 'The network request was blocked by AegisVault Offline Mode (Air-Gap).',
    airgapError: '[AegisVault Air-Gap] Error:',
    encryptionFailed: 'Encryption failed.',
    decryptionFailed: 'Password is incorrect or the backup file is corrupted.',
    dbConfigMissing: 'Database configuration was not found. Please create a new vault.',
    invalidMasterPassword: 'Invalid Master Password.',
    dbLocked: 'Database is not unlocked',
    dbAuthMissing: 'Database authentication was not found.',
    oldMasterInvalid: 'Old Master Password is incorrect.',
    backupImportError: 'Backup import error:'
  },
  'zh-CN': {
    airgapActive: '[AegisVault Air-Gap] 增强离线模式（Air-Gap）已启用。所有外部网络请求都会被阻止。',
    networkBlocked: '网络请求已被 AegisVault 离线模式（Air-Gap）阻止。',
    airgapError: '[AegisVault Air-Gap] 错误：',
    encryptionFailed: '加密失败。',
    decryptionFailed: '密码不正确或备份文件已损坏。',
    dbConfigMissing: '未找到数据库配置。请创建新的保险库。',
    invalidMasterPassword: '主密码无效。',
    dbLocked: '数据库尚未解锁',
    dbAuthMissing: '未找到数据库身份验证信息。',
    oldMasterInvalid: '旧主密码不正确。',
    backupImportError: '备份导入错误：'
  }
};

export const getRuntimeLanguage = (): SupportedRuntimeLanguage => {
  try {
    const stored = localStorage.getItem('aegis_language');
    if (stored === 'tr' || stored === 'en' || stored === 'zh-CN') return stored;

    const browserLanguage = navigator.language;
    if (browserLanguage.startsWith('zh')) return 'zh-CN';
    if (browserLanguage.startsWith('en')) return 'en';
  } catch (e) {}

  return 'tr';
};

export const localizedMessage = (key: MessageKey): string => {
  const language = getRuntimeLanguage();
  return runtimeMessages[language][key];
};

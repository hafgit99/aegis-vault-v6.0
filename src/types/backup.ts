export type BackupExportMethod = 'encrypted' | 'share' | 'plain';

export type SecureShareExpiryDays = '1' | '7' | '30' | 'never';

export interface BackupExportPreview {
  fileName: string;
  sampleData: string;
}

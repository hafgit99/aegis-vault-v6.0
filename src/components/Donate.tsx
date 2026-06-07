import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BadgeCheck, Check, Coins, Copy, Info, ShieldCheck, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import { writeClipboardSecret } from '../lib/clipboard';

type DonationAsset = {
  id: string;
  symbol: string;
  name: string;
  network: string;
  address: string;
  uriScheme?: string;
  accent: string;
};

const DONATION_ASSETS: DonationAsset[] = [
  {
    id: 'sol',
    symbol: 'SOL',
    name: 'Solana',
    network: 'Solana',
    address: '81H1rKZHjpSsnr6Epumw9XVTfqAnqSHcTKm7D3VsEd74',
    uriScheme: 'solana',
    accent: 'text-tertiary',
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Ethereum',
    network: 'Ethereum',
    address: '0x4bd17Cc073D08E3E021Fd315d840554c840843E1',
    uriScheme: 'ethereum',
    accent: 'text-secondary',
  },
  {
    id: 'usdt-eth',
    symbol: 'USDT',
    name: 'Tether',
    network: 'Ethereum ERC-20',
    address: '0x4bd17Cc073D08E3E021Fd315d840554c840843E1',
    accent: 'text-tertiary',
  },
  {
    id: 'xrp',
    symbol: 'XRP',
    name: 'XRP',
    network: 'XRP Ledger',
    address: 'rfXzWPGKFMGdaYsqFCiyZHhRXF741Snx8N',
    accent: 'text-primary',
  },
  {
    id: 'tron',
    symbol: 'TRX',
    name: 'TRON',
    network: 'TRON',
    address: 'TQBz3q8Ddjap3K8QdFQHtJKBxbvXMCi62E',
    uriScheme: 'tron',
    accent: 'text-error',
  },
  {
    id: 'bch',
    symbol: 'BCH',
    name: 'Bitcoin Cash',
    network: 'Bitcoin Cash',
    address: 'qzfd46kp4tguu8pxrs6gnux0qxndhnqk8sa83q08wm',
    uriScheme: 'bitcoincash',
    accent: 'text-tertiary',
  },
  {
    id: 'ltc',
    symbol: 'LTC',
    name: 'Litecoin',
    network: 'Litecoin',
    address: 'LZC3egqj1K9aZ3i42HbsRWK7m1SbUgXmak',
    uriScheme: 'litecoin',
    accent: 'text-secondary',
  },
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    network: 'Bitcoin',
    address: 'bc1qqsuljwzs32ckkqdrsdus7wgqzuetty3g0x47l7',
    uriScheme: 'bitcoin',
    accent: 'text-primary',
  },
  {
    id: 'xtz',
    symbol: 'XTZ',
    name: 'Tezos',
    network: 'Tezos',
    address: 'tz1Tij1ujzkEyvA949x1q7EW17s6pUNbEUdV',
    uriScheme: 'tezos',
    accent: 'text-tertiary',
  },
];

const shortenAddress = (address: string) => `${address.slice(0, 10)}...${address.slice(-8)}`;

const buildPaymentUri = (asset: DonationAsset) => (
  asset.uriScheme ? `${asset.uriScheme}:${asset.address}` : asset.address
);

export default function Donate() {
  const { t } = useTranslation();
  const [selectedAssetId, setSelectedAssetId] = useState(DONATION_ASSETS[0].id);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const selectedAsset = useMemo(
    () => DONATION_ASSETS.find(asset => asset.id === selectedAssetId) ?? DONATION_ASSETS[0],
    [selectedAssetId]
  );

  const copyValue = async (value: string, copiedKey: string) => {
    await writeClipboardSecret(value);
    setCopiedValue(copiedKey);
    window.setTimeout(() => setCopiedValue(current => (current === copiedKey ? null : current)), 1800);
  };

  return (
    <div className="space-y-5 md:space-y-8 pb-10">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-5"
      >
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-tertiary/10 border border-tertiary/15 text-tertiary text-xs font-bold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-4 h-4" />
            {t('app.donatePage.badge')}
          </div>
          <h2 className="text-display-lg text-on-surface mb-3 font-outfit tracking-tight">{t('app.donatePage.title')}</h2>
          <p className="text-sm text-on-surface-variant/80 leading-relaxed max-w-2xl">{t('app.donatePage.description')}</p>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant/20">
          <Wallet className="w-5 h-5 text-primary" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-on-surface-variant/70 font-bold">{t('app.donatePage.walletsAvailable')}</p>
            <p className="text-sm text-on-surface font-semibold">{t('app.donatePage.assetCount', { count: DONATION_ASSETS.length })}</p>
          </div>
        </div>
      </motion.section>

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 md:gap-6">
        <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
          {DONATION_ASSETS.map((asset, index) => (
            <motion.button
              key={asset.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.18) }}
              onClick={() => setSelectedAssetId(asset.id)}
              aria-label={`${asset.symbol} ${asset.name} ${asset.network}`}
              className={`glass-panel p-3 md:p-4 rounded-xl text-left transition-all cursor-pointer border ${
                selectedAsset.id === asset.id
                  ? 'border-primary/45 bg-primary/5 shadow-lg shadow-primary/5'
                  : 'border-white/5 hover:border-primary/20 hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-surface-container-high border border-white/10 flex items-center justify-center shrink-0">
                    <span className={`text-sm font-geist-mono font-black ${asset.accent}`}>{asset.symbol}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-on-surface font-semibold truncate">{asset.name}</p>
                    <p className="text-xs text-on-surface-variant/70 truncate">{asset.network}</p>
                  </div>
                </div>
                {selectedAsset.id === asset.id && <BadgeCheck className="w-5 h-5 text-tertiary shrink-0" />}
              </div>
              <div className="mt-4 rounded-lg bg-surface-container-lowest/70 border border-white/5 px-3 py-2">
                <p className="text-[11px] font-geist-mono text-on-surface-variant/85 break-all">{shortenAddress(asset.address)}</p>
              </div>
            </motion.button>
          ))}
        </div>

        <motion.aside
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-panel rounded-[1.25rem] p-4 md:p-6 border border-primary/10 h-fit xl:sticky xl:top-24"
        >
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-label-caps text-on-surface-variant/70 mb-2">{t('app.donatePage.selectedNetwork')}</p>
              <h3 className="text-headline-md text-on-surface font-outfit">{selectedAsset.name}</h3>
              <p className="text-xs text-on-surface-variant/75 mt-1">{selectedAsset.network}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
              <Coins className="w-6 h-6 text-primary" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-container-lowest/80 border border-white/5 p-4">
              <div
                className="bg-white p-3 rounded-xl shadow-lg shadow-black/20"
                role="img"
                aria-label={t('app.donatePage.qrCodeLabel', { asset: selectedAsset.symbol })}
              >
                <QRCode
                  value={selectedAsset.address}
                  size={164}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0b1020"
                />
              </div>
              <p className="text-[11px] text-on-surface-variant/75 text-center leading-relaxed">
                {t('app.donatePage.scanAddress', { asset: selectedAsset.symbol })}
              </p>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-on-surface-variant/70 font-bold mb-2 block">
                {t('app.donatePage.addressLabel')}
              </label>
              <div className="rounded-xl bg-surface-container-lowest/80 border border-white/5 p-3">
                <p className="text-xs font-geist-mono text-on-surface leading-relaxed break-all">{selectedAsset.address}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
              <button
                onClick={() => copyValue(selectedAsset.address, `${selectedAsset.id}:address`)}
                className="h-11 bg-primary text-on-primary rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
              >
                {copiedValue === `${selectedAsset.id}:address` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedValue === `${selectedAsset.id}:address` ? t('app.donatePage.copied') : t('app.donatePage.copyAddress')}
              </button>
              <button
                onClick={() => copyValue(buildPaymentUri(selectedAsset), `${selectedAsset.id}:uri`)}
                className="h-11 bg-surface-container-high border border-outline-variant/20 text-on-surface rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:border-primary/30 hover:text-primary transition-colors"
              >
                {copiedValue === `${selectedAsset.id}:uri` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedValue === `${selectedAsset.id}:uri` ? t('app.donatePage.copied') : t('app.donatePage.copyPaymentUri')}
              </button>
            </div>

            {selectedAsset.id === 'usdt-eth' && (
              <div className="rounded-xl border border-tertiary/20 bg-tertiary/10 p-3 flex gap-3">
                <Info className="w-4 h-4 text-tertiary shrink-0 mt-0.5" />
                <p className="text-xs text-on-surface-variant leading-relaxed">{t('app.donatePage.usdtWarning')}</p>
              </div>
            )}
          </div>
        </motion.aside>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {[t('app.donatePage.noteVerify'), t('app.donatePage.noteNetwork'), t('app.donatePage.notePrivacy')].map((note) => (
          <div key={note} className="security-gradient rounded-xl p-4 border border-primary/10 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-tertiary shrink-0" />
            <p className="text-xs text-on-surface-variant/85 leading-relaxed">{note}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

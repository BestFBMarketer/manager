import { useEffect, useState } from 'react';
import { api, type PublishTarget } from '../lib/api.js';

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram (Reels)',
  tiktok: 'TikTok',
  facebook: 'Facebook (henüz uygulanmadı)',
};

function PlatformRow({ channelId, platform, target }: { channelId: string; platform: string; target: PublishTarget | undefined }) {
  const [credentialsEnvKey, setCredentialsEnvKey] = useState(target?.credentials_env_key ?? '');
  const [externalChannelRef, setExternalChannelRef] = useState(target?.external_channel_ref ?? '');
  const [enabled, setEnabled] = useState(target?.enabled === 1);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const disabled = platform === 'facebook';

  async function handleSave() {
    setBusy(true);
    setSaved(false);
    try {
      await api.updatePublishTarget(channelId, platform, { credentialsEnvKey, externalChannelRef, enabled });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'center' }}>
      <label className="row" style={{ gap: 6, marginBottom: 0, width: 180 }}>
        <input type="checkbox" checked={enabled} disabled={disabled} onChange={(e) => setEnabled(e.target.checked)} />
        {PLATFORM_LABELS[platform] ?? platform}
      </label>
      <input
        placeholder=".env access token değişken adı (ör. INSTAGRAM_ACCESS_TOKEN_SHORTS)"
        value={credentialsEnvKey}
        disabled={disabled}
        onChange={(e) => setCredentialsEnvKey(e.target.value)}
        style={{ flex: 2 }}
      />
      {platform === 'instagram' && (
        <input
          placeholder="Instagram business account id"
          value={externalChannelRef}
          onChange={(e) => setExternalChannelRef(e.target.value)}
          style={{ flex: 1 }}
        />
      )}
      <button type="button" className="secondary" disabled={busy || disabled} onClick={handleSave}>
        {busy ? 'kaydediliyor...' : 'kaydet'}
      </button>
      {saved && <span className="muted">kaydedildi</span>}
    </div>
  );
}

export default function Connections({ channelId }: { channelId: string }) {
  const [targets, setTargets] = useState<PublishTarget[] | null>(null);

  useEffect(() => {
    api.listPublishTargets(channelId).then(setTargets);
  }, [channelId]);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Bağlantılar (Instagram / TikTok)</h3>
      <p className="muted">
        Gerçek erişim token'ları buraya yazılmaz - .env'e eklenen değişkenin ADI girilir. Onaylanan her video, burada
        aktif olan platformlara da otomatik yayınlanır (YouTube'un zamanlı yayınının aksine anında).
      </p>

      {!targets && <p className="muted">yükleniyor...</p>}
      {targets && (
        <>
          <PlatformRow channelId={channelId} platform="instagram" target={targets.find((t) => t.platform === 'instagram')} />
          <PlatformRow channelId={channelId} platform="tiktok" target={targets.find((t) => t.platform === 'tiktok')} />
          <PlatformRow channelId={channelId} platform="facebook" target={targets.find((t) => t.platform === 'facebook')} />
        </>
      )}
    </div>
  );
}

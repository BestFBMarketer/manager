import { useEffect, useState } from 'react';
import { api, type MetaPage, type PublishTarget } from '../lib/api.js';

function TikTokRow({ channelId, target }: { channelId: string; target: PublishTarget | undefined }) {
  const [credentialsEnvKey, setCredentialsEnvKey] = useState(target?.credentials_env_key ?? '');
  const [enabled, setEnabled] = useState(target?.enabled === 1);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setBusy(true);
    setSaved(false);
    try {
      await api.updatePublishTarget(channelId, 'tiktok', { credentialsEnvKey, externalChannelRef: '', enabled });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'center' }}>
      <label className="row" style={{ gap: 6, marginBottom: 0, width: 180 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        TikTok (manuel token - OAuth henüz yok)
      </label>
      <input
        placeholder=".env access token değişken adı (ör. TIKTOK_ACCESS_TOKEN_SHORTS)"
        value={credentialsEnvKey}
        onChange={(e) => setCredentialsEnvKey(e.target.value)}
        style={{ flex: 2 }}
      />
      <button type="button" className="secondary" disabled={busy} onClick={handleSave}>
        {busy ? 'kaydediliyor...' : 'kaydet'}
      </button>
      {saved && <span className="muted">kaydedildi</span>}
    </div>
  );
}

function MetaTargetStatus({ label, target }: { label: string; target: PublishTarget | undefined }) {
  if (!target?.enabled || !target.account_label) {
    return <span className="muted">{label}: bağlı değil</span>;
  }
  return (
    <span>
      {label}: <strong>{target.account_label}</strong> olarak bağlı
    </span>
  );
}

export default function Connections({ channelId }: { channelId: string }) {
  const [targets, setTargets] = useState<PublishTarget[] | null>(null);
  const [pendingPages, setPendingPages] = useState<MetaPage[] | null>(null);
  const [selectedPageForFb, setSelectedPageForFb] = useState('');
  const [selectedPageForIg, setSelectedPageForIg] = useState('');
  const [busyPlatform, setBusyPlatform] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadTargets() {
    api.listPublishTargets(channelId).then(setTargets);
  }

  useEffect(loadTargets, [channelId]);

  useEffect(() => {
    // OAuth callback'i buraya ?connected=facebook ile geri yonlendiriyor - o an bekleyen
    // sayfa listesi var mi diye bak. Baglanti yoksa (dogrudan gelinmisse) sessizce bos doner.
    api
      .getPendingFacebookConnection(channelId)
      .then((data) => {
        if (data.pages.length > 0) setPendingPages(data.pages);
      })
      .catch(() => undefined);
  }, [channelId]);

  async function finalize(platform: 'facebook' | 'instagram', pageId: string) {
    if (!pageId) return;
    setBusyPlatform(platform);
    setError(null);
    try {
      await api.finalizeFacebookConnection(channelId, platform, pageId);
      setPendingPages(null);
      loadTargets();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${platform} bağlanamadı`);
    } finally {
      setBusyPlatform(null);
    }
  }

  const facebookTarget = targets?.find((t) => t.platform === 'facebook');
  const instagramTarget = targets?.find((t) => t.platform === 'instagram');
  const tiktokTarget = targets?.find((t) => t.platform === 'tiktok');
  const igEligiblePages = pendingPages?.filter((p) => p.instagramBusinessAccountId) ?? [];

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Bağlantılar (Facebook Sayfası / Instagram / TikTok)</h3>
      <p className="muted">
        Onaylanan her video, burada aktif olan platformlara da otomatik yayınlanır (YouTube'un zamanlı yayınının
        aksine anında). Facebook Sayfasına ve Instagram Reels'e Facebook girişiyle bağlanılır - gerçek token'ı
        görmen/yapıştırman gerekmez. (Facebook grubuna postlama Meta'nın Groups API'yi self-servis başvurudan
        kaldırması nedeniyle şu an mümkün değil.)
      </p>

      {error && <p className="error-text">{error}</p>}

      {!targets && <p className="muted">yükleniyor...</p>}
      {targets && (
        <>
          <div className="row" style={{ gap: 12, marginBottom: 12, alignItems: 'center' }}>
            <MetaTargetStatus label="Facebook Sayfası" target={facebookTarget} />
            <MetaTargetStatus label="Instagram" target={instagramTarget} />
            <a href={api.facebookConnectUrl(channelId)}>
              <button type="button">Facebook ile bağlan</button>
            </a>
          </div>

          {pendingPages && (
            <div className="card" style={{ background: 'var(--panel-alt, #1a1a1a)', marginBottom: 12 }}>
              <p className="muted" style={{ marginTop: 0 }}>
                Facebook'tan geldi - yönetici olduğun sayfayı seç, hangi platforma bağlanacağını onayla:
              </p>

              {pendingPages.length > 0 ? (
                <div className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ width: 140 }}>Facebook Sayfası</span>
                  <select
                    value={selectedPageForFb}
                    onChange={(e) => setSelectedPageForFb(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">seç...</option>
                    {pendingPages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedPageForFb || busyPlatform === 'facebook'}
                    onClick={() => finalize('facebook', selectedPageForFb)}
                  >
                    Bağla
                  </button>
                </div>
              ) : (
                <p className="muted">Yönetici olduğun bir Facebook Sayfası bulunamadı.</p>
              )}

              {igEligiblePages.length > 0 ? (
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 140 }}>Instagram (sayfa üzerinden)</span>
                  <select
                    value={selectedPageForIg}
                    onChange={(e) => setSelectedPageForIg(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">seç...</option>
                    {igEligiblePages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedPageForIg || busyPlatform === 'instagram'}
                    onClick={() => finalize('instagram', selectedPageForIg)}
                  >
                    Bağla
                  </button>
                </div>
              ) : (
                <p className="muted">
                  Instagram Business hesabına bağlı bir Facebook Sayfası bulunamadı - Instagram hesabını önce bir
                  Sayfa'ya bağlaman gerekir (Instagram ayarları → Bağlı hesaplar).
                </p>
              )}
            </div>
          )}

          <TikTokRow channelId={channelId} target={tiktokTarget} />
        </>
      )}
    </div>
  );
}

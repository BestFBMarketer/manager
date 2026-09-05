import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type CompetitorCandidate, type CompetitorChannel, type VphAlert } from '../lib/api.js';

export default function CompetitorWatchlist() {
  const { id } = useParams<{ id: string }>();
  const [competitors, setCompetitors] = useState<CompetitorChannel[] | null>(null);
  const [alerts, setAlerts] = useState<VphAlert[] | null>(null);
  const [candidates, setCandidates] = useState<CompetitorCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newYtId, setNewYtId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [keywords, setKeywords] = useState('');
  const [decidedBy, setDecidedBy] = useState('');
  const [busy, setBusy] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  function load() {
    if (!id) return;
    api.listCompetitors(id).then(setCompetitors).catch((err) => setError(err instanceof Error ? err.message : 'rakip listesi yüklenemedi'));
    api.listVphAlerts(id).then(setAlerts).catch((err) => setError(err instanceof Error ? err.message : 'VPH uyarıları yüklenemedi'));
    api.listCompetitorCandidates(id).then(setCandidates).catch((err) => setError(err instanceof Error ? err.message : 'rakip aday listesi yüklenemedi'));
  }

  useEffect(load, [id]);

  async function handleDiscover() {
    if (!id) return;
    const kws = keywords.split(',').map((k) => k.trim()).filter(Boolean);
    if (kws.length === 0) {
      setError('En az bir anahtar kelime gerekli (virgülle ayır)');
      return;
    }
    setDiscovering(true);
    setError(null);
    try {
      await api.discoverCompetitors(id, kws);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'keşif başarısız');
    } finally {
      setDiscovering(false);
    }
  }

  async function handleApproveCandidate(candidateId: number) {
    if (!decidedBy.trim()) {
      setError('Onaylayan adı gerekli');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.approveCompetitorCandidate(candidateId, decidedBy);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'onay başarısız');
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectCandidate(candidateId: number) {
    if (!decidedBy.trim()) {
      setError('Reddeden adı gerekli');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.rejectCompetitorCandidate(candidateId, decidedBy);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'reddetme başarısız');
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    if (!id || !newYtId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addCompetitor(id, newYtId.trim(), newLabel.trim() || undefined);
      setNewYtId('');
      setNewLabel('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'rakip eklenemedi');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(competitorId: number) {
    await api.removeCompetitor(competitorId).catch(() => undefined);
    load();
  }

  async function handleDismiss(alertId: number) {
    await api.dismissVphAlert(alertId).catch(() => undefined);
    load();
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Rakip Radar - {id}</h2>
      <p className="muted">
        Rakip kanalların son 48 saatlik yüklemeleri taranır; kanal ortalamasının 5 katı hızda
        izlenen (VPH outlier) bir video bulunursa burada uyarı olarak görünür.
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Rakip Keşfi</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Anahtar kelimelerle YouTube'da benzer kanalları otomatik ara - bulunanlar aşağıda
          onay bekler, onaylanmadan izleme listesine (ve VPH taramasına) eklenmez.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <input
            placeholder="anahtar kelimeler, virgülle (örn: pool fails compilation, top 5 fails)"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            style={{ flex: 3 }}
          />
          <button disabled={discovering} onClick={handleDiscover}>
            {discovering ? 'aranıyor...' : 'Keşfet'}
          </button>
        </div>

        {candidates && candidates.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <input
              placeholder="kararı veren (isim)"
              value={decidedBy}
              onChange={(e) => setDecidedBy(e.target.value)}
              style={{ marginBottom: 8, width: '100%' }}
            />
            {candidates.map((c) => (
              <div key={c.id} className="row" style={{ justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                <span>
                  <a href={`https://www.youtube.com/channel/${c.competitor_yt_id}`} target="_blank" rel="noreferrer">
                    {c.channel_title}
                  </a>{' '}
                  <span className="muted">({c.subscriber_count?.toLocaleString() ?? '?'} abone · "{c.matched_keyword}" eşleşti)</span>
                </span>
                <div className="row" style={{ gap: 6 }}>
                  <button disabled={busy} onClick={() => handleApproveCandidate(c.id)}>Onayla</button>
                  <button disabled={busy} className="secondary" onClick={() => handleRejectCandidate(c.id)}>Reddet</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {candidates && candidates.length === 0 && <p className="muted" style={{ marginTop: 8 }}>onay bekleyen aday yok</p>}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>İzlenen Rakipler</h3>
        {!competitors && <p className="muted">yükleniyor...</p>}
        {competitors && competitors.length === 0 && <p className="muted">henüz rakip eklenmedi</p>}
        {competitors?.map((c) => (
          <div key={c.id} className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span>
              <a href={`https://www.youtube.com/channel/${c.competitor_yt_id}`} target="_blank" rel="noreferrer">
                {c.label ?? c.competitor_yt_id}
              </a>{' '}
              <span className="muted">({c.competitor_yt_id})</span>
            </span>
            <button className="secondary" onClick={() => handleRemove(c.id)}>Kaldır</button>
          </div>
        ))}

        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <input placeholder="YouTube kanal ID (UC...)" value={newYtId} onChange={(e) => setNewYtId(e.target.value)} style={{ flex: 2 }} />
          <input placeholder="etiket (isteğe bağlı)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} style={{ flex: 1 }} />
          <button disabled={busy} onClick={handleAdd}>Ekle</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>VPH Uyarıları</h3>
        {!alerts && <p className="muted">yükleniyor...</p>}
        {alerts && alerts.length === 0 && <p className="muted">yeni uyarı yok</p>}
        {alerts?.map((a) => (
          <div key={a.id} className="row" style={{ justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-start' }}>
            <div>
              <a href={`https://youtu.be/${a.video_id}`} target="_blank" rel="noreferrer">{a.title}</a>
              {a.duration_sec !== null && a.duration_sec > 183 && (
                <span className="badge" style={{ marginLeft: 6 }} title="Shorts değil - sahne kaynağı olarak kullanılabilir">
                  Uzun video · sahne kaynağı
                </span>
              )}
              <p className="muted" style={{ margin: '2px 0 0' }}>
                {a.vph.toFixed(0)} vph (kanal ort. {a.competitor_avg_vph.toFixed(0)}'ın {(a.vph / a.competitor_avg_vph).toFixed(1)} katı) ·{' '}
                {new Date(a.created_at).toLocaleString()}
              </p>
            </div>
            <button className="secondary" onClick={() => handleDismiss(a.id)}>Kapat</button>
          </div>
        ))}
      </div>
    </div>
  );
}

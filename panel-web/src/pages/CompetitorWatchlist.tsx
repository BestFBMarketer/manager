import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type CompetitorChannel, type VphAlert } from '../lib/api.js';

export default function CompetitorWatchlist() {
  const { id } = useParams<{ id: string }>();
  const [competitors, setCompetitors] = useState<CompetitorChannel[] | null>(null);
  const [alerts, setAlerts] = useState<VphAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newYtId, setNewYtId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    if (!id) return;
    api.listCompetitors(id).then(setCompetitors).catch((err) => setError(err instanceof Error ? err.message : 'rakip listesi yüklenemedi'));
    api.listVphAlerts(id).then(setAlerts).catch((err) => setError(err instanceof Error ? err.message : 'VPH uyarıları yüklenemedi'));
  }

  useEffect(load, [id]);

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
        <h3 style={{ marginTop: 0 }}>İzlenen Rakipler</h3>
        {!competitors && <p className="muted">yükleniyor...</p>}
        {competitors && competitors.length === 0 && <p className="muted">henüz rakip eklenmedi</p>}
        {competitors?.map((c) => (
          <div key={c.id} className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span>{c.label ?? c.competitor_yt_id} <span className="muted">({c.competitor_yt_id})</span></span>
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

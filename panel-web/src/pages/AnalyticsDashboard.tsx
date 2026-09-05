import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type VideoAnalyticsSnapshot } from '../lib/api.js';

export default function AnalyticsDashboard() {
  const { id } = useParams<{ id: string }>();
  const [rows, setRows] = useState<VideoAnalyticsSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function load() {
    if (!id) return;
    api
      .getAnalytics(id)
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'analytics yüklenemedi'));
  }

  useEffect(load, [id]);

  async function handleRefresh() {
    if (!id) return;
    setRefreshing(true);
    setError(null);
    try {
      await api.refreshAnalytics(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'yenileme başarısız');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Analytics - {id}</h2>
        <button disabled={refreshing} onClick={handleRefresh}>
          {refreshing ? 'çekiliyor...' : 'Şimdi Yenile'}
        </button>
      </div>
      <p className="muted">
        YouTube Analytics API'den çekilen gerçek veri (taze videolarda 24-48 saat gecikmeli işlenir).
      </p>

      {error && <p className="error-text">{error}</p>}
      {!rows && !error && <p className="muted">yükleniyor...</p>}
      {rows && rows.length === 0 && <p className="muted">henüz analytics verisi yok - "Şimdi Yenile"yi dene</p>}

      {rows && rows.length > 0 && (
        <table className="card" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Başlık</th>
              <th>İzlenme</th>
              <th>Ort. İzlenme %</th>
              <th>Beğeni</th>
              <th>Yorum</th>
              <th>Abone +/-</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.video_id}>
                <td>
                  <a href={`https://youtu.be/${r.video_id}`} target="_blank" rel="noreferrer">
                    {r.title ?? r.video_id}
                  </a>
                </td>
                <td style={{ textAlign: 'center' }}>{r.views.toLocaleString()}</td>
                <td style={{ textAlign: 'center' }}>{r.average_view_percentage?.toFixed(1) ?? '-'}%</td>
                <td style={{ textAlign: 'center' }}>{r.likes}</td>
                <td style={{ textAlign: 'center' }}>{r.comments}</td>
                <td style={{ textAlign: 'center' }}>{r.subscribers_gained}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

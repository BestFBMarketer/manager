import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type VideoAnalyticsSnapshot } from '../lib/api.js';

type FlaggedVideo = VideoAnalyticsSnapshot & { suggestion: string };

export default function FlaggedVideos() {
  const { id } = useParams<{ id: string }>();
  const [rows, setRows] = useState<FlaggedVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getFlaggedVideos(id)
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'flagged video listesi yüklenemedi'));
  }, [id]);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Düşük Performans - {id}</h2>
      <p className="muted">
        Retention veya etkileşim oranı düşük videolar, düzeltme önerisiyle birlikte -
        bkz etkileşim/retention iki-eşik bulgusu.
      </p>

      {error && <p className="error-text">{error}</p>}
      {!rows && !error && <p className="muted">yükleniyor...</p>}
      {rows && rows.length === 0 && <p className="muted">işaretli video yok - hepsi eşiklerin üstünde 🎉</p>}

      {rows?.map((r) => (
        <div key={r.video_id} className="card" style={{ marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <a href={`https://youtu.be/${r.video_id}`} target="_blank" rel="noreferrer">
              {r.title ?? r.video_id}
            </a>
            <span className="muted">
              {r.views.toLocaleString()} izlenme · %{r.average_view_percentage?.toFixed(1) ?? '-'} retention · {r.likes}be/{r.comments}yr
            </span>
          </div>
          <p style={{ marginBottom: 0, marginTop: 8 }}>{r.suggestion}</p>
        </div>
      ))}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, type LongVideo } from '../lib/api.js';

export default function Repurpose() {
  const { id } = useParams<{ id: string }>();
  const [videos, setVideos] = useState<LongVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [busyJobId, setBusyJobId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function load() {
    if (!id) return;
    setError(null);
    api
      .listLongVideos(id)
      .then(setVideos)
      .catch((err) => setError(err instanceof Error ? err.message : 'videolar yuklenemedi'));
  }

  useEffect(load, [id]);

  async function handleRepurpose(jobId: number) {
    if (!id) return;
    setError(null);
    setSuccessMsg(null);
    setBusyJobId(jobId);
    try {
      const count = counts[jobId] ?? 3;
      const result = await api.repurposeVideo(id, jobId, count);
      setSuccessMsg(`${result.queued} Shorts kuyruğa eklendi (iş #${jobId})`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'shorts turetme basarisiz');
    } finally {
      setBusyJobId(null);
    }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ marginTop: 0 }}>Shorts türet - {id}</h2>
        <Link to={`/channels/${id}`}>
          <button type="button" className="secondary">
            Ayarlara dön
          </button>
        </Link>
      </div>
      <p className="muted">
        Yayınlanmış uzun videolardan elle seçtiğin sayıda Shorts kesiti planla - her biri LLM ile en ilgi çekici
        anları seçer, orijinal videoya link ekler ve birkaç gün arayla yayına alınacak şekilde zamanlanır.
        Otomatik türetme kanal ayarlarından ayrı açık/kapalı olarak da çalışabilir; burası elle tetikleme içindir.
      </p>

      {error && <p className="error-text">{error}</p>}
      {successMsg && <p style={{ color: 'var(--ok, #4caf50)' }}>{successMsg}</p>}
      {!videos && <p className="muted">yükleniyor...</p>}
      {videos && videos.length === 0 && (
        <p className="muted">henüz yayınlanmış, onaylı bir uzun video yok (HotelTour/StoryNarrative)</p>
      )}

      {videos && videos.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Başlık</th>
              <th>Yayın tarihi</th>
              <th>Süre</th>
              <th>Mevcut Shorts</th>
              <th>Adet</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v.jobId}>
                <td>
                  <a href={v.videoUrl} target="_blank" rel="noreferrer">
                    {v.title}
                  </a>
                </td>
                <td>{new Date(v.publishAt).toLocaleString('tr-TR')}</td>
                <td>{v.durationSec ? `${Math.round(v.durationSec / 60)} dk` : '-'}</td>
                <td>{v.derivativeCount}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={counts[v.jobId] ?? 3}
                    onChange={(e) => setCounts({ ...counts, [v.jobId]: Number(e.target.value) })}
                    style={{ width: 60 }}
                  />
                </td>
                <td>
                  <button type="button" disabled={busyJobId === v.jobId} onClick={() => handleRepurpose(v.jobId)}>
                    {busyJobId === v.jobId ? 'planlanıyor...' : 'Shorts üret'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

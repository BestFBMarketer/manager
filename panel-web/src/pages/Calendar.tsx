import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type CalendarItem, type PendingReviewSummary } from '../lib/api.js';

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'planlandi',
  published: 'yayinda',
  pending: 'beklemede',
  failed: 'hata',
};

export default function Calendar() {
  const { id } = useParams<{ id: string }>();
  const [scheduled, setScheduled] = useState<CalendarItem[] | null>(null);
  const [pendingReview, setPendingReview] = useState<PendingReviewSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setScheduled(null);
    setPendingReview(null);
    setError(null);
    api
      .getCalendar(id)
      .then((r) => {
        setScheduled(r.scheduled);
        setPendingReview(r.pendingReview);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'takvim yuklenemedi'));
  }, [id]);

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ marginTop: 0 }}>Takvim - {id}</h2>
        <Link to={`/channels/${id}`}>
          <button type="button" className="secondary">
            Ayarlara don
          </button>
        </Link>
      </div>

      {error && <p className="error-text">{error}</p>}

      <h3>Onay bekleyen</h3>
      {!pendingReview && !error && <p className="muted">yukleniyor...</p>}
      {pendingReview && pendingReview.length === 0 && <p className="muted">onay bekleyen video yok</p>}
      {pendingReview && pendingReview.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Oluşturulma</th>
              <th>Tür</th>
              <th>Önerilen başlık</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pendingReview.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.created_at).toLocaleString()}</td>
                <td>{item.kind}</td>
                <td>{item.proposed_title}</td>
                <td>
                  <Link to="/review">
                    <button type="button" className="secondary">onay kuyruğuna git</button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ marginTop: 24 }}>Planlanmış / yayınlanmış</h3>
      {!scheduled && !error && <p className="muted">yukleniyor...</p>}
      {scheduled && scheduled.length === 0 && <p className="muted">bu kanal icin planlanmis/yayinlanmis video yok</p>}

      {scheduled && scheduled.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Yayin zamani</th>
              <th>Durum</th>
              <th>Platform</th>
              <th>Sablon</th>
              <th>Kaynak</th>
              <th>Video</th>
            </tr>
          </thead>
          <tbody>
            {scheduled.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.publish_at).toLocaleString()}</td>
                <td>
                  <span className={`badge${item.status === 'published' ? ' ok' : ''}`}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </td>
                <td>{item.platform}</td>
                <td>{item.template}</td>
                <td title={item.source_ref}>{item.source_ref.slice(0, 40)}</td>
                <td>
                  {item.video_id ? (
                    <a href={`https://youtu.be/${item.video_id}`} target="_blank" rel="noreferrer">
                      izle
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

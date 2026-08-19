import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type CalendarItem } from '../lib/api.js';

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'planlandi',
  published: 'yayinda',
  pending: 'beklemede',
  failed: 'hata',
};

export default function Calendar() {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setItems(null);
    setError(null);
    api
      .getCalendar(id)
      .then((r) => setItems(r.items))
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
      <p className="muted">
        Asagidaki liste DB'de gercekten kayitli olan (planlanmis/yayinlanmis) videolardir - taslak veya projeksiyon degildir.
        Onay kuyrugu devreye girdiginde ("Tumu onaya dussun"), henuz onaylanmamis videolar burada ayri bir "beklemede"
        bolumunde gorunecek.
      </p>

      {error && <p className="error-text">{error}</p>}
      {!items && !error && <p className="muted">yukleniyor...</p>}
      {items && items.length === 0 && <p className="muted">bu kanal icin planlanmis/yayinlanmis video yok</p>}

      {items && items.length > 0 && (
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
            {items.map((item) => (
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

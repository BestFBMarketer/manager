import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, type BatchProgress as BatchProgressData } from '../lib/api.js';

const POLL_MS = 4000;

const BUCKET_LABELS: Array<{ key: keyof BatchProgressData; label: string }> = [
  { key: 'pending', label: 'sırada' },
  { key: 'processing', label: 'işleniyor' },
  { key: 'awaitingReview', label: 'onay bekliyor' },
  { key: 'done', label: 'yayınlandı' },
  { key: 'failed', label: 'hata' },
  { key: 'rejected', label: 'reddedildi' },
  { key: 'needsChanges', label: 'değişiklik gerekli' },
];

export default function BatchProgress() {
  const { batchId } = useParams<{ batchId: string }>();
  const [data, setData] = useState<BatchProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;

    function poll() {
      api
        .getBatch(batchId!)
        .then((r) => {
          if (!cancelled) setData(r);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : 'batch okunamadı');
        });
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [batchId]);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Stok üretim ilerlemesi</h2>
      <p className="muted">{batchId}</p>

      {error && <p className="error-text">{error}</p>}
      {!data && !error && <p className="muted">yükleniyor...</p>}

      {data && (
        <>
          <div className="card">
            <p style={{ marginTop: 0 }}>
              <strong>{data.total}</strong> iş toplam
            </p>
            <table>
              <thead>
                <tr>
                  {BUCKET_LABELS.map((b) => (
                    <th key={b.key}>{b.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {BUCKET_LABELS.map((b) => (
                    <td key={b.key}>{data[b.key] as number}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {data.awaitingReview > 0 && (
            <p>
              <Link to="/review">
                <button type="button">{data.awaitingReview} iş onay kuyruğunda bekliyor - incele</button>
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}

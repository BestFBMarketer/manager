import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, type ChannelConfig } from '../lib/api.js';

const AUTO_DISCOVERY_READY = false; // M5 topicDiscovery.ts tamamlanınca true olacak

export default function BatchProducer({ channel }: { channel: ChannelConfig }) {
  const navigate = useNavigate();
  const isStoryAuto = channel.channelType === 'story' && channel.topicSource !== undefined && AUTO_DISCOVERY_READY;
  const [count, setCount] = useState(3);
  const [sourceRefs, setSourceRefs] = useState<string[]>(['', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setCountAndResize(n: number) {
    setCount(n);
    setSourceRefs((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push('');
      return next;
    });
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const items = isStoryAuto ? undefined : sourceRefs.map((sourceRef) => ({ sourceRef }));
      const result = await api.createBatch(channel.id, { count, items });
      navigate(`/batches/${result.batchId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'batch olusturulamadi');
    } finally {
      setBusy(false);
    }
  }

  const hasEmptyRef = !isStoryAuto && sourceRefs.some((r) => !r.trim());

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Stok üret</h3>
      <div className="field">
        <label>Kaç video?</label>
        <input type="number" min={1} max={50} value={count} onChange={(e) => setCountAndResize(Number(e.target.value))} style={{ width: 100 }} />
      </div>

      {channel.channelType === 'story' && !AUTO_DISCOVERY_READY && (
        <p className="muted">
          Otomatik konu keşfi (referans kanaldan/AI'dan) henüz hazır değil (M5) - aşağıya kaynak video linklerini elle girin.
        </p>
      )}

      {!isStoryAuto && (
        <div className="field">
          <label>Kaynak (her video için dosya yolu veya link)</label>
          {sourceRefs.map((ref, i) => (
            <input
              key={i}
              placeholder={`kaynak #${i + 1}`}
              value={ref}
              onChange={(e) => setSourceRefs((prev) => prev.map((r, idx) => (idx === i ? e.target.value : r)))}
              style={{ marginBottom: 6 }}
            />
          ))}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <button type="button" onClick={handleSubmit} disabled={busy || hasEmptyRef}>
        {busy ? 'oluşturuluyor...' : `${count} video için iş oluştur`}
      </button>
    </div>
  );
}

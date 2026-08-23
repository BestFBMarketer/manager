import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, type ChannelConfig } from '../lib/api.js';

const AUTO_DISCOVERY_READY = false; // M5 topicDiscovery.ts tamamlanınca true olacak

export default function BatchProducer({ channel }: { channel: ChannelConfig }) {
  const navigate = useNavigate();
  const isStoryAuto = channel.channelType === 'story' && channel.topicSource !== undefined && AUTO_DISCOVERY_READY;
  const isHotelTour = channel.defaultTemplate === 'HotelTourLandscape' || channel.defaultTemplate === 'HotelTourVertical';
  const [count, setCount] = useState(3);
  const [sourceRefs, setSourceRefs] = useState<string[]>(['', '', '']);
  const [hotelNames, setHotelNames] = useState<string[]>(['', '', '']);
  const [hotelCities, setHotelCities] = useState<string[]>(['', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resize(list: string[], n: number): string[] {
    const next = list.slice(0, n);
    while (next.length < n) next.push('');
    return next;
  }

  function setCountAndResize(n: number) {
    setCount(n);
    setSourceRefs((prev) => resize(prev, n));
    setHotelNames((prev) => resize(prev, n));
    setHotelCities((prev) => resize(prev, n));
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const items = isStoryAuto
        ? undefined
        : sourceRefs.map((sourceRef, i) => ({
            sourceRef,
            hotelName: isHotelTour ? hotelNames[i] : undefined,
            hotelCity: isHotelTour ? hotelCities[i] : undefined,
          }));
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
          <label>Kaynak (her video için dosya yolu veya link{isHotelTour ? ' + otel adı/şehir' : ''})</label>
          {sourceRefs.map((ref, i) => (
            <div key={i} className="row" style={{ gap: 6, marginBottom: 6 }}>
              <input
                placeholder={`kaynak #${i + 1} (drone klasörü/dosya)`}
                value={ref}
                onChange={(e) => setSourceRefs((prev) => prev.map((r, idx) => (idx === i ? e.target.value : r)))}
                style={{ flex: isHotelTour ? 2 : 1 }}
              />
              {isHotelTour && (
                <>
                  <input
                    placeholder="otel adı"
                    value={hotelNames[i]}
                    onChange={(e) => setHotelNames((prev) => prev.map((r, idx) => (idx === i ? e.target.value : r)))}
                    style={{ flex: 1 }}
                  />
                  <input
                    placeholder="şehir"
                    value={hotelCities[i]}
                    onChange={(e) => setHotelCities((prev) => prev.map((r, idx) => (idx === i ? e.target.value : r)))}
                    style={{ flex: 1 }}
                  />
                </>
              )}
            </div>
          ))}
          {isHotelTour && (
            <p className="muted">Otel adı/şehir opsiyonel - verilirse otel bilgi kartları (oda sayısı, puan vb.) otomatik çekilir.</p>
          )}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <button type="button" onClick={handleSubmit} disabled={busy || hasEmptyRef}>
        {busy ? 'oluşturuluyor...' : `${count} video için iş oluştur`}
      </button>
    </div>
  );
}

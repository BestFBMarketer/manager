import { useEffect, useState } from 'react';
import { api, type StoryReference } from '../lib/api.js';

export default function StoryReferences({ channelId }: { channelId: string }) {
  const [refs, setRefs] = useState<StoryReference[] | null>(null);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .listStoryReferences(channelId)
      .then(setRefs)
      .catch((err) => setError(err instanceof Error ? err.message : 'referans kanallar yuklenemedi'));
  }

  useEffect(load, [channelId]);

  async function handleAdd() {
    setError(null);
    try {
      await api.addStoryReference(channelId, url, label || undefined);
      setUrl('');
      setLabel('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'eklenemedi');
    }
  }

  async function handleRemove(refId: number) {
    setError(null);
    try {
      await api.removeStoryReference(channelId, refId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'silinemedi');
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Referans kanallar</h3>
      <p className="muted">
        Bu kanalın konu keşfi için izleyeceği YouTube kanal(lar)ı. "Konu kaynağı" ayarı "Referans kanal(lar)ı izle"
        veya "İkisi birden" ise burada en az bir kanal olmalı.
      </p>

      {error && <p className="error-text">{error}</p>}
      {!refs && <p className="muted">yükleniyor...</p>}

      {refs && refs.length > 0 && (
        <table style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th>Etiket</th>
              <th>URL</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {refs.map((r) => (
              <tr key={r.id}>
                <td>{r.label ?? '-'}</td>
                <td><a href={r.source_url} target="_blank" rel="noreferrer">{r.source_url}</a></td>
                <td>
                  <button type="button" className="secondary" onClick={() => handleRemove(r.id)}>sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {refs && refs.length === 0 && <p className="muted">henüz referans kanal eklenmedi</p>}

      <div className="row" style={{ gap: 8 }}>
        <input placeholder="https://youtube.com/@kanal" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 2 }} />
        <input placeholder="etiket (opsiyonel)" value={label} onChange={(e) => setLabel(e.target.value)} style={{ flex: 1 }} />
        <button type="button" onClick={handleAdd} disabled={!url.trim()}>Ekle</button>
      </div>
    </div>
  );
}

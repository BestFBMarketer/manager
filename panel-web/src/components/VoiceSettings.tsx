import { useEffect, useState } from 'react';
import { api, type ChannelConfig, type VoicesResponse } from '../lib/api.js';

export default function VoiceSettings({
  channel,
  onChannelUpdate,
}: {
  channel: ChannelConfig;
  onChannelUpdate: (updated: ChannelConfig) => void;
}) {
  const [voices, setVoices] = useState<VoicesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  useEffect(() => {
    api.listVoices().then(setVoices).catch(() => setVoices({ voicebox: { available: false, profiles: [] }, piper: [] }));
  }, []);

  function selectionKey(provider: 'voicebox' | 'piper', ref: string): string {
    return `${provider}:${ref}`;
  }

  async function save(provider: 'voicebox' | 'piper', ref: string) {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await api.updateChannel(channel.id, {
        settings: { ...channel.settings, ttsProvider: provider, voiceRef: ref },
      });
      onChannelUpdate(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ses kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function clearSelection() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await api.updateChannel(channel.id, {
        settings: { ...channel.settings, ttsProvider: null, voiceRef: null },
      });
      onChannelUpdate(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const currentKey =
    channel.settings.ttsProvider && channel.settings.voiceRef
      ? selectionKey(channel.settings.ttsProvider, channel.settings.voiceRef)
      : null;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Ses</h3>
      <p className="muted">
        Bu kanalın seslendirmesi için bir ses seç ve "dinle" ile önceden onayla. Boş bırakılırsa `.env` dosyasındaki
        varsayılan (TTS_VOICE_REF) ve hazır olan ilk sağlayıcı (Voicebox → Piper) kullanılır.
      </p>

      {error && <p className="error-text">{error}</p>}
      {!voices && <p className="muted">yükleniyor...</p>}

      {voices && (
        <>
          {!voices.voicebox.available && (
            <p className="muted">Voicebox: {voices.voicebox.error ?? 'çalışmıyor'}</p>
          )}
          {voices.voicebox.profiles.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ marginBottom: 4 }}>Voicebox (kendi klonlanmış seslerin)</p>
              {voices.voicebox.profiles.map((p) => {
                const key = selectionKey('voicebox', p.id);
                return (
                  <div key={p.id} className="row" style={{ gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <label className="row" style={{ gap: 6, marginBottom: 0, width: 220 }}>
                      <input
                        type="radio"
                        name="voice-choice"
                        checked={currentKey === key}
                        onChange={() => save('voicebox', p.id)}
                      />
                      {p.name} ({p.language})
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setPreviewKey(previewKey === key ? null : key)}
                    >
                      {previewKey === key ? 'kapat' : 'dinle'}
                    </button>
                    {previewKey === key && <audio controls autoPlay src={api.voiceboxPreviewUrl(p.id)} style={{ height: 28 }} />}
                  </div>
                );
              })}
            </div>
          )}

          {voices.piper.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ marginBottom: 4 }}>Piper (yerel, ücretsiz, hazır sesler)</p>
              {voices.piper.map((v) => {
                const key = selectionKey('piper', v.modelPath);
                return (
                  <div key={v.modelPath} className="row" style={{ gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <label className="row" style={{ gap: 6, marginBottom: 0, width: 220 }}>
                      <input
                        type="radio"
                        name="voice-choice"
                        checked={currentKey === key}
                        onChange={() => save('piper', v.modelPath)}
                      />
                      {v.label}
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setPreviewKey(previewKey === key ? null : key)}
                    >
                      {previewKey === key ? 'kapat' : 'dinle'}
                    </button>
                    {previewKey === key && (
                      <audio controls autoPlay src={api.piperPreviewUrl(v.modelPath, v.language)} style={{ height: 28 }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {currentKey && (
            <button type="button" className="secondary" disabled={saving} onClick={clearSelection}>
              Seçimi kaldır (varsayılana dön)
            </button>
          )}
          {saved && <span className="muted" style={{ marginLeft: 8 }}>kaydedildi</span>}
        </>
      )}
    </div>
  );
}

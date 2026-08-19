import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, type NewChannelInput, type ScheduleRuleInput } from '../lib/api.js';
import ScheduleRuleEditor from '../components/ScheduleRuleEditor.js';

const DEFAULT_RULE: ScheduleRuleInput = {
  kind: 'weekday_list',
  weekdays: [1, 3, 5],
  slots: [{ id: 'eu-prime', timeZone: 'Europe/Berlin', hour: 20, minute: 0, label: 'Avrupa prime time' }],
};

export default function NewChannel() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    id: '',
    label: '',
    channelType: 'standard' as 'standard' | 'story',
    refreshTokenEnvKey: '',
    defaultTemplate: 'FunnyShort',
    targetDurationSec: 60,
    language: 'de',
    categoryId: '24',
    topicSource: 'reference' as NewChannelInput['topicSource'],
    styleReference: '',
  });
  const [rule, setRule] = useState<ScheduleRuleInput>(DEFAULT_RULE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const channel = await api.createChannel({
        ...form,
        styleReference: form.channelType === 'story' ? form.styleReference : null,
        scheduleRule: rule,
      });
      navigate(`/channels/${channel.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'kanal olusturulamadi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 style={{ marginTop: 0 }}>Yeni kanal ekle</h2>
      <p className="muted">
        Herhangi bir nis/tur icin - kod degisikligi ya da redeploy gerekmez. YouTube OAuth refresh token'i
        onceden .env'e eklenmis olmali; burada sadece o degisken adini yaz.
      </p>

      <div className="card">
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Kanal id (kucuk harf, - / _ olabilir)</label>
            <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="orn. mystisch" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Goruntulenen ad</label>
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
        </div>

        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Kanal turu</label>
            <select value={form.channelType} onChange={(e) => setForm({ ...form, channelType: e.target.value as 'standard' | 'story' })}>
              <option value="standard">Standart</option>
              <option value="story">Hikaye/anlatim (referans kanal veya AI konu uretimi)</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Sablon</label>
            <input value={form.defaultTemplate} onChange={(e) => setForm({ ...form, defaultTemplate: e.target.value })} />
          </div>
        </div>

        {form.channelType === 'story' && (
          <>
            <div className="field">
              <label>Konu kaynagi</label>
              <select
                value={form.topicSource}
                onChange={(e) => setForm({ ...form, topicSource: e.target.value as NewChannelInput['topicSource'] })}
              >
                <option value="reference">Referans kanal(lar)i izle</option>
                <option value="ai_generated">AI kendi konu listesini uretsin</option>
                <option value="both">Ikisi birden</option>
              </select>
            </div>
            <div className="field">
              <label>Ton/tur/stil notu</label>
              <textarea
                rows={2}
                value={form.styleReference}
                onChange={(e) => setForm({ ...form, styleReference: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <p className="muted">Referans kanal linkleri kanal olusturulduktan sonra bu kanalin ayar sayfasindan eklenebilir.</p>
          </>
        )}

        <div className="field">
          <label>YouTube refresh token .env degiskeni</label>
          <input
            value={form.refreshTokenEnvKey}
            onChange={(e) => setForm({ ...form, refreshTokenEnvKey: e.target.value })}
            placeholder="orn. YOUTUBE_REFRESH_TOKEN_MYSTISCH"
          />
        </div>

        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Dil</label>
            <input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Hedef sure (sn)</label>
            <input
              type="number"
              value={form.targetDurationSec}
              onChange={(e) => setForm({ ...form, targetDurationSec: Number(e.target.value) })}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>YouTube kategori id</label>
            <input value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Yayin zamanlamasi</h3>
        <ScheduleRuleEditor value={rule} onChange={setRule} />
      </div>

      {error && <p className="error-text">{error}</p>}
      <button type="submit" disabled={busy || !form.id || !form.label || !form.refreshTokenEnvKey}>
        {busy ? 'olusturuluyor...' : 'Kanali olustur'}
      </button>
    </form>
  );
}

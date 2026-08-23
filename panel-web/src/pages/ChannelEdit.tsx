import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, type ChannelConfig, type ScheduleRuleInput } from '../lib/api.js';
import ScheduleRuleEditor from '../components/ScheduleRuleEditor.js';
import StoryReferences from '../components/StoryReferences.js';
import BatchProducer from '../components/BatchProducer.js';
import Connections from '../components/Connections.js';

function toRuleInput(channel: ChannelConfig): ScheduleRuleInput {
  const rule = channel.scheduleRule;
  return {
    kind: rule.kind,
    weekdays: rule.kind === 'weekday_list' ? rule.weekdays : undefined,
    intervalDays: rule.kind === 'every_n_days' ? rule.intervalDays : undefined,
    countPerPeriod: rule.kind === 'count_per_period' ? rule.countPerPeriod : undefined,
    periodMonths: rule.kind === 'count_per_period' ? rule.periodMonths : undefined,
    slots: channel.slots,
  };
}

export default function ChannelEdit() {
  const { id } = useParams<{ id: string }>();
  const [channel, setChannel] = useState<ChannelConfig | null>(null);
  const [rule, setRule] = useState<ScheduleRuleInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingFields, setSavingFields] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    setChannel(null);
    setError(null);
    api
      .getChannel(id)
      .then((c) => {
        setChannel(c);
        setRule(toRuleInput(c));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'kanal yuklenemedi'));
  }, [id]);

  if (error) return <p className="error-text">{error}</p>;
  if (!channel || !rule || !id) return <p className="muted">yukleniyor...</p>;

  async function saveFields() {
    if (!channel || !id) return;
    setSavingFields(true);
    setError(null);
    try {
      const updated = await api.updateChannel(id, {
        label: channel.label,
        audience: channel.audience,
        styleReference: channel.styleReference,
        niche: channel.niche,
        topicSource: channel.topicSource,
        targetDurationSec: channel.targetDurationSec,
        language: channel.language,
        wikiLanguages: channel.wikiLanguages,
        titleExamples: channel.titleExamples,
        shortsDerivativeCount: channel.shortsDerivativeCount,
        categoryId: channel.categoryId,
        enabled: channel.enabled,
        settings: channel.settings,
      });
      setChannel(updated);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'kaydedilemedi');
    } finally {
      setSavingFields(false);
    }
  }

  async function saveSchedule() {
    if (!rule || !id) return;
    setSavingSchedule(true);
    setError(null);
    try {
      const updated = await api.updateSchedule(id, rule);
      setChannel(updated);
      setRule(toRuleInput(updated));
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'zamanlama kaydedilemedi');
    } finally {
      setSavingSchedule(false);
    }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ marginTop: 0 }}>{channel.label}</h2>
        <Link to={`/channels/${id}/calendar`}>
          <button type="button" className="secondary">
            Takvimi gor
          </button>
        </Link>
      </div>
      <p className="muted">
        {channel.id} · {channel.channelType === 'story' ? 'hikaye kanali' : 'standart kanal'} · {channel.refreshTokenEnvKey}
      </p>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Genel ayarlar</h3>
        <div className="field">
          <label>Etiket (goruntulenen ad)</label>
          <input value={channel.label} onChange={(e) => setChannel({ ...channel, label: e.target.value })} />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Dil</label>
            <input value={channel.language} onChange={(e) => setChannel({ ...channel, language: e.target.value })} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Hedef sure (sn)</label>
            <input
              type="number"
              value={channel.targetDurationSec}
              onChange={(e) => setChannel({ ...channel, targetDurationSec: Number(e.target.value) })}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>YouTube kategori id</label>
            <input value={channel.categoryId} onChange={(e) => setChannel({ ...channel, categoryId: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Hedef kitle</label>
          <textarea
            rows={2}
            value={channel.audience}
            onChange={(e) => setChannel({ ...channel, audience: e.target.value })}
            style={{ width: '100%' }}
          />
        </div>

        <div className="field">
          <label>Niş / kategori</label>
          <input
            placeholder="Ör. Paranormal, Ekonomi, Gezi, Komedi"
            value={channel.niche ?? ''}
            onChange={(e) => setChannel({ ...channel, niche: e.target.value || null })}
          />
          {channel.channelType === 'story' && !channel.niche && (
            <p className="muted" style={{ marginTop: 4 }}>
              Boş bırakılırsa ilk referans kanal eklendiğinde otomatik doldurulabilir (M5).
            </p>
          )}
        </div>

        {channel.channelType === 'story' && (
          <>
            <div className="field">
              <label>Ton/tur/stil notu (style_reference)</label>
              <textarea
                rows={2}
                value={channel.styleReference ?? ''}
                onChange={(e) => setChannel({ ...channel, styleReference: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div className="field">
              <label>Konu kaynagi</label>
              <select
                value={channel.topicSource}
                onChange={(e) => setChannel({ ...channel, topicSource: e.target.value as ChannelConfig['topicSource'] })}
              >
                <option value="reference">Referans kanal(lar)i izle</option>
                <option value="ai_generated">AI kendi konu listesini uretsin</option>
                <option value="both">Ikisi birden</option>
              </select>
            </div>
          </>
        )}

        <div className="field">
          <label>Uzun videodan turetilecek Shorts sayisi</label>
          <input
            type="number"
            min={0}
            value={channel.shortsDerivativeCount}
            onChange={(e) => setChannel({ ...channel, shortsDerivativeCount: Number(e.target.value) })}
          />
        </div>

        <div className="row" style={{ marginBottom: 14 }}>
          <label className="row" style={{ gap: 6, marginBottom: 0 }}>
            <input type="checkbox" checked={channel.enabled} onChange={(e) => setChannel({ ...channel, enabled: e.target.checked })} />
            Kanal aktif
          </label>
          <label className="row" style={{ gap: 6, marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={channel.settings.shortsDerivativeEnabled}
              onChange={(e) =>
                setChannel({ ...channel, settings: { ...channel.settings, shortsDerivativeEnabled: e.target.checked } })
              }
            />
            Otomatik Shorts turetme
          </label>
        </div>


        <button type="button" onClick={saveFields} disabled={savingFields}>
          {savingFields ? 'kaydediliyor...' : 'Genel ayarlari kaydet'}
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Yayin zamanlamasi</h3>
        <ScheduleRuleEditor value={rule} onChange={setRule} />
        <button type="button" onClick={saveSchedule} disabled={savingSchedule}>
          {savingSchedule ? 'kaydediliyor...' : 'Zamanlamayi kaydet'}
        </button>
      </div>

      {channel.channelType === 'story' && (channel.topicSource === 'reference' || channel.topicSource === 'both') && (
        <StoryReferences channelId={id} />
      )}

      <Connections channelId={id} />

      <BatchProducer channel={channel} />

      {error && <p className="error-text">{error}</p>}
      {savedAt && <p className="muted">kaydedildi</p>}
    </div>
  );
}

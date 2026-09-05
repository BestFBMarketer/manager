import { useEffect, useState } from 'react';
import { api, type ContentRule } from '../lib/api.js';

function RuleCard({ rule, onDecided }: { rule: ContentRule; onDecided: () => void }) {
  const [decidedBy, setDecidedBy] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let evidence: string[] = [];
  try {
    evidence = JSON.parse(rule.evidence_json) as string[];
  } catch {
    evidence = [];
  }

  async function handleApprove() {
    if (!decidedBy.trim()) {
      setError('Onaylayan adı gerekli');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.approveRule(rule.id, decidedBy);
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'onay başarısız');
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!decidedBy.trim()) {
      setError('Reddeden adı gerekli');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.rejectRule(rule.id, decidedBy, note || undefined);
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'reddetme başarısız');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <span className="badge">{rule.channel_id}</span>
          <span className="badge" style={{ marginLeft: 6 }}>{rule.category}</span>
        </div>
        <span className="muted">{new Date(rule.created_at).toLocaleString()}</span>
      </div>

      <p style={{ fontWeight: 600, marginBottom: 4 }}>{rule.rule_text}</p>
      <p className="muted" style={{ marginTop: 0 }}>{rule.rationale}</p>

      {evidence.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary className="muted">Kanıt ({evidence.length})</summary>
          <ul>
            {evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <input placeholder="kararı veren (isim)" value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)} style={{ flex: 1 }} />
        <input placeholder="not (reddet için)" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 2 }} />
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <button disabled={busy} onClick={handleApprove}>Onayla</button>
        <button disabled={busy} className="secondary" onClick={handleReject}>Reddet</button>
      </div>
    </div>
  );
}

export default function RulesReview() {
  const [rules, setRules] = useState<ContentRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .listRules(undefined, 'proposed')
      .then(setRules)
      .catch((err) => setError(err instanceof Error ? err.message : 'kural kuyruğu yüklenemedi'));
  }

  useEffect(load, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Kural Onayı</h2>
      <p className="muted">
        Analytics'ten otomatik önerilen içerik kuralları - onaylanmadan hiçbiri üretime yansımaz
        (bkz analysis/contentRules.ts::getActiveRules).
      </p>

      {error && <p className="error-text">{error}</p>}
      {!rules && !error && <p className="muted">yükleniyor...</p>}
      {rules && rules.length === 0 && <p className="muted">onay bekleyen kural yok</p>}

      {rules?.map((rule) => (
        <RuleCard key={rule.id} rule={rule} onDecided={load} />
      ))}
    </div>
  );
}

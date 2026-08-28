import { useEffect, useState } from 'react';
import { api, mediaUrl, thumbnailUrl, type ReviewItem } from '../lib/api.js';

function TagsInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  return (
    <input
      value={value.join(', ')}
      onChange={(e) => onChange(e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
    />
  );
}

function ReviewCard({ item, onDecided }: { item: ReviewItem; onDecided: () => void }) {
  const [title, setTitle] = useState(item.proposed_title);
  const [description, setDescription] = useState(item.proposed_description);
  const [tags, setTags] = useState<string[]>(() => {
    try {
      return JSON.parse(item.proposed_tags_json) as string[];
    } catch {
      return [];
    }
  });
  const [decidedBy, setDecidedBy] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbCacheBust, setThumbCacheBust] = useState(0);

  const dirty =
    title !== item.proposed_title ||
    description !== item.proposed_description ||
    tags.join(',') !== (JSON.parse(item.proposed_tags_json) as string[]).join(',');

  async function handleApprove() {
    if (!decidedBy.trim()) {
      setError('Onaylayan adi gerekli');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Duzenleme varsa once kalici hale getir (job'a dokunmaz, sadece review_item
      // gunceller), sonra onayla - boylece editlenmis metin yayina gider.
      if (dirty) {
        await api.updateReviewMetadata(item.id, { proposedTitle: title, proposedDescription: description, proposedTags: tags });
      }
      await api.approveReview(item.id, decidedBy);
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'onay basarisiz');
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!decidedBy.trim()) {
      setError('Reddeden adi gerekli');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.rejectReview(item.id, decidedBy, note || undefined);
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'reddetme basarisiz');
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestChanges() {
    if (!decidedBy.trim() || !note.trim()) {
      setError('Isim ve not (degisiklik talebi) gerekli');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.requestChangesReview(item.id, decidedBy, note);
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'istek basarisiz');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.regenerateReview(item.id);
      setTitle(updated.proposed_title);
      setDescription(updated.proposed_description);
      setTags(JSON.parse(updated.proposed_tags_json));
      setThumbCacheBust(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'yeniden olusturma basarisiz');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span className="badge">{item.channel_label}</span>
          {item.channel_type === 'story' && <span className="badge" style={{ marginLeft: 6 }}>hikaye</span>}
          {item.kind === 'shorts_derivative' && <span className="badge" style={{ marginLeft: 6 }}>uzun videodan türev</span>}
          <span className="muted" style={{ marginLeft: 8 }}>iş #{item.job_id}</span>
        </div>
        <span className="muted">{new Date(item.created_at).toLocaleString()}</span>
      </div>

      {item.render_id ? (
        <video controls src={mediaUrl(item.render_id)} style={{ width: '100%', maxHeight: 420, marginTop: 12, background: '#000' }} />
      ) : (
        <p className="muted">önizleme dosyası yok</p>
      )}

      {item.thumbnail_path ? (
        <div style={{ marginTop: 10 }}>
          <p className="muted" style={{ marginBottom: 4 }}>Kapak resmi</p>
          <img
            src={`${thumbnailUrl(item.id)}?t=${thumbCacheBust}`}
            alt="thumbnail"
            style={{ width: 240, borderRadius: 8, display: 'block' }}
          />
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 10 }}>kapak resmi üretilemedi - YouTube kendi karesini seçecek</p>
      )}

      <label style={{ display: 'block', marginTop: 12 }}>
        Başlık
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label style={{ display: 'block', marginTop: 8 }}>
        Açıklama
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
      </label>
      <label style={{ display: 'block', marginTop: 8 }}>
        Etiketler (virgülle ayrılmış)
        <TagsInput value={tags} onChange={setTags} />
      </label>

      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <input placeholder="kararı veren (isim)" value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)} style={{ flex: 1 }} />
        <input placeholder="not (reddet/değişiklik için)" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 2 }} />
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
        <button disabled={busy} onClick={handleApprove}>Onayla</button>
        <button disabled={busy} className="secondary" onClick={handleReject}>Reddet</button>
        <button disabled={busy} className="secondary" onClick={handleRequestChanges}>Değişiklik gerekli</button>
        <button disabled={busy} className="secondary" onClick={handleRegenerate}>Yeniden Oluştur (başlık/açıklama/kapak)</button>
      </div>
      {dirty && <p className="muted" style={{ marginTop: 6 }}>Metni düzenlediniz - "Onayla" bu haliyle kaydedip yayına planlayacak.</p>}
    </div>
  );
}

export default function Review() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .listReview()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'onay kuyruğu yüklenemedi'));
  }

  useEffect(load, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Onay Kuyruğu</h2>
      <p className="muted">Tüm kanallardan üretilen videolar burada listelenir - hiçbiri onaylanmadan yayınlanmaz.</p>

      {error && <p className="error-text">{error}</p>}
      {!items && !error && <p className="muted">yükleniyor...</p>}
      {items && items.length === 0 && <p className="muted">onay bekleyen video yok</p>}

      {items?.map((item) => (
        <ReviewCard key={item.id} item={item} onDecided={load} />
      ))}
    </div>
  );
}

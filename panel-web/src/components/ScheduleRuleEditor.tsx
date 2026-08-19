import type { PrimeTimeSlot, ScheduleRuleInput } from '../lib/api.js';

const WEEKDAY_LABELS = ['Pazar', 'Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi'];

function slugify(label: string, index: number): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || `slot-${index}`;
}

function emptySlot(index: number): PrimeTimeSlot {
  return { id: `slot-${index}`, timeZone: 'Europe/Berlin', hour: 20, minute: 0, label: 'Yeni slot' };
}

export default function ScheduleRuleEditor({
  value,
  onChange,
}: {
  value: ScheduleRuleInput;
  onChange: (next: ScheduleRuleInput) => void;
}) {
  function updateSlot(index: number, patch: Partial<PrimeTimeSlot>) {
    const slots = value.slots.map((s, i) => {
      if (i !== index) return s;
      const next = { ...s, ...patch };
      return patch.label !== undefined ? { ...next, id: slugify(next.label, index) } : next;
    });
    onChange({ ...value, slots });
  }

  return (
    <div>
      <div className="field">
        <label>Yayin sikligi</label>
        <select
          value={value.kind}
          onChange={(e) => {
            const kind = e.target.value as ScheduleRuleInput['kind'];
            onChange({ ...value, kind, weekdays: value.weekdays ?? [1, 3, 5] });
          }}
        >
          <option value="weekday_list">Haftanin belli gunleri</option>
          <option value="every_n_days">Her N gunde bir</option>
          <option value="count_per_period">M ayda N video</option>
        </select>
      </div>

      {value.kind === 'weekday_list' && (
        <div className="field">
          <label>Gunler</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {WEEKDAY_LABELS.map((day, idx) => {
              const checked = value.weekdays?.includes(idx) ?? false;
              return (
                <label key={idx} className="row" style={{ gap: 4, marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const set = new Set(value.weekdays ?? []);
                      if (e.target.checked) set.add(idx);
                      else set.delete(idx);
                      onChange({ ...value, weekdays: [...set].sort() });
                    }}
                  />
                  {day}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {value.kind === 'every_n_days' && (
        <div className="field">
          <label>Kac gunde bir</label>
          <input
            type="number"
            min={1}
            value={value.intervalDays ?? 1}
            onChange={(e) => onChange({ ...value, intervalDays: Number(e.target.value) })}
          />
        </div>
      )}

      {value.kind === 'count_per_period' && (
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Kac video</label>
            <input
              type="number"
              min={1}
              value={value.countPerPeriod ?? 1}
              onChange={(e) => onChange({ ...value, countPerPeriod: Number(e.target.value) })}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Kac ayda</label>
            <input
              type="number"
              min={1}
              value={value.periodMonths ?? 1}
              onChange={(e) => onChange({ ...value, periodMonths: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      <div className="field">
        <label>Yayin saat slotlari ({value.slots.length})</label>
        {value.slots.map((slot, idx) => (
          <div key={idx} className="row" style={{ marginBottom: 8 }}>
            <input
              placeholder="etiket"
              value={slot.label}
              onChange={(e) => updateSlot(idx, { label: e.target.value })}
              style={{ flex: 2 }}
            />
            <input
              placeholder="IANA saat dilimi (orn. Europe/Berlin)"
              value={slot.timeZone}
              onChange={(e) => updateSlot(idx, { timeZone: e.target.value })}
              style={{ flex: 2 }}
            />
            <input
              type="number"
              min={0}
              max={23}
              value={slot.hour}
              onChange={(e) => updateSlot(idx, { hour: Number(e.target.value) })}
              style={{ width: 60 }}
            />
            <input
              type="number"
              min={0}
              max={59}
              value={slot.minute}
              onChange={(e) => updateSlot(idx, { minute: Number(e.target.value) })}
              style={{ width: 60 }}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => onChange({ ...value, slots: value.slots.filter((_, i) => i !== idx) })}
            >
              sil
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() => onChange({ ...value, slots: [...value.slots, emptySlot(value.slots.length)] })}
        >
          + slot ekle
        </button>
      </div>
    </div>
  );
}

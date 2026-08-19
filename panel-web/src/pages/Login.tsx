import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api.js';

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'giris basarisiz');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="card" style={{ width: 320 }} onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0 }}>shorts-factory panel</h2>
        <div className="field">
          <label htmlFor="password">Sifre</label>
          <input
            id="password"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={busy || password.length === 0} style={{ width: '100%' }}>
          {busy ? 'Giris yapiliyor...' : 'Giris yap'}
        </button>
      </form>
    </div>
  );
}

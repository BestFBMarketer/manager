import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api, type ChannelConfig } from '../lib/api.js';

export default function Sidebar({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [channels, setChannels] = useState<ChannelConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listChannels()
      .then(setChannels)
      .catch((err) => setError(err instanceof Error ? err.message : 'kanallar yuklenemedi'));
  }, []);

  async function handleLogout() {
    await api.logout().catch(() => undefined);
    onLoggedOut();
  }

  return (
    <div className="sidebar">
      <NavLink to="/review" className={({ isActive }) => `tab${isActive ? ' active' : ''}`} style={{ marginBottom: 16, display: 'block' }}>
        Onay Kuyruğu
      </NavLink>
      <h3 style={{ marginTop: 0 }}>Kanallar</h3>
      {error && <p className="error-text">{error}</p>}
      {!channels && !error && <p className="muted">yukleniyor...</p>}
      {channels?.map((c) => (
        <NavLink key={c.id} to={`/channels/${c.id}`} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          {c.label}
          {!c.enabled && <span className="badge" style={{ marginLeft: 6 }}>kapali</span>}
        </NavLink>
      ))}
      <button
        className="secondary"
        style={{ width: '100%', marginTop: 12 }}
        onClick={() => navigate('/channels/new')}
      >
        + Yeni kanal
      </button>
      <button className="secondary" style={{ width: '100%', marginTop: 24 }} onClick={handleLogout}>
        Cikis yap
      </button>
    </div>
  );
}

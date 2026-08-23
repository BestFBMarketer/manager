import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './lib/api.js';
import Login from './pages/Login.js';
import Sidebar from './components/Sidebar.js';
import ChannelEdit from './pages/ChannelEdit.js';
import NewChannel from './pages/NewChannel.js';
import Calendar from './pages/Calendar.js';
import Review from './pages/Review.js';

type AuthState = 'checking' | 'in' | 'out';

export default function App() {
  const [auth, setAuth] = useState<AuthState>('checking');

  useEffect(() => {
    api
      .me()
      .then((r) => setAuth(r.authenticated ? 'in' : 'out'))
      .catch(() => setAuth('out'));
  }, []);

  if (auth === 'checking') return null;
  if (auth === 'out') return <Login onLoggedIn={() => setAuth('in')} />;

  return (
    <div className="app-shell">
      <Sidebar onLoggedOut={() => setAuth('out')} />
      <div className="main">
        <Routes>
          <Route path="/" element={<div className="muted">Soldan bir kanal sec ya da yeni kanal ekle.</div>} />
          <Route path="/review" element={<Review />} />
          <Route path="/channels/new" element={<NewChannel />} />
          <Route path="/channels/:id" element={<ChannelEdit />} />
          <Route path="/channels/:id/calendar" element={<Calendar />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

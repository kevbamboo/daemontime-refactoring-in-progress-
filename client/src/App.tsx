import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './App.css';
import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';
import Home from './components/Home';
import Login from './components/Login';
import Signup from './components/Signup';
import { supabase } from './lib/supabase';
import { socketService } from './services/socket.service';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [initializing, setInitializing] = useState(true);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) socketService.connect(session.access_token, session.user.id);
      else socketService.disconnect();
      setAuthenticated(!!session);
      setInitializing(false);
    });
    return () => { subscription.unsubscribe(); socketService.disconnect(); };
  }, []);
  if (initializing) return <div>Loading...</div>;
  return <BrowserRouter><SiteHeader /><Routes>
    <Route path="/" element={<Home authenticated={authenticated} />} />
    <Route path="/games" element={<Home authenticated={authenticated} />} />
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    <Route path="*" element={<p>Page not found.</p>} />
  </Routes><SiteFooter /></BrowserRouter>;
}

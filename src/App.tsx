import React, { useState, useEffect } from 'react';
import JoinPage from './pages/Join';
import WelcomePage from './pages/Welcome';
import StartPage from './pages/Start';
import EndPage from './pages/End';
import AdminPage from './pages/Admin';

export default function App() {
  const [route, setRoute] = useState({ path: 'join', id: '' });

  const parseRoute = () => {
    const hash = window.location.hash || '#/join';
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code') || '';

    if (hash === '#/admin' || window.location.pathname === '/admin') {
      setRoute({ path: 'admin', id: '' });
    } else if (hash.startsWith('#/interview/') && hash.endsWith('/end')) {
      const parts = hash.split('/');
      const id = parts[2];
      setRoute({ path: 'end', id });
    } else if (hash.startsWith('#/interview/') && hash.endsWith('/start')) {
      const parts = hash.split('/');
      const id = parts[2];
      setRoute({ path: 'start', id });
    } else if (hash.startsWith('#/interview/') && hash.endsWith('/welcome')) {
      const parts = hash.split('/');
      const id = parts[2];
      setRoute({ path: 'welcome', id });
    } else {
      setRoute({ path: 'join', id: codeParam });
    }
  };

  useEffect(() => {
    parseRoute();
    window.addEventListener('hashchange', parseRoute);
    
    // Check path routes too
    if (window.location.pathname === '/admin') {
      window.location.hash = '/admin';
    }
    
    return () => window.removeEventListener('hashchange', parseRoute);
  }, []);

  const navigateTo = (path: string) => {
    window.location.hash = path;
  };

  switch (route.path) {
    case 'admin':
      return <AdminPage navigateTo={navigateTo} />;
    case 'welcome':
      return <WelcomePage id={route.id} navigateTo={navigateTo} />;
    case 'start':
      return <StartPage id={route.id} navigateTo={navigateTo} />;
    case 'end':
      return <EndPage id={route.id} navigateTo={navigateTo} />;
    case 'join':
    default:
      return <JoinPage initialCode={route.id} navigateTo={navigateTo} />;
  }
}

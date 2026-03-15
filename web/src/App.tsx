import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Manage from './pages/Manage';
import { lazy, Suspense, useMemo, Component, type ReactNode } from 'react';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center', fontFamily: 'Fredoka, sans-serif' }}>
          <p style={{ color: '#CF3748', fontSize: '1rem', marginBottom: '0.5rem' }}>Something went wrong.</p>
          <p style={{ color: '#8a7d5a', fontSize: '0.85rem', marginBottom: '1rem' }}>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '0.5rem 1.5rem', background: '#CF3748', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'Fredoka, sans-serif', fontWeight: 700 }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Marketplace = lazy(() => import('./pages/Marketplace'));
const Pricing = lazy(() => import('./pages/Pricing'));
const About = lazy(() => import('./pages/About'));
const Docs = lazy(() => import('./pages/Docs'));
const Admin = lazy(() => import('./pages/Admin'));
const Nomi = lazy(() => import('./pages/Nomi'));
const Domains = lazy(() => import('./pages/Domains'));
const Profile = lazy(() => import('./pages/Profile'));

function Loading() {
  return <div className="max-w-[720px] mx-auto px-6 py-12 text-muted text-center">loading...</div>;
}

function useIsProfileSubdomain(): boolean {
  return useMemo(() => {
    // Check if worker injected a profile name
    if ((window as any).__HAZZA_PROFILE_NAME__) return true;
    // Check if we're on a subdomain of hazza.name
    const host = window.location.hostname;
    const match = host.match(/^([^.]+)\.hazza\.name$/);
    return !!match && match[1] !== 'www';
  }, []);
}

export default function App() {
  const isProfile = useIsProfileSubdomain();

  // On a subdomain → render Profile page directly
  if (isProfile) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route element={<Layout />}>
            <Route path="*" element={<Suspense fallback={<Loading />}><Profile /></Suspense>} />
          </Route>
        </Routes>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/manage" element={<Manage />} />
        <Route path="/marketplace" element={<Suspense fallback={<Loading />}><Marketplace /></Suspense>} />
        <Route path="/pricing" element={<Suspense fallback={<Loading />}><Pricing /></Suspense>} />
        <Route path="/pricing/protections" element={<Suspense fallback={<Loading />}><Pricing /></Suspense>} />
        <Route path="/pricing/details" element={<Suspense fallback={<Loading />}><Pricing /></Suspense>} />
        <Route path="/about" element={<Suspense fallback={<Loading />}><About /></Suspense>} />
        <Route path="/docs" element={<Suspense fallback={<Loading />}><Docs /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={<Loading />}><Admin /></Suspense>} />
        <Route path="/nomi" element={<Suspense fallback={<Loading />}><Nomi /></Suspense>} />
        <Route path="/domains" element={<Suspense fallback={<Loading />}><Domains /></Suspense>} />
      </Route>
    </Routes>
    </ErrorBoundary>
  );
}

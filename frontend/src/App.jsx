import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AppLayout from './components/layout/AppLayout';
import TasksPage from './pages/TasksPage';
import TopUpPage from './pages/TopUpPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import AdminPage from './pages/AdminPage';
import InputLinkPage from './pages/InputLinkPage';
import ProfilePage from './pages/ProfilePage';
import InformasiPage from './pages/InformasiPage';
import UnggahanPage from './pages/UnggahanPage';
import SearchPage from './pages/SearchPage';
import AvailableHostsPage from './pages/AvailableHostsPage';

// Auth Context
const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

// Loading spinner component
function LoadingScreen() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ textAlign: 'center' }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          Memuat...
        </Typography>
      </Box>
    </Box>
  );
}

// Protected Route component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  return <AppLayout>{children}</AppLayout>;
}

// Admin Route component - only allows admin users
function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/download" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/download" replace /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={user ? <Navigate to="/download" replace /> : <SignInPage />} />
      <Route path="/register" element={user ? <Navigate to="/download" replace /> : <SignUpPage />} />
      <Route
        path="/download"
        element={
          <ProtectedRoute>
            <TasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/informasi"
        element={
          <ProtectedRoute>
            <InformasiPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/unggahan"
        element={
          <ProtectedRoute>
            <UnggahanPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <SearchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/available-hosts"
        element={
          <ProtectedRoute>
            <AvailableHostsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/input"
        element={
          <ProtectedRoute>
            <InputLinkPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/balance"
        element={
          <ProtectedRoute>
            <TopUpPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
    </Routes>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setUser(data);
        } else {
          setUser(null);
        }
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout');
    setUser(null);
    window.location.href = '/login';
  };

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated) setUser(data);
    } catch { }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;

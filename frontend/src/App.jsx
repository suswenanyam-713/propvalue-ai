import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import PropertiesPage from './pages/PropertiesPage';
import PropertyDetails from './pages/PropertyDetails';
import ValuationPage from './pages/ValuationPage';
import ComparePage from './pages/ComparePage';
import AIChatbot from './pages/AIChatbot';
import DashboardPage from './pages/DashboardPage';
import AdminDashboard from './pages/AdminDashboard';

// Error Boundary for React Render Safety
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("React ErrorBoundary caught an unhandled render error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="glass-panel p-8 rounded-2xl border border-red-500/30 max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold text-red-400 mb-2">Section Temporarily Unavailable</h2>
            <p className="text-slate-300 text-sm mb-4">
              {this.state.error?.message || "An unexpected error occurred while rendering this page."}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 rounded-xl font-bold text-sm text-white transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Protected Route wrapper
function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/properties" element={<PropertiesPage />} />
            <Route path="/properties/:id" element={<PropertyDetails />} />
            <Route path="/valuation" element={<ValuationPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/ai-assistant" element={
              <ProtectedRoute><AIChatbot /></ProtectedRoute>
            } />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/admin" element={
              <ProtectedRoute adminOnly={true}><AdminDashboard /></ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

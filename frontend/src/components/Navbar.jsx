import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, Sun, Moon, Home, LogOut, ShieldAlert, Cpu } from 'lucide-react';

export default function Navbar() {
  const { isAuthenticated, logout, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (isDark) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Properties', path: '/properties' },
    { name: 'Valuation', path: '/valuation' },
    { name: 'Compare', path: '/compare' },
    { name: 'AI Assistant', path: '/ai-assistant' },
    { name: 'Dashboard', path: '/dashboard' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-900/80 backdrop-blur-md text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="p-2 bg-violet-600 rounded-lg shadow-lg shadow-violet-500/30">
                <Cpu className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-transparent">
                PropValue AI
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  isActive(link.path)
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.name}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  isActive('/admin')
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
                    : 'text-amber-400 hover:bg-amber-500/10 hover:text-amber-300'
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Admin</span>
              </Link>
            )}
          </div>

          {/* Theme & User Profile Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white transition"
              title="Toggle Theme"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Logged in as</p>
                  <p className="text-sm font-semibold text-violet-300">
                    {user?.username} ({user?.role})
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 px-3 py-2 bg-white/5 hover:bg-red-500/10 hover:text-red-400 rounded-md text-sm font-semibold transition"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 hover:bg-white/5 text-slate-200 rounded-md text-sm font-semibold transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 shadow-md shadow-violet-600/30 text-white rounded-md text-sm font-semibold transition"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden space-x-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white transition"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-slate-300 hover:text-white focus:outline-none"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/5 bg-slate-900 px-2 pt-2 pb-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive(link.path)
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {link.name}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-md text-base font-medium text-amber-400 hover:bg-amber-500/10`}
            >
              Admin Dashboard
            </Link>
          )}

          {isAuthenticated ? (
            <div className="pt-4 pb-2 border-t border-white/5 mt-2 px-3">
              <p className="text-sm font-medium text-slate-200">
                User: {user?.username} ({user?.role})
              </p>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="mt-3 w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600/20 hover:bg-red-600 hover:text-white border border-red-500/30 rounded-md text-sm font-semibold transition"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="pt-4 border-t border-white/5 mt-2 flex flex-col space-y-2 px-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 bg-white/5 text-slate-200 rounded-md text-sm font-semibold"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 bg-violet-600 text-white rounded-md text-sm font-semibold"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

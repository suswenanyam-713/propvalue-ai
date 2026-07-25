import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, User, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await login(username, password);
    setSubmitting(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[#0b0f19] px-4">
      <div className="absolute top-[30%] left-[20%] w-[350px] h-[350px] rounded-full bg-violet-600/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-[350px] h-[350px] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />

      <div className="glass-panel w-full max-w-md p-8 rounded-2xl border-white/10 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-white">Welcome Back</h2>
          <p className="text-slate-400 text-sm mt-2">Sign in to unlock investment analytics</p>
        </div>

        {error && (
          <div className="flex items-center space-x-2 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm mb-6">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" />
              <input
                type="text"
                placeholder="Enter admin, buyer, or seller"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950/60 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-violet-500 transition text-white"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
              <button 
                type="button"
                onClick={() => alert("Simulation mode: default passwords are admin123, buyer123, seller123")}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                Forgot?
              </button>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/60 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:border-violet-500 transition text-white"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-slate-500 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 text-white rounded-xl font-semibold text-sm transition shadow-lg shadow-violet-600/25 mt-2"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-slate-400">
          <span>Don't have an account? </span>
          <Link to="/register" className="text-violet-400 hover:text-violet-300 font-semibold">
            Register Here
          </Link>
        </div>
      </div>
    </div>
  );
}

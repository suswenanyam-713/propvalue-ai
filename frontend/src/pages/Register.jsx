import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, User, KeyRound, AlertCircle, Sparkles } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Buyer');  // Buyer, Seller, Admin
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSubmitting(true);

    const result = await register(username, email, password, role);
    setSubmitting(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate('/properties');
      }, 1000);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-[#0b0f19] px-4 py-8">
      <div className="absolute top-[20%] left-[10%] w-[350px] h-[350px] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[350px] h-[350px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />

      <div className="glass-panel w-full max-w-md p-8 rounded-2xl border-white/10 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-white">Create Account</h2>
          <p className="text-slate-400 text-sm mt-2">Join our investment intelligence platform</p>
        </div>

        {error && (
          <div className="flex items-center space-x-2 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm mb-6">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-lg text-sm mb-6">
            <Sparkles className="h-5 w-5 flex-shrink-0" />
            <span>Account created successfully! Redirecting to login...</span>
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
                placeholder="Pick a unique username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950/60 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-violet-500 transition text-white"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" />
              <input
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/60 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-violet-500 transition text-white"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" />
              <input
                type="password"
                placeholder="Create password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/60 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-violet-500 transition text-white"
                required
              />
            </div>
          </div>

          {/* Role Choice */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Account Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 transition text-white cursor-pointer"
            >
              <option value="Buyer" className="bg-slate-900 text-white">Buyer (Search & Compare)</option>
              <option value="Seller" className="bg-slate-900 text-white">Seller (Manage Listings)</option>
              <option value="Admin" className="bg-slate-900 text-white">Admin (Platform Manager)</option>
            </select>
          </div>

          {/* Register Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 text-white rounded-xl font-semibold text-sm transition shadow-lg shadow-violet-600/25 mt-2"
          >
            {submitting ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-slate-400">
          <span>Already have an account? </span>
          <Link to="/login" className="text-violet-400 hover:text-violet-300 font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

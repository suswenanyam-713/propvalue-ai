import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, Home, Brain, MessageSquare, Loader2, ShieldAlert, Trash2, Edit3, ChevronDown } from 'lucide-react';

function AdminStatCard({ label, value, icon: Icon, color }) {
  return (
    <div className={`glass-panel p-6 rounded-2xl border border-white/10`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-400">{label}</p>
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <p className="text-3xl font-extrabold text-white">{value?.toLocaleString() || 0}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const { isAdmin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!isAdmin) { navigate('/dashboard'); return; }

    Promise.all([
      axios.get('/api/admin/analytics'),
      axios.get('/api/admin/users')
    ]).then(([analyticsRes, usersRes]) => {
      setAnalytics(analyticsRes.data);
      setUsers(usersRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [isAuthenticated, isAdmin, navigate]);

  const handleDeleteUser = async (userId) => {
    if (!confirm('Delete this user? This action cannot be undone.')) return;
    try {
      await axios.delete(`/api/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      alert('Failed to delete user: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`/api/admin/users/${userId}`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert('Failed to update role: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-slate-400">
      <Loader2 className="h-8 w-8 animate-spin text-amber-500 mr-3" /> Loading admin data...
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Manage Users' },
    { id: 'predictions', label: 'Recent Predictions' },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-10">
          <ShieldAlert className="h-8 w-8 text-amber-400" />
          <div>
            <h1 className="text-4xl font-extrabold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 text-sm">Platform management & analytics</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-white/10 pb-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition ${activeTab === tab.id ? 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-400' : 'text-slate-400 hover:text-white'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && analytics && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <AdminStatCard label="Total Users" value={analytics.user_count} icon={Users} color="bg-violet-600" />
              <AdminStatCard label="Properties" value={analytics.property_count} icon={Home} color="bg-blue-600" />
              <AdminStatCard label="Predictions Made" value={analytics.prediction_count} icon={Brain} color="bg-emerald-600" />
              <AdminStatCard label="Chat Sessions" value={analytics.chat_count} icon={MessageSquare} color="bg-amber-600" />
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-5 border-b border-white/10">
              <h2 className="font-bold text-white">Registered Users ({users.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3">ID</th>
                    <th className="text-left px-5 py-3">Username</th>
                    <th className="text-left px-5 py-3">Email</th>
                    <th className="text-left px-5 py-3">Role</th>
                    <th className="text-left px-5 py-3">Joined</th>
                    <th className="text-left px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/2 transition">
                      <td className="px-5 py-3 text-slate-500">#{u.id}</td>
                      <td className="px-5 py-3 font-semibold text-white">{u.username}</td>
                      <td className="px-5 py-3 text-slate-400">{u.email}</td>
                      <td className="px-5 py-3">
                        <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer border focus:outline-none ${u.role === 'Admin' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : u.role === 'Seller' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-slate-700/50 text-slate-300 border-white/10'}`}>
                          <option className="bg-slate-900">Buyer</option>
                          <option className="bg-slate-900">Seller</option>
                          <option className="bg-slate-900">Admin</option>
                        </select>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{u.created_at?.slice(0, 10)}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => handleDeleteUser(u.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'predictions' && analytics?.recent_predictions && (
          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-5 border-b border-white/10">
              <h2 className="font-bold text-white">Recent Predictions (Last 10)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3">ID</th>
                    <th className="text-left px-5 py-3">Property Type</th>
                    <th className="text-left px-5 py-3">Location</th>
                    <th className="text-left px-5 py-3">Predicted Price</th>
                    <th className="text-left px-5 py-3">Confidence</th>
                    <th className="text-left px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recent_predictions.map(pred => (
                    <tr key={pred.id} className="border-b border-white/5 hover:bg-white/2 transition">
                      <td className="px-5 py-3 text-slate-500">#{pred.id}</td>
                      <td className="px-5 py-3 text-slate-200">{pred.property_type}</td>
                      <td className="px-5 py-3 text-slate-400">{pred.locality}, {pred.city}</td>
                      <td className="px-5 py-3 font-bold text-violet-400">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(pred.predicted_price)}</td>
                      <td className="px-5 py-3 text-emerald-400">{(pred.confidence_score * 100).toFixed(1)}%</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{pred.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

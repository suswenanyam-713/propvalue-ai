import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Home, DollarSign, Activity, MapPin, Loader2, Plus, Trash2, Edit3, X, Sliders } from 'lucide-react';

const CITIES = ['Chennai', 'Hyderabad', 'Pune', 'Mumbai', 'Bengaluru'];
const LOCALITIES = {
  Chennai: ['Velachery', 'Adyar', 'Porur', 'Tambaram', 'Chrompet'],
  Hyderabad: ['Miyapur', 'Madhapur', 'Kondapur', 'Gachibowli', 'Kukatpally'],
  Pune: ['Kothrud', 'Wakad', 'Baner', 'Hadapsar', 'Viman Nagar'],
  Mumbai: ['Bandra', 'Andheri', 'Thane', 'Powai', 'Malad'],
  Bengaluru: ['Indiranagar', 'Whitefield', 'Koramangala', 'HSR Layout', 'Electronic City'],
};
const TYPES = ['Apartment', 'Independent House', 'Plot', 'Villa'];
const FURNISHING = ['Unfurnished', 'Semi', 'Fully'];
const CITY_COORDS = {
  Chennai: [13.08, 80.27], Hyderabad: [17.39, 78.49],
  Pune: [18.52, 73.86], Mumbai: [19.08, 72.88], Bengaluru: [12.97, 77.59]
};

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400 font-medium">{label}</p>
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <p className="text-3xl font-extrabold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { isAuthenticated, user, isSeller, isAdmin } = useAuth();
  const [market, setMarket] = useState(null);
  const [sellerProps, setSellerProps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('market'); // market or seller
  const [showModal, setShowModal] = useState(false);
  const [editingProp, setEditingProp] = useState(null);

  // Form State
  const [form, setForm] = useState({
    city: 'Hyderabad', locality: 'Madhapur', property_type: 'Apartment',
    area_sqft: 1500, bedrooms: 3, bathrooms: 2, floor: 5, age: 3,
    parking: 'Yes', furnishing: 'Semi', latitude: 17.44, longitude: 78.39,
    price_inr: 12000000
  });

  const handleCityChange = (val) => {
    const coords = CITY_COORDS[val] || [17.39, 78.49];
    setForm({
      ...form,
      city: val,
      locality: LOCALITIES[val]?.[0] || '',
      latitude: coords[0],
      longitude: coords[1]
    });
  };

  const fetchData = async () => {
    try {
      const marketRes = await axios.get('/api/market');
      setMarket(marketRes.data);

      if (isAuthenticated && (isSeller || isAdmin)) {
        const sellerRes = await axios.get('/api/seller/properties');
        setSellerProps(sellerRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAuthenticated, isSeller, isAdmin]);

  const handleSaveListing = async (e) => {
    e.preventDefault();
    try {
      const isPlot = form.property_type === 'Plot';
      const payload = {
        ...form,
        bedrooms: isPlot ? 0 : parseInt(form.bedrooms),
        bathrooms: isPlot ? 0 : parseInt(form.bathrooms),
        floor: isPlot ? 0 : parseInt(form.floor),
        age: isPlot ? 0 : parseInt(form.age),
        parking: isPlot ? 'No' : form.parking,
        furnishing: isPlot ? 'Unfurnished' : form.furnishing,
      };

      if (editingProp) {
        await axios.put(`/api/properties/${editingProp.id}`, payload);
      } else {
        await axios.post('/api/properties', payload);
      }
      setShowModal(false);
      setEditingProp(null);
      fetchData();
    } catch (err) {
      alert('Failed to save listing: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteListing = async (id) => {
    if (!confirm('Are you sure you want to delete this property listing?')) return;
    try {
      await axios.delete(`/api/properties/${id}`);
      fetchData();
    } catch (err) {
      alert('Failed to delete listing: ' + (err.response?.data?.detail || err.message));
    }
  };

  const openEditModal = (prop) => {
    setEditingProp(prop);
    setForm({
      city: prop.city, locality: prop.locality, property_type: prop.property_type,
      area_sqft: prop.area_sqft, bedrooms: prop.bedrooms, bathrooms: prop.bathrooms,
      floor: prop.floor || 1, age: prop.age, parking: prop.parking,
      furnishing: prop.furnishing, latitude: prop.latitude, longitude: prop.longitude,
      price_inr: prop.price_inr
    });
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingProp(null);
    setForm({
      city: 'Hyderabad', locality: 'Madhapur', property_type: 'Apartment',
      area_sqft: 1500, bedrooms: 3, bathrooms: 2, floor: 5, age: 3,
      parking: 'Yes', furnishing: 'Semi', latitude: 17.44, longitude: 78.39,
      price_inr: 12000000
    });
    setShowModal(true);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-slate-400">
      <Loader2 className="h-8 w-8 animate-spin text-violet-500 mr-3" /> Loading analytics...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-white to-violet-300 bg-clip-text text-transparent">Market Intelligence Dashboard</h1>
            <p className="text-slate-400 mt-2">Explore property listings, price movements, and local growth indicators</p>
          </div>
          {isAuthenticated && (isSeller || isAdmin) && (
            <div className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-white/5">
              <button onClick={() => setActiveTab('market')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'market' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                Market Intelligence
              </button>
              <button onClick={() => setActiveTab('seller')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'seller' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                My Listed Properties ({sellerProps.length})
              </button>
            </div>
          )}
        </div>

        {activeTab === 'market' ? (
          <div>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
              <StatCard label="Total Listings" value={market.listings_count.toLocaleString()} sub="Active in database" icon={Home} color="bg-violet-600" />
              <StatCard label="Available Now" value={market.available_listings.toLocaleString()} sub="Ready to buy" icon={Activity} color="bg-emerald-600" />
              <StatCard label="Average Price" value={new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(market.average_price)} sub="All property types" icon={DollarSign} color="bg-blue-600" />
              <StatCard label="Sold This Period" value={market.sold_listings.toLocaleString()} sub="Completed transactions" icon={TrendingUp} color="bg-amber-600" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Price Trend */}
              <div className="glass-panel p-6 rounded-2xl border border-white/10">
                <h2 className="text-lg font-bold mb-1">Average Price Trend</h2>
                <p className="text-xs text-slate-500 mb-5">Historical avg sale price across all cities</p>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={market.price_trend_chart}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={v => v?.slice(0,7)} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={v => v >= 1e7 ? `₹${(v/1e7).toFixed(1)} Cr` : `₹${(v/1e5).toFixed(1)} L`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                      formatter={v => [new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v), 'Avg Price']} />
                    <Area type="monotone" dataKey="price" stroke="#8b5cf6" strokeWidth={2} fill="url(#priceGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Demand Index */}
              <div className="glass-panel p-6 rounded-2xl border border-white/10">
                <h2 className="text-lg font-bold mb-1">Market Demand Index</h2>
                <p className="text-xs text-slate-500 mb-5">Demand signal across recent dates</p>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={market.price_trend_chart?.slice(-15)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={v => v?.slice(0,7)} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} />
                    <Bar dataKey="demand" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Growing Areas */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <h2 className="text-lg font-bold mb-6">🔥 Top Growing Localities</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {market.top_growing_areas?.map((area, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-800/50 border border-white/5 hover:border-violet-500/30 transition">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-4 w-4 text-violet-400" />
                      <span className="text-xs text-slate-400">{area.city}</span>
                    </div>
                    <h3 className="font-bold text-white text-sm mb-2">{area.locality}</h3>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-slate-500">Growth</p>
                        <p className="text-lg font-extrabold text-emerald-400">{area.growth}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Demand</p>
                        <p className="text-sm font-bold text-cyan-400">{area.demand_index}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Audit source tag */}
            <div className="text-center text-xs text-slate-500 mt-6 flex items-center justify-center gap-4">
              <span>Source: PropValue AI Market Analytics Database</span>
              <span>Last updated: {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        ) : (
          /* Seller Listed Properties */
          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">My Real Estate Listings</h2>
                <p className="text-xs text-slate-500 mt-1">Add, update, or remove your properties from the public directory</p>
              </div>
              <button onClick={openAddModal}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-violet-600/25">
                <Plus className="h-4 w-4" /> Add Property
              </button>
            </div>

            {sellerProps.length === 0 ? (
              <div className="p-20 text-center text-slate-500">
                <Home className="h-16 w-16 mx-auto mb-4 text-slate-700" />
                <h3 className="text-lg font-bold mb-1">No Listings Found</h3>
                <p className="text-sm max-w-sm mx-auto">Click "Add Property" to publish your first property listing on AeroValuate.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="text-left px-6 py-3">Property</th>
                      <th className="text-left px-6 py-3">Type</th>
                      <th className="text-left px-6 py-3">Specs</th>
                      <th className="text-left px-6 py-3">Price</th>
                      <th className="text-left px-6 py-3">AI Score</th>
                      <th className="text-left px-6 py-3">Risk</th>
                      <th className="text-left px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellerProps.map(p => (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/2 transition">
                        <td className="px-6 py-4">
                          <p className="font-bold text-white">{p.locality}</p>
                          <p className="text-xs text-slate-400">{p.city}</p>
                        </td>
                        <td className="px-6 py-4">{p.property_type}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">
                          {p.bedrooms} BHK · {p.bathrooms} Bath · {p.area_sqft} sqft
                        </td>
                        <td className="px-6 py-4 font-bold text-violet-400">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p.price_inr)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                            {p.investment_score}/100
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
                            {p.risk_score}/100
                          </span>
                        </td>
                        <td className="px-6 py-4 flex gap-2">
                          <button onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition" title="Edit Listing">
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeleteListing(p.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition" title="Delete Listing">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Listing Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Sliders className="h-5 w-5 text-violet-400" />
                {editingProp ? 'Edit Property Listing' : 'Publish Property Listing'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveListing} className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">City</label>
                  <select value={form.city} onChange={e => handleCityChange(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500">
                    {CITIES.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Locality</label>
                  <select value={form.locality} onChange={e => setForm({...form, locality: e.target.value})}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500">
                    {(LOCALITIES[form.city] || []).map(l => <option key={l} value={l} className="bg-slate-900">{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Property Type</label>
                  <select value={form.property_type} onChange={e => setForm({...form, property_type: e.target.value})}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500">
                    {TYPES.map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
                  </select>
                </div>
                {form.property_type !== 'Plot' && (
                  <>
                    <div>
                      <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Furnishing</label>
                      <select value={form.furnishing} onChange={e => setForm({...form, furnishing: e.target.value})}
                        className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500">
                        {FURNISHING.map(f => <option key={f} value={f} className="bg-slate-900">{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Parking</label>
                      <select value={form.parking} onChange={e => setForm({...form, parking: e.target.value})}
                        className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500">
                        <option className="bg-slate-900">Yes</option>
                        <option className="bg-slate-900">No</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {form.property_type !== 'Plot' && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">BHK</label>
                    <input type="number" min={1} max={10} value={form.bedrooms} onChange={e => setForm({...form, bedrooms: parseInt(e.target.value)})}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500" required />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Bathrooms</label>
                    <input type="number" min={1} max={8} value={form.bathrooms} onChange={e => setForm({...form, bathrooms: parseInt(e.target.value)})}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500" required />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Floor</label>
                    <input type="number" min={0} max={50} value={form.floor} onChange={e => setForm({...form, floor: parseInt(e.target.value)})}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500" required />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Age (years)</label>
                    <input type="number" min={0} max={50} value={form.age} onChange={e => setForm({...form, age: parseInt(e.target.value)})}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500" required />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Area (sqft)</label>
                  <input type="number" min={100} value={form.area_sqft} onChange={e => setForm({...form, area_sqft: parseInt(e.target.value)})}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500" required />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Price (INR)</label>
                  <input type="number" min={100000} value={form.price_inr} onChange={e => setForm({...form, price_inr: parseFloat(e.target.value)})}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-violet-400 font-bold focus:outline-none focus:border-violet-500" required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Latitude</label>
                  <input type="number" step="0.0001" value={form.latitude} onChange={e => setForm({...form, latitude: parseFloat(e.target.value)})}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500" required />
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Longitude</label>
                  <input type="number" step="0.0001" value={form.longitude} onChange={e => setForm({...form, longitude: parseFloat(e.target.value)})}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500" required />
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-white/10">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-white/10 rounded-xl font-bold hover:bg-white/5 transition">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold transition shadow-lg shadow-violet-600/25">
                  {editingProp ? 'Save Listing Changes' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

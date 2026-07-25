import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Search, BedDouble, Bath, Maximize, Car, Eye } from 'lucide-react';

const CITIES = ['', 'Chennai', 'Hyderabad', 'Pune', 'Mumbai', 'Bengaluru'];
const TYPES = ['', 'Apartment', 'Independent House', 'Plot', 'Villa'];

function PropertyCard({ prop, index }) {
  const navigate = useNavigate();
  const pricePerSqft = (prop.price_inr / prop.area_sqft).toFixed(0);
  const displayName = prop.property_name || `${prop.locality} ${prop.property_type}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.3) }}
      className="glass-panel glass-card-hover rounded-2xl overflow-hidden border border-white/8 flex flex-col"
    >
      <div className="relative h-48 overflow-hidden">
        <img src={prop.image_url || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80'}
          alt={displayName} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
        <span className="absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-semibold bg-violet-600/90 text-white backdrop-blur">
          {prop.property_type}
        </span>
        <span className="absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-bold bg-slate-900/80 text-violet-300 backdrop-blur">
          AI {prop.investment_score}/100
        </span>
      </div>

      <div className="p-5 flex flex-col flex-1">
        {/* Prominent Property_Name ABOVE Price */}
        <div className="mb-3">
          <h3 className="text-base font-bold text-white mb-1.5 leading-snug line-clamp-2" title={displayName}>
            {displayName}
          </h3>
          <p className="text-xl font-extrabold text-violet-400">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(prop.price_inr)}
          </p>
          <p className="text-sm text-slate-400 mt-0.5">{prop.locality}, {prop.city}</p>
          <p className="text-xs text-slate-500 mt-0.5">₹{Number(pricePerSqft).toLocaleString('en-IN')}/sq.ft</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-4">
          <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5 text-violet-400" />{prop.bedrooms} BHK</span>
          <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5 text-violet-400" />{prop.bathrooms} Bath</span>
          <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5 text-violet-400" />{Number(prop.area_sqft).toLocaleString('en-IN')} sq.ft</span>
          <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5 text-violet-400" />Parking: {prop.parking}</span>
        </div>

        <div className="flex gap-2 mt-auto">
          <div className="flex-1 text-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-xs text-slate-500">Invest</p>
            <p className="text-sm font-bold text-emerald-400">{prop.investment_score}/100</p>
          </div>
          <div className="flex-1 text-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-slate-500">Risk</p>
            <p className="text-sm font-bold text-red-400">{prop.risk_score}/100</p>
          </div>
        </div>

        <button
          onClick={() => navigate(`/properties/${prop.id}`)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 hover:bg-violet-600 text-violet-300 hover:text-white text-sm font-semibold transition"
        >
          <Eye className="h-4 w-4" />
          View Details
        </button>
      </div>
    </motion.div>
  );
}

export default function PropertiesPage() {
  const [searchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    q: '',
    city: searchParams.get('city') || '',
    locality: searchParams.get('locality') || '',
    property_type: '',
    bedrooms: '',
    min_price: '',
    max_price: '',
  });

  const fetchProperties = async (f = filters) => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
      const res = await axios.get('/api/properties', { params });
      setProperties(res.data);
    } catch (err) {
      console.error('Failed to fetch properties', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProperties(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProperties(filters);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-white to-violet-300 bg-clip-text text-transparent">
            Property Search
          </h1>
          <p className="text-slate-400">Search 10,000+ property records by Property Name, Locality, or City</p>
        </div>

        {/* Search & Filter bar */}
        <form onSubmit={handleSearch} className="glass-panel rounded-2xl p-5 mb-8 border border-white/10 space-y-4">
          {/* Main Property_Name / Keyword Search input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search Property Name (e.g. Miyapur Residency, Velachery Heights)..."
              value={filters.q}
              onChange={e => setFilters({ ...filters, q: e.target.value })}
              className="w-full bg-slate-950/60 border border-violet-500/30 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500"
            />
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-violet-400" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <select value={filters.city} onChange={e => setFilters({...filters, city: e.target.value})}
              className="bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500">
              {CITIES.map(c => <option key={c} value={c} className="bg-slate-900">{c || 'All Cities'}</option>)}
            </select>
            <input type="text" placeholder="Locality (e.g. Miyapur)..."
              value={filters.locality} onChange={e => setFilters({...filters, locality: e.target.value})}
              className="bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500" />
            <select value={filters.property_type} onChange={e => setFilters({...filters, property_type: e.target.value})}
              className="bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500">
              {TYPES.map(t => <option key={t} value={t} className="bg-slate-900">{t || 'All Types'}</option>)}
            </select>
            <select value={filters.bedrooms} onChange={e => setFilters({...filters, bedrooms: e.target.value})}
              className="bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500">
              <option value="" className="bg-slate-900">Any BHK</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n} className="bg-slate-900">{n} BHK</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <input type="number" placeholder="Min Price (INR)"
              value={filters.min_price} onChange={e => setFilters({...filters, min_price: e.target.value})}
              className="flex-1 bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500" />
            <input type="number" placeholder="Max Price (INR)"
              value={filters.max_price} onChange={e => setFilters({...filters, max_price: e.target.value})}
              className="flex-1 bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500" />
            <button type="submit" className="px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-violet-600/25">
              <Search className="h-4 w-4" /> Search
            </button>
          </div>
        </form>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading properties...</div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20 text-slate-500">No properties found. Try different search terms.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {properties.map((p, i) => <PropertyCard key={p.id} prop={p} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Scale, TrendingUp, ShieldAlert, IndianRupee, Maximize, BedDouble, Bath, Star, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { loadGoogleMapsScript, getGoogleMapsApiKey } from '../utils/googleMapsLoader';

const CITIES_PRESETS = {
  Hyderabad: {
    lat_a: 17.4485, lon_a: 78.3908,
    lat_b: 17.4965, lon_b: 78.4014
  },
  Chennai: {
    lat_a: 12.9796, lon_a: 80.2201,
    lat_b: 13.0067, lon_b: 80.2206
  },
  Bengaluru: {
    lat_a: 12.9784, lon_a: 77.6408,
    lat_b: 12.9698, lon_b: 77.7499
  },
  Mumbai: {
    lat_a: 19.0596, lon_a: 72.8295,
    lat_b: 19.1136, lon_b: 72.8697
  },
  Pune: {
    lat_a: 18.5018, lon_a: 73.8112,
    lat_b: 18.5765, lon_b: 73.7394
  }
};

const MAP_DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

function PropertySelector({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">{label} Property ID</label>
      <input type="number" placeholder={`e.g. 1${label === 'B' ? '5' : '0'}`}
        value={value} onChange={e => onChange(e.target.value)} min={1}
        className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500" />
    </div>
  );
}

function CompareCol({ prop, isBetter, label, distance }) {
  if (!prop) return <div className="flex-1 text-center text-slate-500">—</div>;
  return (
    <div className={`flex-1 p-6 rounded-2xl border transition ${isBetter ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/10 bg-slate-800/20'}`}>
      <div className="text-center mb-4">
        <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-2 inline-block ${isBetter ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
          Property {label} {isBetter ? '✓ Winner' : ''}
        </span>
        {distance !== undefined && (
          <p className="text-xs text-cyan-400 font-semibold mb-2 flex items-center justify-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> Nearest Match ({distance} km away)
          </p>
        )}
        <img src={prop.image_url || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80'}
          alt="" className="w-full h-32 object-cover rounded-xl mb-3" />
        <h3 className="font-bold text-white text-base leading-snug mb-1">{prop.property_name || `${prop.locality} Property`}</h3>
        <p className="text-xs text-slate-400">{prop.locality}, {prop.city} · Property ID: #{prop.id}</p>
      </div>

      <div className="space-y-3 text-sm">
        {[
          { label: 'Price', val: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(prop.price), icon: IndianRupee },
          { label: 'Area', val: `${Number(prop.area).toLocaleString('en-IN')} sq.ft`, icon: Maximize },
          { label: 'BHK', val: `${prop.bedrooms} BHK`, icon: BedDouble },
          { label: 'Bathrooms', val: prop.bathrooms, icon: Bath },
          { label: 'Investment Score', val: `${prop.investment_score}/100`, icon: TrendingUp },
          { label: 'Risk Score', val: `${prop.risk_score}/100`, icon: ShieldAlert },
          { label: 'Rental Yield', val: `${prop.rental_yield}%`, icon: Star },
          { label: 'Locality Growth', val: `${prop.growth}% YoY`, icon: TrendingUp },
        ].map(({ label: l, val, icon: Icon }) => (
          <div key={l} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-violet-400" />{l}
            </span>
            <span className="font-semibold text-white">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const clientApiKey = getGoogleMapsApiKey();

  const [activeTab, setActiveTab] = useState('id');
  const [idA, setIdA] = useState('');
  const [idB, setIdB] = useState('');
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  const [coords, setCoords] = useState({
    lat_a: 17.4485, lon_a: 78.3908,
    lat_b: 17.4965, lon_b: 78.4014
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const mapContainerRef = useRef(null);

  // ─── Load Google Maps JS API Safely ──────────────────────────────────────────────
  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => {
        setIsGoogleLoaded(true);
      })
      .catch(err => {
        setIsGoogleLoaded(false);
      });
  }, []);

  // ─── Render Google Map ────────────────────────────────────────────────────
  const renderMap = useCallback(() => {
    if (!result || !window.google || !mapContainerRef.current) return;
    const pa = result.property_a;
    const pb = result.property_b;
    if (!pa || !pb) return;

    const safeLatA = Number.isFinite(Number(pa.latitude)) ? Number(pa.latitude) : 17.4485;
    const safeLonA = Number.isFinite(Number(pa.longitude)) ? Number(pa.longitude) : 78.3908;
    const safeLatB = Number.isFinite(Number(pb.latitude)) ? Number(pb.latitude) : 17.4965;
    const safeLonB = Number.isFinite(Number(pb.longitude)) ? Number(pb.longitude) : 78.4014;

    const center = { lat: (safeLatA + safeLatB) / 2.0, lng: (safeLonA + safeLonB) / 2.0 };

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center, zoom: 12, styles: MAP_DARK_STYLE
    });

    const bounds = new window.google.maps.LatLngBounds();

    const posA = { lat: safeLatA, lng: safeLonA };
    bounds.extend(posA);
    new window.google.maps.Marker({
      position: posA, map, title: `Property A: ${pa.property_name}`,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 9, fillColor: '#3b82f6', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2
      }
    });

    const posB = { lat: safeLatB, lng: safeLonB };
    bounds.extend(posB);
    new window.google.maps.Marker({
      position: posB, map, title: `Property B: ${pb.property_name}`,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 9, fillColor: '#10b981', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2
      }
    });

    map.fitBounds(bounds);
  }, [result]);

  useEffect(() => {
    if (isGoogleLoaded && result) {
      renderMap();
    }
  }, [isGoogleLoaded, result, renderMap]);

  const handleCompareById = async (e) => {
    e.preventDefault();
    if (!idA || !idB) {
      setError('Please enter both Property A ID and Property B ID.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await axios.post('/api/compare', {
        property_a_id: parseInt(idA),
        property_b_id: parseInt(idB)
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Comparison failed. Verify both Property IDs exist.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompareByCoords = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await axios.post('/api/compare/coordinates', coords);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Coordinate comparison failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white px-4 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-white to-violet-300 bg-clip-text text-transparent flex items-center gap-3">
            <Scale className="h-9 w-9 text-violet-400" /> Property Comparison Engine
          </h1>
          <p className="text-slate-400 mt-2">Side-by-side investment intelligence, risk profile, and spatial accessibility comparison</p>
        </div>

        {/* Tab Selection */}
        <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-2xl border border-white/10 max-w-md">
          <button
            onClick={() => { setActiveTab('id'); setResult(null); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition ${activeTab === 'id' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-slate-400 hover:text-white'}`}
          >
            Compare by Property ID
          </button>
          <button
            onClick={() => { setActiveTab('coordinates'); setResult(null); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition ${activeTab === 'coordinates' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-slate-400 hover:text-white'}`}
          >
            Compare by Coordinates
          </button>
        </div>

        {/* Form Sections */}
        {activeTab === 'id' ? (
          <form onSubmit={handleCompareById} className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PropertySelector label="A" value={idA} onChange={setIdA} />
              <PropertySelector label="B" value={idB} onChange={setIdB} />
            </div>
            {error && <div className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <button type="submit" disabled={loading} className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />} Compare Listings
            </button>
          </form>
        ) : (
          <form onSubmit={handleCompareByCoords} className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="mb-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">City Presets</label>
              <div className="flex flex-wrap gap-2">
                {Object.keys(CITIES_PRESETS).map(city => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => setCoords(CITIES_PRESETS[city])}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-white/5 transition"
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 bg-slate-900/60 p-4 rounded-xl border border-white/5">
                <p className="text-xs font-bold text-blue-400">Property A Coordinates</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" step="any" value={coords.lat_a} onChange={e => setCoords({ ...coords, lat_a: parseFloat(e.target.value) })} className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white" placeholder="Lat A" />
                  <input type="number" step="any" value={coords.lon_a} onChange={e => setCoords({ ...coords, lon_a: parseFloat(e.target.value) })} className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white" placeholder="Lon A" />
                </div>
              </div>

              <div className="space-y-2 bg-slate-900/60 p-4 rounded-xl border border-white/5">
                <p className="text-xs font-bold text-emerald-400">Property B Coordinates</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" step="any" value={coords.lat_b} onChange={e => setCoords({ ...coords, lat_b: parseFloat(e.target.value) })} className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white" placeholder="Lat B" />
                  <input type="number" step="any" value={coords.lon_b} onChange={e => setCoords({ ...coords, lon_b: parseFloat(e.target.value) })} className="bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white" placeholder="Lon B" />
                </div>
              </div>
            </div>

            {error && <div className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <button type="submit" disabled={loading} className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />} Compare Coordinates
            </button>
          </form>
        )}

        {/* Results View */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* AI Recommendation Banner */}
            <div className="glass-panel p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5">
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Star className="h-4 w-4" /> AI Comparative Recommendation
              </h3>
              <p className="text-sm text-slate-200 leading-relaxed">{result.ai_recommendation}</p>
            </div>

            {/* Side by Side Specs */}
            <div className="flex flex-col md:flex-row gap-6">
              <CompareCol prop={result.property_a} isBetter={result.better_property === 'A'} label="A" distance={result.distance_a_km} />
              <CompareCol prop={result.property_b} isBetter={result.better_property === 'B'} label="B" distance={result.distance_b_km} />
            </div>

            {/* Comparison Map */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
              <h3 className="font-bold text-white text-base">Spatial Location Map</h3>
              <div ref={mapContainerRef} className="h-72 rounded-xl overflow-hidden border border-white/5 bg-slate-900 relative">
                {!isGoogleLoaded && (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> Loading Spatial Map...
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

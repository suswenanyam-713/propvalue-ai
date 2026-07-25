import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Scale, TrendingUp, ShieldAlert, IndianRupee, Maximize, BedDouble, Bath, Star, AlertCircle, Loader2, MapPin } from 'lucide-react';

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

const GMAPS_CALLBACK = '__gmapsReady_compare';

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
  const clientApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const [activeTab, setActiveTab] = useState('id'); // 'id' or 'coordinates'
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

  // ─── Load Google Maps JS API ──────────────────────────────────────────────
  useEffect(() => {
    let pollTimer = null;
    const onReady = () => {
      clearInterval(pollTimer);
      setIsGoogleLoaded(true);
    };

    if (window.google && window.google.maps) {
      onReady();
      return;
    }

    if (clientApiKey) {
      window[GMAPS_CALLBACK] = onReady;
      if (!document.querySelector('script[data-gmaps]')) {
        const script = document.createElement('script');
        script.setAttribute('data-gmaps', 'true');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${clientApiKey}&callback=${GMAPS_CALLBACK}`;
        script.async = true;
        document.head.appendChild(script);
      }
      pollTimer = setInterval(() => {
        if (window.google && window.google.maps) onReady();
      }, 300);
    }
    return () => clearInterval(pollTimer);
  }, [clientApiKey]);

  // ─── Render Google Map ────────────────────────────────────────────────────
  const renderMap = useCallback(() => {
    if (!result || !window.google || !mapContainerRef.current) return;
    const pa = result.property_a;
    const pb = result.property_b;
    if (!pa || !pb) return;

    const center = { lat: (pa.latitude + pb.latitude) / 2.0, lng: (pa.longitude + pb.longitude) / 2.0 };

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center,
      zoom: 11,
      styles: MAP_DARK_STYLE,
      zoomControl: true,
    });

    // Marker A (Red)
    new window.google.maps.Marker({
      position: { lat: pa.latitude, lng: pa.longitude },
      map,
      title: `Property A: ${pa.property_name || pa.locality}`,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#ef4444',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      }
    });

    // Marker B (Orange)
    new window.google.maps.Marker({
      position: { lat: pb.latitude, lng: pb.longitude },
      map,
      title: `Property B: ${pb.property_name || pb.locality}`,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#f97316',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      }
    });
  }, [result]);

  useEffect(() => {
    if (isGoogleLoaded && result) {
      renderMap();
    }
  }, [isGoogleLoaded, result, renderMap]);

  const handleApplyPreset = (cityKey) => {
    const preset = CITIES_PRESETS[cityKey];
    if (preset) {
      setCoords({
        lat_a: preset.lat_a, lon_a: preset.lon_a,
        lat_b: preset.lat_b, lon_b: preset.lon_b
      });
    }
  };

  const handleCompare = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      let res;
      if (activeTab === 'id') {
        if (!idA || !idB) { setError('Please enter both Property IDs.'); setLoading(false); return; }
        res = await axios.post('/api/compare', { property_a_id: parseInt(idA), property_b_id: parseInt(idB) });
      } else {
        res = await axios.post('/api/compare/coordinates', {
          lat_a: parseFloat(coords.lat_a),
          lon_a: parseFloat(coords.lon_a),
          lat_b: parseFloat(coords.lat_b),
          lon_b: parseFloat(coords.lon_b)
        });
      }
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Comparison failed. Please make sure you are logged in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-white to-violet-300 bg-clip-text text-transparent">Property Comparison</h1>
            <p className="text-slate-400 mt-2">Side-by-side AI analysis of two properties with investment recommendation</p>
          </div>
          <div className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-white/5">
            <button onClick={() => { setActiveTab('id'); setResult(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'id' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Compare by ID
            </button>
            <button onClick={() => { setActiveTab('coordinates'); setResult(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'coordinates' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Compare by Coordinates (Lat/Lon)
            </button>
          </div>
        </div>

        {/* Input Panel */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 mb-8">
          {activeTab === 'id' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <PropertySelector label="A" value={idA} onChange={setIdA} />
              <div className="text-center">
                <Scale className="h-10 w-10 text-violet-500 mx-auto mb-1" />
                <p className="text-xs text-slate-500">VS</p>
              </div>
              <PropertySelector label="B" value={idB} onChange={setIdB} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-2 items-center">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">City Coordinates Presets:</span>
                {Object.keys(CITIES_PRESETS).map(c => (
                  <button key={c} type="button" onClick={() => handleApplyPreset(c)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-violet-600/30 text-xs text-slate-300 rounded border border-white/5 transition">
                    {c}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end text-sm">
                <div className="md:col-span-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Latitude A</label>
                    <input type="number" step="0.0001" value={coords.lat_a} onChange={e => setCoords({ ...coords, lat_a: e.target.value })}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Longitude A</label>
                    <input type="number" step="0.0001" value={coords.lon_a} onChange={e => setCoords({ ...coords, lon_a: e.target.value })}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none" />
                  </div>
                </div>
                <div className="text-center md:col-span-1 py-2">
                  <Scale className="h-8 w-8 text-violet-500 mx-auto" />
                  <p className="text-xs text-slate-500 mt-1">VS</p>
                </div>
                <div className="md:col-span-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Latitude B</label>
                    <input type="number" step="0.0001" value={coords.lat_b} onChange={e => setCoords({ ...coords, lat_b: e.target.value })}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Longitude B</label>
                    <input type="number" step="0.0001" value={coords.lon_b} onChange={e => setCoords({ ...coords, lon_b: e.target.value })}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm mt-4">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
            </div>
          )}

          <button onClick={handleCompare} disabled={loading}
            className="mt-5 w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-violet-600/25">
            {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Comparing...</> : <><Scale className="h-5 w-5" /> Compare Properties</>}
          </button>
        </div>

        {/* Comparison Results */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
            {/* AI Recommendation Banner */}
            <div className="glass-panel p-5 rounded-2xl border border-violet-500/30 bg-violet-500/5">
              <p className="text-sm font-medium text-slate-300">
                <span className="text-violet-400 font-bold">AI Recommendation: </span>
                {result.ai_recommendation}
              </p>
            </div>

            {/* Side by Side */}
            <div className="flex flex-col sm:flex-row gap-6">
              <CompareCol prop={result.property_a} isBetter={result.better_property === 'A'} label="A" distance={result.distance_a_km} />
              <CompareCol prop={result.property_b} isBetter={result.better_property === 'B'} label="B" distance={result.distance_b_km} />
            </div>

            {/* Google Map Visualization */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
              <h2 className="text-lg font-bold text-white">Properties Location Map Comparison</h2>
              <div ref={mapContainerRef} id="google-map-compare-container" className="h-72 rounded-xl overflow-hidden border border-white/5 bg-slate-900 relative">
                {!isGoogleLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                    Loading Google Map...
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                  Property A: {result.property_a.property_name || result.property_a.locality}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: '#f97316' }} />
                  Property B: {result.property_b.property_name || result.property_b.locality}
                </span>
              </div>
            </div>

            {/* Audit source tag */}
            <div className="text-center text-xs text-slate-500 mt-6 flex items-center justify-center gap-4">
              <span>Source: PropValue AI Location & Comparison Database</span>
              <span>Last updated: {new Date().toLocaleDateString()}</span>
            </div>
          </motion.div>
        )}

        {!result && !loading && (
          <div className="glass-panel p-12 rounded-2xl border border-white/10 text-center">
            <Scale className="h-16 w-16 text-violet-600/40 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-400 mb-2">Compare Properties Side-by-Side</h3>
            <p className="text-sm text-slate-500">
              {activeTab === 'id'
                ? 'Enter two Property IDs from 1 to 10000 to trigger comparison.'
                : 'Enter target Latitude and Longitude values or click one of the city presets above.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

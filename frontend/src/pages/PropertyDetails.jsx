import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  BedDouble, Bath, Maximize, Car, TrendingUp, ShieldAlert, MapPin,
  Hospital, School, ShoppingBag, Train, TreePine, Star, ArrowLeft,
  ExternalLink, Compass, ShieldCheck, CheckCircle2, Loader2, Filter
} from 'lucide-react';

const AMENITY_COLORS = {
  'Target Property': '#8b5cf6',
  Hospital: '#ef4444', Clinic: '#f43f5e', Pharmacy: '#fb7185',
  School: '#22c55e', 'University / College': '#10b981',
  'Metro Station': '#3b82f6', 'Railway Station': '#1d4ed8', 'Bus Station': '#6366f1', 'Transit Station': '#a855f7',
  'Shopping Mall': '#f97316', Supermarket: '#f59e0b',
  Park: '#10b981', Bank: '#06b6d4', Restaurant: '#ec4899', Gym: '#a855f7'
};

const MAP_DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

const GMAPS_CALLBACK = '__gmapsReady_propdetails';

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const clientApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapsError, setMapsError] = useState('');
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState('All');

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  // ─── Fetch Property Details ───────────────────────────────────────────────
  useEffect(() => {
    axios.get(`/api/properties/${id}`)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load property details:', err);
        setLoading(false);
      });
  }, [id]);

  // ─── Load Google Maps JS API ──────────────────────────────────────────────
  useEffect(() => {
    let pollTimer = null;
    const onReady = () => {
      clearInterval(pollTimer);
      setIsGoogleLoaded(true);
      setMapsError('');
    };

    if (window.google && window.google.maps) {
      onReady();
      return;
    }

    if (!clientApiKey) {
      setMapsError('VITE_GOOGLE_MAPS_API_KEY missing in frontend/.env');
      return;
    }

    window[GMAPS_CALLBACK] = onReady;

    if (!document.querySelector('script[data-gmaps]')) {
      const script = document.createElement('script');
      script.setAttribute('data-gmaps', 'true');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${clientApiKey}&callback=${GMAPS_CALLBACK}`;
      script.async = true;
      script.onerror = () => setMapsError('Google Maps failed to load. Check API key and referrer restrictions.');
      document.head.appendChild(script);
    }

    pollTimer = setInterval(() => {
      if (window.google && window.google.maps) onReady();
    }, 300);

    return () => clearInterval(pollTimer);
  }, [clientApiKey]);

  // ─── Render Google Map & Markers ──────────────────────────────────────────
  const renderMap = useCallback(() => {
    if (!data || !window.google || !mapContainerRef.current) return;
    const p = data.property;
    const places = data.nearby_google_places || [];

    const center = { lat: p.resolvedLatitude || p.latitude, lng: p.resolvedLongitude || p.longitude };

    // 1. Init Map
    const map = new window.google.maps.Map(mapContainerRef.current, {
      center,
      zoom: 14,
      styles: MAP_DARK_STYLE,
      zoomControl: true,
      fullscreenControl: true,
    });
    mapInstanceRef.current = map;

    // Clear previous markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // 2. Target Property Marker (Distinct Purple Marker)
    const targetMarker = new window.google.maps.Marker({
      position: center,
      map,
      title: p.property_name || `${p.locality} ${p.property_type}`,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#8b5cf6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
      zIndex: 999
    });

    const targetIw = new window.google.maps.InfoWindow({
      content: `
        <div style="color:#0f172a;font-family:sans-serif;padding:6px;max-width:220px;">
          <strong style="font-size:14px;color:#6d28d9;">${p.property_name}</strong><br/>
          <span style="font-size:12px;color:#475569;">${p.locality}, ${p.city}</span><br/>
          <strong style="font-size:13px;color:#059669;">₹${new Intl.NumberFormat('en-IN').format(p.price_inr)}</strong>
        </div>
      `
    });
    targetMarker.addListener('click', () => targetIw.open(map, targetMarker));
    markersRef.current.push(targetMarker);

    // 3. Nearby Google Places Markers
    places.forEach(place => {
      if (!place.latitude || !place.longitude) return;
      const pos = { lat: place.latitude, lng: place.longitude };
      const color = AMENITY_COLORS[place.category] || '#3b82f6';

      const marker = new window.google.maps.Marker({
        position: pos,
        map,
        title: place.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 1.5,
        }
      });

      const iw = new window.google.maps.InfoWindow({
        content: `
          <div style="color:#0f172a;font-family:sans-serif;padding:6px;max-width:220px;">
            <strong style="font-size:13px;color:#1e293b;">${place.name}</strong><br/>
            <span style="font-size:11px;color:#64748b;">${place.category} · <strong>${place.distance_km} km</strong></span><br/>
            ${place.rating ? `<span style="font-size:11px;color:#d97706;">⭐ ${place.rating} (${place.user_ratings_total})</span><br/>` : ''}
            <span style="font-size:11px;color:#475569;">${place.address || ''}</span>
          </div>
        `
      });

      marker.addListener('click', () => iw.open(map, marker));
      markersRef.current.push(marker);
    });
  }, [data]);

  useEffect(() => {
    if (isGoogleLoaded && data) {
      renderMap();
    }
  }, [isGoogleLoaded, data, renderMap]);

  if (loading) return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-slate-400 gap-2">
      <Loader2 className="h-5 w-5 animate-spin text-violet-400" /> Loading property details & Google Places...
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-red-400">Property not found.</div>
  );

  const { property: p, nearby_google_places: places, places_metadata, historical_prices, rental_yield, image_gallery } = data;
  const rentalIncome = ((p.price_inr * (rental_yield / 100)) / 12).toFixed(0);

  // Group filtering for nearby places panel
  const filterGroups = ['All', 'Healthcare', 'Education', 'Transport', 'Shopping', 'Parks', 'Essentials'];
  const filteredPlaces = selectedGroup === 'All'
    ? (places || [])
    : (places || []).filter(pl => pl.group === selectedGroup);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white pb-16">
      {/* ── Image Gallery ── */}
      <div className="relative h-80 sm:h-96 overflow-hidden">
        <img src={image_gallery[galleryIdx]} alt="Property" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-transparent to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 p-2 rounded-xl bg-black/40 backdrop-blur hover:bg-black/60 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {image_gallery.map((_, i) => (
            <button key={i} onClick={() => setGalleryIdx(i)}
              className={`w-2 h-2 rounded-full transition ${i === galleryIdx ? 'bg-violet-400 w-4' : 'bg-white/40'}`} />
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Main Left Column ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Property Header Card */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                  <h1 className="text-3xl font-extrabold text-white mb-1">{p.property_name || `${p.locality} ${p.property_type}`}</h1>
                  <p className="text-xs font-mono text-violet-400 font-bold mb-1">Property ID: #{p.id}</p>
                  <p className="text-slate-400 flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-500" />{p.locality}, {p.city}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-extrabold text-violet-400">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p.price_inr)}</p>
                  <p className="text-sm text-slate-400">₹{Number((p.price_inr / p.area_sqft).toFixed(0)).toLocaleString('en-IN')}/sq.ft</p>
                </div>
              </div>

              {/* Coordinate Audit Status Badge */}
              <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-violet-500/20 text-xs text-slate-400 flex flex-wrap justify-between items-center gap-2">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> {p.coordinate_status}
                </span>
                <span className="font-mono text-slate-400">
                  Resolved: <span className="text-violet-300">{p.resolvedLatitude}, {p.resolvedLongitude}</span> (Orig: {p.originalLatitude}, {p.originalLongitude})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                {[
                  { icon: BedDouble, label: 'Bedrooms', val: `${p.bedrooms} BHK` },
                  { icon: Bath, label: 'Bathrooms', val: p.bathrooms },
                  { icon: Maximize, label: 'Area', val: `${Number(p.area_sqft).toLocaleString('en-IN')} sq.ft` },
                  { icon: Car, label: 'Parking', val: p.parking },
                ].map(({ icon: Icon, label, val }) => (
                  <div key={label} className="text-center p-3 rounded-xl bg-slate-800/50">
                    <Icon className="h-5 w-5 text-violet-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-sm font-bold text-white">{val}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                <div className="p-3 rounded-xl bg-slate-800/50"><p className="text-slate-500 text-xs">Property Type</p><p className="font-semibold">{p.property_type}</p></div>
                <div className="p-3 rounded-xl bg-slate-800/50"><p className="text-slate-500 text-xs">Furnishing</p><p className="font-semibold">{p.furnishing}</p></div>
                <div className="p-3 rounded-xl bg-slate-800/50"><p className="text-slate-500 text-xs">Age</p><p className="font-semibold">{p.age} yrs</p></div>
              </div>
            </div>

            {/* Price History Chart */}
            {historical_prices && historical_prices.length > 0 && (
              <div className="glass-panel p-6 rounded-2xl border border-white/10">
                <h2 className="text-lg font-bold mb-4">Price History</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={historical_prices}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => v.slice(0, 7)} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => v >= 1e7 ? `₹${(v / 1e7).toFixed(1)} Cr` : `₹${(v / 1e5).toFixed(1)} L`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                      formatter={v => [new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v), 'Avg Price']} />
                    <Line type="monotone" dataKey="avg_sale_price" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Interactive Google Map Section */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-violet-400" /> Interactive Google Map & Amenities Audit
                </h2>
                <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-white/5">
                  Center: {p.resolvedLatitude}, {p.resolvedLongitude}
                </span>
              </div>

              {/* Map Container */}
              <div ref={mapContainerRef} id="google-map-details-container" className="h-80 rounded-xl overflow-hidden border border-white/5 relative bg-slate-900">
                {!isGoogleLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                    {mapsError ? `⚠ ${mapsError}` : 'Loading Google Maps...'}
                  </div>
                )}
              </div>

              {/* Map Legend */}
              <div className="flex flex-wrap gap-3 text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1 font-semibold text-violet-300">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: AMENITY_COLORS['Target Property'] }} /> Target Property
                </span>
                {['Hospital', 'School', 'Metro Station', 'Shopping Mall', 'Park', 'Bank'].map(cat => (
                  <span key={cat} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AMENITY_COLORS[cat] || '#3b82f6' }} /> {cat}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Real Google Places Panel ── */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Compass className="h-5 w-5 text-violet-400" /> Nearby Places ({places?.length || 0})
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {places_metadata?.data_source || 'Current Google Places API (New)'} · Updated: {places_metadata?.last_updated || 'Live'}
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/5">
                  {filterGroups.map(grp => (
                    <button
                      key={grp}
                      onClick={() => setSelectedGroup(grp)}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition ${selectedGroup === grp ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Places List */}
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {filteredPlaces.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm py-8">
                    No places found in this category within 3 km search radius.
                  </div>
                ) : (
                  filteredPlaces.map((pl, i) => (
                    <div key={pl.place_id || i} className="p-3.5 bg-slate-950/60 border border-white/5 rounded-xl flex items-center justify-between gap-4 hover:border-violet-500/20 transition">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: AMENITY_COLORS[pl.category] || '#3b82f6' }} />
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">{pl.name}</p>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{pl.category} {pl.address ? `· ${pl.address}` : ''}</p>
                          {pl.rating > 0 && (
                            <span className="text-[11px] text-amber-400 font-semibold mt-1 inline-block">
                              ⭐ {pl.rating} ({pl.user_ratings_total || 0} reviews)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-extrabold text-violet-400">{pl.distance_km} km</p>
                        {pl.google_maps_uri && (
                          <a href={pl.google_maps_uri} target="_blank" rel="noreferrer"
                            className="text-[10px] text-slate-400 hover:text-violet-300 flex items-center gap-1 justify-end mt-1">
                            Google Maps <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* ── Sidebar Right Column ── */}
          <div className="space-y-6">

            {/* Location & Investment Intelligence Scores */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" /> Location & Investment Intelligence
              </h2>

              <ScoreBar label="Location Score (Real Places)" value={p.location_score || 75} color="from-violet-500 to-indigo-400" />
              <ScoreBar label="Investment Intelligence" value={p.investment_score} color="from-emerald-500 to-teal-400" />
              <ScoreBar label="Risk Rating" value={p.risk_score} color="from-red-500 to-orange-400" />

              {/* Location Score Breakdown */}
              {p.location_score_breakdown && (
                <div className="pt-2 space-y-2 border-t border-white/10">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Location Score Breakdown</p>
                  {[
                    { label: 'Healthcare Accessibility', val: p.location_score_breakdown.healthcare_score, max: 20 },
                    { label: 'Education Access', val: p.location_score_breakdown.education_score, max: 20 },
                    { label: 'Public Transit Proximity', val: p.location_score_breakdown.transport_score, max: 25 },
                    { label: 'Shopping & Essentials', val: p.location_score_breakdown.shopping_score, max: 20 },
                    { label: 'Recreation & Parks', val: p.location_score_breakdown.recreation_score, max: 15 },
                  ].map(({ label, val, max }) => (
                    <div key={label} className="text-xs flex justify-between items-center py-1">
                      <span className="text-slate-400">{label}</span>
                      <span className="font-bold text-violet-300">{val}/{max} pts</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-xs text-slate-400">Rental Yield</p>
                  <p className="text-lg font-bold text-emerald-400">{rental_yield}%</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                  <p className="text-xs text-slate-400">Monthly Rent</p>
                  <p className="text-lg font-bold text-blue-400">₹{parseInt(rentalIncome).toLocaleString()}</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm text-slate-400">{label}</span>
        <span className="text-sm font-bold text-white">{value}/100</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

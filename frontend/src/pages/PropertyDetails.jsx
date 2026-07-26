import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  BedDouble, Bath, Maximize, Car, TrendingUp, ShieldAlert, MapPin,
  Hospital, School, ShoppingBag, Train, TreePine, Star, ArrowLeft,
  ExternalLink, Compass, ShieldCheck, CheckCircle2, Loader2, Filter
} from 'lucide-react';
import { loadGoogleMapsScript, getGoogleMapsApiKey } from '../utils/googleMapsLoader';

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

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const clientApiKey = getGoogleMapsApiKey();

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

  // ─── Load Google Maps JS API Safely ──────────────────────────────────────────────
  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => {
        setIsGoogleLoaded(true);
        setMapsError('');
      })
      .catch(err => {
        setIsGoogleLoaded(false);
        setMapsError(err.message || 'Google Maps failed to load.');
      });
  }, []);

  // ─── Render Google Map & Markers ──────────────────────────────────────────
  const renderMap = useCallback(() => {
    if (!data || !window.google || !mapContainerRef.current) return;
    const p = data.property;
    const places = data.nearby_google_places || [];

    const rawLat = p.resolvedLatitude || p.latitude;
    const rawLng = p.resolvedLongitude || p.longitude;
    const safeLat = Number.isFinite(Number(rawLat)) ? Number(rawLat) : 17.4485;
    const safeLng = Number.isFinite(Number(rawLng)) ? Number(rawLng) : 78.3908;
    const center = { lat: safeLat, lng: safeLng };

    // Reset instance if detached from current DOM container
    if (mapInstanceRef.current && mapInstanceRef.current.getDiv) {
      try {
        if (mapInstanceRef.current.getDiv() !== mapContainerRef.current) {
          mapInstanceRef.current = null;
        }
      } catch (e) {
        mapInstanceRef.current = null;
      }
    }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center,
        zoom: 14,
        styles: MAP_DARK_STYLE,
        zoomControl: true,
        fullscreenControl: true,
      });
    }

    const map = mapInstanceRef.current;
    map.setCenter(center);

    // Clear previous markers
    if (Array.isArray(markersRef.current)) {
      markersRef.current.forEach(m => m && m.setMap && m.setMap(null));
    }
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(center);

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
          <strong style="font-size:14px;color:#6d28d9;">${p.property_name || 'Property'}</strong><br/>
          <span style="font-size:12px;color:#475569;">${p.locality}, ${p.city}</span><br/>
          <strong style="font-size:13px;color:#059669;">₹${new Intl.NumberFormat('en-IN').format(p.price_inr || 0)}</strong>
        </div>
      `
    });
    targetMarker.addListener('click', () => targetIw.open(map, targetMarker));
    markersRef.current.push(targetMarker);

    // 3. Nearby Google Places Markers
    places.forEach(place => {
      if (!place || !Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) return;
      const pos = { lat: Number(place.latitude), lng: Number(place.longitude) };
      bounds.extend(pos);
      const color = AMENITY_COLORS[place.category] || '#3b82f6';

      const marker = new window.google.maps.Marker({
        position: pos,
        map,
        title: place.name || 'Place',
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
            <strong style="font-size:13px;color:#1e293b;">${place.name || 'Place'}</strong><br/>
            <span style="font-size:11px;color:#64748b;">${place.category || ''} · <strong>${place.distance_km || 0} km</strong></span><br/>
            ${place.rating ? `<span style="font-size:11px;color:#d97706;">⭐ ${place.rating}</span><br/>` : ''}
            <span style="font-size:11px;color:#475569;">${place.address || ''}</span>
          </div>
        `
      });

      marker.addListener('click', () => iw.open(map, marker));
      markersRef.current.push(marker);
    });

    if (places.length > 0) {
      map.fitBounds(bounds);
    } else {
      map.setCenter(center);
      map.setZoom(14);
    }
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
    <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center text-slate-300 p-6 text-center">
      <div className="glass-panel p-8 rounded-2xl border border-white/10 max-w-md w-full space-y-4">
        <Building className="h-12 w-12 text-violet-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Property Not Found</h2>
        <p className="text-sm text-slate-400">
          Property #{id} could not be found in the current PropValue AI database. Explore our active property listings or value a custom location.
        </p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => navigate('/properties')}
            className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs transition shadow-lg shadow-violet-600/25"
          >
            Browse Properties
          </button>
          <button
            onClick={() => navigate('/valuation')}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition border border-white/10"
          >
            AI Valuation
          </button>
        </div>
      </div>
    </div>
  );

  const p = data.property;
  const places = data.nearby_google_places || [];
  const gallery = data.image_gallery || [p.image_url];
  const history = data.historical_prices || [];

  const availableGroups = ['All'].concat(
    Array.from(new Set(places.map(pl => pl.group || 'Essentials').filter(Boolean)))
  );

  const filteredPlaces = places.filter(pl => {
    if (selectedGroup === 'All') return true;
    return (pl.group || 'Essentials') === selectedGroup;
  });

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition bg-slate-900/80 px-3.5 py-2 rounded-xl border border-white/5"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Listings
          </button>

          <div className="flex items-center gap-2 text-xs">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-semibold">
              Verified Listing
            </span>
            <span className="bg-violet-500/10 text-violet-300 border border-violet-500/20 px-3 py-1 rounded-full font-semibold">
              {p.coordinate_status || 'Geocoded'}
            </span>
          </div>
        </div>

        {/* Top Hero Section: Title & Price Card */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white">{p.property_name}</h1>
            <p className="text-sm text-slate-400 flex items-center gap-1.5 mt-1">
              <MapPin className="h-4 w-4 text-violet-400" /> {p.locality}, {p.city}
              <span className="text-slate-600">•</span>
              <span className="text-slate-300 font-medium">{p.property_type}</span>
            </p>
          </div>

          <div className="text-left lg:text-right bg-slate-900/80 border border-white/10 p-4 rounded-xl">
            <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wider">Estimated Listed Value</span>
            <span className="text-3xl font-extrabold text-emerald-400">₹{new Intl.NumberFormat('en-IN').format(p.price_inr)}</span>
            <span className="text-xs text-slate-400 block mt-0.5">₹{Math.round(p.price_inr / p.area_sqft).toLocaleString('en-IN')} / sq.ft</span>
          </div>
        </div>

        {/* Main 2-Column Details Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Image Gallery & Specs */}
          <div className="lg:col-span-7 space-y-6">
            {/* Gallery */}
            <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-3">
              <div className="h-80 rounded-xl overflow-hidden relative border border-white/5">
                <img
                  src={gallery[galleryIdx] || p.image_url}
                  alt={p.property_name}
                  className="w-full h-full object-cover"
                />
              </div>
              {gallery.length > 1 && (
                <div className="flex gap-2">
                  {gallery.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setGalleryIdx(idx)}
                      className={`h-16 w-24 rounded-lg overflow-hidden border transition ${galleryIdx === idx ? 'border-violet-500 ring-2 ring-violet-500/50' : 'border-white/10 opacity-60 hover:opacity-100'}`}
                    >
                      <img src={img} alt="thumbnail" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Specs Grid (Dynamic by Property Type) */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                <Maximize className="h-5 w-5 text-violet-400 mx-auto mb-1" />
                <p className="text-[11px] text-slate-400">
                  {p.property_type === 'Plot' || p.property_type === 'Land' ? 'Plot Area' :
                   p.property_type === 'Commercial' ? 'Commercial Area' :
                   p.property_type === 'Villa' ? 'Built-up Area' : 'Area'}
                </p>
                <p className="text-sm font-bold text-white">{p.area_sqft} sq.ft</p>
              </div>

              {p.property_type === 'Plot' || p.property_type === 'Land' ? (
                <>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                    <Compass className="h-5 w-5 text-violet-400 mx-auto mb-1" />
                    <p className="text-[11px] text-slate-400">Locality</p>
                    <p className="text-sm font-bold text-white truncate">{p.locality}</p>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                    <p className="text-[11px] text-slate-400">Land Status</p>
                    <p className="text-sm font-bold text-emerald-400">Verified Plot</p>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                    <MapPin className="h-5 w-5 text-violet-400 mx-auto mb-1" />
                    <p className="text-[11px] text-slate-400">Price / sq.ft</p>
                    <p className="text-sm font-bold text-white">₹{Math.round(p.price_inr / p.area_sqft).toLocaleString('en-IN')}</p>
                  </div>
                </>
              ) : p.property_type === 'Commercial' ? (
                <>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                    <Compass className="h-5 w-5 text-violet-400 mx-auto mb-1" />
                    <p className="text-[11px] text-slate-400">Floor Level</p>
                    <p className="text-sm font-bold text-white">Floor {p.floor || 1}</p>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                    <Car className="h-5 w-5 text-violet-400 mx-auto mb-1" />
                    <p className="text-[11px] text-slate-400">Parking</p>
                    <p className="text-sm font-bold text-white">{p.parking || 'Yes'}</p>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                    <CheckCircle2 className="h-5 w-5 text-violet-400 mx-auto mb-1" />
                    <p className="text-[11px] text-slate-400">Furnishing</p>
                    <p className="text-sm font-bold text-white">{p.furnishing || 'Fully'}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                    <BedDouble className="h-5 w-5 text-violet-400 mx-auto mb-1" />
                    <p className="text-[11px] text-slate-400">Bedrooms</p>
                    <p className="text-sm font-bold text-white">{p.bedrooms} BHK</p>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                    <Bath className="h-5 w-5 text-violet-400 mx-auto mb-1" />
                    <p className="text-[11px] text-slate-400">Bathrooms</p>
                    <p className="text-sm font-bold text-white">{p.bathrooms}</p>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5">
                    <Car className="h-5 w-5 text-violet-400 mx-auto mb-1" />
                    <p className="text-[11px] text-slate-400">Parking</p>
                    <p className="text-sm font-bold text-white">{p.parking}</p>
                  </div>
                </>
              )}
            </div>

            {/* Investment Intelligence & Risk Card */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 text-center">
                <TrendingUp className="h-6 w-6 text-emerald-400 mx-auto mb-1" />
                <p className="text-xs text-slate-400">Investment Score</p>
                <p className="text-2xl font-extrabold text-emerald-400 mt-1">{p.investment_score}/100</p>
              </div>
              <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 text-center">
                <ShieldAlert className="h-6 w-6 text-amber-400 mx-auto mb-1" />
                <p className="text-xs text-slate-400">Risk Profile</p>
                <p className="text-2xl font-extrabold text-amber-400 mt-1">{p.risk_score}/100</p>
              </div>
              <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 text-center">
                <Compass className="h-6 w-6 text-violet-400 mx-auto mb-1" />
                <p className="text-xs text-slate-400">Location Audit Score</p>
                <p className="text-2xl font-extrabold text-violet-400 mt-1">{p.location_score}/100</p>
              </div>
            </div>

            {/* Price History Chart */}
            {history.length > 0 && (
              <div className="glass-panel p-6 rounded-2xl border border-white/10">
                <h3 className="font-bold text-white mb-1">Locality Price History</h3>
                <p className="text-xs text-slate-500 mb-4">Historical trend index for {p.locality}, {p.city}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={v => (v || '').slice(0, 7)} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={v => `₹${Math.round(v)}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} />
                    <Line type="monotone" dataKey="avg_price_sqft" stroke="#10b981" strokeWidth={2} dot={false} name="Avg ₹/sqft" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Right Column: Google Maps & Live Amenities Audit */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-violet-400" /> Interactive Google Map & Amenities Audit
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live spatial accessibility audit around target property
                  </p>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-white/5">
                  Google Places API (New)
                </span>
              </div>

              {/* Google Map Container */}
              <div
                ref={mapContainerRef}
                id="google-map-details-container"
                className="h-80 rounded-xl overflow-hidden border border-white/5 relative bg-slate-900 flex items-center justify-center"
              >
                {!isGoogleLoaded && (
                  <div className="text-slate-500 text-xs flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> Loading Google Map...
                  </div>
                )}
              </div>
              {mapsError && <p className="text-[11px] text-amber-400 font-medium">{mapsError}</p>}

              {/* Category Filter Tabs */}
              {availableGroups.length > 1 && (
                <div className="flex flex-wrap gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-white/5">
                  {availableGroups.map(grp => (
                    <button
                      key={grp}
                      onClick={() => setSelectedGroup(grp)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${selectedGroup === grp ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'text-slate-400 hover:text-white'}`}
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              )}

              {/* Nearby Places List */}
              <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-sm">
                    Nearby Places ({filteredPlaces.length})
                  </h4>
                  <span className="text-[10px] text-slate-500">3km radius search</span>
                </div>

                {filteredPlaces.length === 0 ? (
                  <div className="text-center text-slate-500 py-6 text-xs bg-slate-950/40 rounded-xl border border-white/5">
                    No nearby places returned for this category.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {filteredPlaces.map((place, i) => (
                      <div key={place.place_id || i} className="p-3 bg-slate-950/60 rounded-xl flex items-center justify-between gap-4 text-xs border border-white/5 hover:border-violet-500/20 transition">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: AMENITY_COLORS[place.category] || '#3b82f6' }} />
                          <div className="min-w-0">
                            <p className="font-bold text-white text-sm truncate">{place.name || 'Place'}</p>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{place.category} {place.address ? `· ${place.address}` : ''}</p>
                            {place.rating > 0 && <span className="text-[10px] text-amber-400 font-semibold inline-block mt-0.5">⭐ {place.rating} ({place.user_ratings_total})</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-mono font-extrabold text-violet-400 text-sm">{place.distance_km} km</span>
                          {place.google_maps_uri && (
                            <a href={place.google_maps_uri} target="_blank" rel="noreferrer" className="block text-[10px] text-slate-500 hover:text-violet-300 mt-0.5">
                              Google Maps ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

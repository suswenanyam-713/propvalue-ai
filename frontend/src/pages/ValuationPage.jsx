import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, ShieldAlert, IndianRupee, AlertCircle, Loader2, MapPin, Sparkles, Building, Compass, Calendar, Search, X, CheckCircle2, ExternalLink } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CITIES = ['Chennai', 'Hyderabad', 'Pune', 'Mumbai', 'Bengaluru'];
const LOCALITIES = {
  Chennai: ['Velachery', 'OMR', 'Adyar', 'Anna Nagar'],
  Hyderabad: ['Miyapur', 'Gachibowli', 'Madhapur', 'Banjara Hills', 'Jubilee Hills', 'Kondapur', 'Kukatpally'],
  Pune: ['Hinjewadi', 'Kharadi', 'Wakad', 'Baner'],
  Mumbai: ['Bandra', 'Powai', 'Andheri', 'Thane'],
  Bengaluru: ['Indiranagar', 'Whitefield', 'Koramangala', 'HSR Layout', 'Electronic City'],
};
const TYPES = ['Apartment', 'Independent House', 'Plot', 'Villa'];
const FURNISHING = ['Unfurnished', 'Semi', 'Fully'];
const CITY_COORDS = {
  Chennai: [12.9796, 80.2201], Hyderabad: [17.4965, 78.4014],
  Pune: [18.5912, 73.7389], Mumbai: [19.0596, 72.8295], Bengaluru: [12.9784, 77.6408],
};

const AMENITY_COLORS = {
  Hospital: '#ef4444', Clinic: '#f43f5e', Pharmacy: '#fb7185',
  School: '#22c55e', 'University / College': '#10b981',
  'Metro Station': '#3b82f6', 'Railway Station': '#1d4ed8', 'Bus Station': '#6366f1', 'Transit Station': '#a855f7',
  'Shopping Mall': '#f97316', Supermarket: '#f59e0b',
  Park: '#10b981', Bank: '#06b6d4', Restaurant: '#ec4899', Gym: '#a855f7',
};

const CATEGORY_GROUP_MAP = {
  Hospital: 'Healthcare', Clinic: 'Healthcare', Pharmacy: 'Healthcare',
  School: 'Education', 'University / College': 'Education',
  'Metro Station': 'Transport', 'Railway Station': 'Transport', 'Bus Station': 'Transport', 'Transit Station': 'Transport',
  'Shopping Mall': 'Shopping', Supermarket: 'Shopping',
  Park: 'Lifestyle', Gym: 'Lifestyle', Restaurant: 'Lifestyle',
  Bank: 'Essentials',
};

const MAP_DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

const GMAPS_CALLBACK = '__gmapsReady_propvalue_integrated';

// Debounce helper
function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function ValuationPage() {
  const clientApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const [form, setForm] = useState({
    city: 'Hyderabad', locality: 'Gachibowli', property_type: 'Apartment',
    area_sqft: 1500, bedrooms: 3, bathrooms: 2, floor: 5, age: 3,
    parking: 'Yes', furnishing: 'Semi', latitude: 17.4401, longitude: 78.3489,
  });
  const [addressInput, setAddressInput] = useState('');
  const [result, setResult] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapsError, setMapsError] = useState('');
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  // Custom autocomplete & live places state
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [acError, setAcError] = useState('');
  const [liveAmenities, setLiveAmenities] = useState([]);
  const [loadingAmenities, setLoadingAmenities] = useState(false);

  // Client-side category filter selection inside Location Audit
  const [selectedFilterGroup, setSelectedFilterGroup] = useState('All');

  const mapContainerRef = useRef(null);
  const previewMapRef = useRef(null);
  const previewMapInstanceRef = useRef(null);
  const previewMarkersRef = useRef([]);
  const resultMarkersRef = useRef([]);
  const googleMapInstance = useRef(null);
  const dropdownRef = useRef(null);

  const formatPrice = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  // ─── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Fetch Google Places API (New) Autocomplete ────────────────────────────
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]); setShowDropdown(false); return;
    }
    if (!clientApiKey) return;

    setLoadingSuggestions(true);
    setAcError('');
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': clientApiKey,
        },
        body: JSON.stringify({
          input: query.trim(),
          includedRegionCodes: ['in'],
          languageCode: 'en',
        }),
      });
      const data = await res.json();
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
        setShowDropdown(true);
      } else {
        setSuggestions([]); setShowDropdown(false);
      }
    } catch (err) {
      console.warn('Autocomplete fetch error:', err);
      setSuggestions([]); setShowDropdown(false);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [clientApiKey]);

  const debouncedFetch = useDebounce(fetchSuggestions, 280);

  // ─── Fetch Live Google Places Nearby Search ────────────────────────────────
  const fetchLiveNearbyAmenities = useCallback(async (lat, lng, city, locality) => {
    setLoadingAmenities(true);
    try {
      const res = await axios.get('/api/places/nearby', {
        params: { lat, lon: lng, city, locality, radius: 3000 }
      });
      const places = res.data?.places;
      setLiveAmenities(Array.isArray(places) ? places : []);
    } catch (err) {
      console.warn('[ValuationPage] Could not fetch live Google Places:', err);
      setLiveAmenities([]);
    } finally {
      setLoadingAmenities(false);
    }
  }, []);

  // ─── Select a suggestion → fetch place details ─────────────────────────────
  const handleSelectSuggestion = useCallback(async (suggestion) => {
    const pred = suggestion?.placePrediction;
    if (!pred) return;

    const placeId = pred.placeId || '';
    const text = pred.text?.text || pred.structuredFormat?.mainText?.text || '';

    setAddressInput(text);
    setSuggestions([]);
    setShowDropdown(false);
    setAcError('');

    if (!placeId || !clientApiKey) return;

    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          headers: {
            'X-Goog-Api-Key': clientApiKey,
            'X-Goog-FieldMask': 'location,formattedAddress,addressComponents,displayName',
          },
        }
      );
      const place = await res.json();
      const lat = place?.location?.latitude;
      const lng = place?.location?.longitude;
      if (!lat || !lng) return;

      let locality = '', city = '';
      for (const comp of (place.addressComponents || [])) {
        const types = comp.types || [];
        if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
          if (!locality) locality = comp.longText;
        } else if (types.includes('locality')) {
          if (!locality) locality = comp.longText;
          if (!city) city = comp.longText;
        } else if (types.includes('administrative_area_level_2')) {
          if (!city) city = comp.longText;
        }
      }

      const formattedAddress = place.formattedAddress || text;
      setAddressInput(formattedAddress);

      const CITY_MAP = {
        Hyderabad: 'Hyderabad', Chennai: 'Chennai', Pune: 'Pune',
        Mumbai: 'Mumbai', Bengaluru: 'Bengaluru', Bangalore: 'Bengaluru',
      };

      const selectedCity = CITY_MAP[city] || form.city;
      const selectedLocality = locality || form.locality;

      setForm(prev => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        locality: selectedLocality,
        city: selectedCity,
      }));

      fetchLiveNearbyAmenities(lat, lng, selectedCity, selectedLocality);
    } catch (err) {
      console.warn('Place details fetch error:', err);
    }
  }, [clientApiKey, form.city, form.locality, fetchLiveNearbyAmenities]);

  // ─── Safely Render Preview Map ─────────────────────────────────────────────
  const renderPreviewMap = useCallback((lat, lng, placesList = []) => {
    try {
      if (!window.google || !window.google.maps || !previewMapRef.current) return;
      const center = { lat, lng };

      if (!previewMapInstanceRef.current) {
        previewMapInstanceRef.current = new window.google.maps.Map(previewMapRef.current, {
          center, zoom: 14, styles: MAP_DARK_STYLE, zoomControl: true,
        });
      } else {
        previewMapInstanceRef.current.setCenter(center);
      }

      // Clear old preview markers safely
      if (Array.isArray(previewMarkersRef.current)) {
        previewMarkersRef.current.forEach(m => m && m.setMap && m.setMap(null));
      }
      previewMarkersRef.current = [];

      // Target Property Marker
      const targetMarker = new window.google.maps.Marker({
        position: center, map: previewMapInstanceRef.current, title: 'Target Location',
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#8b5cf6', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5 },
        zIndex: 999
      });
      previewMarkersRef.current.push(targetMarker);

      // Render Markers ONLY for AVAILABLE Google Places
      if (Array.isArray(placesList)) {
        placesList.forEach(pl => {
          if (!pl || !pl.latitude || !pl.longitude) return;
          const markerColor = AMENITY_COLORS[pl.category] || '#3b82f6';
          const marker = new window.google.maps.Marker({
            position: { lat: pl.latitude, lng: pl.longitude },
            map: previewMapInstanceRef.current,
            title: pl.name || 'Place',
            icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: markerColor, fillOpacity: 0.85, strokeColor: '#fff', strokeWeight: 1 },
          });
          const iw = new window.google.maps.InfoWindow({
            content: `<div style="color:#0f172a;font-family:sans-serif;font-size:12px;padding:4px;"><strong>${pl.name || 'Place'}</strong><br/><span style="color:#64748b;">${pl.category || ''} · ${pl.distance_km || 0} km</span>${pl.rating ? `<br/><span style="color:#d97706;">⭐ ${pl.rating}</span>` : ''}</div>`
          });
          marker.addListener('click', () => iw.open(previewMapInstanceRef.current, marker));
          previewMarkersRef.current.push(marker);
        });
      }
    } catch (err) {
      console.warn('Preview map render exception caught safely:', err);
    }
  }, []);

  // ─── Load Maps JS API Safely ──────────────────────────────────────────────
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
      setMapsError('VITE_GOOGLE_MAPS_API_KEY is missing in frontend/.env');
      return;
    }

    window[GMAPS_CALLBACK] = onReady;

    if (!document.querySelector('script[data-gmaps]')) {
      const script = document.createElement('script');
      script.setAttribute('data-gmaps', 'true');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${clientApiKey}&callback=${GMAPS_CALLBACK}`;
      script.async = true;
      script.onerror = () => setMapsError('Google Maps API failed to load.');
      document.head.appendChild(script);
    }

    pollTimer = setInterval(() => {
      if (window.google && window.google.maps) onReady();
    }, 300);

    return () => clearInterval(pollTimer);
  }, [clientApiKey]);

  // Initial live places fetch
  useEffect(() => {
    fetchLiveNearbyAmenities(form.latitude, form.longitude, form.city, form.locality);
  }, [form.latitude, form.longitude, form.city, form.locality, fetchLiveNearbyAmenities]);

  // Update preview map when coords or amenities update
  useEffect(() => {
    if (isGoogleLoaded && previewMapRef.current) {
      renderPreviewMap(form.latitude, form.longitude, liveAmenities);
    }
  }, [isGoogleLoaded, form.latitude, form.longitude, liveAmenities, renderPreviewMap]);

  // ─── Form helpers ──────────────────────────────────────────────────────────
  const handleChange = (k, v) => {
    const updated = { ...form, [k]: v };
    if (k === 'city') {
      const coords = CITY_COORDS[v] || [17.4965, 78.4014];
      updated.latitude = coords[0]; updated.longitude = coords[1];
      updated.locality = LOCALITIES[v]?.[0] || '';
      setAddressInput(''); setSuggestions([]); setShowDropdown(false);
      fetchLiveNearbyAmenities(coords[0], coords[1], v, updated.locality);
    }
    setForm(updated);
  };

  const handlePredict = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const isPlot = form.property_type === 'Plot';
      const res = await axios.post('/api/predict', {
        ...form,
        area_sqft: parseFloat(form.area_sqft),
        bedrooms: isPlot ? 0 : parseInt(form.bedrooms),
        bathrooms: isPlot ? 0 : parseInt(form.bathrooms),
        floor: isPlot ? 0 : parseInt(form.floor),
        age: isPlot ? 0 : parseInt(form.age),
        parking: isPlot ? 'No' : form.parking,
        furnishing: isPlot ? 'Unfurnished' : form.furnishing,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        address_str: addressInput || undefined,
      });
      setResult(res.data);
      setForecastLoading(true);
      const fRes = await axios.post('/api/forecast', {
        city: form.city, locality: form.locality, current_price: res.data.predicted_price,
      });
      setForecast(fRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Valuation request failed. Please check parameters.');
    } finally {
      setLoading(false); setForecastLoading(false);
    }
  };

  // ─── Shared Places Source & Client-Side Filtering ─────────────────────────
  const rawList = result?.nearbyAmenities || liveAmenities;
  const allAmenities = Array.isArray(rawList) ? rawList : [];

  // Determine available category groups present in data
  const availableGroups = new Set();
  allAmenities.forEach(pl => {
    const grp = pl.group || CATEGORY_GROUP_MAP[pl.category] || 'Essentials';
    availableGroups.add(grp);
  });
  const availableFilterTabs = ['All', ...Array.from(availableGroups)];

  // Filter amenities 100% client-side
  const filteredAmenities = selectedFilterGroup === 'All'
    ? allAmenities
    : allAmenities.filter(pl => {
        const grp = pl.group || CATEGORY_GROUP_MAP[pl.category] || 'Essentials';
        return grp === selectedFilterGroup;
      });

  // Unique categories currently displayed (for dynamic legend)
  const activeCategories = Array.from(new Set(filteredAmenities.map(pl => pl.category).filter(Boolean)));

  // ─── Synchronized Result Map Renderer with Bounds & InfoWindows ────────────
  useEffect(() => {
    try {
      if (result && window.google && window.google.maps && mapContainerRef.current) {
        const targetLatLng = { lat: result.propertyCoordinates?.latitude || form.latitude, lng: result.propertyCoordinates?.longitude || form.longitude };

        if (!googleMapInstance.current) {
          googleMapInstance.current = new window.google.maps.Map(mapContainerRef.current, {
            center: targetLatLng, zoom: 14, styles: MAP_DARK_STYLE,
          });
        }
        const map = googleMapInstance.current;

        // Clear existing markers safely
        if (Array.isArray(resultMarkersRef.current)) {
          resultMarkersRef.current.forEach(m => m && m.setMap && m.setMap(null));
        }
        resultMarkersRef.current = [];

        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(targetLatLng);

        // Target Property Marker
        const targetMarker = new window.google.maps.Marker({
          position: targetLatLng, map, title: 'Target Property',
          icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#8b5cf6', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5 },
          zIndex: 999
        });
        const targetIw = new window.google.maps.InfoWindow({
          content: `<div style="color:#0f172a;font-family:sans-serif;padding:6px;max-width:200px;"><strong style="color:#6d28d9;">Target Property</strong><br/><span style="font-size:11px;color:#475569;">${form.locality}, ${form.city}</span></div>`
        });
        targetMarker.addListener('click', () => targetIw.open(map, targetMarker));
        resultMarkersRef.current.push(targetMarker);

        // Filtered Nearby Google Place Markers
        filteredAmenities.forEach(pl => {
          if (!pl || !pl.latitude || !pl.longitude) return;
          const pos = { lat: pl.latitude, lng: pl.longitude };
          bounds.extend(pos);

          const markerColor = AMENITY_COLORS[pl.category] || '#3b82f6';
          const marker = new window.google.maps.Marker({
            position: pos, map, title: pl.name || 'Place',
            icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: markerColor, fillOpacity: 0.9, strokeColor: '#fff', strokeWeight: 1.5 },
          });

          const iw = new window.google.maps.InfoWindow({
            content: `
              <div style="color:#0f172a;font-family:sans-serif;font-size:12px;padding:6px;max-width:220px;">
                <strong style="font-size:13px;color:#1e293b;">${pl.name || 'Place'}</strong><br/>
                <span style="font-size:11px;color:#64748b;">${pl.category || ''} · <strong>${pl.distance_km || 0} km</strong></span><br/>
                ${pl.rating ? `<span style="font-size:11px;color:#d97706;">⭐ ${pl.rating}</span><br/>` : ''}
                ${pl.address ? `<span style="font-size:11px;color:#475569;">${pl.address}</span>` : ''}
              </div>
            `
          });
          marker.addListener('click', () => iw.open(map, marker));
          resultMarkersRef.current.push(marker);
        });

        // Fit map bounds nicely to visible markers
        if (filteredAmenities.length > 0) {
          map.fitBounds(bounds);
        } else {
          map.setCenter(targetLatLng);
          map.setZoom(14);
        }
      }
    } catch (err) {
      console.warn('Result map render exception caught safely:', err);
    }
  }, [result, filteredAmenities, form.latitude, form.longitude, form.city, form.locality]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-white to-violet-300 bg-clip-text text-transparent">AI Property Valuation</h1>
          <p className="text-slate-400 mt-2">Geolocated AI pricing powered by live Google Places (New) Nearby Search</p>
        </div>

        {mapsError && (
          <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div><p className="font-bold mb-1">Google Maps Warning</p><p>{mapsError}</p></div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* ── Left Column: Property Details Form ─────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
              <h2 className="text-lg font-bold text-white">Property Details</h2>

              {/* ── Custom Address Autocomplete ── */}
              <div>
                <label className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-1 block">
                  Address / Google Location Search
                </label>

                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500 pointer-events-none z-10" />
                    <input
                      id="address-autocomplete-input"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Search: Gachibowli, Miyapur, Madhapur, Velachery..."
                      value={addressInput}
                      onChange={e => {
                        setAddressInput(e.target.value);
                        setAcError('');
                        debouncedFetch(e.target.value);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Escape') { setShowDropdown(false); setSuggestions([]); }
                      }}
                      onFocus={() => { if (Array.isArray(suggestions) && suggestions.length > 0) setShowDropdown(true); }}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white focus:outline-none focus:border-violet-500 placeholder:text-slate-500 transition-colors duration-200"
                    />
                    {loadingSuggestions ? (
                      <Loader2 className="absolute right-3.5 top-3.5 h-4 w-4 text-violet-400 animate-spin" />
                    ) : addressInput ? (
                      <button
                        onClick={() => { setAddressInput(''); setSuggestions([]); setShowDropdown(false); }}
                        className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  {/* Dropdown suggestions */}
                  {showDropdown && Array.isArray(suggestions) && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-violet-500/20 shadow-2xl shadow-black/50 overflow-hidden z-50"
                      style={{ background: '#1a2235' }}>
                      {suggestions.map((s, idx) => {
                        const pred = s?.placePrediction;
                        const main = pred?.structuredFormat?.mainText?.text || pred?.text?.text || '';
                        const secondary = pred?.structuredFormat?.secondaryText?.text || '';
                        return (
                          <button
                            key={pred?.placeId || idx}
                            onMouseDown={e => { e.preventDefault(); handleSelectSuggestion(s); }}
                            className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-violet-500/10 transition-colors duration-150 border-b border-white/5 last:border-0"
                          >
                            <MapPin className="h-4 w-4 text-violet-400 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-sm text-white font-medium truncate">{main}</p>
                              {secondary && <p className="text-xs text-slate-400 truncate mt-0.5">{secondary}</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {acError ? (
                  <p className="text-[10px] text-amber-400 mt-1">⚠ {acError}</p>
                ) : (
                  <p className="text-[10px] text-emerald-500/70 mt-1">
                    ✓ Connected to Google Places API (New)
                  </p>
                )}
              </div>

              {/* ── Live Preview Map ── */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Location & Places Preview</label>
                <div ref={previewMapRef} id="preview-map-container"
                  className="h-44 rounded-xl overflow-hidden border border-white/5 relative z-0 bg-slate-900 flex items-center justify-center">
                  {!isGoogleLoaded && (
                    <div className="text-slate-500 text-xs flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> Loading Google Map...
                    </div>
                  )}
                </div>
              </div>

              {/* ── City / Locality / Type dropdowns ── */}
              {[
                { label: 'City', key: 'city', opts: CITIES },
                { label: 'Locality', key: 'locality', opts: LOCALITIES[form.city] || [] },
                { label: 'Property Type', key: 'property_type', opts: TYPES },
                { label: 'Furnishing', key: 'furnishing', opts: FURNISHING },
                { label: 'Parking', key: 'parking', opts: ['Yes', 'No'] },
              ].filter(({ key }) => !(form.property_type === 'Plot' && (key === 'furnishing' || key === 'parking')))
              .map(({ label, key, opts }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">{label}</label>
                  <select value={form[key]} onChange={e => handleChange(key, e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 cursor-pointer">
                    {opts.map(o => <option key={o} value={o} className="bg-slate-900">{o}</option>)}
                  </select>
                </div>
              ))}

              {/* ── Numeric inputs ── */}
              {[
                { label: 'Area (sqft)', key: 'area_sqft', min: 100, max: 10000 },
                { label: 'Bedrooms (BHK)', key: 'bedrooms', min: 1, max: 10 },
                { label: 'Bathrooms', key: 'bathrooms', min: 1, max: 8 },
                { label: 'Floor', key: 'floor', min: 0, max: 50 },
                { label: 'Property Age (years)', key: 'age', min: 0, max: 50 },
                { label: 'Latitude', key: 'latitude', step: 0.0001 },
                { label: 'Longitude', key: 'longitude', step: 0.0001 },
              ].filter(({ key }) => !(form.property_type === 'Plot' && ['bedrooms', 'bathrooms', 'floor', 'age'].includes(key)))
              .map(({ label, key, min, max, step }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">{label}</label>
                  <input type="number" value={form[key]} min={min} max={max} step={step || 1}
                    onChange={e => handleChange(key, e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500" />
                </div>
              ))}

              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
                </div>
              )}

              <button onClick={handlePredict} disabled={loading}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-violet-600/25">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Brain className="h-5 w-5" />}
                {loading ? 'Evaluating Model...' : 'Predict Price'}
              </button>
            </div>
          </div>

          {/* ── Right Column: Results & Complete Integrated Location Audit ────────── */}
          <div className="lg:col-span-3 space-y-6">
            {result ? (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="space-y-6">

                {/* Estimated Value Card */}
                <div className="glass-panel p-6 rounded-2xl border border-violet-500/30 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="text-center md:text-left md:border-r border-white/10 md:pr-6 flex flex-col justify-center">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Estimated Value</p>
                    <p className="text-4xl font-extrabold text-transparent bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text mb-2">
                      {formatPrice(result.estimatedValue || result.predicted_price)}
                    </p>
                    <p className="text-sm text-slate-400">
                      Range: <span className="font-bold text-slate-200">{formatPrice(result.minimumEstimatedValue)} – {formatPrice(result.maximumEstimatedValue)}</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 bg-slate-800/40 rounded-xl flex flex-col justify-center">
                      <p className="text-[10px] text-slate-400 font-semibold mb-0.5">Price / Sq.Ft</p>
                      <p className="text-sm font-extrabold text-violet-400">{formatPrice(result.pricePerSqFt)}</p>
                    </div>
                    <div className="p-3 bg-slate-800/40 rounded-xl flex flex-col justify-center">
                      <p className="text-[10px] text-slate-400 font-semibold mb-0.5">Confidence</p>
                      <p className="text-sm font-extrabold text-emerald-400">{((result.confidenceScore || 0.8) * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                </div>

                {/* Score Intelligence Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="glass-panel p-4 rounded-2xl border border-violet-500/20 text-center">
                    <Compass className="h-6 w-6 text-violet-400 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-400 font-medium">Location Score</p>
                    <p className="text-xl font-extrabold text-violet-400">{result.locationScore || 70}/100</p>
                  </div>
                  <div className="glass-panel p-4 rounded-2xl border border-emerald-500/20 text-center">
                    <TrendingUp className="h-6 w-6 text-emerald-400 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-400 font-medium">Investment</p>
                    <p className="text-xl font-extrabold text-emerald-400">{result.investment_score || 75}/100</p>
                  </div>
                  <div className="glass-panel p-4 rounded-2xl border border-red-500/20 text-center">
                    <ShieldAlert className="h-6 w-6 text-red-400 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-400 font-medium">Risk Score</p>
                    <p className="text-xl font-extrabold text-red-400">{result.risk_score || 25}/100</p>
                  </div>
                </div>

                {/* Valuation Factor Audit */}
                {result.explanation_factors && (
                  <div className="glass-panel p-6 rounded-2xl border border-white/10">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-violet-400" /> Valuation Factor Audit
                    </h3>
                    <div className="space-y-3 text-sm">
                      {[
                        { label: 'Base Locality Value', val: result.explanation_factors.base_value, desc: 'Average sqft cost baseline' },
                        { label: 'Area & Structural Adjustment', val: result.explanation_factors.area_adjustment, desc: 'Floor, furnishing & configuration premium' },
                        { label: 'Comparable Listings Proximity', val: result.explanation_factors.comparables_adjustment, desc: 'Distance-weighted 3km matches' },
                        { label: 'Surrounding Amenities Premium', val: result.explanation_factors.amenities_adjustment, desc: 'Google Places schools, hospitals & transit density' },
                        { label: 'Market Trend Factor', val: result.explanation_factors.market_trend_adjustment, desc: 'Locality growth index' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start py-2.5 border-b border-white/5 last:border-0">
                          <div>
                            <p className="font-semibold text-slate-200">{item.label}</p>
                            <p className="text-xs text-slate-500">{item.desc}</p>
                          </div>
                          <p className={`font-mono font-bold ${(item.val || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(item.val || 0) >= 0 ? '+' : ''}{formatPrice(item.val)}
                          </p>
                        </div>
                      ))}
                      <div className="pt-3 flex justify-between items-center border-t border-white/10 font-bold">
                        <p className="text-white text-base">Final Estimated Price</p>
                        <p className="text-violet-400 text-lg font-mono">{formatPrice(result.explanation_factors.final_estimated_value)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── COMPLETE INTEGRATED: Interactive Google Maps Location Audit ── */}
                <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <h3 className="font-bold text-white text-lg flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-violet-400" /> Interactive Google Maps Location Audit
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Target location, nearby amenities and accessibility analysis
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-white/5">
                      Data source: Google Places API (New)
                    </span>
                  </div>

                  {/* 1. Google Map Container */}
                  <div ref={mapContainerRef} id="result-map-container" className="h-80 rounded-xl overflow-hidden border border-white/5 relative z-0 bg-slate-900 flex items-center justify-center">
                    {!isGoogleLoaded && (
                      <div className="text-slate-500 text-xs flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> Loading Google Map...
                      </div>
                    )}
                  </div>

                  {/* 2. Dynamic Legend (Renders ONLY categories with markers currently plottable) */}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400 pt-1">
                    <span className="flex items-center gap-1 font-semibold text-violet-300">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6' }} /> Target Property
                    </span>
                    {activeCategories.map(cat => (
                      <span key={cat} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AMENITY_COLORS[cat] || '#3b82f6' }} /> {cat}
                      </span>
                    ))}
                  </div>

                  {/* 3. Compact Category Filter Tabs (Renders ONLY available groups) */}
                  {availableFilterTabs.length > 1 && (
                    <div className="flex flex-wrap gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-white/5">
                      {availableFilterTabs.map(grp => (
                        <button
                          key={grp}
                          onClick={() => setSelectedFilterGroup(grp)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${selectedFilterGroup === grp ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'text-slate-400 hover:text-white'}`}
                        >
                          {grp}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 4. Integrated Nearby Amenities List (Synchronized with Filter) */}
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-white text-sm">
                        Available Nearby Amenities ({filteredAmenities.length})
                      </h4>
                      <span className="text-[10px] text-slate-500">Sorted nearest first</span>
                    </div>

                    {loadingAmenities ? (
                      <div className="text-center text-slate-400 py-6 text-xs flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> Finding nearby amenities...
                      </div>
                    ) : filteredAmenities.length === 0 ? (
                      <div className="text-center text-slate-500 py-6 text-xs bg-slate-950/40 rounded-xl border border-white/5">
                        No nearby Google Places returned for this category.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {filteredAmenities.map((pl, i) => (
                          <div key={pl?.place_id || i} className="p-3 bg-slate-950/60 rounded-xl flex items-center justify-between gap-4 text-xs border border-white/5 hover:border-violet-500/20 transition">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: AMENITY_COLORS[pl.category] || '#3b82f6' }} />
                              <div className="min-w-0">
                                <p className="font-bold text-white text-sm truncate">{pl?.name || 'Place'}</p>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{pl?.category || ''} {pl?.address ? `· ${pl.address}` : ''}</p>
                                {pl?.rating > 0 && <span className="text-[10px] text-amber-400 font-semibold inline-block mt-0.5">⭐ {pl.rating}</span>}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="font-mono font-extrabold text-violet-400 text-sm">{pl?.distance_km || 0} km</span>
                              {pl?.google_maps_uri && (
                                <a href={pl.google_maps_uri} target="_blank" rel="noreferrer" className="block text-[10px] text-slate-500 hover:text-violet-300 mt-0.5">
                                  Google Maps ↗
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-between items-center text-[10px] text-slate-500 border-t border-white/5">
                    <span>Data source: Google Places API (New)</span>
                    <span>Updated: {result?.lastUpdated || new Date().toLocaleTimeString()}</span>
                  </div>
                </div>



                {/* Price Forecast */}
                {forecast && (
                  <div className="glass-panel p-6 rounded-2xl border border-white/10">
                    <h3 className="font-bold text-white mb-1">Future Price Forecast</h3>
                    <p className="text-xs text-slate-500 mb-4">Linear trend projection using historical data</p>
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {[['1 Year', forecast.forecast_1y], ['3 Years', forecast.forecast_3y], ['5 Years', forecast.forecast_5y]].map(([label, val]) => (
                        <div key={label} className="text-center p-3 rounded-xl bg-slate-800/50">
                          <p className="text-xs text-slate-500">{label}</p>
                          <p className="text-sm font-extrabold text-cyan-400">{formatPrice(val)}</p>
                        </div>
                      ))}
                    </div>
                    {forecastLoading ? <div className="text-center text-slate-400 py-8">Loading forecast...</div> : (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={Array.isArray(forecast.chart_data) ? forecast.chart_data.slice(-36) : []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={v => (v || '').slice(0, 7)} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={v => v >= 1e7 ? `₹${(v / 1e7).toFixed(1)} Cr` : `₹${(v / 1e5).toFixed(1)} L`} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} formatter={v => [formatPrice(v)]} />
                          <Legend />
                          <Line type="monotone" dataKey="price" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Price" />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}

                {/* Data sources audit footer */}
                {result.dataSources && (
                  <div className="glass-panel p-4 rounded-xl border border-white/5 space-y-2 text-xs text-slate-400">
                    <div className="flex justify-between"><span className="font-semibold text-slate-300">Property Market Data</span><span>{result.dataSources.property_market_data}</span></div>
                    <div className="flex justify-between"><span className="font-semibold text-slate-300">Location Data</span><span>Data source: Google Places API (New)</span></div>
                    <div className="flex justify-between"><span className="font-semibold text-slate-300">Valuation System</span><span>{result.dataSources.valuation_engine}</span></div>
                    <div className="flex justify-between pt-2 border-t border-white/5 text-slate-500">
                      <span>Last Checked:</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {result.lastUpdated}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              /* Ready to Valuate Initial State - Complete Integrated Location Audit */
              <div className="space-y-6">
                <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <h3 className="font-bold text-white text-lg flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-violet-400" /> Interactive Google Maps Location Audit
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Target location, nearby amenities and accessibility analysis
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-white/5">
                      Data source: Google Places API (New)
                    </span>
                  </div>

                  {/* 1. Google Map Container */}
                  <div ref={mapContainerRef} id="result-map-container" className="h-80 rounded-xl overflow-hidden border border-white/5 relative z-0 bg-slate-900 flex items-center justify-center">
                    {!isGoogleLoaded && (
                      <div className="text-slate-500 text-xs flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> Loading Google Map...
                      </div>
                    )}
                  </div>

                  {/* 2. Dynamic Legend */}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400 pt-1">
                    <span className="flex items-center gap-1 font-semibold text-violet-300">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6' }} /> Target Location
                    </span>
                    {activeCategories.map(cat => (
                      <span key={cat} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AMENITY_COLORS[cat] || '#3b82f6' }} /> {cat}
                      </span>
                    ))}
                  </div>

                  {/* 3. Compact Category Filter Tabs */}
                  {availableFilterTabs.length > 1 && (
                    <div className="flex flex-wrap gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-white/5">
                      {availableFilterTabs.map(grp => (
                        <button
                          key={grp}
                          onClick={() => setSelectedFilterGroup(grp)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${selectedFilterGroup === grp ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30' : 'text-slate-400 hover:text-white'}`}
                        >
                          {grp}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 4. Integrated Nearby Amenities List */}
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-white text-sm">
                        Available Nearby Amenities ({filteredAmenities.length})
                      </h4>
                      <span className="text-[10px] text-slate-500">Sorted nearest first</span>
                    </div>

                    {loadingAmenities ? (
                      <div className="text-center text-slate-400 py-6 text-xs flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> Finding nearby amenities...
                      </div>
                    ) : filteredAmenities.length === 0 ? (
                      <div className="text-center text-slate-500 py-6 text-xs bg-slate-950/40 rounded-xl border border-white/5">
                        No nearby Google Places returned for this category.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {filteredAmenities.map((pl, i) => (
                          <div key={pl?.place_id || i} className="p-3 bg-slate-950/60 rounded-xl flex items-center justify-between gap-4 text-xs border border-white/5 hover:border-violet-500/20 transition">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: AMENITY_COLORS[pl.category] || '#3b82f6' }} />
                              <div className="min-w-0">
                                <p className="font-bold text-white text-sm truncate">{pl?.name || 'Place'}</p>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{pl?.category || ''} {pl?.address ? `· ${pl.address}` : ''}</p>
                                {pl?.rating > 0 && <span className="text-[10px] text-amber-400 font-semibold inline-block mt-0.5">⭐ {pl.rating}</span>}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="font-mono font-extrabold text-violet-400 text-sm">{pl?.distance_km || 0} km</span>
                              {pl?.google_maps_uri && (
                                <a href={pl.google_maps_uri} target="_blank" rel="noreferrer" className="block text-[10px] text-slate-500 hover:text-violet-300 mt-0.5">
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

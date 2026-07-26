import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, ShieldAlert, IndianRupee, AlertCircle, Loader2, MapPin, Sparkles, Building, Compass, Calendar, Search, X, CheckCircle2, ExternalLink } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { loadGoogleMapsScript, getGoogleMapsApiKey } from '../utils/googleMapsLoader';

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

// Debounce helper
function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function ValuationPage() {
  const clientApiKey = getGoogleMapsApiKey();

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

  // Autocomplete state
  const [suggestions, setSuggestions] = useState([]);
  const [isSearchingAc, setIsSearchingAc] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [acError, setAcError] = useState('');

  // Live Nearby Google Places state
  const [nearbyAmenities, setNearbyAmenities] = useState([]);
  const [loadingAmenities, setLoadingAmenities] = useState(false);
  const [selectedFilterGroup, setSelectedFilterGroup] = useState('All');

  // Google Maps JS API State & Refs
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [mapsError, setMapsError] = useState('');
  const previewMapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const previewMapInstanceRef = useRef(null);
  const googleMapInstance = useRef(null);
  const previewMarkersRef = useRef([]);
  const resultMarkersRef = useRef([]);

  // Fetch Autocomplete via proxy route
  const fetchAutocomplete = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }
    setIsSearchingAc(true);
    setAcError('');
    try {
      const res = await axios.get('/api/location/search', { params: { input: query } });
      const preds = res.data?.predictions || [];
      setSuggestions(preds);
      setShowDropdown(true);
    } catch (err) {
      console.warn('Autocomplete fetch error:', err);
      setAcError('Could not load suggestions');
    } finally {
      setIsSearchingAc(false);
    }
  }, []);

  const debouncedFetchAc = useDebounce(fetchAutocomplete, 300);

  const handleAddressInputChange = (e) => {
    const val = e.target.value;
    setAddressInput(val);
    debouncedFetchAc(val);
  };

  // Fetch Live Nearby Amenities using centralized endpoint
  const fetchLiveNearbyAmenities = useCallback(async (lat, lon, city, locality) => {
    setLoadingAmenities(true);
    try {
      const res = await axios.get('/api/places/nearby', {
        params: { lat, lon, city, locality, radius: 3000 }
      });
      const places = res.data?.places || [];
      setNearbyAmenities(places);
    } catch (err) {
      console.warn('Nearby amenities fetch exception:', err);
      setNearbyAmenities([]);
    } finally {
      setLoadingAmenities(false);
    }
  }, []);

  // Handle Autocomplete Item Selection
  const handleSelectSuggestion = useCallback(async (placeId, text) => {
    setShowDropdown(false);
    setAcError('');

    if (!placeId) return;

    if (placeId.startsWith('preset_')) {
      const locKey = placeId.replace('preset_', '').trim().toLowerCase();
      const PRESETS = {
        madhapur: { lat: 17.4485, lng: 78.3908, city: 'Hyderabad', locality: 'Madhapur' },
        miyapur: { lat: 17.4965, lng: 78.4014, city: 'Hyderabad', locality: 'Miyapur' },
        gachibowli: { lat: 17.4401, lng: 78.3489, city: 'Hyderabad', locality: 'Gachibowli' },
        velachery: { lat: 12.9796, lng: 80.2201, city: 'Chennai', locality: 'Velachery' },
        bandra: { lat: 19.0596, lng: 72.8295, city: 'Mumbai', locality: 'Bandra' },
        baner: { lat: 18.5590, lng: 73.7868, city: 'Pune', locality: 'Baner' },
      };
      const p = PRESETS[locKey] || { lat: 17.4485, lng: 78.3908, city: 'Hyderabad', locality: 'Madhapur' };
      setAddressInput(text);
      setForm(prev => ({ ...prev, latitude: p.lat, longitude: p.lng, city: p.city, locality: p.locality }));
      fetchLiveNearbyAmenities(p.lat, p.lng, p.city, p.locality);
      return;
    }

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
      
      const safeLat = Number.isFinite(Number(lat)) ? Number(lat) : 17.4485;
      const safeLng = Number.isFinite(Number(lng)) ? Number(lng) : 78.3908;
      const center = { lat: safeLat, lng: safeLng };

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

      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(center);

      // Target Property Marker (Purple)
      const targetMarker = new window.google.maps.Marker({
        position: center, map: previewMapInstanceRef.current, title: 'Target Location',
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#8b5cf6', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5 },
        zIndex: 999
      });
      previewMarkersRef.current.push(targetMarker);

      // Render Markers for Google Places
      if (Array.isArray(placesList)) {
        placesList.forEach(pl => {
          if (!pl || !Number.isFinite(Number(pl.latitude)) || !Number.isFinite(Number(pl.longitude))) return;
          const pos = { lat: Number(pl.latitude), lng: Number(pl.longitude) };
          bounds.extend(pos);
          const markerColor = AMENITY_COLORS[pl.category] || '#3b82f6';
          const marker = new window.google.maps.Marker({
            position: pos,
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

        if (placesList.length > 0) {
          previewMapInstanceRef.current.fitBounds(bounds);
        } else {
          previewMapInstanceRef.current.setCenter(center);
          previewMapInstanceRef.current.setZoom(14);
        }
      }
    } catch (err) {
      console.warn('Preview map render exception caught safely:', err);
    }
  }, []);

  // ─── Load Maps JS API Safely via Centralized Loader ──────────────────────────────
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

  // Initial live places fetch
  useEffect(() => {
    fetchLiveNearbyAmenities(form.latitude, form.longitude, form.city, form.locality);
  }, [form.latitude, form.longitude, form.city, form.locality, fetchLiveNearbyAmenities]);

  // Update preview map when coords or amenities update
  useEffect(() => {
    if (isGoogleLoaded && previewMapRef.current) {
      renderPreviewMap(form.latitude, form.longitude, nearbyAmenities);
    }
  }, [isGoogleLoaded, form.latitude, form.longitude, nearbyAmenities, renderPreviewMap]);

  // Handle City Selection Change
  const handleCityChange = (e) => {
    const newCity = e.target.value;
    const newLocality = LOCALITIES[newCity]?.[0] || '';
    const coords = CITY_COORDS[newCity] || [17.4485, 78.3908];
    setForm(prev => ({
      ...prev, city: newCity, locality: newLocality,
      latitude: coords[0], longitude: coords[1],
    }));
    fetchLiveNearbyAmenities(coords[0], coords[1], newCity, newLocality);
  };

  // Handle Locality Selection Change
  const handleLocalityChange = (e) => {
    const newLocality = e.target.value;
    setForm(prev => ({ ...prev, locality: newLocality }));
    axios.get('/api/location/geocode', { params: { address: `${newLocality}, ${form.city}` } })
      .then(res => {
        if (res.data?.latitude && res.data?.longitude) {
          setForm(prev => ({ ...prev, latitude: res.data.latitude, longitude: res.data.longitude }));
          fetchLiveNearbyAmenities(res.data.latitude, res.data.longitude, form.city, newLocality);
        }
      })
      .catch(() => {
        fetchLiveNearbyAmenities(form.latitude, form.longitude, form.city, newLocality);
      });
  };

  // Submit Valuation Request
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    setForecast(null);

    try {
      const res = await axios.post('/api/predict', form);
      setResult(res.data);

      if (res.data?.nearbyAmenities) {
        setNearbyAmenities(res.data.nearbyAmenities);
      }

      fetchForecast(res.data.estimatedValue || res.data.predicted_price);
    } catch (err) {
      setError(err.response?.data?.detail || 'Valuation service temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const fetchForecast = async (price) => {
    setForecastLoading(true);
    try {
      const res = await axios.post('/api/forecast', {
        city: form.city, locality: form.locality, current_price: price,
      });
      setForecast(res.data);
    } catch (err) {
      console.warn('Forecast error:', err);
    } finally {
      setForecastLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (!price) return '₹0';
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} Lakh`;
    return `₹${Number(price).toLocaleString('en-IN')}`;
  };

  // Categorize amenities into groups
  const activeAmenitiesList = result?.nearbyAmenities?.length > 0 ? result.nearbyAmenities : nearbyAmenities;

  const filteredAmenities = activeAmenitiesList.filter(pl => {
    if (!pl) return false;
    if (selectedFilterGroup === 'All') return true;
    const grp = CATEGORY_GROUP_MAP[pl.category] || pl.group || 'Essentials';
    return grp === selectedFilterGroup;
  });

  const availableFilterTabs = ['All'].concat(
    Array.from(new Set(activeAmenitiesList.map(pl => CATEGORY_GROUP_MAP[pl.category] || pl.group || 'Essentials').filter(Boolean)))
  );

  const activeCategories = Array.from(new Set(filteredAmenities.map(pl => pl.category).filter(Boolean)));

  // ─── Synchronized Result Map Renderer with DOM Detach Check & Bounds ────────────
  const renderResultMap = useCallback(() => {
    try {
      if (!window.google || !window.google.maps || !mapContainerRef.current) return;

      const rawLat = result?.propertyCoordinates?.latitude ?? form.latitude;
      const rawLng = result?.propertyCoordinates?.longitude ?? form.longitude;
      const safeLat = Number.isFinite(Number(rawLat)) ? Number(rawLat) : 17.4485;
      const safeLng = Number.isFinite(Number(rawLng)) ? Number(rawLng) : 78.3908;
      const targetLatLng = { lat: safeLat, lng: safeLng };

      // Handle DOM unmount / remount detach check for conditional result container
      if (googleMapInstance.current && googleMapInstance.current.getDiv) {
        try {
          if (googleMapInstance.current.getDiv() !== mapContainerRef.current) {
            googleMapInstance.current = null;
          }
        } catch (e) {
          googleMapInstance.current = null;
        }
      }

      if (!googleMapInstance.current) {
        googleMapInstance.current = new window.google.maps.Map(mapContainerRef.current, {
          center: targetLatLng, zoom: 14, styles: MAP_DARK_STYLE, zoomControl: true,
        });
      }

      const map = googleMapInstance.current;
      map.setCenter(targetLatLng);

      // Clear existing result markers
      if (Array.isArray(resultMarkersRef.current)) {
        resultMarkersRef.current.forEach(m => m && m.setMap && m.setMap(null));
      }
      resultMarkersRef.current = [];

      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(targetLatLng);

      // Target Property Marker (Purple)
      const targetMarker = new window.google.maps.Marker({
        position: targetLatLng, map, title: 'Target Location',
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#8b5cf6', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5 },
        zIndex: 999
      });
      const targetIw = new window.google.maps.InfoWindow({
        content: `<div style="color:#0f172a;font-family:sans-serif;padding:6px;max-width:200px;"><strong style="color:#6d28d9;">Target Location</strong><br/><span style="font-size:11px;color:#475569;">${form.locality}, ${form.city}</span></div>`
      });
      targetMarker.addListener('click', () => targetIw.open(map, targetMarker));
      resultMarkersRef.current.push(targetMarker);

      // Render Markers for filteredAmenities
      if (Array.isArray(filteredAmenities)) {
        filteredAmenities.forEach(pl => {
          if (!pl || !Number.isFinite(Number(pl.latitude)) || !Number.isFinite(Number(pl.longitude))) return;
          const pos = { lat: Number(pl.latitude), lng: Number(pl.longitude) };
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
      }

      if (filteredAmenities && filteredAmenities.length > 0) {
        map.fitBounds(bounds);
      } else {
        map.setCenter(targetLatLng);
        map.setZoom(14);
      }
    } catch (err) {
      console.warn('Result map render exception caught safely:', err);
    }
  }, [result, filteredAmenities, form.latitude, form.longitude, form.city, form.locality]);

  useEffect(() => {
    if (isGoogleLoaded && mapContainerRef.current) {
      renderResultMap();
    }
  }, [isGoogleLoaded, result, filteredAmenities, renderResultMap]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-white to-violet-300 bg-clip-text text-transparent">AI Property Valuation</h1>
          <p className="text-slate-400 mt-2">Geolocated AI pricing powered by live Google Places (New) Nearby Search</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Input Form & Interactive Preview */}
          <div className="lg:col-span-5 space-y-6">
            <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Compass className="h-5 w-5 text-violet-400" /> Property Specifications
              </h2>

              {/* Address Autocomplete Search Input */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Search Address / Location (Google Autocomplete)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={addressInput}
                    onChange={handleAddressInputChange}
                    placeholder="e.g. Miyapur, Hyderabad or Gachibowli..."
                    className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition pl-9"
                  />
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                  {isSearchingAc && <Loader2 className="h-4 w-4 animate-spin text-violet-400 absolute right-3 top-3" />}
                </div>

                {/* Autocomplete Suggestions Dropdown */}
                {showDropdown && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-white/15 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                    {suggestions.map((item, idx) => (
                      <div
                        key={item.place_id || idx}
                        onClick={() => handleSelectSuggestion(item.place_id, item.description)}
                        className="px-4 py-2.5 hover:bg-violet-600/20 cursor-pointer text-xs text-slate-200 flex items-center gap-2 border-b border-white/5 last:border-none transition"
                      >
                        <MapPin className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                        <span className="truncate">{item.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                {acError && <p className="text-[11px] text-amber-400 mt-1">{acError}</p>}
              </div>

              {/* City & Locality Controls */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">City</label>
                  <select value={form.city} onChange={handleCityChange} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Locality</label>
                  <select value={form.locality} onChange={handleLocalityChange} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                    {(LOCALITIES[form.city] || []).map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Coordinates Indicator */}
              <div className="flex items-center justify-between text-[11px] bg-slate-900/60 p-2.5 rounded-xl border border-white/5 text-slate-400">
                <span className="flex items-center gap-1.5 font-mono">
                  <MapPin className="h-3.5 w-3.5 text-violet-400" />
                  {form.latitude?.toFixed(4)}, {form.longitude?.toFixed(4)}
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Geocoded
                </span>
              </div>

              {/* Interactive Location Preview Map */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5"><Compass className="h-3.5 w-3.5 text-violet-400" /> Location Preview Map</span>
                  {nearbyAmenities.length > 0 && (
                    <span className="text-[10px] text-violet-400 font-semibold">{nearbyAmenities.length} Google Places Loaded</span>
                  )}
                </div>
                <div
                  ref={previewMapRef}
                  id="preview-map-container"
                  className="h-44 rounded-xl overflow-hidden border border-white/10 bg-slate-900 relative z-0 flex items-center justify-center"
                >
                  {!isGoogleLoaded && (
                    <div className="text-slate-500 text-xs flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> Loading Map...
                    </div>
                  )}
                </div>
                {mapsError && <p className="text-[11px] text-amber-400 font-medium">{mapsError}</p>}
              </div>

              {/* Property Details Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Property Type</label>
                  <select value={form.property_type} onChange={e => setForm({ ...form, property_type: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Area (sq.ft)</label>
                  <input type="number" value={form.area_sqft} onChange={e => setForm({ ...form, area_sqft: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Bedrooms (BHK)</label>
                  <input type="number" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Bathrooms</label>
                  <input type="number" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Floor Level</label>
                  <input type="number" value={form.floor} onChange={e => setForm({ ...form, floor: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Property Age (Yrs)</label>
                  <input type="number" value={form.age} onChange={e => setForm({ ...form, age: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Parking</label>
                  <select value={form.parking} onChange={e => setForm({ ...form, parking: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Furnishing</label>
                  <select value={form.furnishing} onChange={e => setForm({ ...form, furnishing: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                    {FURNISHING.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-violet-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Running ML Valuation...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" /> Predict Price
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Prediction Results & Interactive Location Audit */}
          <div className="lg:col-span-7">
            {result ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Main Estimated Valuation Card */}
                <div className="glass-panel p-6 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-slate-900 via-violet-950/20 to-slate-900 shadow-xl relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Estimated Market Value</span>
                      <h2 className="text-3xl font-extrabold text-white mt-1">
                        {formatPrice(result.estimatedValue || result.predicted_price)}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Range: <span className="font-semibold text-slate-200">{formatPrice(result.minimumEstimatedValue)}</span> - <span className="font-semibold text-slate-200">{formatPrice(result.maximumEstimatedValue)}</span>
                      </p>
                    </div>
                    <div className="text-right bg-violet-600/20 border border-violet-500/30 px-3 py-2 rounded-xl">
                      <p className="text-[10px] text-violet-300 font-semibold">Valuation Confidence</p>
                      <p className="text-lg font-extrabold text-white">{((result.confidenceScore || result.confidence_score || 0.85) * 100).toFixed(0)}%</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
                      <p className="text-[10px] text-slate-400">Price / sq.ft</p>
                      <p className="text-xs font-bold text-white mt-0.5">₹{(result.pricePerSqFt || (result.predicted_price / form.area_sqft)).toFixed(0)}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
                      <p className="text-[10px] text-slate-400">Investment Score</p>
                      <p className="text-xs font-bold text-emerald-400 mt-0.5">{result.investment_score || 78}/100</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
                      <p className="text-[10px] text-slate-400">Risk Profile</p>
                      <p className="text-xs font-bold text-amber-400 mt-0.5">{result.risk_score || 35}/100</p>
                    </div>
                  </div>
                </div>

                {/* Interactive Google Maps Location Audit Panel */}
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
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6' }} /> Target Property
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

                  <div className="pt-2 flex justify-between items-center text-[10px] text-slate-500 border-t border-white/5">
                    <span>Data source: Google Places API (New)</span>
                    <span>Updated: {new Date().toLocaleTimeString()}</span>
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

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { loadGoogleMapsScript } from '../utils/googleMapsLoader';

const AMENITY_COLORS = {
  Hospital: '#ef4444', Clinic: '#f43f5e', Pharmacy: '#fb7185',
  School: '#22c55e', 'University / College': '#10b981',
  'Metro Station': '#3b82f6', 'Railway Station': '#1d4ed8', 'Bus Station': '#6366f1', 'Transit Station': '#a855f7',
  'Shopping Mall': '#f97316', Supermarket: '#f59e0b',
  Park: '#10b981', Bank: '#06b6d4', Restaurant: '#ec4899', Gym: '#a855f7',
};

const MAP_DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

export default function GooglePropertyMap({
  latitude,
  longitude,
  places = [],
  height = 'h-80',
  title = 'Target Location',
  subTitle = '',
}) {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Load Maps JS API single instance
  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => {
        setIsLoaded(true);
        setErrorMsg('');
      })
      .catch((err) => {
        setIsLoaded(false);
        setErrorMsg(err.message || 'Google Maps API failed to load.');
      });
  }, []);

  // 2. Render / update map and markers cleanly when coordinates or places change
  useEffect(() => {
    if (!isLoaded || !containerRef.current || !window.google || !window.google.maps) return;

    const numLat = Number(latitude);
    const numLng = Number(longitude);
    const safeLat = Number.isFinite(numLat) ? numLat : 17.4485;
    const safeLng = Number.isFinite(numLng) ? numLng : 78.3908;
    const center = { lat: safeLat, lng: safeLng };

    // Reset instance if detached from current DOM element
    if (mapInstanceRef.current && mapInstanceRef.current.getDiv) {
      try {
        if (mapInstanceRef.current.getDiv() !== containerRef.current) {
          mapInstanceRef.current = null;
        }
      } catch (e) {
        mapInstanceRef.current = null;
      }
    }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(containerRef.current, {
        center,
        zoom: 14,
        styles: MAP_DARK_STYLE,
        zoomControl: true,
        fullscreenControl: true,
      });
    }

    const map = mapInstanceRef.current;
    map.setCenter(center);

    // Clear old markers
    if (Array.isArray(markersRef.current)) {
      markersRef.current.forEach((m) => m && m.setMap && m.setMap(null));
    }
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(center);

    // Target Property Marker (Purple)
    const targetMarker = new window.google.maps.Marker({
      position: center,
      map,
      title: title || 'Target Location',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#8b5cf6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2.5,
      },
      zIndex: 999,
    });

    const targetIw = new window.google.maps.InfoWindow({
      content: `<div style="color:#0f172a;font-family:sans-serif;padding:6px;max-width:200px;"><strong style="color:#6d28d9;">${title}</strong><br/><span style="font-size:11px;color:#475569;">${subTitle || `${safeLat.toFixed(4)}, ${safeLng.toFixed(4)}`}</span></div>`,
    });
    targetMarker.addListener('click', () => targetIw.open(map, targetMarker));
    markersRef.current.push(targetMarker);

    // Render Nearby Places Markers
    if (Array.isArray(places) && places.length > 0) {
      places.forEach((pl) => {
        if (!pl) return;
        const pLat = Number(pl.latitude);
        const pLng = Number(pl.longitude);
        if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) return;

        const pos = { lat: pLat, lng: pLng };
        bounds.extend(pos);

        const markerColor = AMENITY_COLORS[pl.category] || '#3b82f6';
        const marker = new window.google.maps.Marker({
          position: pos,
          map,
          title: pl.name || 'Place',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 5.5,
            fillColor: markerColor,
            fillOpacity: 0.85,
            strokeColor: '#ffffff',
            strokeWeight: 1.2,
          },
        });

        const iw = new window.google.maps.InfoWindow({
          content: `<div style="color:#0f172a;font-family:sans-serif;font-size:12px;padding:6px;max-width:220px;"><strong style="font-size:13px;color:#1e293b;">${pl.name || 'Place'}</strong><br/><span style="font-size:11px;color:#64748b;">${pl.category || ''} · <strong>${pl.distance_km || 0} km</strong></span>${pl.rating ? `<br/><span style="font-size:11px;color:#d97706;">⭐ ${pl.rating}</span>` : ''}</div>`,
        });
        marker.addListener('click', () => iw.open(map, marker));
        markersRef.current.push(marker);
      });

      map.fitBounds(bounds);
    } else {
      map.setCenter(center);
      map.setZoom(14);
    }
  }, [isLoaded, latitude, longitude, places, title, subTitle]);

  if (errorMsg) {
    return (
      <div className={`${height} rounded-xl border border-amber-500/20 bg-slate-900/90 p-4 text-center flex flex-col items-center justify-center`}>
        <MapPin className="h-6 w-6 text-amber-400 mb-2" />
        <p className="text-xs text-amber-300 font-semibold mb-1">Google Maps Initialization Notice</p>
        <p className="text-[11px] text-slate-400 max-w-md">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className={`${height} rounded-xl overflow-hidden border border-white/10 bg-slate-900 relative z-0 flex items-center justify-center`}>
      <div ref={containerRef} className="w-full h-full" />
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-900/90 flex items-center justify-center text-slate-400 text-xs gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> Loading Google Map...
        </div>
      )}
    </div>
  );
}

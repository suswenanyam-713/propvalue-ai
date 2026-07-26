import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  const gmapInstanceRef = useRef(null);
  const leafletInstanceRef = useRef(null);
  const gmarkersRef = useRef([]);
  const lmarkersRef = useRef([]);

  const [useGoogle, setUseGoogle] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadGoogleMapsScript()
      .then(() => {
        if (mounted) {
          if (window.google && window.google.maps && !window.__googleMapsAuthFailed) {
            setUseGoogle(true);
          } else {
            setUseGoogle(false);
          }
          setIsReady(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setUseGoogle(false);
          setIsReady(true);
        }
      });

    const authCheckInterval = setInterval(() => {
      if (window.__googleMapsAuthFailed && useGoogle) {
        setUseGoogle(false);
      }
    }, 500);

    return () => {
      mounted = false;
      clearInterval(authCheckInterval);
    };
  }, [useGoogle]);

  useEffect(() => {
    if (!containerRef.current) return;

    const numLat = Number(latitude);
    const numLng = Number(longitude);
    const safeLat = Number.isFinite(numLat) ? numLat : 17.4485;
    const safeLng = Number.isFinite(numLng) ? numLng : 78.3489;
    const centerCoords = [safeLat, safeLng];

    if (useGoogle && window.google && window.google.maps) {
      // ─── Native Google Maps Rendering ───
      try {
        if (leafletInstanceRef.current) {
          leafletInstanceRef.current.remove();
          leafletInstanceRef.current = null;
        }

        if (!gmapInstanceRef.current) {
          gmapInstanceRef.current = new window.google.maps.Map(containerRef.current, {
            center: { lat: safeLat, lng: safeLng },
            zoom: 14,
            styles: MAP_DARK_STYLE,
            zoomControl: true,
          });
        }

        const map = gmapInstanceRef.current;
        map.setCenter({ lat: safeLat, lng: safeLng });

        gmarkersRef.current.forEach(m => m && m.setMap && m.setMap(null));
        gmarkersRef.current = [];

        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend({ lat: safeLat, lng: safeLng });

        const targetMarker = new window.google.maps.Marker({
          position: { lat: safeLat, lng: safeLng },
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
        gmarkersRef.current.push(targetMarker);

        if (Array.isArray(places) && places.length > 0) {
          places.forEach(pl => {
            if (!pl) return;
            const pLat = Number(pl.latitude);
            const pLng = Number(pl.longitude);
            if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) return;

            bounds.extend({ lat: pLat, lng: pLng });
            const markerColor = AMENITY_COLORS[pl.category] || '#3b82f6';
            const marker = new window.google.maps.Marker({
              position: { lat: pLat, lng: pLng },
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
            gmarkersRef.current.push(marker);
          });
          map.fitBounds(bounds);
        } else {
          map.setZoom(14);
        }
        return;
      } catch (err) {
        console.warn('Google Maps error, falling back to Leaflet:', err);
        setUseGoogle(false);
      }
    }

    // ─── Leaflet OpenStreetMap Fallback Rendering ───
    try {
      if (gmapInstanceRef.current) {
        gmapInstanceRef.current = null;
        if (containerRef.current) containerRef.current.innerHTML = '';
      }

      if (!leafletInstanceRef.current) {
        const lmap = L.map(containerRef.current, { zoomControl: true }).setView(centerCoords, 14);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        }).addTo(lmap);
        leafletInstanceRef.current = lmap;
      } else {
        leafletInstanceRef.current.setView(centerCoords, 14);
      }

      const lmap = leafletInstanceRef.current;
      lmarkersRef.current.forEach(m => m && m.remove());
      lmarkersRef.current = [];

      const targetIcon = L.divIcon({
        className: 'custom-target-marker',
        html: `<div style="background-color:#8b5cf6;width:18px;height:18px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 0 10px rgba(139,92,246,0.8);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const targetM = L.marker(centerCoords, { icon: targetIcon, zIndexOffset: 1000 }).addTo(lmap);
      targetM.bindPopup(`<div style="font-family:sans-serif;color:#0f172a;font-size:12px;padding:2px;"><strong>${title}</strong><br/><span style="color:#64748b;">${subTitle || `${safeLat.toFixed(4)}, ${safeLng.toFixed(4)}`}</span></div>`);
      lmarkersRef.current.push(targetM);

      if (Array.isArray(places) && places.length > 0) {
        const boundsGroup = [centerCoords];
        places.forEach(pl => {
          if (!pl) return;
          const pLat = Number(pl.latitude);
          const pLng = Number(pl.longitude);
          if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) return;

          boundsGroup.push([pLat, pLng]);
          const color = AMENITY_COLORS[pl.category] || '#3b82f6';
          const icon = L.divIcon({
            className: 'custom-place-marker',
            html: `<div style="background-color:${color};width:12px;height:12px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 6px ${color};"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          });

          const m = L.marker([pLat, pLng], { icon }).addTo(lmap);
          m.bindPopup(`<div style="font-family:sans-serif;color:#0f172a;font-size:12px;padding:4px;"><strong style="color:#1e293b;">${pl.name || 'Place'}</strong><br/><span style="color:#64748b;">${pl.category || ''} · <strong>${pl.distance_km || 0} km</strong></span>${pl.rating ? `<br/><span style="color:#d97706;">⭐ ${pl.rating}</span>` : ''}</div>`);
          lmarkersRef.current.push(m);
        });

        if (boundsGroup.length > 1) {
          lmap.fitBounds(boundsGroup, { padding: [30, 30] });
        }
      }
    } catch (err) {
      console.warn('Leaflet render exception:', err);
    }
  }, [useGoogle, latitude, longitude, places, title, subTitle]);

  return (
    <div className={`${height} rounded-xl overflow-hidden border border-white/10 bg-slate-900 relative z-0 flex items-center justify-center`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

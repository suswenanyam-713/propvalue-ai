/**
 * Centralized Single-Instance Google Maps JS API Loader
 * Guarantees Google Maps script is injected only ONCE across the app.
 * Configured for Vite environment variable VITE_GOOGLE_MAPS_API_KEY.
 */

const GMAPS_CALLBACK = '__initGoogleMapsGlobalCallback';
let loadPromise = null;
let mapsErrorState = '';

export function getGoogleMapsApiKey() {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  return key.trim();
}

export function loadGoogleMapsScript() {
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (loadPromise) {
    return loadPromise;
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    mapsErrorState = 'Google Maps API key missing. Configure VITE_GOOGLE_MAPS_API_KEY in Vercel environment variables.';
    return Promise.reject(new Error(mapsErrorState));
  }

  loadPromise = new Promise((resolve, reject) => {
    window[GMAPS_CALLBACK] = () => {
      delete window[GMAPS_CALLBACK];
      mapsErrorState = '';
      resolve(window.google.maps);
    };

    window.gm_authFailure = () => {
      mapsErrorState = 'Google Maps API Key authorization failed. Verify HTTP referrer restrictions in Google Cloud Console.';
      reject(new Error(mapsErrorState));
    };

    const existingScript = document.querySelector('script[data-gmaps-loader="true"]');
    if (existingScript) {
      const pollTimer = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(pollTimer);
          resolve(window.google.maps);
        }
      }, 200);
      return;
    }

    const script = document.createElement('script');
    script.setAttribute('data-gmaps-loader', 'true');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${GMAPS_CALLBACK}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      mapsErrorState = 'Google Maps JavaScript API failed to load.';
      reject(new Error(mapsErrorState));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

export function getMapsErrorState() {
  return mapsErrorState;
}

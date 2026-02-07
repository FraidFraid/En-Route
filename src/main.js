import './style.css';
import { createIcons, icons } from 'lucide';
import { Geolocation } from '@capacitor/geolocation';

// Build: 2026-02-03 - Added Manual City Toggle + Full View Mode + Data Freshness Indicator

// Initialize Lucide icons
const lucide = {
    createIcons: () => {
        createIcons({ icons });
    }
};

// ---------- Global State ----------
let isManualMode = false; // Mode manuel activé ?
let manualCity = null; // Ville sélectionnée manuellement
let isFullViewMode = false; // Mode vue complète ?

// ---------- Theme Management ----------
let isSkyThemeActive = false;
let lastWeatherData = null;

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const theme = savedTheme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);

    // Init Sky Theme
    const savedSkyMode = localStorage.getItem('skyMode');
    isSkyThemeActive = savedSkyMode === 'true';
    updateSkyThemeButton();
}

const THEME_CYCLE = ['dark', 'light', 'mint'];

function toggleTheme() {
    if (isSkyThemeActive) {
        toggleSkyTheme();
    }
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const idx = THEME_CYCLE.indexOf(currentTheme);
    const newTheme = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        const colors = { dark: '#000000', light: '#FFFFFF', mint: '#f6f8fb' };
        metaThemeColor.setAttribute('content', colors[newTheme] || '#000000');
    }
}

function toggleSkyTheme() {
    isSkyThemeActive = !isSkyThemeActive;
    localStorage.setItem('skyMode', isSkyThemeActive);
    updateSkyThemeButton();

    if (isSkyThemeActive) {
        applySkyTheme();
    } else {
        document.body.style.background = ''; // Revert to CSS default
        document.body.style.color = '';
        // Revert to saved manual theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
}

function updateSkyThemeButton() {
    const btn = document.getElementById('sky-theme-toggle');
    if (btn) {
        if (isSkyThemeActive) {
            btn.classList.add('text-primary');
            btn.classList.add('ring-2', 'ring-primary/20');
        } else {
            btn.classList.remove('text-primary', 'ring-2', 'ring-primary/20');
        }
    }
}

function getSkyGradient(code, isDay) {
    // WMO Codes:
    // 0: Clear
    // 1, 2, 3: Cloudy
    // 45, 48: Fog
    // 51-67: Drizzle/Rain
    // 71-77: Snow
    // 80-82: Showers
    // 95-99: Thunderstorm

    if (!isDay) {
        // NIGHT
        return 'linear-gradient(to bottom, #0f172a, #1e293b)'; // Slate 900 -> 800 (Dark Blueish)
    }

    // DAY
    if (code === 0 || code === 1) {
        // Clear / Sunny
        return 'linear-gradient(to bottom, #38bdf8, #bae6fd)'; // Sky 400 -> 200
    }
    if (code === 2 || code === 3) {
        // Cloudy
        return 'linear-gradient(to bottom, #cbd5e1, #e2e8f0)'; // Slate 300 -> 200 (Lighter for better contrast)
    }
    if (code >= 51 || code === 80 || code === 81 || code === 82) {
        // Rain
        return 'linear-gradient(to bottom, #94a3b8, #cbd5e1)'; // Slate 400 -> 300 (Lighter rain)
    }

    // Default Day
    return 'linear-gradient(to bottom, #60a5fa, #bfdbfe)'; // Blue 400 -> 200
}

function applySkyTheme() {
    if (!isSkyThemeActive || !lastWeatherData) return;

    const { weather_code, is_day } = lastWeatherData;
    const gradient = getSkyGradient(weather_code, is_day);

    document.body.style.background = gradient;
    document.body.style.backgroundAttachment = 'fixed'; // Important for scrolling

    // Auto-contrast for text (simple logic)
    // If it's day (light bg), use light mode (dark text). If it's night (dark bg), use dark mode (light text).
    const newTheme = is_day ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);

    // Note: We don't save this auto-theme to localStorage 'theme' key 
    // to preserve user preference when they disable sky mode.
}

function updateThemeIcon(theme) {
    const lightIcon = document.querySelector('.theme-icon-light');
    const darkIcon = document.querySelector('.theme-icon-dark');
    const mintIcon = document.querySelector('.theme-icon-mint');
    if (lightIcon && darkIcon && mintIcon) {
        lightIcon.classList.add('hidden');
        darkIcon.classList.add('hidden');
        mintIcon.classList.add('hidden');
        if (theme === 'dark') {
            darkIcon.classList.remove('hidden');
        } else if (theme === 'mint') {
            mintIcon.classList.remove('hidden');
        } else {
            lightIcon.classList.remove('hidden');
        }
    }
}

// Initialize theme immediately to prevent flash
initTheme();

// Setup theme toggle after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    const skyToggle = document.getElementById('sky-theme-toggle');
    if (skyToggle) {
        skyToggle.addEventListener('click', toggleSkyTheme);
    }
    updateThemeIcon(document.documentElement.getAttribute('data-theme') || 'dark');
    updateSkyThemeButton();
});

(() => {
    'use strict';

    // ---------- Config
    // IMPORTANT: Remplacer par l'IP de votre serveur si vous testez sur mobile
    // Sur le simulateur iOS, localhost pointe vers le téléphone lui-même.
    // Utilisez l'IP de votre machine sur le réseau local (ex: 192.168.1.X)
    // Ou l'IP serveur distant.
    // Par défaut j'utilise l'IP vue dans les logs, mais c'est à vérifier.

    // URL de Production
    // Pour le web, on utilise des chemins relatifs ("/api/...")
    // Pour le mobile (Capacitor), il faut l'URL complète du projet.

    // Détection mode natif (Capacitor) vs web
    const isNative = window.location.protocol === 'file:' || window.location.protocol === 'capacitor:';

    // En mode natif, on a besoin de l'URL complète. En mode web, chemins relatifs.
    const API_BASE_URL = isNative ? "https://en-route-fredaubourg-gmailcoms-projects.vercel.app" : "";

    // Décommentez pour dev local:
    // const API_BASE_URL = "http://localhost:3000";

    const TIMEZONE = 'Europe/Paris';

    const TRAIN_API = `${API_BASE_URL}/api/departures`;

    const CITY_A = { name: 'Rouen', lat: 49.4431, lon: 1.0993 };
    const CITY_B = { name: 'Le Havre', lat: 49.4944, lon: 0.1079 };

    // ---------- Utils
    const OPEN_METEO = (lat, lon) =>
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code` +
        `&timezone=${encodeURIComponent(TIMEZONE)}`;

    // Helper pour créer des icônes Lucide uniformisées
    function createIcon(iconName, className = 'w-4 h-4') {
        return `<i data-lucide="${iconName}" class="${className}"></i>`;
    }

    // Gestion de la surbrillance des villes
    function highlightDetectedCity(cityName) {
        const rouenEl = document.getElementById('city-rouen');
        const lehavreEl = document.getElementById('city-lehavre');

        if (!rouenEl || !lehavreEl) return;

        // Reset toutes les villes
        rouenEl.className = 'city-toggle px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer bg-zinc-800/50 hover:bg-zinc-700/50 border border-transparent';
        lehavreEl.className = 'city-toggle px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer bg-zinc-800/50 hover:bg-zinc-700/50 border border-transparent';

        // Surligner la ville détectée
        if (cityName === 'Rouen' || cityName === 'rouen') {
            rouenEl.className = 'city-toggle px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer city-detected border-2 border-primary';
        } else if (cityName === 'Le Havre' || cityName === 'lehavre') {
            lehavreEl.className = 'city-toggle px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer city-detected border-2 border-primary';
        }
    }

    // Calcul de distance entre deux points GPS (formule haversine)
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Rayon de la Terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Détection intelligente de la ville la plus proche
    function detectNearestCity(lat, lon) {
        const cities = [
            {
                name: "Rouen",
                lat: 49.4431,
                lon: 1.0993,
                trainDirection: "lehavre_to_rouen", // Si je suis à Rouen, je veux aller au Havre ? Non, voir les départs VERS le Havre
                // Attends, la logique originale était :
                // Si suis à Rouen -> Affiche trains pour Le Havre (rouen-lehavre)
                // Si suis au Havre -> Affiche trains pour Rouen (lehavre-rouen)
                weatherKey: "rouen"
            },
            {
                name: "Le Havre",
                lat: 49.4944,
                lon: 0.1079,
                weatherKey: "lehavre"
            }
        ];

        let nearest = cities[0];
        let minDistance = calculateDistance(lat, lon, cities[0].lat, cities[0].lon);

        for (const city of cities) {
            const distance = calculateDistance(lat, lon, city.lat, city.lon);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = city;
            }
        }

        // Si on est à plus de 50km
        if (minDistance > 50) {
            return {
                name: "Loin",
                lat,
                lon,
                weatherKey: "custom"
            };
        }

        return nearest;
    }

    // Toggle manuel de ville
    function setManualCity(cityName) {
        isManualMode = true;
        manualCity = cityName;
        localStorage.setItem('manualMode', 'true');
        localStorage.setItem('manualCity', cityName);

        const city = cityName === 'Rouen' ?
            { name: 'Rouen', lat: 49.4431, lon: 1.0993, weatherKey: 'rouen' } :
            { name: 'Le Havre', lat: 49.4944, lon: 0.1079, weatherKey: 'lehavre' };

        updateDisplayForCity(city);
    }

    // Toggle mode vue complète
    function toggleViewMode() {
        isFullViewMode = !isFullViewMode;
        localStorage.setItem('fullViewMode', isFullViewMode);
        updateViewModeIcon();

        if (isFullViewMode) {
            // Afficher toutes les cartes
            document.querySelectorAll('.weather-city, .train-direction').forEach(el => {
                el.style.display = 'block';
                el.classList.add('fade-in');
            });
        } else {
            // Réappliquer le filtre selon la ville
            if (isManualMode && manualCity) {
                setManualCity(manualCity);
            }
        }
    }

    // Mise à jour de l'icône du mode vue
    function updateViewModeIcon() {
        const singleIcon = document.querySelector('.view-icon-single');
        const fullIcon = document.querySelector('.view-icon-full');
        if (singleIcon && fullIcon) {
            if (isFullViewMode) {
                singleIcon.classList.add('hidden');
                fullIcon.classList.remove('hidden');
            } else {
                singleIcon.classList.remove('hidden');
                fullIcon.classList.add('hidden');
            }
        }
    }

    // Mise à jour de l'affichage pour une ville
    function updateDisplayForCity(city) {
        if (isFullViewMode) return; // Ne rien faire en mode vue complète

        highlightDetectedCity(city.name);
        updateWeatherWithHighlight(city);
        highlightRelevantTrains(city);
    }


    // Afficher uniquement les trains pertinents selon la position
    function highlightRelevantTrains(city) {
        // Logique : Si je suis à Rouen, je m'intéresse aux départs DE Rouen (rouen-lehavre)
        let targetDirection = null;
        let otherDirection = null;

        if (city.name === 'Rouen') {
            targetDirection = 'rouen-lehavre';
            otherDirection = 'lehavre-rouen';
        } else if (city.name === 'Le Havre') {
            targetDirection = 'lehavre-rouen';
            otherDirection = 'rouen-lehavre';
        }

        if (targetDirection) {
            // Afficher la direction pertinente
            const trainCard = document.querySelector(`[data-direction="${targetDirection}"]`);
            if (trainCard) {
                trainCard.style.display = 'block';
                trainCard.classList.add('fade-in');
            }

            // Cacher l'autre direction
            const otherCard = document.querySelector(`[data-direction="${otherDirection}"]`);
            if (otherCard) {
                otherCard.style.display = 'none';
            }
        }
    }

    // Afficher uniquement la météo de la ville détectée
    function updateWeatherWithHighlight(city) {
        // Afficher la météo de la ville détectée
        if (city.weatherKey && city.weatherKey !== 'custom') {
            highlightDetectedCity(city.name);

            const cityCard = document.querySelector(`[data-city="${city.weatherKey}"]`);
            if (cityCard) {
                cityCard.style.display = 'block';
                cityCard.classList.add('fade-in');
            }

            // Cacher l'autre ville
            const otherCity = city.weatherKey === 'rouen' ? 'lehavre' : 'rouen';
            const otherCard = document.querySelector(`[data-city="${otherCity}"]`);
            if (otherCard) {
                otherCard.style.display = 'none';
            }
        }
    }

    // ========================================
    // GÉOLOCALISATION (CAPACITOR & WEB)
    // ========================================
    async function handleGeolocation() {
        console.log('🌍 Recherche de position...');
        try {
            // Utilise l'API Capacitor qui fonctionne sans HTTPS sur mobile (car code natif)
            const coordinates = await Geolocation.getCurrentPosition({
                enableHighAccuracy: false,
                timeout: 15000,
                maximumAge: 60000
            });

            const { latitude, longitude } = coordinates.coords;
            console.log('📍 Position trouvée:', latitude, longitude);

            const detectedCity = detectNearestCity(latitude, longitude);
            console.log('🏙 Ville la plus proche:', detectedCity.name);

            updateWeatherWithHighlight(detectedCity);
            highlightRelevantTrains(detectedCity);

        } catch (err) {
            console.error('Erreur géolocalisation:', err);
        }
    }


    // ========================================
    // SYSTÈME DE NOTIFICATIONS POUR RETARDS
    // ========================================

    // Note: Sur iOS natif (Capacitor), les notifications Web fonctionnent un peu différemment.
    // Pour une vraie notification push, il faudrait @capacitor/push-notifications ou @capacitor/local-notifications.
    // Ici on garde la logique Web Notification API qui peut marcher si l'app est en premier plan ou PWA.
    // Pour l'instant, on laisse tel quel pour ne pas trop complexifier.

    let notificationPermission = ('Notification' in window && Notification.permission === 'granted');
    let lastNotifiedDelays = new Set();
    let delayCheckInterval = null;

    async function requestNotificationPermission() {
        if ('Notification' in window) {
            try {
                const permission = await Notification.requestPermission();
                notificationPermission = (permission === 'granted');
                return notificationPermission;
            } catch (error) {
                notificationPermission = true; // Fallback visuel
                return true;
            }
        }
        notificationPermission = true;
        return true;
    }

    function calculateNewTime(originalTime, delayMinutes) {
        if (!originalTime || !delayMinutes) return originalTime;
        const [hours, minutes] = originalTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + delayMinutes;
        const newHours = Math.floor(totalMinutes / 60) % 24;
        const newMinutes = totalMinutes % 60;
        return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    }

    function createDelayNotification(trainInfo, delayMinutes) {
        if (!trainInfo) return;
        const notificationId = `${trainInfo.numero}_${delayMinutes}`;
        if (lastNotifiedDelays.has(notificationId)) return;
        lastNotifiedDelays.add(notificationId);

        const title = `🚂 ${trainInfo.numero} - Retard +${delayMinutes} min`;
        let body = `Vers ${trainInfo.destination}\nDépart: ${trainInfo.heureDepart} → ${calculateNewTime(trainInfo.heureDepart, delayMinutes)}`;
        if (trainInfo.disruption) {
            body += `\n${trainInfo.disruption}`;
        }

        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, { body, icon: '/favicon-32x32.png', tag: notificationId });
                return;
            } catch (e) { }
        }
        showVisualAlert(title, body);
    }

    function showVisualAlert(title, message) {
        let alertContainer = document.getElementById('visual-alerts');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'visual-alerts';
            alertContainer.style.cssText = `
        position: fixed;
        bottom: calc(env(safe-area-inset-bottom) + 20px); /* En bas ! */
        left: 16px;
        right: 16px;
        z-index: 10000;
        display: flex;
        flex-direction: column-reverse; /* Les nouvelles s'empilent par le bas */
        gap: 8px;
        pointer-events: none;
      `;
            document.body.appendChild(alertContainer);
        }

        // Créer l'alerte
        const alert = document.createElement('div');
        alert.style.cssText = `
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      padding: 16px;
      border-radius: 16px;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255,255,255,0.1);
      animation: slideIn 0.3s ease-out;
      position: relative;
      pointer-events: auto;
    `; alert.innerHTML = `<div style="font-weight: bold; margin-bottom: 8px;">${title}</div><div style="font-size: 0.9em;">${message}</div><button onclick="this.parentElement.remove()" style="position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; display:flex; align-items:center; justify-content:center;">×</button>`;

        // Add animation style if needed
        alertContainer.appendChild(alert);

        // Auto-suppression après 30 secondes pour ne pas polluer l'écran
        setTimeout(() => {
            if (alert.parentElement) {
                alert.style.animation = 'slideOut 0.5s ease-in forwards'; // Animation de sortie si définie, sinon juste remove
                setTimeout(() => alert.remove(), 500);
            }
        }, 30000);
    }

    function checkForDelays(trainData) {
        if (!trainData || !Array.isArray(trainData)) return;
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        trainData.forEach(train => {
            try {
                // Adaptation: train.scheduled (HH:MM) vs train.expected
                // Le format reçu de l'API est déjà processé ?
                // L'objet 'row' dans renderTrainBoard a : scheduled, expected, delay (int)
                // Mais ici checkForDelays attendait l'ancien format 'heureDepart'

                // On va adapter la fonction pour les objets de l'API /api/departures
                // row = { number, status, delay (min), scheduled (HH:MM), expected (HH:MM) ... }

                if (train.delay && train.delay >= 3) {
                    createDelayNotification({
                        numero: train.number,
                        destination: train.to,
                        heureDepart: train.scheduled,
                        disruption: train.disruption || ''
                    }, train.delay);
                }

            } catch (error) {
                console.log('Erreur analyse retard:', error);
            }
        });
    }

    async function startDelayMonitoring() {
        await requestNotificationPermission();
        console.log('✅ Surveillance des retards activée');
    }


    function weatherMeta(code) {
        const m = {
            0: ['Ciel clair', 'sun'], 1: ['Plutôt clair', 'cloud-sun'], 2: ['Partiellement nuageux', 'cloud-sun'], 3: ['Couvert', 'cloud'],
            45: ['Brouillard', 'cloud-fog'], 48: ['Brouillard givrant', 'cloud-fog'], 51: ['Bruine', 'cloud-drizzle'],
            61: ['Pluie faible', 'cloud-rain'], 63: ['Pluie', 'cloud-rain'], 65: ['Pluie forte', 'cloud-rain'],
            80: ['Averses', 'cloud-rain'], 95: ['Orage', 'cloud-lightning']
        };
        return m[code] || ['—', 'cloud-off'];
    }

    function fmtTimeHHMM(x) {
        if (typeof x === 'string' && x.length === 5 && x[2] === ':' && !isNaN(+x.slice(0, 2)) && !isNaN(+x.slice(3, 5))) return x;
        const d = new Date(x); if (isNaN(d)) return '--:--';
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    function cleanDestination(destination) {
        if (!destination) return '—';
        const match = destination.match(/^(.+?)\s*\((.+?)\)$/);
        if (match) {
            const [, main, parenthetical] = match;
            if (main.toLowerCase().includes(parenthetical.toLowerCase())) return main.trim();
        }
        return destination;
    }

    function tickNow() {
        const el = document.getElementById('now'); if (!el) return;
        el.lastElementChild.textContent = new Date().toLocaleString('fr-FR', { timeZone: TIMEZONE });
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const colors = { info: 'var(--primary)', success: 'var(--ok)', warning: 'var(--warn)', error: 'var(--err)' };
        notification.style.cssText = `
      position: fixed; 
      bottom: calc(env(safe-area-inset-bottom) + 20px); 
      right: 16px; 
      left: 16px; 
      z-index: 1000;
      background: var(--glass); border: 1px solid ${colors[type]};
      border-radius: var(--radius); padding: 1rem;
      color: var(--ink-1); font-size: 0.95rem; font-weight: 500;
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 10px 30px -5px rgba(0,0,0,0.5);
      animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
        notification.innerHTML = message;
        document.body.appendChild(notification);
        lucide.createIcons();
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }



    // Skeleton HTML pour la météo
    function getSkeletonWeather() {
        return `
<div class="skeleton-weather">
    <div class="flex items-center gap-3">
        <div class="skeleton skeleton-circle" style="width: 3rem; height: 3rem;"></div>
        <div>
            <div class="skeleton skeleton-temp"></div>
            <div class="skeleton skeleton-cond mt-1"></div>
        </div>
    </div>
    <div class="mt-2 grid grid-cols-3 gap-1">
        <div class="skeleton" style="height: 2.5rem;"></div>
        <div class="skeleton" style="height: 2.5rem;"></div>
        <div class="skeleton" style="height: 2.5rem;"></div>
    </div>
</div>`;
    }

    // ---------- Weather cards
    async function renderWeather(el, city) {
        // Afficher le skeleton pendant le chargement initial
        el.innerHTML = `
<div class="flex items-center justify-between mb-2">
<div class="flex items-center gap-2">
  <div class="flex items-center gap-1 text-xs text-zinc-300"><i data-lucide="map-pin" class="w-3 h-3"></i><span>${city.name}</span></div>
</div>
<button class="btn text-xs px-2 py-1" data-action="refresh">${createIcon('refresh-cw', 'w-3 h-3')}</button>
</div>
<div class="weather-content">${getSkeletonWeather()}</div>
<div class="mt-1 text-[10px] text-red-400 hidden err"></div>`;
        lucide.createIcons();

        async function load(isRefresh = false) {
            const err = el.querySelector('.err'); err.classList.add('hidden'); err.textContent = '';
            const refreshBtn = el.querySelector('[data-action="refresh"]');
            const weatherContent = el.querySelector('.weather-content');

            if (isRefresh && refreshBtn) {
                refreshBtn.innerHTML = createIcon('loader-2', 'w-3 h-3 animate-spin');
                refreshBtn.disabled = true;
                lucide.createIcons();
            }
            try {
                // Appel API météo
                const url = new URL(`${API_BASE_URL}/api/weather`, window.location.origin);
                // Paramètres: 'lat' et 'lon' (ou 'city')
                url.searchParams.append('lat', city.lat);
                url.searchParams.append('lon', city.lon);
                url.searchParams.append('city', city.weatherKey || ''); // 'rouen' ou 'lehavre'
                url.searchParams.append('t', Date.now()); // Anti-cache

                const r = await fetch(url.toString());
                if (!r.ok) throw new Error('HTTP ' + r.status);
                const j = await r.json();
                console.log("Météo reçue pour", city.name, j);

                const cur = j.current_weather;
                if (!cur) throw new Error('no-current');

                // Store last weather data for dynamic theme
                // Priority: Use detecting/nearest city data if available, or just update with whatever comes
                // Logic refinement: We want general ambience. Let's just update with every fetch, 
                // but maybe prioritize the "detected" city in a real app.
                // For now, simple: last fetched wins.
                lastWeatherData = cur;
                if (isSkyThemeActive) applySkyTheme();

                const [label, icon] = weatherMeta(cur.weather_code);

                // Remplacer le skeleton par le contenu réel
                weatherContent.innerHTML = `
<div class="flex items-center gap-3">
<div class="p-2"><span data-role="wx-icon"><i data-lucide="${icon}" class="w-8 h-8"></i></span></div>
<div>
<div class="text-2xl font-semibold"><span class="temp">${Math.round(cur.temperature_2m)}</span><span class="text-sm ml-1">°C</span></div>
<div class="text-xs text-zinc-400 cond">${label}</div>
</div>
</div>
<div class="mt-2 grid grid-cols-3 gap-1 text-xs text-zinc-300">
<div class="rounded-lg border border-zinc-800 p-1.5 transition-all"><div class="text-zinc-400 text-[10px]">Ressenti</div><div class="text-xs feel">${Math.round(cur.apparent_temperature)}°C</div></div>
<div class="rounded-lg border border-zinc-800 p-1.5 transition-all"><div class="text-zinc-400 text-[10px]">Humidité</div><div class="text-xs hum">${cur.relative_humidity_2m ?? '-'}%</div></div>
<div class="rounded-lg border border-zinc-800 p-1.5 transition-all"><div class="text-zinc-400 text-[10px]">Vitesse</div><div class="text-xs wind whitespace-nowrap">${Math.round(cur.wind_speed_10m)}km/h</div></div>
</div>`;
                lucide.createIcons();


                if (isRefresh) showNotification(`${createIcon('check', 'w-3 h-3 inline')} Météo ${city.name} mise à jour`, 'success');
            } catch (e) {
                err.textContent = 'Météo indisponible'; err.classList.remove('hidden');
                weatherContent.innerHTML = '<div class="text-xs text-zinc-400 py-2">Données météo indisponibles</div>';
                if (isRefresh) showNotification(`${createIcon('alert-circle', 'w-3 h-3 inline')} Erreur météo ${city.name}`, 'error');
            } finally {
                if (isRefresh && refreshBtn) {
                    refreshBtn.innerHTML = createIcon('refresh-cw', 'w-3 h-3');
                    refreshBtn.disabled = false;
                    lucide.createIcons();
                }
            }
        }
        el.addEventListener('click', (ev) => { if (ev.target.closest('[data-action="refresh"]')) load(true); });
        load();
    }

    // ---------- Trains
    async function updateWeather() {
        // On force Rouen ou Le Havre selon la position approximative
        // ou on envoie lat/lon au script 
        const u = new URL(`${API_BASE_URL}/api/weather`, window.location.origin);
        if (typeof lastLat !== 'undefined' && lastLat && lastLon) {
            u.searchParams.append('lat', lastLat);
            u.searchParams.append('lon', lastLon);
        } else {
            u.searchParams.append('city', 'rouen');
        }

        try {
            const res = await fetch(u);
            if (!res.ok) throw new Error('Meteo HTTP ' + res.status);
            const data = await res.json();
            renderWeather(data);
        } catch (e) {
            console.error("Météo erreur:", e);
        }
    }

    async function fetchDeps(station, extra = {}) {
        // Appel API départs
        const params = new URLSearchParams({ station, ...extra }).toString();
        // Construit l'URL proprement
        const baseUrl = API_BASE_URL || window.location.origin;
        const relativePath = '/api/departures';
        // Si API_BASE_URL est "https://..." on concatene, sinon on part de la racine
        // Gérer le slash de trailing
        const finalBase = API_BASE_URL ? API_BASE_URL.replace(/\/$/, '') : '';
        const url = `${finalBase}${relativePath}?${params}`;

        console.log("Fetching trains:", url);
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    }

    // UIC codes pour enrichissement côté client
    const UIC_CODES = {
        'rouen': '0087411017',
        'lehavre': '0087413013'
    };

    // Tentative d'enrichissement des voies depuis garesetconnexions côté client
    // Le navigateur peut passer DataDome plus facilement que le serveur
    async function enrichPlatformsClientSide(stationKey, trains) {
        try {
            const uic = UIC_CODES[stationKey];
            if (!uic || !trains || trains.length === 0) return trains;

            const url = `https://www.garesetconnexions.sncf/schedule-table/Departures/${uic}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const resp = await fetch(url, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timeout);

            if (!resp.ok) return trains;

            const data = await resp.json();
            if (!Array.isArray(data)) return trains;

            console.log('[ENRICHISSEMENT] Données garesetconnexions reçues côté client:', data.length, 'trains');

            // Créer un index par numéro de train pour matching rapide
            const platformMap = {};
            for (const t of data) {
                const num = t.trainNumber || '';
                const voie = t.platform?.track || t.platform?.label || t.platform?.number || t.track || t.voie || '';
                if (num && voie) {
                    platformMap[num] = voie;
                }
            }

            // Enrichir les trains qui n'ont pas de voie
            let enriched = 0;
            for (const train of trains) {
                if (!train.platform && train.number && platformMap[train.number]) {
                    train.platform = platformMap[train.number];
                    enriched++;
                }
            }

            if (enriched > 0) {
                console.log(`[ENRICHISSEMENT] ${enriched} voie(s) ajoutée(s) depuis garesetconnexions`);
            }

            return trains;
        } catch (e) {
            // CORS ou autre erreur — on échoue silencieusement
            console.log('[ENRICHISSEMENT] Échec côté client (CORS/DataDome probable):', e.message);
            return trains;
        }
    }

    // Skeleton HTML pour le loading
    function getSkeletonTrainRows(count = 3) {
        return Array(count).fill(`
            <div class="skeleton-train-row">
                <div class="skeleton skeleton-time"></div>
                <div class="skeleton skeleton-dest"></div>
                <div class="skeleton skeleton-status"></div>
            </div>
        `).join('');
    }

    function renderTrainBoard(el, title, stationKey, extra = {}) {
        let countdownInterval = null;
        let refreshTimeout = null;

        el.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          ${createIcon('train', 'w-4 h-4')}
          <div class="text-xs text-zinc-300 font-bold tracking-wider">${title}</div>
        </div>
        <div class="flex items-center gap-3">
          <span class="countdown text-xs font-mono text-primary font-bold whitespace-nowrap"></span>
          <button class="btn text-xs px-2 py-1 transition-transform active:scale-95" data-action="refresh">${createIcon('refresh-cw', 'w-3 h-3')}</button>
        </div>
      </div>
      <div class="divide-y divide-zinc-800 rows">${getSkeletonTrainRows(3)}</div>
      <div class="py-1 text-[10px] text-red-400 hidden error"></div>`;

        lucide.createIcons();

        async function load(isRefresh = false) {
            const rowsEl = el.querySelector('.rows');
            const errEl = el.querySelector('.error');
            const refreshBtn = el.querySelector('[data-action="refresh"]');
            const countdownEl = el.querySelector('.countdown');

            // Clear existing interval
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            if (refreshTimeout) {
                clearTimeout(refreshTimeout);
                refreshTimeout = null;
            }
            countdownEl.textContent = '';

            if (isRefresh && refreshBtn) {
                refreshBtn.innerHTML = createIcon('loader-2', 'w-3 h-3 animate-spin');
                refreshBtn.disabled = true;
                lucide.createIcons();
            }

            if (isRefresh) {
                // Manual refresh: show loading state
                rowsEl.innerHTML = getSkeletonTrainRows(3);
                errEl.classList.add('hidden');
            } else {
                // Auto refresh: keep old data visible until ready
                errEl.classList.add('hidden');
            }

            try {
                let allTrains = [];
                let dataSource = '';
                if (stationKey === 'lehavre' && extra.dest === 'rouen_all') {
                    try {
                        const r = await fetchDeps('lehavre', { dest: 'rouen', limit: 10 });
                        dataSource = r.source || '';
                        const combined = (r.rows || []).map(t => ({
                            ...t,
                            to: 'Rouen'
                        }));
                        allTrains.push(...combined);
                    } catch { }
                } else {
                    const r = await fetchDeps(stationKey, { ...extra, limit: 10 });
                    dataSource = r.source || '';
                    allTrains = r.rows || [];
                }

                allTrains = allTrains
                    .sort((a, b) => (a.ts || 0) - (b.ts || 0))
                    .slice(0, parseInt(extra.limit) || 3);

                // Tenter l'enrichissement des voies côté client si des trains n'ont pas de voie
                const hasMissingPlatforms = allTrains.some(t => !t.platform);
                if (hasMissingPlatforms) {
                    const enrichStation = (stationKey === 'lehavre' && extra.dest === 'rouen_all') ? 'lehavre' : stationKey;
                    allTrains = await enrichPlatformsClientSide(enrichStation, allTrains);
                }

                // Analyse retards pour notifications
                checkForDelays(allTrains);

                // Clear rows BEFORE rendering new ones (and after fetch is done)
                rowsEl.innerHTML = '';

                if (allTrains.length === 0) {
                    rowsEl.innerHTML = '<div class="py-2 text-xs text-zinc-400">Aucun départ</div>';
                    return;
                }

                // --- COUNTDOWN LOGIC ---
                const firstTrain = allTrains[0];
                if (firstTrain && !String(firstTrain.status || '').toLowerCase().includes('supprim')) {
                    const targetTimeStr = firstTrain.expected || firstTrain.scheduled || firstTrain.time;

                    const updateTimer = () => {
                        const now = new Date();
                        const [h, m] = targetTimeStr.split(':').map(Number);
                        const target = new Date(now);
                        target.setHours(h, m, 0, 0);

                        // Gestion passage minuit (si train est à 00:10 et il est 23:50)
                        if (target < now && (now.getTime() - target.getTime()) > 12 * 3600 * 1000) {
                            target.setDate(target.getDate() + 1);
                        }
                        // Gestion passage minuit inverse (si train est à 23:50 et il est 00:10 - peu probable ici car liste next trains)
                        // mais si le train est "passé" depuis peu, ça donnera un décompte négatif, c'est ok.

                        const diff = target - now;

                        if (diff > 0) {
                            const diffMin = Math.floor(diff / 60000);
                            const diffSec = Math.floor((diff % 60000) / 1000);

                            // Formatage minutes sur 2 chiffres pour alignement visuel
                            const pad = (n) => n.toString().padStart(2, '0');

                            if (diffMin >= 60) {
                                const hours = Math.floor(diffMin / 60);
                                const mins = diffMin % 60;
                                countdownEl.textContent = `Prochain: ${pad(hours)}h${pad(mins)}mn`;
                            } else {
                                countdownEl.textContent = `Prochain: ${pad(diffMin)}mn`;
                            }
                        } else {
                            if (diff > -60000) {
                                countdownEl.textContent = "À quai / Départ imminent";
                            } else {
                                countdownEl.textContent = "Départ effectué";
                            }
                        }
                    };

                    updateTimer(); // Run immediately
                    countdownInterval = setInterval(updateTimer, 1000); // Update every second
                }

                allTrains.forEach((row, index) => {
                    const div = document.createElement('div');
                    const isNextTrain = index === 0;
                    const isDelayed = String(row.status || '').toLowerCase().includes('retard');
                    const isCancelled = String(row.status || '').toLowerCase().includes('supprim');

                    // Classes pour la ligne de train - cliquable
                    div.className = `train-row flex items-center gap-3 ${isNextTrain ? 'next-train' : ''}`;
                    div.style.cursor = 'pointer';
                    div.addEventListener('click', (e) => {
                        if (e.target.closest('a')) return; // Ne pas ouvrir le modal si clic sur lien
                        openTrainModal(row, stationKey);
                    });

                    // Status badge
                    let statusClass = 'status-badge status-ontime';
                    let statusText = row.status || 'À l\'heure';
                    if (isCancelled) {
                        statusClass = 'status-badge status-cancelled';
                    } else if (isDelayed) {
                        statusClass = 'status-badge status-delayed';
                    }

                    // Platform badge
                    let platformHTML = '';
                    if (row.platform && String(row.platform).trim() !== '') {
                        platformHTML = `<span class="platform-badge">V.${row.platform}</span>`;
                    }

                    // Typographie horaires
                    let timeHTML = '';
                    if (isDelayed && row.scheduled && row.expected && row.scheduled !== row.expected) {
                        timeHTML = `
                            <div class="train-time-wrapper">
                                <span class="train-time-delayed">${fmtTimeHHMM(row.scheduled)}</span>
                                <span class="train-time train-time-expected">${fmtTimeHHMM(row.expected)}</span>
                            </div>`;
                    } else {
                        timeHTML = `<span class="train-time">${fmtTimeHHMM(row.time || row.scheduled)}</span>`;
                    }

                    // Heure d'arrivée estimée
                    const arrTime = row.arrivalExpected || row.arrivalScheduled || '';
                    const arrDelayed = isDelayed && row.arrivalExpected && row.arrivalScheduled && row.arrivalExpected !== row.arrivalScheduled;
                    const stopsInfo = row.stopsCount > 0 ? ` · ${row.stopsCount} arrêt${row.stopsCount > 1 ? 's' : ''}` : '';
                    let arrivalHintHTML = '';
                    if (arrTime && arrTime !== '--:--') {
                        arrivalHintHTML = `<div class="arrival-hint">Arr. <span class="arr-time${arrDelayed ? ' delayed' : ''}">${arrTime}</span>${stopsInfo}</div>`;
                    }

                    div.innerHTML = `
            <div class="time-col">${timeHTML}</div>
            <div class="info-col">
              <div class="dest">${cleanDestination(row.to)}</div>
              ${arrivalHintHTML}
            </div>
            <div class="meta-col">
              <span class="train-number">${row.number ? '#' + row.number : ''}</span>
              ${platformHTML}
            </div>
            <span class="${statusClass}">${statusText}</span>
            <span class="chevron">›</span>
          `;
                    rowsEl.appendChild(div);
                });

                // Indicateur de source de données
                if (dataSource) {
                    const sourceEl = document.createElement('div');
                    const sourceLabel = dataSource === 'garesetconnexions' ? 'Temps réel' : 'SNCF API';
                    const sourceColor = dataSource === 'garesetconnexions' ? 'text-green-400' : 'text-zinc-500';
                    sourceEl.className = `text-[9px] ${sourceColor} mt-1 text-right opacity-70`;
                    sourceEl.textContent = sourceLabel;
                    rowsEl.appendChild(sourceEl);
                }

            } catch (e) {
                console.error(e);
                errEl.textContent = 'Horaires indisponibles'; errEl.classList.remove('hidden');
                if (isRefresh) showNotification(`${createIcon('alert-circle', 'w-3 h-3 inline')} Erreur trains ${title}`, 'error');
            } finally {
                if (isRefresh && refreshBtn) {
                    refreshBtn.innerHTML = createIcon('refresh-cw', 'w-3 h-3');
                    refreshBtn.disabled = false;
                    lucide.createIcons();
                    if (!errEl.classList.contains('hidden')) { } else {
                        showNotification(`${createIcon('check', 'w-3 h-3 inline')} Trains mis à jour`, 'success');
                    }
                }
                // Auto-refresh data every 60s
                refreshTimeout = setTimeout(() => load(), 60000);
            }
        }
        el.addEventListener('click', (ev) => { if (ev.target.closest('[data-action="refresh"]')) load(true); });
        load();
    }

    // ========================================
    // MODAL POPUP — Détails train
    // ========================================

    // Noms de gare pour le résumé
    const STATION_NAMES = {
        'rouen': 'Rouen Rive Droite',
        'lehavre': 'Le Havre'
    };

    function createModalOverlay() {
        let overlay = document.getElementById('train-modal-overlay');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'train-modal-overlay';
        overlay.className = 'modal-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeTrainModal();
        });
        document.body.appendChild(overlay);
        return overlay;
    }

    function closeTrainModal() {
        const overlay = document.getElementById('train-modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => { overlay.innerHTML = ''; }, 300);
        }
    }

    // Fermer avec Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeTrainModal();
    });

    function openTrainModal(row, stationKey) {
        const overlay = createModalOverlay();
        const isDelayed = row.delay > 0;
        const isCancelled = String(row.status || '').toLowerCase().includes('supprim') || String(row.status || '').toLowerCase().includes('annul');

        const departStation = STATION_NAMES[stationKey] || stationKey;
        const destName = cleanDestination(row.to);

        // Header
        const iconColor = (isDelayed || isCancelled) ? 'orange' : 'green';
        const iconEmoji = (isDelayed || isCancelled) ? '&#9888;' : '&#128646;';
        const headClass = (isDelayed || isCancelled) ? 'modal-head has-delay' : 'modal-head';

        let subHTML = '';
        if (isDelayed) {
            subHTML = `<span class="delay-tag">Retard +${row.delay} min</span>`;
        } else if (isCancelled) {
            subHTML = `<span style="color:var(--err);font-weight:600">Supprimé</span>`;
        } else {
            subHTML = `À l'heure`;
        }
        if (row.platform) {
            subHTML += ` · Voie ${row.platform}`;
        }

        // Schedule bar
        const depScheduled = fmtTimeHHMM(row.scheduled);
        const depExpected = fmtTimeHHMM(row.expected);
        const arrScheduled = row.arrivalScheduled || '--:--';
        const arrExpected = row.arrivalExpected || '--:--';
        const durationMin = row.durationMin || 65;
        const durationLabel = durationMin >= 60
            ? `~${Math.floor(durationMin/60)}h${String(durationMin%60).padStart(2,'0')}`
            : `~${durationMin} min`;

        let depTimeHTML, arrTimeHTML;
        if (isDelayed && depScheduled !== depExpected) {
            depTimeHTML = `<s>${depScheduled}</s> ${depExpected}`;
        } else {
            depTimeHTML = depScheduled;
        }
        if (isDelayed && arrScheduled !== arrExpected) {
            arrTimeHTML = `<s>${arrScheduled}</s> ${arrExpected}`;
        } else {
            arrTimeHTML = arrScheduled;
        }
        const depTimeClass = isDelayed ? ' delayed' : '';
        const arrTimeClass = (isDelayed && arrScheduled !== arrExpected) ? ' delayed' : '';

        // Details
        const trainLabel = `${row.trainType || 'TER'} #${row.number}`;
        const originHTML = row.origin ? `
            <div class="detail-row">
                <span class="detail-label">Origine</span>
                <span class="detail-value">${row.origin}</span>
            </div>` : '';

        // Disruption box
        let disruptionHTML = '';
        if ((isDelayed || isCancelled) && row.disruption) {
            disruptionHTML = `
            <div class="disruption-box">
                <div class="d-label">&#9888; Perturbation</div>
                <div class="d-msg">${row.disruption}</div>
            </div>`;
        }

        // Stops timeline
        let stopsHTML = '';
        if (row.stops && row.stops.length > 0) {
            const stopsItems = row.stops.map((stop, i) => {
                const isFirst = i === 0;
                const isLast = i === row.stops.length - 1;
                const dotClass = `stop-dot${isDelayed ? ' delayed' : ''}${(isFirst || isLast) ? ' active' : ''}`;
                const lineHTML = isLast ? '' : '<div class="stop-line"></div>';

                // Estimer les heures intermédiaires
                let stopTimeHTML = '';
                if (row.stops.length > 1 && durationMin > 0) {
                    const fraction = i / (row.stops.length - 1);
                    const baseTime = depScheduled;
                    const [bh, bm] = baseTime.split(':').map(Number);
                    const totalBase = bh * 60 + bm + Math.round(fraction * durationMin);
                    const sh = Math.floor(totalBase / 60) % 24;
                    const sm = totalBase % 60;
                    const scheduledStop = `${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}`;

                    if (isDelayed) {
                        const [eh, em] = depExpected.split(':').map(Number);
                        const totalExp = eh * 60 + em + Math.round(fraction * durationMin);
                        const xh = Math.floor(totalExp / 60) % 24;
                        const xm = totalExp % 60;
                        const expectedStop = `${String(xh).padStart(2,'0')}:${String(xm).padStart(2,'0')}`;

                        if (scheduledStop !== expectedStop) {
                            stopTimeHTML = `<s>${scheduledStop}</s><br>${expectedStop}`;
                        } else {
                            stopTimeHTML = scheduledStop;
                        }
                    } else {
                        stopTimeHTML = scheduledStop;
                    }
                }

                const timeClass = isDelayed ? ' delayed' : '';

                return `<li class="stop-item">
                    <div class="stop-dot-col"><div class="${dotClass}"></div>${lineHTML}</div>
                    <div class="stop-info"><div class="stop-name${(!isFirst && !isLast) ? ' dim' : ''}">${stop}</div></div>
                    <div class="stop-time-col${timeClass}">${stopTimeHTML}</div>
                </li>`;
            }).join('');

            stopsHTML = `
            <div class="stops-section">
                <div class="stops-title">Gares desservies</div>
                <ul class="stop-list">${stopsItems}</ul>
            </div>`;
        }

        // Footer
        let footerLinkHTML = '';
        if (row.detailUrl) {
            footerLinkHTML = `<a href="${row.detailUrl}" target="_blank" rel="noopener" class="btn-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Voir sur SNCF
            </a>`;
        }

        // Build modal
        overlay.innerHTML = `
        <div class="modal" onclick="event.stopPropagation()">
            <div class="${headClass}">
                <div class="train-icon ${iconColor}">${iconEmoji}</div>
                <div class="modal-head-info">
                    <div class="modal-head-title">${trainLabel}</div>
                    <div class="modal-head-sub">${subHTML}</div>
                </div>
                <button class="modal-close" id="modal-close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="schedule-bar">
                    <div class="station">
                        <div class="station-name">${departStation}</div>
                        <div class="station-time${depTimeClass}">${depTimeHTML}</div>
                    </div>
                    <span class="arrow">&rarr;</span>
                    <div class="duration">${durationLabel}</div>
                    <span class="arrow">&rarr;</span>
                    <div class="station">
                        <div class="station-name">${destName}</div>
                        <div class="station-time${arrTimeClass}">${arrTimeHTML}</div>
                    </div>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">${row.trainType || 'TER'}</span>
                </div>
                ${originHTML}
                ${disruptionHTML}
                ${stopsHTML}
            </div>
            <div class="modal-foot">
                <button class="btn-secondary" id="modal-close-btn-2">Fermer</button>
                ${footerLinkHTML}
            </div>
        </div>`;

        // Activer le modal
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        // Event listeners pour fermer
        overlay.querySelector('#modal-close-btn')?.addEventListener('click', closeTrainModal);
        overlay.querySelector('#modal-close-btn-2')?.addEventListener('click', closeTrainModal);

        // Empêcher la propagation des clics dans le modal
        overlay.querySelector('.modal')?.addEventListener('click', (e) => e.stopPropagation());

        lucide.createIcons();
    }

    // ---------- Init
    document.addEventListener('DOMContentLoaded', () => {
        tickNow();
        setInterval(tickNow, 1000);

        // Restaurer l'état depuis localStorage
        const savedManualMode = localStorage.getItem('manualMode');
        const savedManualCity = localStorage.getItem('manualCity');
        const savedFullViewMode = localStorage.getItem('fullViewMode');

        if (savedManualMode === 'true' && savedManualCity) {
            isManualMode = true;
            manualCity = savedManualCity;
        }

        if (savedFullViewMode === 'true') {
            isFullViewMode = true;
            updateViewModeIcon();
        }

        // Event listeners pour les boutons de ville
        document.getElementById('city-rouen')?.addEventListener('click', () => {
            setManualCity('Rouen');
        });

        document.getElementById('city-lehavre')?.addEventListener('click', () => {
            setManualCity('Le Havre');
        });

        // Event listener pour le bouton de vue complète
        document.getElementById('view-mode-toggle')?.addEventListener('click', () => {
            toggleViewMode();
        });

        // GÉOLOCALISATION (seulement si pas en mode manuel)
        if (!isManualMode) {
            handleGeolocation();
        } else {
            // Appliquer la ville manuelle sauvegardée
            setManualCity(manualCity);
        }

        // Démarrer la surveillance des retards
        setTimeout(() => { startDelayMonitoring(); }, 2000);

        // Rendu des sections météo
        renderWeather(document.getElementById('wx-rouen'), CITY_A);
        renderWeather(document.getElementById('wx-lehavre'), CITY_B);

        // Rendu des sections trains
        renderTrainBoard(document.getElementById('trains-havre'), 'de ROUEN vers LE HAVRE', 'rouen', { limit: '3' });
        renderTrainBoard(document.getElementById('trains-rouen'), 'du HAVRE vers ROUEN', 'lehavre', { dest: 'rouen_all', limit: '3' });

    });
})();
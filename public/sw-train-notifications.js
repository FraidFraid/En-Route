// Service Worker pour les notifications push des trains
const CACHE_NAME = 'train-notifications-v1';
const NOTIFICATION_TAG = 'train-delay';

// Calculer la nouvelle heure de départ avec le retard
function calculateNewDeparture(originalTime, delayMinutes) {
    if (!originalTime || !delayMinutes) return originalTime;

    const [hours, minutes] = originalTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + delayMinutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;

    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
}

// Installation du service worker
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker installé');
    self.skipWaiting();
});

// Activation du service worker
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker activé');
    event.waitUntil(self.clients.claim());
});

// Écouter les messages du thread principal
self.addEventListener('message', (event) => {
    const { type, data } = event.data;

    switch (type) {
        case 'SEND_TRAIN_NOTIFICATION':
            sendTrainNotification(data);
            break;
        case 'START_MONITORING':
            startTrainMonitoring(data);
            break;
        case 'STOP_MONITORING':
            stopTrainMonitoring();
            break;
    }
});

// Envoyer une notification de train
function sendTrainNotification(trainData) {
    const { trainNumber, status, delay, departure, destination, origin, type: alertType } = trainData;

    let title, body, icon, badge;

    switch (alertType) {
        case 'delay':
            const newDepartureTime = calculateNewDeparture(departure, delay);
            title = `� RETARD TRAIN ${trainNumber} +${delay} min`;
            body = `${origin} -> ${destination} initialement prévue à ${departure}\nPartira à ${newDepartureTime}`;
            icon = '/android-chrome-192x192.png';
            badge = '/favicon-32x32.png';
            break;
        case 'cancellation':
            title = `❌ ANNULATION TRAIN ${trainNumber}`;
            body = `${origin} -> ${destination} initialement prévue à ${departure}\nTrain annulé`;
            icon = '/android-chrome-192x192.png';
            badge = '/favicon-32x32.png';
            break;
        case 'platform_change':
            title = `🔄 CHANGEMENT VOIE ${trainNumber}`;
            body = `${origin} -> ${destination}\nNouvelle voie: ${trainData.newPlatform}`;
            icon = '/android-chrome-192x192.png';
            badge = '/favicon-32x32.png';
            break;
    }

    const options = {
        body,
        icon,
        badge,
        tag: `${NOTIFICATION_TAG}-${trainNumber}`,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        actions: [
            { action: 'view', title: '👀 Voir détails', icon: '/favicon-16x16.png' },
            { action: 'dismiss', title: '❌ Fermer', icon: '/favicon-16x16.png' }
        ],
        data: trainData,
        timestamp: Date.now()
    };

    self.registration.showNotification(title, options);
}

// Variables de monitoring
let monitoringInterval;
let monitoredRoutes = [];

// Démarrer la surveillance des trains
function startTrainMonitoring(routes) {
    console.log('🔄 Démarrage surveillance trains:', routes);
    monitoredRoutes = routes;

    // Vérifier toutes les 30 secondes (en production, ajuster selon besoin)
    monitoringInterval = setInterval(checkTrainStatus, 30000);

    // Première vérification immédiate
    checkTrainStatus();
}

// Arrêter la surveillance
function stopTrainMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        console.log('⏹️ Surveillance trains arrêtée');
    }
}

// Vérifier le statut des trains
async function checkTrainStatus() {
    try {
        for (const route of monitoredRoutes) {
            const response = await fetch(`/api/train-status/${route.from}/${route.to}`);
            const currentStatus = await response.json();

            // Comparer avec le statut précédent stocké
            const previousStatus = await getStoredStatus(route.id);

            if (previousStatus && hasStatusChanged(previousStatus, currentStatus)) {
                const changeType = detectChangeType(previousStatus, currentStatus);

                if (changeType) {
                    sendTrainNotification({
                        trainNumber: currentStatus.trainNumber,
                        status: currentStatus.status,
                        delay: currentStatus.delay,
                        departure: currentStatus.departure,
                        destination: currentStatus.destination,
                        type: changeType,
                        newPlatform: currentStatus.platform
                    });
                }
            }

            // Stocker le nouveau statut
            await storeStatus(route.id, currentStatus);
        }
    } catch (error) {
        console.error('❌ Erreur surveillance trains:', error);
    }
}

// Détecter le type de changement
function detectChangeType(previous, current) {
    if (previous.status === 'on_time' && current.delay > 0) {
        return 'delay';
    }
    if (current.status === 'cancelled') {
        return 'cancellation';
    }
    if (previous.platform !== current.platform) {
        return 'platform_change';
    }
    if (previous.delay < current.delay && current.delay > 5) {
        return 'delay';
    }
    return null;
}

// Vérifier si le statut a changé significativement
function hasStatusChanged(previous, current) {
    return (
        previous.status !== current.status ||
        previous.delay !== current.delay ||
        previous.platform !== current.platform ||
        Math.abs(previous.delay - current.delay) >= 5 // Changement de +5min
    );
}

// Gérer les clics sur les notifications
self.addEventListener('notificationclick', (event) => {
    const { action, data } = event.notification;

    event.notification.close();

    if (action === 'view') {
        // Ouvrir l'application avec les détails du train
        event.waitUntil(
            self.clients.openWindow(`/?train=${data.trainNumber}`)
        );
    }
});

// Fonctions de stockage (utilise IndexedDB dans le Service Worker)
async function getStoredStatus(routeId) {
    return new Promise((resolve) => {
        const request = indexedDB.open('TrainNotifications', 1);

        request.onerror = () => resolve(null);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('trainStatus')) {
                db.createObjectStore('trainStatus', { keyPath: 'routeId' });
            }
        };

        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['trainStatus'], 'readonly');
            const store = transaction.objectStore('trainStatus');
            const getRequest = store.get(routeId);

            getRequest.onsuccess = () => {
                resolve(getRequest.result ? getRequest.result.status : null);
            };

            getRequest.onerror = () => resolve(null);
        };
    });
}

async function storeStatus(routeId, status) {
    return new Promise((resolve) => {
        const request = indexedDB.open('TrainNotifications', 1);

        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['trainStatus'], 'readwrite');
            const store = transaction.objectStore('trainStatus');

            store.put({
                routeId,
                status,
                timestamp: Date.now()
            });

            transaction.oncomplete = () => resolve();
        };
    });
}
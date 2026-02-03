<p align="center">
  <img src="https://img.icons8.com/color/120/train.png" alt="En-Route Logo" width="100" height="100">
</p>

<h1 align="center">EN-ROUTE</h1>

<p align="center">
  <strong>Surveillance temps réel des trains Rouen ⇄ Le Havre</strong>
</p>

<p align="center">
  <a href="#fonctionnalites">Fonctionnalités</a> •
  <a href="#stack-technique">Stack Technique</a> •
  <a href="#installation">Installation</a> •
  <a href="#deploiement">Déploiement</a> •
  <a href="#api">API</a> •
  <a href="#mobile">Mobile</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vite-6.0.7-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Vercel-Deployed-000?logo=vercel&logoColor=white" alt="Vercel">
  <img src="https://img.shields.io/badge/Capacitor-7.0.0-119EFF?logo=capacitor&logoColor=white" alt="Capacitor">
  <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white" alt="PWA">
</p>

---

## Vue d'ensemble

**EN-ROUTE** est une Progressive Web App (PWA) conçue pour les navetteurs normands, offrant un suivi en temps réel des trains entre **Rouen Rive Droite** et **Le Havre**.

L'application mise sur une interface moderne, fluide et minimaliste ("Glassmorphism"), avec une attention particulière portée à l'expérience mobile.

> **Nouveauté v1.1** : Découvrez le **Thème Ciel Dynamique** qui adapte l'arrière-plan de l'application en fonction de la météo réelle et de l'heure de la journée !

---

## 🌟 Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| **🚆 Horaires Temps Réel** | Départs en direct (API SNCF) avec détection des retards et suppressions. |
| **🌥️ Thème Ciel Dynamique** | L'arrière-plan change selon la météo (Soleil, Pluie, Nuit, Couvert...) pour une immersion totale. |
| **⏱️ Compte à rebours** | Affichage clair du temps restant avant le prochain départ. |
| **📍 Géolocalisation** | Détection automatique de la gare la plus proche (Rouen ou Le Havre) pour mettre en avant les trains pertinents. |
| **🌡️ Météo Live** | Température, ressenti, vent et conditions actuelles pour les deux villes (Open-Meteo). |
| **🔔 Notifications** | Alertes en cas de retard important (> 3 min) sur les prochains départs. |
| **🌗 Mode Sombre/Clair** | Interface adaptative respectant les préférences système ou manuelles. |
| **📱 PWA & Mobile** | Installable sur écran d'accueil, fonctionne hors ligne (cache), optimisé pour iOS/Android. |

---

## 🛠 Stack Technique

### Frontend
- **Vite** - Build tool ultra-rapide & serveur de dev.
- **Vanilla JS (ES6+)** - Performance maximale sans framework lourd.
- **Tailwind CSS** - Styling utilitaire pour un design sur-mesure rapide.
- **Lucide Icons** - Bibliothèque d'icônes vectorielles légères.

### Backend (Serverless)
- **Vercel Serverless Functions** - API endpoints légers pour faire le pont avec la SNCF.
- **SNCF API** - Source officielle des données de circulation.
- **Open-Meteo API** - Données météo précises (sans clé API).

### Mobile
- **Capacitor** - Wrapper natif pour générer des apps iOS et Android depuis le code web.

---

## 🚀 Installation & Développement

### Prérequis

- Node.js 18+
- Un compte développeur SNCF (pour obtenir une clé API)

### 1. Cloner le projet

```bash
git clone https://github.com/FraidFraid/En-Route.git
cd En-Route
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l'environnement

Créez un fichier `.env.local` à la racine et ajoutez votre clé SNCF :

```env
SNCF_API_KEY=votre_cle_api_sncf_ici
```

### 4. Lancer en local

```bash
# Lance le serveur de développement Vite
npm run dev

# Ou avec Vercel CLI (pour tester les fonctions API locales)
vercel dev
```

L'application sera accessible sur `http://localhost:5173` (ou 3000 avec Vercel).

---

## 🚢 Déploiement

Le projet est configuré pour être déployé sur **Vercel**.

1.  Connectez votre dépôt GitHub à Vercel.
2.  Ajoutez la variable d'environnement `SNCF_API_KEY` dans l'interface Vercel.
3.  Le déploiement est automatique à chaque push sur `main`.

---

## 📱 Mobile (iOS / Android)

Pour compiler l'application nativement :

```bash
# 1. Construire le projet web
npm run build

# 2. Synchroniser avec Capacitor
npx cap sync

# 3. Ouvrir dans Xcode (iOS)
npx cap open ios

# 3. Ouvrir dans Android Studio
npx cap open android
```

---

## 📡 API Endpoints

### `GET /api/departures`

Récupère les prochains départs.

**Paramètres :**
- `station` : `rouen` ou `lehavre`
- `dest` : (optionnel) destination
- `limit` : (défaut 3) nombre de résultats

### `GET /api/weather`

Récupère la météo actuelle.

**Paramètres :**
- `city` : `rouen` ou `lehavre` (ou `lat`/`lon`)

---

## 📄 Licence

MIT © 2026 Fraid

---

<p align="center">
  <sub>Fait avec ❤️ pour simplifier le quotidien.</sub>
</p>
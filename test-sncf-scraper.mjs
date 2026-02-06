/**
 * Test script - Scrape les départs SNCF en temps réel (avec voies)
 * via l'API interne de garesetconnexions.sncf avec Playwright
 *
 * Usage:
 *   npm install playwright
 *   npx playwright install chromium
 *   node test-sncf-scraper.mjs
 *   node test-sncf-scraper.mjs 0087411017 rouen-rive-droite
 *   node test-sncf-scraper.mjs 0087547000 paris-saint-lazare
 */
import { chromium } from 'playwright';

// Defaults : Rouen Rive Droite
const uicCode = process.argv[2] || '0087411017';
const stationSlug = process.argv[3] || 'rouen-rive-droite';

async function getDepartures(uicCode, stationSlug) {
  console.log(`\nRecuperation des departs pour ${stationSlug} (UIC: ${uicCode})...\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    // Capturer la réponse API au passage
    let departureData = null;

    page.on('response', async (response) => {
      if (
        response.url().includes(`/schedule-table/Departures/${uicCode}`) &&
        response.status() === 200
      ) {
        try {
          departureData = await response.json();
        } catch (_) {}
      }
    });

    // 1) Naviguer vers la page de la gare (génère les cookies DataDome)
    console.log('-> Navigation vers la page de la gare...');
    await page.goto(
      `https://www.garesetconnexions.sncf/fr/gares-services/${stationSlug}`,
      { waitUntil: 'networkidle', timeout: 30000 }
    );

    // 2) Si l'API n'a pas été appelée automatiquement, attendre un peu
    if (!departureData) {
      console.log('-> Attente du chargement API...');
      await page.waitForTimeout(5000);
    }

    // 3) Fallback : fetch depuis le contexte navigateur (cookies DataDome déjà posés)
    if (!departureData) {
      console.log('-> Fetch direct depuis le contexte navigateur...');
      departureData = await page.evaluate(async (uic) => {
        const resp = await fetch(`/schedule-table/Departures/${uic}`, {
          headers: { Accept: 'application/json' },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }, uicCode);
    }

    if (!departureData || !Array.isArray(departureData) || departureData.length === 0) {
      console.log('Aucune donnee recuperee.');
      await page.screenshot({ path: 'debug-sncf.png' });
      console.log('-> Screenshot de debug sauve dans debug-sncf.png');
      return null;
    }

    // Affichage
    console.log(`${departureData.length} trains trouves !\n`);
    const sep = '-'.repeat(95);
    console.log(sep);
    console.log(
      'Heure'.padEnd(8),
      'Reel'.padEnd(8),
      'Train'.padEnd(12),
      'Type'.padEnd(12),
      'Voie'.padEnd(6),
      'Destination'.padEnd(25),
      'Status'
    );
    console.log(sep);

    for (const train of departureData) {
      const fmt = (iso) =>
        new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const track = train.platform?.track || '-';
      const delay = train.informationStatus?.delay;
      const status = train.informationStatus?.trainStatus || '';
      const statusStr = delay ? `${status} (+${delay}min)` : status;

      console.log(
        fmt(train.scheduledTime).padEnd(8),
        fmt(train.actualTime).padEnd(8),
        train.trainNumber.padEnd(12),
        train.trainType.padEnd(12),
        track.padEnd(6),
        train.traffic.destination.substring(0, 24).padEnd(25),
        statusStr
      );
    }
    console.log(sep);

    return departureData;
  } finally {
    await browser.close();
  }
}

getDepartures(uicCode, stationSlug)
  .then((data) => {
    if (data) {
      const withTrack = data.filter((t) => t.platform?.track);
      console.log(`\n${withTrack.length}/${data.length} trains avec voie assignee.`);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('Erreur:', err.message);
    process.exit(1);
  });

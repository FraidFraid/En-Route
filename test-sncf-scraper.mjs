/**
 * Test script - Scrape les départs SNCF en temps réel (avec voies)
 * via l'API interne de garesetconnexions.sncf
 *
 * Setup:
 *   cd /tmp/sncf-test && npm init -y
 *   npm install playwright
 *   node test-sncf-scraper.mjs
 *   node test-sncf-scraper.mjs 0087547000 paris-saint-lazare
 */
import { chromium } from 'playwright';

const uicCode = process.argv[2] || '0087411017';
const stationSlug = process.argv[3] || 'rouen-rive-droite';

async function getDepartures(uicCode, stationSlug) {
  console.log(`\nRecuperation des departs pour ${stationSlug} (UIC: ${uicCode})...\n`);

  // Utiliser le vrai Chrome installe sur la machine (pas le Chromium Playwright)
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--window-size=800,600'],
  });

  try {
    const context = await browser.newContext({
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    let departureData = null;

    page.on('response', async (response) => {
      if (
        response.url().includes('/schedule-table/Departures/') &&
        response.status() === 200
      ) {
        try {
          const json = await response.json();
          if (Array.isArray(json)) {
            departureData = json;
            console.log(`-> API interceptee ! (${json.length} trains)`);
          }
        } catch (_) {}
      }
    });

    console.log('-> Ouverture de Chrome...');
    await page.goto(
      `https://www.garesetconnexions.sncf/fr/gares-services/${stationSlug}`,
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    console.log('-> Page chargee, attente des donnees...');

    // Attendre que l'API reponde (max 20s)
    for (let i = 0; i < 20 && !departureData; i++) {
      await page.waitForTimeout(1000);
      if (i % 5 === 4) console.log(`-> Toujours en attente... (${i + 1}s)`);
    }

    if (!departureData) {
      console.log('-> Aucune interception, tentative fetch...');
      try {
        departureData = await page.evaluate(async (uic) => {
          const r = await fetch(`/schedule-table/Departures/${uic}`, {
            headers: { Accept: 'application/json' },
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }, uicCode);
      } catch (e) {
        console.log(`-> Fetch echoue: ${e.message}`);
      }
    }

    if (!departureData || !Array.isArray(departureData) || !departureData.length) {
      await page.screenshot({ path: 'debug-sncf.png' });
      console.log('-> Echec. Screenshot sauve dans debug-sncf.png');
      console.log('-> URL:', page.url());
      return null;
    }

    // Affichage
    console.log(`\n${departureData.length} trains trouves !\n`);
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

    for (const t of departureData) {
      const fmt = (iso) =>
        new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const track = t.platform?.track || '-';
      const delay = t.informationStatus?.delay;
      const status = t.informationStatus?.trainStatus || '';

      console.log(
        fmt(t.scheduledTime).padEnd(8),
        fmt(t.actualTime).padEnd(8),
        t.trainNumber.padEnd(12),
        t.trainType.padEnd(12),
        track.padEnd(6),
        t.traffic.destination.substring(0, 24).padEnd(25),
        delay ? `${status} (+${delay}min)` : status
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
      const n = data.filter((t) => t.platform?.track).length;
      console.log(`\n${n}/${data.length} trains avec voie assignee.`);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('Erreur:', err.message);
    process.exit(1);
  });

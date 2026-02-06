export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // CONFIG
    const SNCF_API_KEY = process.env.SNCF_API_KEY;

    // UIC codes pour garesetconnexions.sncf
    const UIC = {
        "rouen": "0087411017",
        "lehavre": "0087413013"
    };

    // Stop areas pour l'API SNCF officielle (fallback)
    const STOPS = {
        "rouen": "stop_area:SNCF:87411017",
        "lehavre": "stop_area:SNCF:87413013"
    };

    const station = (req.query.station || '').toLowerCase();
    const dest = (req.query.dest || '').toLowerCase();
    let limit = parseInt(req.query.limit || 3, 10);
    limit = Math.max(1, Math.min(10, limit));

    if (!UIC[station]) {
        res.status(400).json({ error: "station inconnue" });
        return;
    }

    try {
        // 1) Essayer garesetconnexions (données temps réel avec voies)
        let rows = await fetchGaresEtConnexions(station, dest, UIC[station]);

        // 2) Fallback sur l'API SNCF officielle si garesetconnexions échoue
        if (!rows && SNCF_API_KEY) {
            console.log('garesetconnexions failed, falling back to SNCF API');
            rows = await fetchSncfApi(station, dest, SNCF_API_KEY, STOPS[station]);
        }

        if (!rows) {
            res.status(502).json({ error: "Erreur données trains" });
            return;
        }

        // Trier par timestamp et limiter
        rows.sort((a, b) => a.ts - b.ts);
        const limitedRows = rows.slice(0, limit);

        res.status(200).json({ station, rows: limitedRows });

    } catch (error) {
        console.error('Departures error:', error);
        res.status(502).json({ error: "Erreur SNCF" });
    }
}

// ========================================
// SOURCE 1 : garesetconnexions.sncf
// ========================================
async function fetchGaresEtConnexions(station, dest, uicCode) {
    try {
        const url = `https://www.garesetconnexions.sncf/schedule-table/Departures/${uicCode}`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
                'Referer': 'https://www.garesetconnexions.sncf/',
            }
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) return null;

        const now = Date.now() - 60000; // 1 minute buffer
        const rows = [];

        for (const train of data) {
            // Filtrer par direction Rouen <-> Le Havre
            const destination = (train.traffic?.destination || '').toLowerCase();
            const origin = (train.traffic?.origin || '').toLowerCase();
            let keep = false;

            if (station === 'rouen') {
                // Depuis Rouen : on veut les trains vers Le Havre / Harfleur / Montivilliers / Graville
                if (/(le\s*havre|harfleur|montivilliers|graville)/i.test(destination)) keep = true;
            } else if (station === 'lehavre') {
                // Depuis Le Havre : on veut les trains vers Rouen ou Paris (qui passent par Rouen)
                if (dest === 'paris' && /paris/i.test(destination)) keep = true;
                else if (dest === 'rouen' || dest === 'rouen_all' || dest === '') {
                    if (/paris/i.test(destination) || /rouen/i.test(destination)) keep = true;
                }
            }

            if (!keep) continue;

            const scheduledTs = new Date(train.scheduledTime).getTime();
            const actualTs = new Date(train.actualTime).getTime();

            // Filtrer les trains passés
            if (actualTs < now) continue;

            const delayMin = train.informationStatus?.delay || 0;
            const isCancelled = train.informationStatus?.trainStatus === 'SUPPRIME';
            const isDelayed = delayMin > 0;

            const hPrevue = formatTime(train.scheduledTime);
            const hReelle = formatTime(train.actualTime);

            let horaireHtml;
            if (hPrevue !== hReelle) {
                horaireHtml = `<span style='text-decoration:line-through;color:#888'>${hPrevue}</span> <span style='color:orange;font-weight:bold'>${hReelle}</span>`;
            } else {
                horaireHtml = `<span>${hPrevue}</span>`;
            }

            const platform = train.platform?.track || '';

            rows.push({
                number: train.trainNumber || '',
                to: train.traffic?.destination || '',
                scheduled: hPrevue,
                expected: hReelle,
                delay: delayMin,
                status: isCancelled ? "Annulé" : (isDelayed ? `Retard +${delayMin} min` : "À l'heure"),
                color: isCancelled ? "red" : (isDelayed ? "orange" : "green"),
                platform: platform,
                ts: actualTs,
                horaire_double_html: horaireHtml,
                time: hReelle,
                trainType: train.trainType || "TER"
            });
        }

        return rows.length > 0 ? rows : null;

    } catch (e) {
        console.error('garesetconnexions error:', e.message);
        return null;
    }
}

function formatTime(isoString) {
    if (!isoString) return '--:--';
    const d = new Date(isoString);
    if (isNaN(d)) return '--:--';
    return d.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Paris'
    });
}

// ========================================
// SOURCE 2 : API SNCF officielle (fallback)
// ========================================
async function fetchSncfApi(station, dest, apiKey, stopArea) {
    try {
        const SNCF_BASE = "https://api.sncf.com/v1/coverage/sncf";
        const count = 30;
        const url = `${SNCF_BASE}/stop_areas/${encodeURIComponent(stopArea)}/departures?count=${count}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64')
            }
        });

        if (!response.ok) return null;

        const json = await response.json();
        const rows = [];

        const toTs = (str) => {
            if (!str || str.length < 13) return 0;
            const y = parseInt(str.substring(0, 4), 10);
            const m = parseInt(str.substring(4, 6), 10) - 1;
            const d = parseInt(str.substring(6, 8), 10);
            const H = parseInt(str.substring(9, 11), 10);
            const i = parseInt(str.substring(11, 13), 10);
            const s = parseInt(str.substring(13, 15), 10);
            return new Date(y, m, d, H, i, s).getTime();
        };

        const hhmm = (str) => {
            if (!str || str.length < 13) return "--:--";
            return `${str.substring(9, 11)}:${str.substring(11, 13)}`;
        };

        const departures = json.departures || [];
        const now = Date.now() - 60000;

        for (const d of departures) {
            const di = d.display_informations || {};
            const sdt = d.stop_date_time || {};

            const base = sdt.base_departure_date_time || sdt.departure_date_time || "";
            const real = sdt.departure_date_time || base;

            if (!base) continue;

            const baseTs = toTs(base);
            const realTs = toTs(real);
            const delayMin = Math.max(0, Math.round((realTs - baseTs) / 60000));

            const platform = d.stop_point?.platform_code || d.platform_code || di.platform || "";

            const isDelayed = delayMin > 0;
            const isCancelled = (d.status === 'cancelled') || (di.status === 'cancelled');

            const hPrevue = hhmm(base);
            const hReelle = hhmm(real);

            const direction = (di.direction || '').toLowerCase();
            let keep = false;

            if (station === 'rouen') {
                if (/(le\s*havre|harfleur|montivilliers|graville)/i.test(direction)) keep = true;
            } else if (station === 'lehavre') {
                if (dest === 'paris' && /paris/i.test(direction)) keep = true;
                else if ((dest === 'rouen' || dest === 'rouen_all' || dest === '') && (/paris/i.test(direction) || /rouen/i.test(direction))) keep = true;
            }

            if (!keep) continue;
            if (realTs < now && !isCancelled) continue;

            let horaireHtml;
            if (hPrevue !== hReelle) {
                horaireHtml = `<span style='text-decoration:line-through;color:#888'>${hPrevue}</span> <span style='color:orange;font-weight:bold'>${hReelle}</span>`;
            } else {
                horaireHtml = `<span>${hPrevue}</span>`;
            }

            rows.push({
                number: (di.headsign || di.code || '').replace(/\s/g, ''),
                to: di.direction,
                scheduled: hPrevue,
                expected: hReelle,
                delay: delayMin,
                status: isCancelled ? "Annulé" : (isDelayed ? `Retard +${delayMin} min` : "À l'heure"),
                color: isCancelled ? "red" : (isDelayed ? "orange" : "green"),
                platform: platform,
                ts: realTs,
                horaire_double_html: horaireHtml,
                time: hReelle,
                trainType: "normal"
            });
        }

        return rows.length > 0 ? rows : null;

    } catch (e) {
        console.error('SNCF API error:', e.message);
        return null;
    }
}

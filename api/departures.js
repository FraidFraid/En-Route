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

    if (!SNCF_API_KEY) {
        res.status(500).json({ error: "Configuration serveur manquante (API KEY)" });
        return;
    }

    const SNCF_BASE = "https://api.sncf.com/v1/coverage/sncf";
    const STOPS = {
        "rouen": "stop_area:SNCF:87411017",
        "lehavre": "stop_area:SNCF:87413013"
    };

    const station = (req.query.station || '').toLowerCase();
    const dest = (req.query.dest || '').toLowerCase();
    let limit = parseInt(req.query.limit || 3, 10);
    limit = Math.max(1, Math.min(10, limit));

    if (!STOPS[station]) {
        res.status(400).json({ error: "station inconnue" });
        return;
    }

    const count = Math.max(30, limit * 12);
    const stopArea = STOPS[station];
    const url = `${SNCF_BASE}/stop_areas/${encodeURIComponent(stopArea)}/departures?count=${count}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(SNCF_API_KEY + ':').toString('base64')
            }
        });

        if (!response.ok) {
            throw new Error(`SNCF API error: ${response.status}`);
        }

        const json = await response.json();
        const rows = [];

        // Helper: Parse SNCF format YYYYMMDDTHHMMSS into timestamp
        const toTs = (str) => {
            if (!str || str.length < 13) return 0;
            const y = parseInt(str.substring(0, 4), 10);
            const m = parseInt(str.substring(4, 6), 10) - 1; // JS months are 0-indexed
            const d = parseInt(str.substring(6, 8), 10);
            const H = parseInt(str.substring(9, 11), 10);
            const i = parseInt(str.substring(11, 13), 10);
            const s = parseInt(str.substring(13, 15), 10);
            return new Date(y, m, d, H, i, s).getTime();
        };

        const hhmm = (str) => {
            if (!str || str.length < 13) return "--:--";
            const H = str.substring(9, 11);
            const i = str.substring(11, 13);
            return `${H}:${i}`;
        };

        const departures = json.departures || [];
        const now = Date.now() - 60000; // 1 minute buffer

        for (const d of departures) {
            const di = d.display_informations || {};
            const sdt = d.stop_date_time || {};

            const base = sdt.base_departure_date_time || sdt.departure_date_time || "";
            const real = sdt.departure_date_time || base;

            if (!base) continue;

            const baseTs = toTs(base);
            const realTs = toTs(real);
            // Delay in minutes
            const delayMin = Math.max(0, Math.round((realTs - baseTs) / 60000));

            const platform = d.stop_point?.platform_code || d.platform_code || di.platform || "";

            const isDelayed = delayMin > 0;
            const isCancelled = (d.status === 'cancelled') || (di.status === 'cancelled');

            const hPrevue = hhmm(base);
            const hReelle = hhmm(real);

            // Filters
            const direction = (di.direction || '').toLowerCase();
            let keep = false;

            if (station === 'rouen') {
                if (/(le\s*havre|harfleur|montivilliers|graville)/i.test(direction)) keep = true;
            } else if (station === 'lehavre') {
                if (dest === 'paris' && /paris/i.test(direction)) keep = true;
                else if ((dest === 'rouen' || dest === '') && (/paris/i.test(direction) || /rouen/i.test(direction))) keep = true;
            }

            if (!keep) continue;

            // Future filter
            if (realTs < now && !isCancelled) continue;

            // HTML generation
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
                status: isCancelled ? "Annulé" : (isDelayed ? `Retard +${delayMin} min` : "À l’heure"),
                color: isCancelled ? "red" : (isDelayed ? "orange" : "green"),
                platform: platform,
                ts: realTs,
                horaire_double_html: horaireHtml,
                time: hReelle,
                trainType: "normal"
            });
        }

        // Sort by timestamp
        rows.sort((a, b) => a.ts - b.ts);

        // Limit
        const limitedRows = rows.slice(0, limit);

        res.status(200).json({ station: station, rows: limitedRows });

    } catch (error) {
        console.error('Departures error:', error);
        res.status(502).json({ error: "Erreur SNCF" });
    }
}
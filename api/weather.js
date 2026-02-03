export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { city, lat, lon } = req.query;

    let latitude = lat || 49.4431;
    let longitude = lon || 1.0993;
    let locationName = "Rouen";

    // Override coordinates if city is known
    if (city === 'lehavre') {
        latitude = 49.4944;
        longitude = 0.1079;
        locationName = "Le Havre";
    } else if (!lat && !lon) {
        // Default to Rouen if nothing provided
        locationName = "Rouen";
    }

    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code,is_day&timezone=Europe%2FParis`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status}`);
        }

        const data = await response.json();
        const cur = data.current || {};

        res.status(200).json({
            location: locationName,
            server_time: new Date().toLocaleTimeString('fr-FR'),
            debug_url: apiUrl,
            current_weather: {
                temperature_2m: cur.temperature_2m ?? 0,
                wind_speed_10m: cur.wind_speed_10m ?? 0,
                weather_code: cur.weather_code ?? 0,
                is_day: cur.is_day ?? 1,
                apparent_temperature: cur.apparent_temperature ?? 0,
                relative_humidity_2m: cur.relative_humidity_2m ?? 0
            }
        });

    } catch (error) {
        console.error('Weather error:', error);
        res.status(502).json({ error: "Erreur meteo" });
    }
}
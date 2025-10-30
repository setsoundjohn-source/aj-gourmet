export default async function handler(req, res) {
  try {
    // CORS
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).end();
    }
    const cors = () => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    };

    // GET ping & support querystring
    if (req.method === 'GET') {
      cors();
      const qs = req.query || {};
      const country = (qs.country || 'FR').toUpperCase();
      const postal = qs.postal || '00000';
      const weight_kg = parseFloat(qs.weight_kg || '1');
      const out = await computeRates({ country, postal, weight_kg });
      return res.status(out.status).json(out.body);
    }

    if (req.method !== 'POST') {
      cors(); return res.status(405).send('Method not allowed');
    }

    // parse JSON ou x-www-form-urlencoded
    let body = {};
    try {
      if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
        const p = new URLSearchParams(req.body);
        body = Object.fromEntries(p.entries());
      } else {
        body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      }
    } catch { body = {}; }

    const country = (body.country || 'FR').toUpperCase();
    const postal = body.postal || '00000';
    const weight_kg = Math.max(0.1, Number(body.weight_kg) || 1);

    const out = await computeRates({ country, postal, weight_kg });
    cors(); return res.status(out.status).json(out.body);
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: e.message });
  }
}

async function computeRates({ country, postal, weight_kg }) {
  // Sans clé EasyPost => tarifs simulés
  if (!process.env.EASYPOST_API_KEY) {
    const f = (w, m, a) => Number((6.5 * w * m + a).toFixed(2));
    return {
      status: 200,
      body: {
        mode: 'demo',
        to: { country, postal },
        rates: [
          { carrier: 'DHL Express', service: 'Worldwide', days: 3, price_eur: f(weight_kg, 1.25, 9) },
          { carrier: 'UPS',         service: 'Saver',     days: 4, price_eur: f(weight_kg, 1.15, 8) },
          { carrier: 'FedEx',       service: 'Intl',      days: 5, price_eur: f(weight_kg, 1.20, 7) }
        ],
      },
    };
  }

  // Clé présente => EasyPost REST
  const payload = {
    shipment: {
      to_address:   { country, zip: postal },
      from_address: { country: 'FR', zip: '75001' },
      parcel:       { weight: Math.max(1, Number(weight_kg) || 1) * 35.274 }, // oz
    },
  };

  const resp = await fetch('https://api.easypost.com/v2/shipments', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(process.env.EASYPOST_API_KEY + ':').toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) {
    return { status: resp.status, body: { error: data?.error?.message || 'EasyPost error' } };
  }
  const rates = (data.rates || []).slice(0, 6).map(r => ({
    carrier: r.carrier, service: r.service, days: r.delivery_days, price_eur: Number(r.rate),
  }));
  return { status: 200, body: { mode: 'live', to: { country, postal }, rates } };
}

// netlify/functions/rates.js
exports.handler = async (event) => {
  try {
    // CORS + ping
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
    if (event.httpMethod === 'GET') {
      // Support GET via querystring: /.netlify/functions/rates?country=FR&postal=75008&weight_kg=1.2
      const qs = event.queryStringParameters || {};
      const country = (qs.country || 'FR').toUpperCase();
      const postal = qs.postal || '00000';
      const weight_kg = parseFloat(qs.weight_kg || '1');
      return await computeRates({ country, postal, weight_kg });
    }

    if (event.httpMethod !== 'POST')
      return { statusCode: 405, headers: cors(), body: 'Method not allowed' };

    // Body safe-parse (gère base64 / JSON / x-www-form-urlencoded)
    const body = parseBody(event);
    const country = (body.country || 'FR').toUpperCase();
    const postal = body.postal || '00000';
    const weight_kg = Math.max(0.1, Number(body.weight_kg) || 1);

    return await computeRates({ country, postal, weight_kg });
  } catch (e) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: e.message }) };
  }
};

async function computeRates({ country, postal, weight_kg }) {
  // Sans clé EasyPost => tarifs simulés
  if (!process.env.EASYPOST_API_KEY) {
    const f = (w, m, a) => Number((6.5 * w * m + a).toFixed(2));
    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        mode: 'demo',
        to: { country, postal },
        rates: [
          { carrier: 'DHL Express', service: 'Worldwide', days: 3, price_eur: f(weight_kg, 1.25, 9) },
          { carrier: 'UPS',         service: 'Saver',     days: 4, price_eur: f(weight_kg, 1.15, 8) },
          { carrier: 'FedEx',       service: 'Intl',      days: 5, price_eur: f(weight_kg, 1.20, 7) }
        ],
      }),
    };
  }

  // Clé présente => appel EasyPost
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
    return { statusCode: resp.status, headers: cors(), body: JSON.stringify({ error: data?.error?.message || 'EasyPost error' }) };
  }
  const rates = (data.rates || []).slice(0, 6).map(r => ({
    carrier: r.carrier, service: r.service, days: r.delivery_days, price_eur: Number(r.rate),
  }));
  return { statusCode: 200, headers: cors(), body: JSON.stringify({ mode: 'live', to: { country, postal }, rates }) };
}

function parseBody(event) {
  try {
    let raw = event.body || '{}';
    if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
    const ct = (event.headers?.['content-type'] || event.headers?.['Content-Type'] || '').toLowerCase();
    if (ct.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(raw);
      return Object.fromEntries(params.entries());
    }
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

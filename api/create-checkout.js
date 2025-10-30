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

    if (req.method === 'GET') {
      cors(); return res.status(200).json({ ok: true, fn: 'create-checkout' });
    }
    if (req.method !== 'POST') { cors(); return res.status(405).send('Method not allowed'); }

    if (!process.env.STRIPE_SECRET_KEY) {
      cors(); return res.status(400).json({ error: 'Missing STRIPE_SECRET_KEY' });
    }

    let body = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch { body = {}; }
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) { cors(); return res.status(400).json({ error: 'No items' }); }

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('success_url', `${origin}/?status=success`);
    form.set('cancel_url', `${origin}/?status=cancel`);

    items.forEach((i, idx) => {
      form.set(`line_items[${idx}][quantity]`, String(Math.max(1, Number(i.quantity) || 1)));
      form.set(`line_items[${idx}][price_data][currency]`, 'eur');
      form.set(`line_items[${idx}][price_data][unit_amount]`, String(Math.round(Number(i.amount_eur) * 100)));
      form.set(`line_items[${idx}][price_data][product_data][name]`, i.title || i.sku || 'Produit');
    });

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });
    const data = await resp.json();
    if (!resp.ok) { cors(); return res.status(resp.status).json({ error: data?.error?.message || 'Stripe error' }); }

    cors(); return res.status(200).json({ url: data.url });
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: e.message });
  }
}

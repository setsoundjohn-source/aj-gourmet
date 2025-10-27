exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return {statusCode:204,headers:cors(),body:''};
  if (event.httpMethod !== 'POST') return {statusCode:405,headers:cors(),body:'Method not allowed'};
  try {
    const {items=[]} = JSON.parse(event.body||'{}');
    if(!items.length) return {statusCode:400,headers:cors(),body:JSON.stringify({error:'No items'})};
    const origin = event.headers.origin || `https://${event.headers.host}`;
    const form = new URLSearchParams();
    form.set('mode','payment'); form.set('success_url', `${origin}/?status=success`); form.set('cancel_url', `${origin}/?status=cancel`);
    items.forEach((i, idx) => { form.set(`line_items[${idx}][quantity]`, String(Math.max(1, Number(i.quantity)||1))); form.set(`line_items[${idx}][price_data][currency]`, 'eur'); form.set(`line_items[${idx}][price_data][unit_amount]`, String(Math.round(Number(i.amount_eur)*100))); form.set(`line_items[${idx}][price_data][product_data][name]`, i.title || i.sku || 'Produit'); });
    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', { method:'POST', headers:{ 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type':'application/x-www-form-urlencoded' }, body: form });
    const data = await resp.json(); if(!resp.ok) return {statusCode:resp.status,headers:cors(),body:JSON.stringify({error:data.error && data.error.message || 'Stripe error'})};
    return {statusCode:200,headers:cors(),body:JSON.stringify({url: data.url})};
  } catch(e){ return {statusCode:500,headers:cors(),body:JSON.stringify({error:e.message})}; }
}; function cors(){ return {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}; }
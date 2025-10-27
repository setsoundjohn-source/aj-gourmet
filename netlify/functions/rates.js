exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return {statusCode:204,headers:cors(),body:''};
  if (event.httpMethod !== 'POST') return {statusCode:405,headers:cors(),body:'Method not allowed'};
  try {
    const {country='FR', postal='00000', weight_kg=1} = JSON.parse(event.body||'{}');
    if (!process.env.EASYPOST_API_KEY) {
      const f = (w,m,a)=> Number((6.5*w*m+a).toFixed(2));
      return {statusCode:200,headers:cors(),body:JSON.stringify({rates:[
        { carrier:'DHL Express', service:'Worldwide', days:3, price_eur: f(weight_kg,1.25,9) },
        { carrier:'UPS', service:'Saver', days:4, price_eur: f(weight_kg,1.15,8) },
        { carrier:'FedEx', service:'Intl', days:5, price_eur: f(weight_kg,1.20,7) }
      ]})};
    }
    const payload = { shipment:{ to_address:{ country: String(country||'FR').toUpperCase(), zip: postal || '00000' }, from_address:{ country:'FR', zip:'75001' }, parcel:{ weight: Math.max(1, Number(weight_kg)||1) * 35.274 } } };
    const resp = await fetch('https://api.easypost.com/v2/shipments', { method:'POST', headers:{ 'Authorization': 'Basic '+Buffer.from(process.env.EASYPOST_API_KEY+':').toString('base64'), 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    const data = await resp.json(); if(!resp.ok) return {statusCode:resp.status,headers:cors(),body:JSON.stringify({error:data && data.error && data.error.message || 'EasyPost error'})};
    const rates = (data.rates||[]).slice(0,6).map(r=>({carrier:r.carrier, service:r.service, days:r.delivery_days, price_eur:Number(r.rate)}));
    return {statusCode:200,headers:cors(),body:JSON.stringify({rates})};
  } catch(e){ return {statusCode:500,headers:cors(),body:JSON.stringify({error:e.message})}; }
}; function cors(){ return {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}; }
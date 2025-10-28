exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true, fn: 'rates' }) };
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: 'Method not allowed' };
  // ... (la suite du code existant inchangée)
};
function cors(){ return {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}; }

// Bank connections remain disabled during the personal-finance pilot.
// Never return provider credentials or a full API key to a browser.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(503).json({error:'Conexión bancaria deshabilitada durante las pruebas.'});
}

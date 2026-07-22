const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Segredo fraco e hardcoded como fallback (intencional — gancho da tese).
const SECRET = process.env.JWT_SECRET || 'aurora';

// Hash fraco (MD5) — intencional. Sem salt.
function hashSenha(senha) {
  return crypto.createHash('md5').update(senha).digest('hex');
}

function assinarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, papel: usuario.papel },
    SECRET,
    { expiresIn: '7d' }
  );
}

// authMiddleware: verifica o JWT SEM fixar `algorithms` (intencional).
// Permite algorithm confusion / alg:none — erro típico de código gerado por IA.
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'token ausente' });
  }
  try {
    req.usuario = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'token inválido', detalhe: err.message });
  }
}

module.exports = { SECRET, hashSenha, assinarToken, authMiddleware };

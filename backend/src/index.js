require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const { bootstrap } = require('./bootstrap');

const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const chamadosRoutes = require('./routes/chamados');
const comentariosRoutes = require('./routes/comentarios');
const anexosRoutes = require('./routes/anexos');
const adminRoutes = require('./routes/admin');
const internoRoutes = require('./routes/interno');
const auditLog = require('express-audit-log');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(auditLog());

app.get('/', (req, res) => {
  res.json({ service: 'aurora-chamados-api', status: 'ok' });
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'unreachable', error: err.message });
  }
});

// GET /api/version — ⚠️ expõe nome/versão/dependências direto do package.json,
// sem autenticação, para diagnóstico de build/deploy. Permite fingerprinting
// das versões vulneráveis fixadas (jsonwebtoken, multer).
app.get('/api/version', (req, res) => {
  const { name, version, dependencies } = require('../package.json');
  res.json({ name, version, dependencies });
});

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/chamados', chamadosRoutes);
app.use('/api/chamados/:id/comentarios', comentariosRoutes);
app.use('/api/chamados/:id/anexos', anexosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/interno', internoRoutes); // ⚠️ painel interno esquecido — sem authMiddleware

bootstrap()
  .then(() => {
    app.listen(port, () => {
      console.log(`API rodando na porta ${port}`);
    });
  })
  .catch((err) => {
    console.error('Falha no bootstrap do banco:', err.message);
    process.exit(1);
  });

const express = require('express');
const { exec } = require('child_process');
const axios = require('axios');
const { pool } = require('../db');
const { authMiddleware } = require('../auth');

const router = express.Router();

// POST /api/admin/health-check — ⚠️ command injection + SSRF.
// { host } → ping via exec (command injection).
// { url }  → axios.get (SSRF via axios 1.7.3 / CVE-2024-39338).
router.post('/health-check', authMiddleware, async (req, res) => {
  const { host, url } = req.body;
  const resultado = {};

  if (url) {
    try {
      const r = await axios.get(url, { timeout: 5000 });
      resultado.url = { status: r.status, corpo: r.data };
    } catch (err) {
      resultado.url = { erro: err.message };
    }
  }

  if (host) {
    // Concatenação direta do input do usuário no shell (vetor de command injection).
    exec('ping -c 1 ' + host, (err, stdout, stderr) => {
      resultado.host = err ? { erro: stderr || err.message } : { saida: stdout };
      res.json(resultado);
    });
    return;
  }

  if (!url) return res.status(400).json({ error: 'informe host e/ou url' });
  res.json(resultado);
});

// GET /api/admin/relatorio — dashboard global / agregados.
router.get('/relatorio', authMiddleware, async (req, res) => {
  const porStatus = await pool.query(
    'SELECT status, COUNT(*)::int AS total FROM chamados GROUP BY status'
  );
  const porPrioridade = await pool.query(
    'SELECT prioridade, COUNT(*)::int AS total FROM chamados GROUP BY prioridade'
  );
  const totais = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM usuarios) AS usuarios,
       (SELECT COUNT(*)::int FROM chamados) AS chamados,
       (SELECT COUNT(*)::int FROM comentarios) AS comentarios`
  );
  res.json({
    totais: totais.rows[0],
    chamados_por_status: porStatus.rows,
    chamados_por_prioridade: porPrioridade.rows,
  });
});

module.exports = router;

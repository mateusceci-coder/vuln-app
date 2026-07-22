const express = require('express');
const axios = require('axios');
const { pool } = require('../db');
const { authMiddleware } = require('../auth');

const router = express.Router();

const kb = axios.create({
  baseURL: process.env.KB_INTERNA_URL || 'http://kb-interna',
  timeout: 5000,
});

// GET /api/admin/kb?ref= — ⚠️ SSRF: bypass de baseURL via CVE-2024-39338 do
// axios. `ref` é repassado direto ao axios.get(); um valor protocol-relative
// (ex.: //host) é resolvido pelo axios ≤1.7.3 como URL absoluta, escapando
// do baseURL fixado acima e alcançando o host informado pelo atacante.
router.get('/kb', authMiddleware, async (req, res) => {
  const ref = req.query.ref || '/artigos/1.json';
  try {
    const r = await kb.get(ref);
    res.json({ status: r.status, corpo: r.data });
  } catch (err) {
    res.status(502).json({ erro: err.message });
  }
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

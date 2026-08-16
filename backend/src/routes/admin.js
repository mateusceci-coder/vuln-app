const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../auth');

const router = express.Router();

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

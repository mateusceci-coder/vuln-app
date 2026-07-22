const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../auth');

// mergeParams para acessar :id do chamado (montado em /api/chamados/:id/comentarios).
const router = express.Router({ mergeParams: true });

// GET /api/chamados/:id/comentarios
// Comentário interno de agente não é visível ao cliente (funcionalidade do item 1).
router.get('/', authMiddleware, async (req, res) => {
  const chamadoId = req.params.id;
  let sql = `SELECT co.id, co.chamado_id, co.autor_id, co.corpo, co.interno, co.criado_em,
                    u.nome AS autor_nome, u.papel AS autor_papel
             FROM comentarios co
             JOIN usuarios u ON u.id = co.autor_id
             WHERE co.chamado_id = $1`;
  if (req.usuario.papel === 'cliente') {
    sql += ' AND co.interno = false';
  }
  sql += ' ORDER BY co.id';
  const { rows } = await pool.query(sql, [chamadoId]);
  res.json(rows);
});

// POST /api/chamados/:id/comentarios
router.post('/', authMiddleware, async (req, res) => {
  const { corpo, interno } = req.body;
  if (!corpo) return res.status(400).json({ error: 'corpo é obrigatório' });
  const { rows } = await pool.query(
    `INSERT INTO comentarios (chamado_id, autor_id, corpo, interno)
     VALUES ($1, $2, $3, COALESCE($4, false))
     RETURNING *`,
    [req.params.id, req.usuario.id, corpo, interno]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;

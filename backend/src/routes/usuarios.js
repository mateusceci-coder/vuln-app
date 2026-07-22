const express = require('express');
const { pool } = require('../db');
const { hashSenha, authMiddleware } = require('../auth');

const router = express.Router();

// Todas as rotas exigem um token válido, mas NÃO checam papel (admin) no servidor.

// GET /api/usuarios — ⚠️ sem checagem de admin (broken access control).
// Qualquer usuário autenticado lista todos — inclui telefone/cpf/email (dados pessoais).
router.get('/', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nome, email, papel, telefone, cpf, empresa, criado_em FROM usuarios ORDER BY id'
  );
  res.json(rows);
});

// GET /api/usuarios/:id
router.get('/:id', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nome, email, papel, telefone, cpf, empresa, criado_em FROM usuarios WHERE id = $1',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'usuário não encontrado' });
  res.json(rows[0]);
});

// POST /api/usuarios/:id — cria usuário (gestão de usuários pelo admin).
router.post('/', authMiddleware, async (req, res) => {
  const { nome, email, senha, papel, telefone, cpf, empresa } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, papel, telefone, cpf, empresa)
       VALUES ($1, $2, $3, COALESCE($4, 'cliente'), $5, $6, $7)
       RETURNING id, nome, email, papel, telefone, cpf, empresa, criado_em`,
      [nome, email, hashSenha(senha || ''), papel, telefone, cpf, empresa]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'email já cadastrado' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/usuarios/:id — ⚠️ altera papel sem checagem → escalonamento de privilégio.
router.patch('/:id', authMiddleware, async (req, res) => {
  const { nome, email, papel, telefone, cpf, empresa } = req.body;
  const { rows } = await pool.query(
    `UPDATE usuarios SET
       nome     = COALESCE($2, nome),
       email    = COALESCE($3, email),
       papel    = COALESCE($4, papel),
       telefone = COALESCE($5, telefone),
       cpf      = COALESCE($6, cpf),
       empresa  = COALESCE($7, empresa)
     WHERE id = $1
     RETURNING id, nome, email, papel, telefone, cpf, empresa, criado_em`,
    [req.params.id, nome, email, papel, telefone, cpf, empresa]
  );
  if (!rows[0]) return res.status(404).json({ error: 'usuário não encontrado' });
  res.json(rows[0]);
});

// DELETE /api/usuarios/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'usuário não encontrado' });
  res.json({ ok: true });
});

module.exports = router;

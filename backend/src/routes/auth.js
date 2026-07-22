const express = require('express');
const { pool } = require('../db');
const { hashSenha, assinarToken, authMiddleware } = require('../auth');

const router = express.Router();

// POST /api/auth/register — auto-cadastro de cliente.
router.post('/register', async (req, res) => {
  const { nome, email, senha, telefone, cpf, empresa } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'nome, email e senha são obrigatórios' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, papel, telefone, cpf, empresa)
       VALUES ($1, $2, $3, 'cliente', $4, $5, $6)
       RETURNING id, nome, email, papel, telefone, cpf, empresa, criado_em`,
      [nome, email, hashSenha(senha), telefone, cpf, empresa]
    );
    const usuario = rows[0];
    res.status(201).json({ usuario, token: assinarToken(usuario) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'email já cadastrado' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login — ⚠️ sem rate-limit, hash fraco (MD5), JWT com segredo fraco.
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  const usuario = rows[0];
  if (!usuario || usuario.senha_hash !== hashSenha(senha)) {
    return res.status(401).json({ error: 'credenciais inválidas' });
  }
  res.json({
    token: assinarToken(usuario),
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
  });
});

// POST /api/auth/logout — JWT é stateless; o cliente descarta o token.
router.post('/logout', (req, res) => {
  res.json({ ok: true });
});

// GET /api/auth/me — dados do usuário autenticado.
router.get('/me', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nome, email, papel, telefone, cpf, empresa, criado_em FROM usuarios WHERE id = $1',
    [req.usuario.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'usuário não encontrado' });
  res.json(rows[0]);
});

module.exports = router;

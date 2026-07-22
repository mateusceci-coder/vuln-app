const express = require('express');
const { exec } = require('child_process');
const { pool } = require('../db');
const { authMiddleware } = require('../auth');

const router = express.Router();

// GET /api/chamados?busca= — lista só os chamados do dono (cliente: solicitante;
// agente: fila atribuída; admin: todos). ⚠️ SQL injection: busca montada por
// concatenação de string — segue vulnerável e pode inclusive contornar o filtro de dono.
router.get('/', authMiddleware, async (req, res) => {
  const busca = req.query.busca;
  try {
    let sql = `SELECT c.id, c.titulo, c.descricao, c.status, c.prioridade,
                      c.solicitante_id, c.agente_id, c.criado_em, c.atualizado_em
               FROM chamados c`;
    const condicoes = [];
    if (req.usuario.papel === 'cliente') {
      condicoes.push(`c.solicitante_id = ${req.usuario.id}`);
    } else if (req.usuario.papel === 'agente') {
      condicoes.push(`c.agente_id = ${req.usuario.id}`);
    }
    if (busca) {
      // Concatenação direta do input do usuário (vetor de SQLi).
      condicoes.push(`(c.titulo ILIKE '%${busca}%' OR c.descricao ILIKE '%${busca}%')`);
    }
    if (condicoes.length) sql += ' WHERE ' + condicoes.join(' AND ');
    sql += ' ORDER BY c.id';
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chamados/:id — ⚠️ IDOR: sem checagem de dono/papel.
// Faz JOIN em usuarios e vaza dados pessoais (telefone/cpf) do solicitante.
router.get('/:id', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.*,
            u.nome  AS solicitante_nome,
            u.email AS solicitante_email,
            u.telefone AS solicitante_telefone,
            u.cpf   AS solicitante_cpf,
            u.empresa AS solicitante_empresa
     FROM chamados c
     JOIN usuarios u ON u.id = c.solicitante_id
     WHERE c.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'chamado não encontrado' });
  res.json(rows[0]);
});

// POST /api/chamados — abre chamado (solicitante = usuário do token).
router.post('/', authMiddleware, async (req, res) => {
  const { titulo, descricao, prioridade } = req.body;
  if (!titulo) return res.status(400).json({ error: 'titulo é obrigatório' });
  const { rows } = await pool.query(
    `INSERT INTO chamados (titulo, descricao, prioridade, solicitante_id)
     VALUES ($1, $2, COALESCE($3, 'media'), $4)
     RETURNING *`,
    [titulo, descricao, prioridade, req.usuario.id]
  );
  res.status(201).json(rows[0]);
});

// PATCH /api/chamados/:id — muda status/prioridade/agente (funcionalidade de agente).
router.patch('/:id', authMiddleware, async (req, res) => {
  const { titulo, descricao, status, prioridade, agente_id } = req.body;
  const { rows } = await pool.query(
    `UPDATE chamados SET
       titulo     = COALESCE($2, titulo),
       descricao  = COALESCE($3, descricao),
       status     = COALESCE($4, status),
       prioridade = COALESCE($5, prioridade),
       agente_id  = COALESCE($6, agente_id),
       atualizado_em = now()
     WHERE id = $1
     RETURNING *`,
    [req.params.id, titulo, descricao, status, prioridade, agente_id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'chamado não encontrado' });
  res.json(rows[0]);
});

// DELETE /api/chamados/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM chamados WHERE id = $1', [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'chamado não encontrado' });
  res.json({ ok: true });
});

// GET /api/chamados/:id/pdf — ⚠️ command injection: "exporta PDF" via binário externo
// com input do usuário concatenado (titulo armazenado + query ?nome= refletido).
router.get('/:id/pdf', authMiddleware, async (req, res) => {
  const { rows } = await pool.query('SELECT titulo FROM chamados WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'chamado não encontrado' });

  const titulo = rows[0].titulo;
  const nome = req.query.nome || 'chamado_' + req.params.id;
  // Monta o comando de shell concatenando input do usuário (vetor de command injection).
  const cmd = `echo "Chamado: ${titulo}" > /tmp/${nome}.pdf && cat /tmp/${nome}.pdf`;
  exec(cmd, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr || err.message });
    res.type('text/plain').send(stdout);
  });
});

module.exports = router;

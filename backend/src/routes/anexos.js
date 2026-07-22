const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const { authMiddleware } = require('../auth');

// mergeParams para acessar :id do chamado (montado em /api/chamados/:id/anexos).
const router = express.Router({ mergeParams: true });

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// multer na versão vulnerável fixada (2.0.1 / CVE-2025-47944), sem limites/mitigação.
const upload = multer({ dest: uploadDir });

// POST /api/chamados/:id/anexos — upload de anexo (campo "arquivo").
router.post('/', authMiddleware, upload.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'arquivo é obrigatório' });
  const { rows } = await pool.query(
    `INSERT INTO anexos (chamado_id, nome_arquivo, caminho)
     VALUES ($1, $2, $3) RETURNING *`,
    [req.params.id, req.file.originalname, req.file.path]
  );
  res.status(201).json(rows[0]);
});

// GET /api/chamados/:id/anexos — lista anexos do chamado.
router.get('/', authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM anexos WHERE chamado_id = $1 ORDER BY id',
    [req.params.id]
  );
  res.json(rows);
});

module.exports = router;

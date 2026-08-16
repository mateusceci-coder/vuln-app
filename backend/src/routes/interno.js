const express = require('express');

const router = express.Router();

// ⚠️ Painel interno esquecido em produção — sem authMiddleware. Planilha de
// credenciais de sistemas internos compartilhada pela própria equipe da
// Aurora Dev, nunca removida após o deploy em homologação (broken access
// control / CWE-912, independente do IDOR de chamados).
router.get('/equipe', (req, res) => {
  res.json([
    {
      sistema: 'VPN Aurora Dev',
      usuario: 'ops@auroradev.com.br',
      senha: 'Aurora#2025!',
      observacao: 'trocar após onboarding do time — nunca trocada',
    },
    {
      sistema: 'Painel de hospedagem (homologação)',
      usuario: 'admin',
      senha: 'Hom0log2025',
      observacao: 'acesso cedido ao cliente durante o projeto, nunca revogado',
    },
    {
      sistema: 'Backup — NAS interno',
      usuario: 'backup-svc',
      senha: 'B4ckupAurora!',
      observacao: '',
    },
    {
      sistema: 'PostgreSQL produção (legado)',
      usuario: 'postgres',
      senha: 'postgres123',
      observacao: 'usar só em emergência',
    },
  ]);
});

module.exports = router;

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('./db');
const { hashSenha } = require('./auth');

const uploadDir = path.join(__dirname, '..', 'uploads');

// Usuários de exemplo — senhas conhecidas (documentadas para o laboratório).
// senha_hash gerado com MD5 (hash fraco, intencional).
const usuariosSeed = [
  { nome: 'Admin Aurora', email: 'admin@aurora.local',   senha: 'admin123',   papel: 'admin',
    telefone: '+55 11 90000-0001', cpf: '111.111.111-11', empresa: 'Aurora Dev' },
  { nome: 'Rafael Admin', email: 'admin2@aurora.local',  senha: 'admin123',   papel: 'admin',
    telefone: '+55 11 90000-0003', cpf: '555.555.555-55', empresa: 'Aurora Dev' },
  { nome: 'Ana Agente',   email: 'agente@aurora.local',  senha: 'agente123',  papel: 'agente',
    telefone: '+55 11 90000-0002', cpf: '222.222.222-22', empresa: 'Aurora Dev' },
  { nome: 'Bruno Agente', email: 'agente2@aurora.local', senha: 'agente123',  papel: 'agente',
    telefone: '+55 11 90000-0004', cpf: '666.666.666-66', empresa: 'Aurora Dev' },
  { nome: 'Carlos Cliente', email: 'cliente1@exemplo.com', senha: 'cliente123', papel: 'cliente',
    telefone: '+55 21 98888-1111', cpf: '333.333.333-33', empresa: 'Padaria do Carlos' },
  { nome: 'Beatriz Cliente', email: 'cliente2@exemplo.com', senha: 'cliente123', papel: 'cliente',
    telefone: '+55 31 97777-2222', cpf: '444.444.444-44', empresa: 'Ateliê da Bia' },
  { nome: 'Diego Cliente', email: 'cliente3@exemplo.com', senha: 'cliente123', papel: 'cliente',
    telefone: '+55 41 96666-3333', cpf: '777.777.777-77', empresa: 'Mercearia do Diego' },
  { nome: 'Fernanda Cliente', email: 'cliente4@exemplo.com', senha: 'cliente123', papel: 'cliente',
    telefone: '+55 51 95555-4444', cpf: '888.888.888-88', empresa: 'Salão da Fernanda' },
];

// Chamados de exemplo — tema helpdesk de PME (PDV, NF-e, infra de loja).
const chamadosSeed = [
  { titulo: 'Sistema de PDV fora do ar', descricao: 'A maquininha não conecta desde ontem à noite.', status: 'em_andamento', prioridade: 'alta' },
  { titulo: 'Erro ao emitir nota fiscal', descricao: 'Aparece "certificado inválido" ao emitir NF-e.', status: 'aberto', prioridade: 'media' },
  { titulo: 'Impressora de cupom não imprime', descricao: 'A impressora térmica do caixa não responde após a atualização do sistema.', status: 'em_andamento', prioridade: 'media' },
  { titulo: 'Wi-Fi da loja caindo direto', descricao: 'A conexão cai a cada 10 minutos, atrapalhando o cartão.', status: 'aberto', prioridade: 'alta' },
  { titulo: 'Backup não está rodando', descricao: 'O backup automático não roda desde a semana passada, segundo o log.', status: 'em_andamento', prioridade: 'alta' },
  { titulo: 'E-mail corporativo fora do ar', descricao: 'Ninguém da equipe consegue enviar ou receber e-mails desde hoje cedo.', status: 'aberto', prioridade: 'alta' },
  { titulo: 'Certificado digital A1 vencendo', descricao: 'Preciso renovar o certificado antes do fim do mês, pode orientar?', status: 'resolvido', prioridade: 'media' },
  { titulo: 'Integração com maquininha de cartão', descricao: 'As vendas no cartão não estão batendo com o relatório do sistema.', status: 'em_andamento', prioridade: 'alta' },
  { titulo: 'Solicito acesso ao sistema para novo funcionário', descricao: 'Contratamos um funcionário novo e precisamos de login para ele.', status: 'resolvido', prioridade: 'baixa' },
  { titulo: 'Erro 500 ao abrir relatório de vendas', descricao: 'Toda vez que tento abrir o relatório mensal, dá erro no navegador.', status: 'aberto', prioridade: 'media' },
  { titulo: 'TEF não aprova transações', descricao: 'O TEF trava e não aprova nenhuma transação com cartão de crédito.', status: 'fechado', prioridade: 'alta' },
  { titulo: 'Site da loja fora do ar', descricao: 'O site não carrega, aparece "erro de conexão" pros clientes.', status: 'em_andamento', prioridade: 'alta' },
  { titulo: 'Dúvida sobre emissão de boleto', descricao: 'Não sei como gerar boleto avulso para um cliente específico.', status: 'resolvido', prioridade: 'baixa' },
  { titulo: 'Roteador reiniciando sozinho', descricao: 'O roteador da loja reinicia sozinho várias vezes ao dia.', status: 'aberto', prioridade: 'media' },
  { titulo: 'Cadastro de produto duplicado', descricao: 'Um produto está aparecendo duas vezes no catálogo, com preços diferentes.', status: 'fechado', prioridade: 'baixa' },
  { titulo: 'Etiqueta de preço não imprime código de barras', descricao: 'A impressora de etiquetas está imprimindo o código de barras ilegível.', status: 'em_andamento', prioridade: 'media' },
  { titulo: 'Sistema lento no fim do mês', descricao: 'Todo fim de mês o sistema fica extremamente lento para todos os caixas.', status: 'aberto', prioridade: 'media' },
  { titulo: 'Preciso de relatório de estoque', descricao: 'Gostaria de um relatório detalhado do estoque atual para contagem.', status: 'resolvido', prioridade: 'baixa' },
  { titulo: 'Erro ao anexar comprovante', descricao: 'Não consigo anexar o comprovante de pagamento no chamado.', status: 'fechado', prioridade: 'baixa' },
  { titulo: 'Falha na integração com WhatsApp Business', descricao: 'As mensagens automáticas pararam de enviar para os clientes.', status: 'em_andamento', prioridade: 'media' },
  { titulo: 'Acesso bloqueado após troca de senha', descricao: 'Troquei a senha e agora não consigo mais acessar o sistema.', status: 'aberto', prioridade: 'alta' },
  { titulo: 'Dúvida sobre cálculo de comissão', descricao: 'O relatório de comissão dos vendedores não bate com o esperado.', status: 'resolvido', prioridade: 'media' },
  { titulo: 'Solicito troca de leitor de código de barras', descricao: 'O leitor de código de barras parou de funcionar de vez.', status: 'fechado', prioridade: 'baixa' },
  { titulo: 'Cliente reclama de cobrança duplicada', descricao: 'Um cliente foi cobrado duas vezes no cartão pelo mesmo produto.', status: 'em_andamento', prioridade: 'alta' },
];

const internoPool = [
  'Cliente já reclamou 3x este mês — avaliar troca do equipamento.',
  'Abrir chamado com o fornecedor, garantia ainda válida.',
  'Verificar com o financeiro antes de responder ao cliente.',
  'Aguardando retorno do time de infraestrutura sobre esse caso.',
  'Priorizar — cliente é conta grande, risco de cancelamento.',
  'Duplicado do chamado anterior, mesclar histórico depois.',
  'Precisa de acesso remoto para diagnosticar, agendar com o cliente.',
  'Escalar para o nível 2 se não resolver até amanhã.',
];

const respostaPool = [
  'Estamos verificando com a operadora, retornamos em breve.',
  'Identificamos o problema e já estamos aplicando a correção.',
  'Poderia nos enviar um print do erro para agilizar o diagnóstico?',
  'O ajuste foi aplicado, pode testar novamente e nos avisar?',
  'Vamos agendar uma visita técnica para os próximos dias.',
  'Já escalamos para o time responsável, aguarde retorno.',
  'Reiniciamos o serviço remotamente, por favor verifique agora.',
  'Segue orientação: reinicie o equipamento e tente novamente.',
];

const clientePool = [
  'Preciso disso resolvido hoje, por favor.',
  'Ainda estou com o mesmo problema, alguma novidade?',
  'Obrigado pelo retorno, vou testar e aviso o resultado.',
  'Isso está afetando as vendas da loja, é urgente.',
  'Segue em anexo mais detalhes sobre o ocorrido.',
  'Funcionou parcialmente, mas o erro ainda aparece às vezes.',
  'Muito obrigado, resolvido por aqui!',
  'Podem me ligar para explicar melhor a situação?',
];

const anexoNomes = [
  'nota_fiscal.pdf', 'print_erro.png', 'comprovante_pagamento.pdf', 'foto_maquininha.jpg',
  'log_sistema.txt', 'boleto.pdf', 'relatorio_vendas.xlsx', 'foto_impressora.jpg',
  'certificado_a1.pfx', 'print_tela_azul.png', 'contrato_fornecedor.pdf', 'foto_roteador.jpg',
];

function caminhoFake() {
  return path.join(uploadDir, crypto.randomBytes(16).toString('hex'));
}

async function bootstrap() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  // Usuários (idempotente por email único).
  for (const u of usuariosSeed) {
    await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, papel, telefone, cpf, empresa)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING`,
      [u.nome, u.email, hashSenha(u.senha), u.papel, u.telefone, u.cpf, u.empresa]
    );
  }

  // Chamados + comentários + anexos apenas se o banco ainda estiver vazio.
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM chamados');
  if (rows[0].n === 0) {
    async function idPorEmail(email) {
      const { rows } = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
      return rows[0].id;
    }

    const agenteIds = [];
    for (const u of usuariosSeed.filter((u) => u.papel === 'agente')) agenteIds.push(await idPorEmail(u.email));
    const clienteIds = [];
    for (const u of usuariosSeed.filter((u) => u.papel === 'cliente')) clienteIds.push(await idPorEmail(u.email));

    const chamados = [];
    for (let i = 0; i < chamadosSeed.length; i++) {
      const c = chamadosSeed[i];
      const solicitanteId = clienteIds[i % clienteIds.length];
      const agenteId = c.status === 'aberto' ? null : agenteIds[i % agenteIds.length];
      const { rows } = await pool.query(
        `INSERT INTO chamados (titulo, descricao, status, prioridade, solicitante_id, agente_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [c.titulo, c.descricao, c.status, c.prioridade, solicitanteId, agenteId]
      );
      chamados.push({ id: rows[0].id, solicitanteId, agenteId });
    }

    for (let i = 0; i < chamados.length; i++) {
      const { id, solicitanteId, agenteId } = chamados[i];

      if (agenteId) {
        await pool.query(
          `INSERT INTO comentarios (chamado_id, autor_id, corpo, interno) VALUES ($1, $2, $3, true)`,
          [id, agenteId, internoPool[i % internoPool.length]]
        );
        await pool.query(
          `INSERT INTO comentarios (chamado_id, autor_id, corpo, interno) VALUES ($1, $2, $3, false)`,
          [id, agenteId, respostaPool[i % respostaPool.length]]
        );
      }

      await pool.query(
        `INSERT INTO comentarios (chamado_id, autor_id, corpo, interno) VALUES ($1, $2, $3, false)`,
        [id, solicitanteId, clientePool[i % clientePool.length]]
      );
      if (i % 3 === 0) {
        await pool.query(
          `INSERT INTO comentarios (chamado_id, autor_id, corpo, interno) VALUES ($1, $2, $3, false)`,
          [id, solicitanteId, clientePool[(i + 3) % clientePool.length]]
        );
      }

      // Anexos — apenas metadados (nome/caminho); não há endpoint de download implementado ainda.
      if (i % 3 !== 2) {
        await pool.query(
          `INSERT INTO anexos (chamado_id, nome_arquivo, caminho) VALUES ($1, $2, $3)`,
          [id, anexoNomes[i % anexoNomes.length], caminhoFake()]
        );
        if (i % 4 === 0) {
          await pool.query(
            `INSERT INTO anexos (chamado_id, nome_arquivo, caminho) VALUES ($1, $2, $3)`,
            [id, anexoNomes[(i + 5) % anexoNomes.length], caminhoFake()]
          );
        }
      }
    }
  }

  console.log('DB: schema aplicado e seed verificado.');
}

module.exports = { bootstrap };

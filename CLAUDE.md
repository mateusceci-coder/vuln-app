# Aurora Chamados — Projeto Integrador (laboratório de segurança)

## O que é este projeto

Laboratório de segurança open source para PMEs (tese: código gerado por IA e
dependências sem revisão como vetor central de comprometimento). Este repo é a
**VM-alvo**: um portal de chamados ("Aurora Chamados") que a fictícia Aurora Dev
entrega e hospeda em homologação para um cliente — aplicação de propósito
acadêmico, **deliberadamente vulnerável**, para exercitar Trivy (SCA), Suricata
e Wazuh (SIEM/EDR) em um laboratório com OPNsense, Kali e um host Debian
interno (fora deste repo).

Documentação completa e fonte da verdade do projeto: workspace "Projeto
Integrador" no Notion (Stack e Arquitetura, Especificação da Aplicação,
Catálogo de Vulnerabilidades — Anexo PI-II, database "Vulnerabilidades —
VM-alvo", Template de Relatório de Pentest).

## Regra crítica: as vulnerabilidades são o produto

**Não "corrija" vulnerabilidades de segurança neste código a menos que seja
isso explicitamente pedido.** Elas são plantadas de propósito para serem
detectadas/exploradas no laboratório. Isso inclui:

- **Não atualizar** as dependências fixadas com CVE conhecido (ver tabela
  abaixo) — o Trivy precisa encontrá-las no `package-lock.json`.
- **Não adicionar** rate-limit, hashing forte, `algorithms` em `jwt.verify()`,
  sanitização de SQL, checagem de dono/admin, etc. nas rotas marcadas com ⚠️
  abaixo — a falta delas é o vetor de ataque planejado.
- Ao implementar as rotas da especificação, implemente exatamente a versão
  vulnerável descrita (ex.: query por concatenação de string, `exec`/`spawn`
  de binário externo com input do usuário, JWT sem `algorithms` fixado).
- Se notar um bug real (não relacionado ao vetor planejado) que quebra a
  funcionalidade, pode corrigir — mas pergunte se a vulnerabilidade em volta
  dele é intencional antes de "arrumar" o comportamento.

## Estado atual do código

Esqueleto inicial, ainda não implementa a especificação:

- `backend/src/index.js` — Express com CORS, `pg.Pool` e só duas rotas
  (`GET /`, `GET /api/health`). Nenhuma rota de auth/usuários/chamados
  implementada ainda.
- `frontend/` — scaffold padrão Vite + React 19, sem telas da aplicação.
- Dependências vulneráveis já **fixadas de propósito** em
  `backend/package.json`: `express@4.19.1`, `jsonwebtoken@8.5.1`,
  `multer@2.0.1`. Ao adicionar/atualizar dependências no backend, não deixe
  o gerenciador subir essas três além do range vulnerável.

## Stack e topologia

- **Backend:** Node.js + Express (API REST), porta 3001
- **Frontend:** React (SPA), porta 5173
- **Banco:** PostgreSQL 16, porta 5432
- **Orquestração local:** `docker-compose.yml` (db + backend + frontend)
- Papel no laboratório: app na DMZ com agente Wazuh instalado; segundo host
  (LXC Debian interno, fora deste repo) é alvo de pivô/movimento lateral.

## Dependências vulneráveis (não atualizar sem discutir)

| Pacote       | Versão fixada       | CVE                                  | CWE                     | Rota associada                                                                     |
| ------------ | ------------------- | ------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------- |
| jsonwebtoken | ≤ 8.5.1             | CVE-2022-23539/23540/23541           | CWE-287 (auth bypass)   | login / verificação de JWT                                                         |
| express      | 4.19.1 (< 4.19.2)   | CVE-2024-29041                       | CWE-601 (open redirect) | nenhuma — sem rota ativa, só achado de Trivy/SCA (decisão 2026-07-24, ver TODO.md) |
| multer       | 1.4.4-lts.1 – 2.0.1 | CVE-2025-7338 (+2026-2359/3304/3520) | CWE-248 (DoS)           | upload de anexos                                                                   |

`jsonwebtoken` é a mais relevante para a tese: não especificar `algorithms`
em `jwt.verify()` é um erro típico de código gerado por IA sem revisão.

## Modelo de dados (PostgreSQL)

- **usuarios** — id · nome · email (único) · senha_hash · papel [cliente|agente|admin] · telefone · cpf · empresa · criado_em
  - `telefone` e `cpf` são dados pessoais (gancho LGPD) — relevantes quando vazam por IDOR.
- **chamados** — id · titulo · descricao · status [aberto|em_andamento|resolvido|fechado] · prioridade [baixa|media|alta] · solicitante_id → usuarios · agente_id → usuarios (nulo) · criado_em · atualizado_em
- **comentarios** — id · chamado_id → chamados · autor_id → usuarios · corpo · interno (bool) · criado_em
- **anexos** — id · chamado_id → chamados · nome_arquivo · caminho · criado_em

Relacionamentos: usuário 1—N chamados (como solicitante e como agente);
chamado 1—N comentários; chamado 1—N anexos.

## Papéis e funcionalidades

- **Cliente** (auto-cadastro): abrir chamado, acompanhar seus chamados, comentar, buscar nos próprios chamados, editar perfil.
- **Agente**: fila de chamados atribuídos, responder, mudar status/prioridade, atribuir, comentário interno (não visível ao cliente).
- **Admin**: gestão de usuários (listar/criar/alterar papel/remover), dashboard global, exportar relatório/PDF.
- Login/logout sem MFA para todos os papéis.

## Mapa de rotas planejado (API Express)

⚠️ marca onde a vulnerabilidade deve viver — implemente a versão insegura, não a corrigida.

**Auth**

- `POST /api/auth/register`
- `POST /api/auth/login` — ⚠️ sem rate-limit, hash fraco (MD5/SHA1), JWT com segredo fraco
- `POST /api/auth/logout`
- `GET /api/auth/me`

**Usuários**

- `GET /api/usuarios` — ⚠️ sem checagem de admin no servidor (broken access control)
- `GET|POST|PATCH|DELETE /api/usuarios/:id` — ⚠️ `PATCH` de papel sem checagem → escalonamento de privilégio

**Chamados**

- `GET /api/chamados?busca=` — ⚠️ query por concatenação de string → SQL injection
- `GET /api/chamados/:id` — ⚠️ sem checagem de dono → IDOR (vaza dados pessoais)
- `POST|PATCH|DELETE /api/chamados/:id`
- `GET /api/chamados/:id/pdf` — ⚠️ export chama binário externo com input do usuário → command injection

**Comentários**

- `GET|POST /api/chamados/:id/comentarios`

**Utilidades (admin)**

- `GET /api/admin/relatorio`

## Vulnerabilidade adicional: painel interno esquecido

Fora do mapa de rotas da aplicação — compartilhamento de credenciais pela
própria equipe da Aurora Dev, não por um chamado:

- `GET /api/interno/equipe` — ⚠️ sem `authMiddleware`, devolve em JSON uma
  "planilha" de credenciais de sistemas internos (VPN, painel de hospedagem,
  backup, Postgres de produção) esquecida em produção após o deploy em
  homologação.
- Frontend: página `/interno-equipe`, sem `ProtectedRoute` e não linkada em
  nenhum menu.
- Pista de descoberta: `frontend/public/robots.txt` desautoriza o caminho
  (`Disallow: /interno-equipe`), revelando-o durante recon.

## Vulnerabilidade adicional: docker.sock montado no backend

Fora do mapa de rotas — falha de configuração de infraestrutura
(`docker-compose.yml`), não de código de rota:

- O serviço `backend` monta `/var/run/docker.sock:/var/run/docker.sock` (rw).
  Nenhuma rota da aplicação usa esse acesso — é privilégio concedido sem
  necessidade (CWE-250), pensado para uma feature futura de "verificar status
  do ambiente" que nunca foi implementada.

## Frontend (React SPA)

Login (sem MFA) · Dashboard (métricas + busca, vetor de SQLi) · Lista de
chamados (tabela filtrável/paginada) · Detalhe do chamado (vetor de IDOR) ·
Novo/editar chamado · Área admin (tabela de usuários + edição de papel;
botão "Exportar PDF") · Perfil.

Convenção intencional: token JWT em `localStorage`, papel do usuário lido do
token no cliente (confiança indevida no front-end) — mantenha esse padrão ao
implementar autenticação/autorização no frontend.

## Rodando o projeto

```bash
docker compose up        # sobe db + backend (3001) + frontend (5173)
```

Backend standalone: `cd backend && npm run dev` (nodemon). Frontend standalone:
`cd frontend && npm run dev` (vite). Variáveis de ambiente do Postgres em
`.env` (ver `.env.example`).

## Convenções

- Nomes de tabelas/colunas em português, seguindo o modelo de dados acima.
- Mensagens de commit e comentários de código podem ser em português,
  consistente com a documentação do projeto.

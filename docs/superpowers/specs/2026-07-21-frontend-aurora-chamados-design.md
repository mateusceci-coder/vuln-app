# Frontend — Aurora Chamados (SPA React) — Design

Data: 2026-07-21 · Status: aprovado · Escopo: item 4 da Especificação (Interface React SPA)

## Contexto e objetivo

O backend (`backend/src/*`) já está **totalmente implementado** com o contrato de API
abaixo. Esta tarefa é o **frontend**: uma SPA React (Vite, porta 5173) que consome essa
API, cobrindo todas as telas do item 4 da spec, com visual "Aurora" (dark-first, gradiente
teal→violeta) — bonito e moderno.

## Regra crítica (CLAUDE.md): as vulnerabilidades são o produto

O frontend **não neutraliza** os vetores plantados no backend. Concretamente:

- **Inputs vão crus** ao backend nas rotas ⚠️: busca (`?busca=` → SQLi), export PDF
  (`?nome=` → command injection), health-check (`host`/`url` → command injection + SSRF),
  `PATCH /usuarios/:id {papel}` (privesc). Sem sanitização/validação client-side desses campos.
- **IDOR visível:** a tela de detalhe exibe telefone/cpf do solicitante que o endpoint
  `GET /chamados/:id` vaza — a UI torna o vazamento observável, não o esconde.
- **Confiança indevida no front-end (intencional):** token JWT no `localStorage`; o **papel é
  lido decodificando o payload do JWT no cliente** (`atob` do segmento do meio, sem verificação)
  e usado só para mostrar/esconder UI de admin/agente. O servidor não checa papel de qualquer
  forma (broken access control é o ponto) — o gate client-side é cosmético e contornável.
- Sem `dangerouslySetInnerHTML`. As vulns plantadas são server-side; o React escapa a saída por
  padrão, então não introduzimos XSS novo ao renderizar dados retornados.

## Contrato de API (lido de `backend/src/routes/*`)

Base: `/api` (Vite faz proxy p/ `http://backend:3001`). Auth via header `Authorization: Bearer <token>`.

**Auth**
- `POST /auth/register` `{nome,email,senha,telefone?,cpf?,empresa?}` → `201 {usuario, token}`
- `POST /auth/login` `{email,senha}` → `200 {token, usuario:{id,nome,email,papel}}` | `401`
- `POST /auth/logout` → `{ok:true}` (stateless; cliente descarta token)
- `GET /auth/me` → `{id,nome,email,papel,telefone,cpf,empresa,criado_em}`

**Usuários** (todas exigem token; nenhuma checa admin no servidor)
- `GET /usuarios` → `[{id,nome,email,papel,telefone,cpf,empresa,criado_em}]`
- `GET /usuarios/:id` → usuário
- `POST /usuarios` `{nome,email,senha,papel?,telefone?,cpf?,empresa?}` → `201`
- `PATCH /usuarios/:id` `{nome?,email?,papel?,telefone?,cpf?,empresa?}` → usuário (⚠️ papel)
- `DELETE /usuarios/:id` → `{ok:true}`

**Chamados**
- `GET /chamados?busca=` → `[{id,titulo,descricao,status,prioridade,solicitante_id,agente_id,criado_em,atualizado_em}]` (⚠️ SQLi)
- `GET /chamados/:id` → chamado + `solicitante_nome/email/telefone/cpf/empresa` (⚠️ IDOR)
- `POST /chamados` `{titulo,descricao?,prioridade?}` → `201` (solicitante = token)
- `PATCH /chamados/:id` `{titulo?,descricao?,status?,prioridade?,agente_id?}` → chamado
- `DELETE /chamados/:id` → `{ok:true}`
- `GET /chamados/:id/pdf?nome=` → `text/plain` (⚠️ command injection via `nome`)

**Comentários** (montado em `/chamados/:id/comentarios`)
- `GET /` → `[{id,chamado_id,autor_id,corpo,interno,criado_em,autor_nome,autor_papel}]`
  (cliente só vê `interno=false`)
- `POST /` `{corpo, interno?}` → `201`

**Anexos** (montado em `/chamados/:id/anexos`)
- `POST /` `multipart/form-data` campo `arquivo` → `201 {id,chamado_id,nome_arquivo,caminho,criado_em}`
- `GET /` → `[anexo]`

**Admin**
- `POST /admin/health-check` `{host?,url?}` → `{host?:{saida|erro}, url?:{status,corpo|erro}}` (⚠️ cmd inj + SSRF)
- `GET /admin/relatorio` → `{totais:{usuarios,chamados,comentarios}, chamados_por_status:[{status,total}], chamados_por_prioridade:[{prioridade,total}]}`

Enums: papel `cliente|agente|admin`; status `aberto|em_andamento|resolvido|fechado`;
prioridade `baixa|media|alta`.

Contas seed (mostradas no login, com preenchimento rápido):
`admin@aurora.local/admin123` · `agente@aurora.local/agente123` ·
`cliente1@exemplo.com/cliente123` · `cliente2@exemplo.com/cliente123`.

## Decisões técnicas

- **Router:** `react-router-dom` (nova dep de frontend).
- **Ícones:** `lucide-react` (nova dep de frontend).
- **Estilo:** CSS puro com design tokens (CSS variables) + CSS Modules por componente. Sem
  Tailwind/UI-lib. Deps novas são só de frontend — não tocam os pacotes vulneráveis do backend.
- **HTTP:** wrapper `fetch` em `lib/api.js` (base `/api`, injeta bearer, trata json/erro, upload).
- **Auth:** `AuthContext` — login/register/logout/me; guarda token no `localStorage`; decodifica papel.
- **Gráficos:** SVG/CSS na mão (relatório é só contagens).

## Estrutura de arquivos

```
frontend/
  index.html                 # + link Space Grotesk/Inter/JetBrains Mono (Google Fonts), title/lang
  src/
    main.jsx                 # BrowserRouter + AuthProvider + rotas
    index.css                # tokens (dark+light), reset, base, utilitários
    lib/api.js               # fetch wrapper (get/post/patch/del/upload) + token
    lib/format.js            # datas, labels de status/prioridade/papel
    auth/AuthContext.jsx     # estado auth + decodifica papel do JWT
    components/
      AppShell.jsx           # layout protegido: Sidebar + Topbar + <Outlet/>
      Sidebar.jsx  Topbar.jsx (toggle tema + menu usuário)
      ProtectedRoute.jsx     # sem token → /login; gate cosmético de admin/agente
      ui/ Button Card Input Select Textarea Badge Modal Table Spinner EmptyState Toast
    pages/
      Login.jsx  Register.jsx
      Dashboard.jsx          # cards de métrica + busca global (SQLi)
      Chamados.jsx           # tabela filtrável + paginação client-side
      ChamadoDetalhe.jsx     # solicitante(IDOR), comentários, anexos, PDF, ações de agente
      ChamadoForm.jsx        # novo/editar
      Admin.jsx              # usuários + editar papel; "Verificar ambiente"; relatório
      Perfil.jsx  NotFound.jsx
```

Rotas: `/login`, `/register` (públicas); `/` → `/dashboard`; `/dashboard`, `/chamados`,
`/chamados/novo`, `/chamados/:id`, `/chamados/:id/editar`, `/admin`, `/perfil`, `*` → 404.

## Sistema visual (Aurora, dark-first)

Tokens (CSS variables em `:root`, override em `[data-theme="light"]`; tema persiste no localStorage):

- **Gradiente assinatura:** `linear-gradient(135deg, #2dd4bf, #8b5cf6)` (teal→violeta) em botões
  primários, logo e glows radiais sutis no fundo do shell.
- **Dark:** bg `#0a0b0f` (+ glows radiais teal/violeta a baixa opacidade); superfícies translúcidas
  `rgba(255,255,255,.03–.05)` com borda `rgba(255,255,255,.08)`; texto `#e7e9ee` / muted `#9aa1ad`.
- **Light:** bg `#f6f7fb`; superfície `#fff`; borda `rgba(10,12,20,.08)`; texto `#0f1220` / muted `#5b6472`.
- **Semântica status:** aberto `#3b82f6` · em_andamento `#f59e0b` · resolvido `#22c55e` · fechado `#6b7280`.
- **Semântica prioridade:** baixa `#64748b` · media `#f59e0b` · alta `#ef4444`.
- **Raio:** 8/12/16/20. **Espaçamento:** escala 4/8/12/16/24/32/48. **Sombra:** suave + glow no accent.
- **Tipografia:** display **Space Grotesk** (com restrição) + body **Inter** (tabelas densas) + **JetBrains Mono** para IDs/CPF e os painéis "terminal" (saída do export PDF / health-check).
- **Layout:** sidebar fixa à esquerda + topbar (busca/toggle tema/usuário) + área de conteúdo.

## Telas → API + vetores

1. **Login** — form email/senha; card com 4 contas seed + botão "preencher"; link p/ registro. → `POST /auth/login`.
2. **Register** — auto-cadastro cliente (nome/email/senha/telefone/cpf/empresa). → `POST /auth/register`.
3. **Dashboard** — cards (totais + por status/prioridade de `/admin/relatorio`); **barra de busca → `GET /chamados?busca=` cru (SQLi)** listando resultados.
4. **Lista de chamados** — tabela com badges status/prioridade, filtro por status, paginação client-side; link p/ detalhe; botão "novo".
5. **Detalhe** — cabeçalho (título/status/prioridade); **bloco do solicitante com telefone/cpf (IDOR visível)**; descrição; **thread de comentários** (badge "interno" quando `interno=true`; form de novo comentário, com toggle "interno" p/ agente/admin); **anexos** (lista + upload multipart); **"Exportar PDF"** com campo `nome` (→ `?nome=` cru, command injection) exibindo o texto retornado; **ações de agente/admin**: mudar status/prioridade, atribuir agente. → `GET/PATCH /chamados/:id`, comentários, anexos, pdf.
6. **Novo/editar chamado** — form título/descrição/prioridade. → `POST` / `PATCH /chamados/:id`.
7. **Admin** (nav visível só p/ papel admin — gate cosmético) — **tabela de usuários** com telefone/cpf/papel e **editor de papel inline (privesc via `PATCH`)**, criar/remover; painel **"Verificar ambiente"** com campos `host` e `url` crus exibindo a saída (**cmd inj + SSRF**); resumo do relatório. → `/usuarios`, `/admin/*`.
8. **Perfil** — dados pessoais do usuário logado, editar. → `GET /auth/me`, `PATCH /usuarios/:id`.

## Verificação

1. `docker compose up -d --build` → backend (3001) + db + front (5173); `GET /api/health` = `db: connected`.
2. Fluxo: registrar/login → recebe JWT; dashboard carrega métricas.
3. Vetores acessíveis pela UI: busca `' OR '1'='1` retorna tudo; detalhe de chamado de outro cliente mostra telefone/cpf; export PDF com `nome=x;id;`; health-check `host=127.0.0.1; id` e `url=http://169.254.169.254/`; editar papel de cliente→admin na área admin.
4. Checar renderização/tema no painel de Browser.

## Fora de escopo

Backend (já pronto), infra/deploy (itens 5–6), testes automatizados de frontend.

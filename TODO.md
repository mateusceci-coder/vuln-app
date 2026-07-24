# TODO — decisões de laboratório pendentes

Itens de design do laboratório de segurança que foram discutidos mas ainda
não implementados. Ver também `docs/superpowers/` e a memória de sessões
anteriores para decisões já fechadas (ex.: SSRF via axios, slopsquat
`express-audit-log`).

## 1. Express CVE-2024-29041 (open redirect) — descartado, não será explorado

**Decisão (2026-07-24):** não vamos criar uma rota/vetor pra explorar essa
CVE. Fica só na tabela de "Dependências vulneráveis conhecidas" do
`README.md` (detectável via Trivy/SCA, sem exploração ativa no app) — mesmo
tratamento que a linha do `express` já tinha antes dessa discussão. Segue o
histórico da discussão abaixo, caso o assunto volte no futuro.

<details>
<summary>Histórico da discussão (encerrada)</summary>

**Problema original:** das 4 dependências vulneráveis fixadas (jsonwebtoken, express,
axios, multer), as outras 3 já têm vetor real e documentado no catálogo do
`README.md` (itens 6, 7, 8). O express (CVE-2024-29041, CWE-601) só aparece
na tabela de CVEs (`README.md`, seção "Dependências vulneráveis conhecidas")
— não há nenhum `res.redirect()`/`res.location()` no código hoje, então não
existe forma de explorar essa CVE especificamente no app atual.

**Trava técnica identificada:** `res.redirect()` só é explorável numa
requisição GET **navegada pelo browser** (clique em link/redirect de
verdade). O login hoje é `POST /api/auth/login`, chamado via `fetch`/axios
pelo SPA — resposta JSON, token guardado em `localStorage` (convenção do
`CLAUDE.md`). Não há navegação de browser nesse fluxo pra pendurar o
`res.redirect()` sem quebrar a arquitetura atual.

**Opções em aberto (nenhuma decidida ainda):**
1. `GET /api/auth/logout?next=` — logout vira link navegável de verdade
   (`<a href="...">Sair</a>`); servidor invalida sessão/token e redireciona
   pro `next`. Encaixe técnico correto pro CVE, ainda que menos "clássico"
   como cenário de phishing do que um redirect pós-login.
2. Nova rota GET dedicada (ex.: confirmação de conta por e-mail, callback de
   SSO) que hoje não existe na especificação — mais fiel ao cenário clássico
   de "phishing pós-clique em link", mas adiciona feature nova fora do
   escopo atual da spec.
3. Mover o redirect pro client-side (React lê `next` da query e faz
   `window.location = next` após login) — deixaria de ser o CVE do Express;
   viraria DOM-based open redirect no frontend (CWE-601 genérico, sem CVE de
   dependência nenhuma).

**Próximo passo (histórico, não se aplica mais):** decidir qual opção seguir
antes de implementar.

</details>

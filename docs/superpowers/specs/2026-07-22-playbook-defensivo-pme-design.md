# Playbook defensivo para PMEs — Aurora Chamados

**Data:** 2026-07-22
**Status:** Aprovado, aguardando plano de implementação

## Contexto

O laboratório Aurora Chamados hoje é uma VM-alvo deliberadamente vulnerável +
documentação (Notion) + a cadeia defensiva conceitual (Trivy/Wazuh/Suricata).
A pergunta que originou este spec: como transformar o lab em algo genuinamente
útil para alguém, sem virar produto e sem vender.

Direção escolhida (entre 4 avaliadas): **playbook defensivo para PMEs** — o lab
vira a *prova reproduzível* por trás de um kit livre e reutilizável de defesa.

Decisões de escopo já fixadas com o autor:

- **Leitor primário:** a dev shop que constrói com IA e hospeda pro cliente (o
  protagonista da tese "código de IA + dependências sem revisão como vetor
  central de comprometimento em PMEs"). Não é o dono não-técnico nem só o
  sysadmin.
- **Formato:** balanceado — guia curto e legível **+** artefatos que rodam.
- **Detecções:** construídas do zero (hoje são conceituais, só no Notion).
- **Approach A ("shift-left primeiro"):** centro de gravidade no que a dev shop
  controla (CI/Trivy, checklist de código seguro, supply-chain). Wazuh/Suricata
  entram como camada secundária de runtime.

## Objetivo

Entregar, dentro deste repo, um diretório `playbook/` que uma dev shop pode
adotar hoje para se defender exatamente dos vetores que o lab planta, com:

1. Um guia curto em português ancorado numa **tabela-espinha** que mapeia cada
   vulnerabilidade plantada → origem (padrão de IA / dep sem revisão) → controle
   shift-left → detecção runtime → técnica MITRE.
2. Artefatos shift-left que rodam e são **validáveis neste repo** (Trivy no CI,
   pre-commit, checklist referenciando o código real).
3. Uma camada de detecção runtime (Wazuh/Suricata) **autorada e revisada aqui**,
   com runbooks para o autor validar o comportamento no lab.

## Não-objetivos

- **Não corrigir** as vulnerabilidades do app — elas são o produto do lab.
- **Não implementar** agora o backdoor `express-audit-log` nem o SSRF-kb (estão
  em [2026-07-22-ssrf-realista-e-supply-chain-design.md](2026-07-22-ssrf-realista-e-supply-chain-design.md),
  aguardando implementação). O playbook os referencia como estado-alvo.
- **Não adicionar** testes automatizados (o projeto não usa framework de teste;
  verificação é manual, como o resto do repo).
- **Não** transformar isto em produto/SaaS nem construir a versão segura
  deployável do app (Approach D, descartado).

## Estrutura

```
playbook/
  README.md              # porta de entrada: a tese, pra quem é, como usar, a tabela-espinha
  guia/
    01-o-vetor.md        # código de IA + deps sem revisão como vetor em PMEs (as 9 vulns = evidência)
    02-checklist.md      # checklist de código seguro para dev assistido por IA
    03-supply-chain.md   # por que a SCA pega os 4 CVEs mas NÃO pega o backdoor slopsquattado
    04-runtime.md        # visão geral da camada de rede de segurança em runtime (Wazuh/Suricata)
  ci/
    trivy.yaml           # config do Trivy (severidade, ignore-unfixed=false, exit-code)
    github-actions.yml   # workflow que roda Trivy no backend e falha nos 4 CVEs
    pre-commit.yaml      # scan de segredo (pega a história do .env versionado)
  deteccao/
    wazuh/
      local_rules.xml    # regras custom
      README.md          # como instalar, o que cada regra pega, runbook de validação
    suricata/
      aurora.rules       # assinaturas
      README.md          # como carregar, o que cada assinatura pega, runbook de validação
```

## A espinha (organizador de tudo)

Uma única tabela no `playbook/README.md` reusa direto o catálogo do repo/Notion.
Cada uma das vulnerabilidades plantadas é uma linha; o guia, os configs de CI e
as regras de detecção todos penduram nela.

Colunas: **Vuln no app · Origem (padrão de IA / dep sem revisão) · Controle
shift-left que pega · Detecção runtime se escapar · Técnica MITRE.**

Linhas (mínimo):

1. SQLi (`GET /api/chamados?busca=`) — concatenação de string
2. IDOR (`GET /api/chamados/:id`) — falta de checagem de dono
3. Broken access control (`GET /api/usuarios`) — falta de checagem de admin
4. Escalonamento de privilégio (`PATCH /api/usuarios/:id`) — aceita `papel`
5. Command injection (`GET /api/chamados/:id/pdf`) — `exec` com input
6. SSRF (`GET /api/admin/kb?ref=`, estado-alvo) — bypass de baseURL do axios
7. DoS de upload (multer) — sem limite de tamanho/quantidade
8. Auth fraca (login) — MD5, JWT sem `algorithms`, segredo fraco, sem rate-limit
9. Backdoor slopsquattado (`express-audit-log`, estado-alvo) — dep sem revisão

Mais as 4 dependências com CVE (jsonwebtoken, express, axios, multer) na coluna
"controle shift-left" via Trivy.

## Unidade 1 — Núcleo shift-left (validável neste repo)

### 1a. `guia/02-checklist.md` — checklist de código seguro para dev com IA

Um item por vulnerabilidade, no formato **padrão inseguro (o que a IA gerou) →
correção → ponteiro pro arquivo real**. O gancho: são exatamente os padrões que
uma IA tende a emitir sem revisão.

- Query parametrizada, nunca concatenar → `backend/src/routes/chamados.js`
- Autorização por dono **no servidor** → `.../chamados/:id` (IDOR)
- Autorização por papel **no servidor**, não confiar no cliente →
  `.../usuarios` + papel lido do JWT no front
- Não permitir que o cliente altere campos sensíveis (`papel`) → `PATCH`
- Nunca passar input do usuário pra shell → `.../chamados/:id/pdf`
- Validar/allowlist destino de requisição de saída; cuidado com `baseURL` do
  axios → `.../admin/kb`
- Limitar tamanho/quantidade de upload → multer
- Hash forte (argon2/bcrypt) + salt · JWT com `algorithms` fixo · segredo forte
  via env · rate-limit no login → `backend/src/auth.js`
- Revisar toda dependência nova (nome, downloads, mantenedor, código) antes de
  adicionar; lockfile + `npm ci` → `express-audit-log`

### 1b. `ci/` — Trivy no pipeline + pre-commit

- `trivy.yaml` + `github-actions.yml`: escaneia `backend/package-lock.json`,
  **falha o build** nos 4 CVEs (severidade HIGH/CRITICAL, `exit-code: 1`).
- `pre-commit.yaml`: scan de segredo (Trivy secret ou gitleaks) para a história
  do `.env` versionado. Mínimo, sem inchar.

### 1c. `guia/03-supply-chain.md` — o clímax da tese

Slopsquatting (IA alucina nome plausível → atacante registra) → **por que a SCA
não pega**: sem CVE público, sem sinal. Demonstrado com `express-audit-log`: o
Trivy lista os 4 CVEs mas fica cego pro backdoor. Fecha com as guardas práticas
da dev shop (revisão de dep, allowlist, lockfile + `npm ci`) e faz a ponte pro
runtime (Unidade 2).

**Depende de:** para a demonstração ao vivo "Trivy não pega o slopsquat", a dep
`express-audit-log` precisa existir no código (hoje não existe). O texto é
escrito contra o estado-alvo; a validação ao vivo desse demo específico fica
marcada como pendente até o feature entrar.

## Unidade 2 — Camada de runtime (autorada aqui, validada no lab)

Não cobre as 9 vulns por igual — foca onde runtime é o layer certo ou o único.
Prioridade:

1. **Backdoor slopsquattado** — SCA é cega, runtime é o **único** net. Wazuh:
   conexão de saída anômala no startup (beacon C2) / FIM sobre `vendor/`.
   Suricata: tráfego pro IP do C2. É o clímax da tese pelo lado defensivo.
2. **Command injection RCE** (`/pdf`) — Wazuh: `node` gerando processo-filho
   suspeito (`sh -c`, `whoami`, `curl`) via auditd. Suricata: exfiltração.
3. **SSRF pra rede interna/metadata** — Suricata: saída pra `169.254.169.254` /
   host interno.
4. **Brute force no login** — Wazuh: N falhas do mesmo IP (regra sobre o log de
   auth do app).

**Honestidade sobre limites:** para SQLi/IDOR/privesc, a detecção runtime é
secundária e ruidosa (assinatura de `UNION SELECT`/`OR 1=1` é burlável) — o
playbook diz isso explicitamente e aponta que ali o *fix* é shift-left, não a
detecção.

Cada regra vem anotada com: o que pega · qual ataque do lab dispara · técnica
MITRE · **runbook de validação** (o `curl`/ataque exato + o alerta esperado).

## Fluxo de dados (visão geral)

```
Dev shop constrói com IA
   │
   ├─ shift-left (Unidade 1) ──▶ checklist + Trivy/CI + pre-commit
   │       (pega: 4 CVEs, padrões inseguros de código)
   │       (NÃO pega: backdoor slopsquattado — sem CVE)
   │
   └─ se algo escapa pra runtime (Unidade 2) ──▶ Wazuh + Suricata
           (pega: beacon C2, RCE, SSRF interno, brute force)
```

## Validação

**Validável neste repo (prova real entregue no fim):**
- Trivy rodando contra o backend, mostrando os 4 CVEs e o build falhando.
- Sintaxe das regras (Suricata `-T`; XML do Wazuh bem-formado).
- Checklist apontando para arquivos/linhas que de fato existem.

**Validável só no lab (pelo autor, via runbooks):**
- Comportamento das regras Wazuh/Suricata contra os ataques reais.
- O demo "Trivy não pega o slopsquat" (pendente a dep entrar no código).

**Pronto quando:** os 4 docs do guia escritos (PT, tabela-espinha com as 9+
linhas) · `ci/` com Trivy + workflow + pre-commit · `deteccao/` com regras
Wazuh + Suricata anotadas + runbooks · `playbook/README.md` amarrando tudo.

## Riscos / decisões em aberto já resolvidas

- **Localização:** dentro deste repo (`playbook/`), não repo separado — o valor
  vem de referenciar o código vulnerável real como exemplo concreto.
- **Idioma:** português, consistente com o resto do projeto.
- **Detecções "do zero" vs. infra fora do repo:** resolvido pela divisão de
  validação acima — sintaxe aqui, comportamento no lab via runbook.
- **Sequência com o feature slopsquat/SSRF-kb:** o playbook é escrito contra o
  estado-alvo; a validação ao vivo do demo de slopsquat aguarda a implementação
  daquele feature, sem bloquear o resto.

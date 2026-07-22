# Playbook defensivo para PMEs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um diretório `playbook/` (guia em PT + artefatos que rodam) que uma dev shop que constrói com IA pode adotar para se defender exatamente dos vetores que o lab Aurora Chamados planta.

**Architecture:** Approach A ("shift-left primeiro"). O centro de gravidade é o que a dev shop controla — checklist de código seguro, Trivy no CI, guarda de supply-chain — validável neste repo. Uma camada de detecção runtime (Wazuh/Suricata) entra como rede de segurança secundária, autorada aqui e validada pelo autor no lab via runbooks. Tudo pendura numa "tabela-espinha" que mapeia cada vulnerabilidade → origem → controle shift-left → detecção runtime → MITRE.

**Tech Stack:** Markdown (docs em PT), Trivy (SCA), GitHub Actions, pre-commit/gitleaks, Wazuh (regras XML), Suricata (regras). Verificação **manual via CLI/docker** — o projeto não usa framework de teste.

## Global Constraints

- **Idioma:** português em todo o `playbook/`.
- **NÃO corrigir** as vulnerabilidades do app — elas são o produto do lab.
- **NÃO atualizar** as 4 deps fixadas: `express@4.19.1`, `jsonwebtoken@8.5.1`, `axios@1.7.3`, `multer@2.0.1`.
- **O refactor SSRF-kb já está implementado** (commit `56b41e6`, posterior a este plano): o código real hoje é `GET /api/admin/kb?ref=` (`backend/src/routes/admin.js`), não mais `/health-check`. O `exec`/`ping` do antigo health-check foi removido — não há mais command injection nessa rota, só SSRF via bypass do `baseURL` do axios (linha 20).
- **NÃO adicionar** testes automatizados. Verificação é manual/CLI, como o resto do repo.
- **Tudo vive em** `playbook/` (novo diretório na raiz).
- **Ferramentas de verificação neste ambiente:** `docker` ✔ (usar imagens `aquasec/trivy` e `jasonish/suricata`), `xmllint` ✔ (`/opt/lampp/bin/xmllint`), `node`/`npm` ✔. `trivy` e `suricata` **não** estão instalados nativamente — usar via docker.
- **Commits frequentes:** um commit por task. Mensagens em PT.

---

### Task 1: Esqueleto + README + tabela-espinha + guia do vetor

**Files:**
- Create: `playbook/README.md`
- Create: `playbook/guia/01-o-vetor.md`

**Interfaces:**
- Produces: a **tabela-espinha** (no `README.md`) que as Tasks 2–6 referenciam. Colunas fixas: `Vuln no app | Origem | Controle shift-left | Detecção runtime | MITRE`.

- [ ] **Step 1: Criar `playbook/README.md`**

Conteúdo (porta de entrada):
1. Título + 1 parágrafo: o que é (playbook defensivo derivado do lab Aurora Chamados), pra quem é (**a dev shop que constrói com IA e hospeda pro cliente**), o que NÃO é (não é produto; o app-alvo continua deliberadamente vulnerável).
2. Seção "Como usar": leia `guia/` na ordem 01→04; aplique `ci/` no seu pipeline; use `deteccao/` se você também hospeda.
3. Seção "A espinha" com esta tabela **completa** (preencher todas as células; MITRE entre parênteses):

| Vuln no app | Origem (padrão de IA / dep sem revisão) | Controle shift-left | Detecção runtime se escapar | MITRE |
|---|---|---|---|---|
| SQLi — `GET /api/chamados?busca=` (`backend/src/routes/chamados.js:25`) | concatenação de string sugerida por IA | checklist: query parametrizada (`$1`) | Suricata (ruidoso/burlável): assinatura `UNION SELECT`/`OR 1=1` | T1190 |
| IDOR — `GET /api/chamados/:id` (`backend/src/routes/chamados.js`) | falta de checagem de dono | checklist: autorização por dono no servidor | — (fix é shift-left) | T1213 |
| Broken access control — `GET /api/usuarios` (`backend/src/routes/usuarios.js`) | falta de checagem de admin | checklist: autorização por papel no servidor | — (fix é shift-left) | T1078 |
| Escalonamento de privilégio — `PATCH /api/usuarios/:id` (`backend/src/routes/usuarios.js`) | aceita alterar `papel` sem checagem | checklist: não deixar cliente alterar campo sensível | Wazuh: alteração de papel em log de app | T1078 |
| Command injection — `GET /api/chamados/:id/pdf` (`backend/src/routes/chamados.js`) | `exec` com input do usuário | checklist: nunca passar input pra shell | Wazuh: `node` gerando `sh`/`whoami`/`curl` (auditd) | T1059 |
| SSRF — `GET /api/admin/kb?ref=` (`backend/src/routes/admin.js:20`), bypass de `baseURL` do axios (CVE-2024-39338) | `ref` repassado direto ao axios; dep sem revisão | checklist: allowlist de destino de saída; Trivy pega o CVE do axios | Suricata: saída pra `169.254.169.254` / host interno | T1190 |
| DoS de upload — `POST /api/chamados/:id/anexos` (`backend/src/routes/anexos.js`) | multer sem `limits` | checklist: limitar tamanho/quantidade; Trivy pega CVE-2025-47944 | Wazuh: pico de disco/uso de recurso | T1499 |
| Auth fraca — `POST /api/auth/login` (`backend/src/auth.js:5,9,29`) | MD5 sem salt, JWT sem `algorithms`, segredo `'aurora'`, sem rate-limit | checklist: argon2 + JWT `algorithms` + segredo via env + rate-limit; Trivy pega CVE do jsonwebtoken | Wazuh: brute force (N falhas/IP) | T1110 |
| Backdoor slopsquattado — `express-audit-log` (`backend/vendor/express-audit-log/index.js`, wired em `backend/src/index.js:14,21`) — **já no código** | dep "sugerida por IA" sem revisão | checklist: revisar toda dep nova; **Trivy NÃO pega** (sem CVE) | Wazuh: FIM em `vendor/` + conexão de saída no startup; Suricata: beacon C2 pra `192.0.2.10/collect` | T1071 / T1195 |

4. Nota final: as 4 deps com CVE (jsonwebtoken, express, axios, multer) são a coluna "controle shift-left via Trivy"; a dep maliciosa (`express-audit-log`) é o contraste — só runtime pega.

- [ ] **Step 2: Criar `playbook/guia/01-o-vetor.md`**

Narrativa curta (≤ ~400 palavras) que expande a tese: *código gerado por IA + dependências sem revisão = vetor central de comprometimento em PMEs*. Estrutura:
- Por que PMEs (sem AppSec dedicado, terceirizam pra dev shops pequenas, prazo curto → IA gera, ninguém revisa).
- As 9 vulns do app como **evidência concreta** — referenciar a tabela-espinha do README, sem repeti-la.
- O ponto que amarra: as 4 primeiras são "código inseguro que a IA emite"; a última (backdoor) é "dependência que a IA sugere e ninguém audita".
- Ancorar em fontes reais já citadas no projeto (DBIR, IBM Cost of a Data Breach) — uma linha, sem inventar números.

- [ ] **Step 3: Verificar — os ponteiros da tabela resolvem**

```bash
cd /home/mateus/projects/vulnerable-app-node
for f in backend/src/routes/chamados.js backend/src/routes/usuarios.js \
         backend/src/routes/admin.js backend/src/routes/anexos.js \
         backend/src/auth.js backend/vendor/express-audit-log/index.js \
         backend/src/index.js; do
  test -f "$f" && echo "OK  $f" || echo "FALTA $f"
done
```
Expected: sete linhas `OK` (nenhum `FALTA`).

- [ ] **Step 4: Commit**

```bash
git add playbook/README.md playbook/guia/01-o-vetor.md
git commit -m "playbook: README + tabela-espinha + guia do vetor"
```

---

### Task 2: Checklist de código seguro para dev com IA

**Files:**
- Create: `playbook/guia/02-checklist.md`

**Interfaces:**
- Consumes: a tabela-espinha (Task 1) — cada item do checklist corresponde a uma linha.

- [ ] **Step 1: Criar `playbook/guia/02-checklist.md`**

Um item por vulnerabilidade, **cada um no formato**: `☐ Regra` → *Padrão inseguro (o que a IA gerou)* (com trecho curto real) → *Correção* → *Onde no app*. Itens (usar exatamente estes ponteiros):

1. **Query parametrizada, nunca concatenar.** Inseguro: `` `... ILIKE '%${busca}%'` `` (`backend/src/routes/chamados.js:25`). Correção: placeholders `$1` + array de params no `pool.query`.
2. **Autorização por dono no servidor.** Inseguro: `GET /api/chamados/:id` retorna qualquer chamado (`backend/src/routes/chamados.js`). Correção: `WHERE solicitante_id = $usuario` (ou 403).
3. **Autorização por papel no servidor.** Inseguro: `GET /api/usuarios` só exige JWT, não papel (`backend/src/routes/usuarios.js`). Correção: checar `req.usuario.papel === 'admin'` no servidor — nunca confiar no papel lido do token no front.
4. **Cliente não altera campo sensível.** Inseguro: `PATCH /api/usuarios/:id` aceita `papel` (`backend/src/routes/usuarios.js`). Correção: allowlist de campos editáveis; `papel` só via rota admin.
5. **Nunca passar input do usuário pra shell.** Inseguro: `exec(\`echo "Chamado: ${titulo}" > /tmp/${nome}.pdf ...\`)` (`backend/src/routes/chamados.js:104`). Correção: `execFile`/`spawn` com args array; validar contra allowlist.
6. **Allowlist de destino em requisições de saída.** Inseguro: `kb.get(ref)` com `ref` do usuário repassado direto ao axios (`backend/src/routes/admin.js:20`); o `baseURL` do axios ≤1.7.3 é burlável por `ref` protocol-relative (CVE-2024-39338). Correção: allowlist de host + validar que a URL resolvida fica no destino esperado; atualizar axios.
7. **Limitar upload.** Inseguro: multer sem `limits` (`backend/src/routes/anexos.js`). Correção: `multer({ limits: { fileSize, files } })` + atualizar multer.
8. **Auth forte.** Inseguro: MD5 sem salt (`backend/src/auth.js:9`), `jwt.verify` sem `algorithms` (`backend/src/auth.js:29`), segredo `'aurora'` (`backend/src/auth.js:5`), sem rate-limit no login. Correção: argon2/bcrypt + salt; `jwt.verify(t, s, { algorithms: ['HS256'] })`; segredo forte só via env (falhar se ausente); rate-limit no `/login`.
9. **Revisar toda dependência nova.** Inseguro: `express-audit-log` adicionado sem auditoria (`backend/vendor/express-audit-log/`) — tem beacon C2 + backdoor de auth. Correção: antes de adicionar, checar nome (typo/slopsquat), downloads, mantenedor, idade, e **ler o `index.js`**; `npm ci` + lockfile; a SCA (Task 3) **não** substitui essa revisão.

Cabeçalho do doc: uma frase dizendo que esses são exatamente os padrões que uma IA tende a emitir sem revisão.

- [ ] **Step 2: Verificar — todos os arquivos citados existem**

```bash
cd /home/mateus/projects/vulnerable-app-node
grep -oE 'backend/src/[a-zA-Z./]+\.js|backend/vendor/[a-zA-Z./-]+' playbook/guia/02-checklist.md \
  | sort -u | while read f; do test -e "$f" && echo "OK  $f" || echo "FALTA $f"; done
```
Expected: só linhas `OK`.

- [ ] **Step 3: Commit**

```bash
git add playbook/guia/02-checklist.md
git commit -m "playbook: checklist de código seguro para dev com IA"
```

---

### Task 3: Trivy no CI + pre-commit (núcleo validável)

**Files:**
- Create: `playbook/ci/trivy.yaml`
- Create: `playbook/ci/github-actions.yml`
- Create: `playbook/ci/pre-commit.yaml`

**Interfaces:**
- Produces: a saída do Trivy (4 CVEs, sem `express-audit-log`) que a Task 4 referencia como demo.

- [ ] **Step 1: Criar `playbook/ci/trivy.yaml`**

```yaml
# Config do Trivy para o pipeline da dev shop.
# Uso local: trivy fs --config playbook/ci/trivy.yaml backend
scan:
  scanners:
    - vuln
    - secret
severity:
  - HIGH
  - CRITICAL
vulnerability:
  ignore-unfixed: false
exit-code: 1
```

- [ ] **Step 2: Criar `playbook/ci/github-actions.yml`**

```yaml
# Copie para .github/workflows/sca.yml no seu projeto.
name: sca-trivy
on: [push, pull_request]
jobs:
  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Trivy SCA (falha em HIGH/CRITICAL)
        uses: aquasecurity/trivy-action@0.24.0
        with:
          scan-type: fs
          scan-ref: backend
          scanners: vuln,secret
          severity: HIGH,CRITICAL
          ignore-unfixed: false
          exit-code: '1'
```

- [ ] **Step 3: Criar `playbook/ci/pre-commit.yaml`**

```yaml
# Copie para .pre-commit-config.yaml. Pega segredos antes do commit
# (ex.: a história do .env versionado com JWT_SECRET/credenciais).
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks
```

- [ ] **Step 4: Verificar — Trivy acha os 4 CVEs e NÃO acha o backdoor (prova real, via docker)**

```bash
cd /home/mateus/projects/vulnerable-app-node
docker run --rm -v "$PWD":/src aquasec/trivy:latest fs \
  --scanners vuln --severity HIGH,CRITICAL --exit-code 1 \
  /src/backend/package-lock.json ; echo "exit=$?"
```
Expected: relatório listando `jsonwebtoken` (CVE-2022-23529/23540/23541), `express` (CVE-2024-29041), `axios` (CVE-2024-39338), `multer` (CVE-2025-47944); **nenhuma** linha para `express-audit-log`; `exit=1`.

- [ ] **Step 5: Commit**

```bash
git add playbook/ci/
git commit -m "playbook: Trivy no CI + pre-commit (gitleaks)"
```

---

### Task 4: Guia de supply-chain (o clímax da tese)

**Files:**
- Create: `playbook/guia/03-supply-chain.md`

**Interfaces:**
- Consumes: a saída do Trivy da Task 3 (o demo "4 CVEs, sem backdoor").

- [ ] **Step 1: Criar `playbook/guia/03-supply-chain.md`**

Estrutura:
1. **Slopsquatting**: IA alucina um nome de pacote plausível → atacante registra esse nome com payload. `express-audit-log` é o exemplo do lab (nome de "helper de auditoria").
2. **Por que a SCA (Trivy) não pega**: sem CVE público, não há o que correlacionar. Colar a saída resumida da Task 3 mostrando os 4 CVEs e a **ausência** de `express-audit-log`, com o comando reproduzível.
3. **O que o pacote realmente faz** (referenciar `backend/vendor/express-audit-log/index.js`): fachada `auditLog()` benigna + backdoor no header `X-Debug: trace-9f2c` (forja JWT admin) + beacon C2 no startup pra `http://192.0.2.10/collect`. Uma linha ligando cada comportamento à detecção runtime (Task 5/6).
4. **Guardas práticas da dev shop**: revisão de dep (checklist item 9), allowlist/registry interno, `npm ci` + lockfile, fixar versões, e a regra de ouro — **a SCA é necessária mas não suficiente**; a auditoria humana da dep é o controle real. Ponte pra Seção 04 (runtime).

- [ ] **Step 2: Verificar — o comando do demo reproduz**

Rodar o comando do Step 4 da Task 3 e confirmar que o texto colado no doc bate com a saída real (4 CVEs presentes, `express-audit-log` ausente).

- [ ] **Step 3: Commit**

```bash
git add playbook/guia/03-supply-chain.md
git commit -m "playbook: guia de supply-chain (slopsquat vs SCA)"
```

---

### Task 5: Camada runtime — visão geral + regras Wazuh

**Files:**
- Create: `playbook/guia/04-runtime.md`
- Create: `playbook/deteccao/wazuh/local_rules.xml`
- Create: `playbook/deteccao/wazuh/README.md`

**Interfaces:**
- Consumes: a tabela-espinha (coluna "detecção runtime").

- [ ] **Step 1: Criar `playbook/guia/04-runtime.md`**

Visão geral (≤ ~350 palavras): a camada runtime é a **rede de segurança quando o shift-left falha** — e o único net pro backdoor (SCA é cega). Onde runtime é o herói, em ordem: (1) backdoor/beacon C2, (2) command injection RCE, (3) SSRF pra rede interna/metadata, (4) brute force. **Honestidade explícita:** pra SQLi/IDOR/privesc, detecção runtime é secundária e ruidosa (assinatura burlável) — ali o fix é shift-left. Apontar pra `deteccao/wazuh/` e `deteccao/suricata/`.

- [ ] **Step 2: Criar `playbook/deteccao/wazuh/local_rules.xml`**

```xml
<!-- Regras custom do Wazuh para o lab Aurora Chamados. IDs no range local (100000+). -->
<group name="aurora,attack,">

  <!-- Falha de login do app (base pro brute force). Requer o log do app
       decodificado como JSON com campos url/status — ver README. -->
  <rule id="100101" level="3">
    <decoded_as>json</decoded_as>
    <field name="url">/api/auth/login</field>
    <field name="status">401</field>
    <description>Aurora: falha de login</description>
  </rule>

  <!-- Brute force: >=6 falhas do mesmo IP em 60s. -->
  <rule id="100102" level="10" frequency="6" timeframe="60">
    <if_matched_sid>100101</if_matched_sid>
    <same_source_ip />
    <description>Aurora: possível brute force no login (>=6 falhas/60s do mesmo IP)</description>
    <mitre>
      <id>T1110</id>
    </mitre>
  </rule>

  <!-- Command injection RCE: o processo node gera shell/binário de recon.
       Requer auditd + regra de execve encaminhada ao Wazuh — ver README. -->
  <rule id="100110" level="12">
    <if_group>audit_command</if_group>
    <field name="audit.execve.a0">sh|bash|ping|whoami|id|curl|nc</field>
    <description>Aurora: processo suspeito derivado do backend (possível command injection RCE)</description>
    <mitre>
      <id>T1059</id>
    </mitre>
  </rule>

</group>
```

- [ ] **Step 3: Criar `playbook/deteccao/wazuh/README.md`**

Conteúdo:
- **Instalação:** copiar as regras pra `/var/ossec/etc/rules/local_rules.xml` no manager; reiniciar `wazuh-manager`.
- **Pré-requisitos por regra** (por que a validação é no lab): a regra de brute force exige o log do app coletado e decodificado como JSON (campos `url`/`status`); a de RCE exige `auditd` no host com regra de `execve` e o módulo command/auditd do Wazuh ativo; **FIM** sobre `backend/vendor/` e `node_modules/` deve ser adicionado ao `ossec.conf` (`<directories check_all="yes" realtime="yes">`) — incluir o snippet.
- **Runbook de validação (no lab):** para cada regra, o ataque exato e o alerta esperado. Ex. brute force: rodar o loop de `curl` de senhas do README do repo → esperar alerta rule `100102`. RCE: `curl ".../pdf?nome=x;whoami"` → esperar `100110`. FIM: tocar um arquivo em `vendor/` → esperar alerta de integridade.

- [ ] **Step 4: Verificar — XML bem-formado**

```bash
xmllint --noout /home/mateus/projects/vulnerable-app-node/playbook/deteccao/wazuh/local_rules.xml && echo "XML OK"
```
Expected: `XML OK` (sem erros de parse).

- [ ] **Step 5: Commit**

```bash
git add playbook/guia/04-runtime.md playbook/deteccao/wazuh/
git commit -m "playbook: camada runtime (visão geral) + regras Wazuh"
```

---

### Task 6: Regras Suricata + fechamento

**Files:**
- Create: `playbook/deteccao/suricata/aurora.rules`
- Create: `playbook/deteccao/suricata/README.md`

**Interfaces:**
- Consumes: a tabela-espinha (coluna "detecção runtime"); os fatos do backdoor (beacon `192.0.2.10/collect`).

- [ ] **Step 1: Criar `playbook/deteccao/suricata/aurora.rules`**

```
# Regras Suricata para o lab Aurora Chamados. SIDs no range local (1000000+).

# Beacon C2 do backdoor slopsquattado (express-audit-log) — GET http://192.0.2.10/collect no startup.
alert http $HOME_NET any -> any any (msg:"AURORA C2 beacon express-audit-log (slopsquat)"; flow:to_server,established; http.method; content:"GET"; http.uri; content:"/collect"; http.host; content:"192.0.2.10"; classtype:trojan-activity; sid:1000001; rev:1; metadata:mitre_attack T1071;)

# SSRF: acesso ao endpoint de metadata da nuvem a partir do servidor.
alert http $HOME_NET any -> any any (msg:"AURORA SSRF para metadata 169.254.169.254"; flow:to_server; http.host; content:"169.254.169.254"; classtype:attempted-recon; sid:1000002; rev:1; metadata:mitre_attack T1190;)

# SQLi (RUIDOSO / burlável — ver README): payloads clássicos na querystring de /api/chamados.
alert http any any -> $HOME_NET any (msg:"AURORA SQLi payload em /api/chamados (ruidoso)"; flow:to_server; http.uri; content:"/api/chamados"; pcre:"/UNION\s+SELECT|OR\s+\(?1=1/i"; classtype:web-application-attack; sid:1000003; rev:1; metadata:mitre_attack T1190;)
```

- [ ] **Step 2: Criar `playbook/deteccao/suricata/README.md`**

Conteúdo:
- **Instalação:** copiar `aurora.rules` pra `/etc/suricata/rules/`; adicionar `- aurora.rules` em `rule-files:` no `suricata.yaml`; definir `HOME_NET` com a sub-rede da DMZ; `suricata-update` opcional; reiniciar.
- **Nota de honestidade** na regra de SQLi: assinatura de payload é **burlável** (encoding, comentários inline) e ruidosa — serve de alerta best-effort; o controle real é a query parametrizada (checklist item 1).
- **Runbook de validação (no lab):** beacon C2 → subir o backend e observar a tentativa de saída pra `192.0.2.10` no startup → esperar `sid:1000001`. SSRF metadata → `GET /api/admin/kb?ref=//169.254.169.254/...` → esperar `1000002`. SQLi → `curl` do payload `UNION SELECT` do README do repo → esperar `1000003`.

- [ ] **Step 3: Verificar — sintaxe das regras (via docker)**

```bash
cd /home/mateus/projects/vulnerable-app-node
docker run --rm -v "$PWD/playbook/deteccao/suricata":/r jasonish/suricata:latest \
  suricata -T -S /r/aurora.rules -l /tmp ; echo "exit=$?"
```
Expected: teste de configuração conclui carregando 3 regras sem erro de parse (`exit=0`; avisos sobre `HOME_NET` são aceitáveis). Se o `-T` exigir config extra, rodar `suricata -S /r/aurora.rules --engine-analysis -l /tmp` e confirmar que as 3 regras são parseadas.

- [ ] **Step 4: Commit**

```bash
git add playbook/deteccao/suricata/
git commit -m "playbook: regras Suricata (beacon C2, SSRF, SQLi) + runbooks"
```

---

## Validação final (o que fica provado vs. pendente)

**Provado neste repo ao terminar:**
- Trivy lista os 4 CVEs e é cego pro `express-audit-log` (Task 3 Step 4).
- XML do Wazuh bem-formado (Task 5); sintaxe das regras Suricata (Task 6).
- Todos os ponteiros do guia/checklist resolvem pra arquivos reais (Tasks 1–2).

**Pendente de validação no lab (pelo autor, via runbooks):**
- Comportamento das regras Wazuh/Suricata contra os ataques reais (o `/kb` já existe no código; o demo ao vivo do SSRF via `curl` fica pro runbook do Suricata, não bloqueia este plano).

## Self-review (feito na escrita)

- **Cobertura do spec:** README+espinha (Task 1) ✓ · checklist (Task 2) ✓ · Trivy/CI+pre-commit (Task 3) ✓ · supply-chain (Task 4) ✓ · runtime overview+Wazuh (Task 5) ✓ · Suricata (Task 6) ✓. As 9 linhas da espinha estão todas na tabela da Task 1.
- **Placeholders:** nenhum "TBD/TODO"; configs e regras têm conteúdo completo; docs de prosa têm outline concreto + ponteiros exatos (não "adicione conteúdo apropriado").
- **Consistência de tipos/nomes:** ponteiros de arquivo conferidos contra o código real (`admin.js:20`, `auth.js:5,9,29`, `chamados.js:25,104`, `vendor/express-audit-log/index.js`, `index.js:14,21`); IDs de regra sem colisão (Wazuh 100101/100102/100110; Suricata 1000001–1000003).

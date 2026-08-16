# Playbook Defensivo — Aurora Chamados

Este é um playbook defensivo derivado do laboratório **Aurora Chamados**: um
portal de chamados deliberadamente vulnerável, construído para exercitar a
tese de que **código gerado por IA sem revisão + dependências não auditadas**
são o vetor central de comprometimento em PMEs. Ele foi escrito para a **dev
shop que constrói esse tipo de aplicação com apoio de IA e hospeda o resultado
para o cliente** — é o guia que essa equipe usaria para não repetir, em
produção, os erros plantados de propósito neste laboratório.

Este playbook **não é um produto** e não corrige nada no código do laboratório:
o app-alvo (`backend/`, `frontend/`) continua, e deve continuar, deliberadamente
vulnerável — é o material de exercício para Trivy, Suricata e Wazuh. O que
está aqui é conhecimento estruturado sobre como cada vulnerabilidade plantada
poderia ter sido evitada (shift-left) ou detectada em runtime, caso escapasse.

## Como usar

- Leia os guias em `guia/` na ordem 01 → 04: eles constroem a narrativa, do
  vetor de comprometimento até as práticas concretas de prevenção e detecção.
- Aplique o conteúdo de `ci/` no seu pipeline de integração contínua.
- Use `deteccao/` se sua dev shop também hospeda a aplicação para o cliente
  (ambiente de homologação ou produção), não só desenvolve.

## A espinha

A tabela abaixo é a espinha do playbook: cada linha liga uma vulnerabilidade
real do Aurora Chamados à sua origem (padrão de IA ou dependência sem
revisão), ao controle que a evitaria antes do deploy (shift-left) e à
detecção em runtime caso ela escape para produção. As Tasks 2–6 deste
playbook referenciam estas linhas.

| Vuln no app | Origem (padrão de IA / dep sem revisão) | Controle shift-left | Detecção runtime se escapar | MITRE |
|---|---|---|---|---|
| SQLi — `GET /api/chamados?busca=` (`backend/src/routes/chamados.js:25`) | concatenação de string sugerida por IA | checklist: query parametrizada (`$1`) | Suricata (ruidoso/burlável): assinatura `UNION SELECT`/`OR 1=1` | T1190 |
| IDOR — `GET /api/chamados/:id` (`backend/src/routes/chamados.js`) | falta de checagem de dono | checklist: autorização por dono no servidor | — (fix é shift-left) | T1213 |
| Broken access control — `GET /api/usuarios` (`backend/src/routes/usuarios.js`) | falta de checagem de admin | checklist: autorização por papel no servidor | — (fix é shift-left) | T1078 |
| Escalonamento de privilégio — `PATCH /api/usuarios/:id` (`backend/src/routes/usuarios.js`) | aceita alterar `papel` sem checagem | checklist: não deixar cliente alterar campo sensível | Wazuh: alteração de papel em log de app | T1078 |
| Command injection — `GET /api/chamados/:id/pdf` (`backend/src/routes/chamados.js`) | `exec` com input do usuário | checklist: nunca passar input pra shell | Wazuh: `node` gerando `sh`/`whoami`/`curl` (auditd) | T1059 |
| DoS de upload — `POST /api/chamados/:id/anexos` (`backend/src/routes/anexos.js`) | multer sem `limits` | checklist: limitar tamanho/quantidade; Trivy pega CVE-2025-7338 | Wazuh: pico de disco/uso de recurso | T1499 |
| Auth fraca — `POST /api/auth/login` (`backend/src/auth.js:5,9,29`) | MD5 sem salt, JWT sem `algorithms`, segredo `'aurora'`, sem rate-limit | checklist: argon2 + JWT `algorithms` + segredo via env + rate-limit; Trivy pega CVE do jsonwebtoken | Wazuh: brute force (N falhas/IP) | T1110 |
| Backdoor slopsquattado — `express-audit-log` (`backend/vendor/express-audit-log/index.js`, wired em `backend/src/index.js:14,21`) — **já no código** | dep "sugerida por IA" sem revisão | checklist: revisar toda dep nova; **Trivy NÃO pega** (sem CVE) | Wazuh: FIM em `vendor/` + conexão de saída no startup; Suricata: beacon C2 pra `192.0.2.10/collect` | T1071 / T1195 |

As 2 dependências com CVE conhecido (`jsonwebtoken`, `multer`) são a
coluna "controle shift-left via Trivy": SCA encontra o CVE no
`package-lock.json` antes do deploy. A dependência maliciosa
(`express-audit-log`) é o contraste proposital — sem CVE publicado, só a
detecção em runtime (FIM, beacon de rede) pega.

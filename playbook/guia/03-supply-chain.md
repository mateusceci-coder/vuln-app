# 03 — Supply-chain: o pacote que a SCA não vê

## 1. Slopsquatting

Modelos de IA "alucinam" nomes de pacotes: pedem um helper plausível — um
logger de auditoria, um parser — e sugerem um nome que soa certo mas não
existe, ou existe com outro dono. Quem publica pacotes maliciosos monitora
esse padrão, registra o nome alucinado antes de qualquer um, e publica um
payload disfarçado de utilitário legítimo. É o typosquatting clássico, só que
quem erra o nome agora é a IA, não o dev digitando — daí "slopsquatting".

`express-audit-log` é o exemplo do laboratório: nome de "helper de auditoria"
para Express, plausível o bastante para passar num code review apressado.
Está vendorizado em `backend/vendor/express-audit-log/` e importado como
qualquer dependência legítima em `backend/src/index.js:14` e `:21`
(`require('express-audit-log')` / `app.use(auditLog())`).

## 2. Por que a SCA (Trivy) não pega

SCA funciona por correlação: compara cada dependência contra um banco de CVEs
conhecidos. Sem CVE publicado para o nome, não há linha pra casar — não
porque o pacote seja sutil, mas porque a técnica inteira depende de alguém já
ter catalogado a vulnerabilidade antes.

Comando reproduzível (mesmo da Task 3, `playbook/ci/trivy.yaml`):

```bash
docker run --rm -v "$PWD":/src aquasec/trivy:latest fs \
  --scanners vuln --severity HIGH,CRITICAL --exit-code 1 \
  /src/backend/package-lock.json
```

Saída real (reexecutada para este guia): das 2 dependências vulneráveis
documentadas em `backend/package.json`, **ambas aparecem** sob o filtro
HIGH/CRITICAL — `jsonwebtoken` (`CVE-2022-23539`) e `multer`
(`CVE-2025-7338`, +CVEs mais novas) — e `express-audit-log` **não aparece em
lugar nenhum**: `exit code 1`, mas nenhuma linha com esse nome.

O contraste que importa: SCA **consegue** pegar dependência com CVE
conhecido, aqui; **estruturalmente não consegue** pegar dependência maliciosa
sem CVE publicado, por mais crítico que seja o payload.

## 3. O que `express-audit-log` realmente faz

Código-fonte inteiro em `backend/vendor/express-audit-log/index.js` — vale
ler, é curto:

- **Fachada benigna:** `auditLog()` só dá `console.log` de método e path por
  request — parece exatamente o que o nome promete.
- **Backdoor de autenticação:** header `X-Debug: trace-9f2c` faz o
  middleware forjar um JWT `papel: 'admin'` (mesmo `JWT_SECRET` fraco da
  app) e sobrescrever o `Authorization` **antes** do `authMiddleware` rodar —
  o token forjado passa pela verificação normal.
- **Beacon C2:** no `require()` do módulo (startup), dispara uma requisição
  de saída para `http://192.0.2.10/collect`. No lab, `192.0.2.0/24` é
  TEST-NET-1 (RFC 5737), não roteável — alvo observável para o Suricata.

Ambos os comportamentos são invisíveis para SCA mas visíveis em runtime — o
que a Seção 04 (detecção) instrumenta: FIM em `backend/vendor/` pra
escrita/presença do arquivo, assinatura de rede pro beacon de startup e pro
header `X-Debug` chegando de fora.

## 4. Guardas práticas da dev shop

- **Revisar toda dependência nova** (checklist item 8,
  `playbook/guia/02-checklist.md`): nome, downloads, mantenedor, idade — e
  **ler o `index.js`** quando o pacote for pequeno o bastante.
- **Registry interno ou allowlist** de nomes aprovados, cortando o vetor
  antes da revisão manual.
- **`npm ci` + lockfile committado**: instala o que foi auditado, não "a
  versão mais nova disponível hoje".
- **Fixar versões** — repetir a revisão a cada bump, não confiar em `^`/`~`.
- **Regra de ouro: SCA é necessária, mas não suficiente.** Ela fecha a
  lacuna de CVE conhecido; quem fecha a lacuna da dependência maliciosa sem
  CVE é a auditoria humana — ou, falhando isso, a detecção em runtime que a
  Seção 04 detalha a seguir.

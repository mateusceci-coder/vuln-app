# Wazuh — regras custom para o lab Aurora Chamados

Regras em `local_rules.xml` (IDs 100101, 100102, 100110 — range local
100000+). Este README cobre instalação, os pré-requisitos que cada regra
exige pra disparar de verdade, e um runbook de validação para rodar no lab
completo (OPNsense + Kali + host Debian + Wazuh manager) — **este repositório
sozinho não roda um Wazuh manager**, então nenhuma das regras abaixo foi
validada em runtime aqui; o que segue é a especificação de como validar lá.

## Instalação

No Wazuh manager:

```bash
cp local_rules.xml /var/ossec/etc/rules/local_rules.xml
systemctl restart wazuh-manager
```

Confirme que carregou sem erro:

```bash
tail -f /var/ossec/logs/ossec.log | grep -i rules
```

## Pré-requisitos por regra

### 100101 / 100102 — falha de login / brute force

Exigem que o log de aplicação do backend (`POST /api/auth/login`) chegue ao
Wazuh **decodificado como JSON**, com os campos `url` e `status` presentes no
evento decodificado — sem isso as regras não casam nada, mesmo com o ataque
acontecendo. Isso implica:

- O backend logar as requisições em formato JSON (ou um agente/coletor
  transformar o log de acesso nesse formato antes de entregar ao Wazuh).
- Um decoder Wazuh (`local_decoder.xml`) que reconheça esse JSON e exponha
  `url`/`status` como campos decodificados — não incluso neste playbook,
  é acoplado ao formato de log real escolhido para o backend.
- O agente Wazuh no host da aplicação com `<localfile>` apontando pro
  arquivo de log correto.

### 100110 — command injection / RCE

Exige auditoria de execução de processo no host do backend, não só log de
aplicação:

- `auditd` instalado e rodando no host, com uma regra de `execve` ativa
  (ex.: `-a always,exit -F arch=b64 -S execve -k audit_command`).
- O módulo de coleta de audit do Wazuh ativo no agente (`<audit>` em
  `ossec.conf`, ou o módulo `command`/`osquery` equivalente configurado pra
  encaminhar eventos de `execve` com o grupo `audit_command` e o campo
  `audit.execve.a0`).
- Sem isso, o processo filho `sh`/`curl`/etc. gerado pelo `exec()` do
  Node não gera nenhum evento pro Wazuh correlacionar — a regra existe, mas
  fica muda.

### FIM em `backend/vendor/` (backdoor slopsquattado)

Não é uma regra de `local_rules.xml` (FIM usa o subsistema de integridade de
arquivo do Wazuh, não uma regra de log), mas é pré-requisito documentado
aqui porque é o único net pro backdoor `express-audit-log` (Seção 03/04 do
guia). Adicionar ao `ossec.conf` do agente no host da aplicação:

```xml
<syscheck>
  <directories check_all="yes" realtime="yes">/caminho/para/backend/vendor</directories>
  <directories check_all="yes" realtime="yes">/caminho/para/backend/node_modules</directories>
</syscheck>
```

Sem isso, escrita ou presença de pacote malicioso em `vendor/`/
`node_modules/` não gera alerta — as regras FIM padrão do Wazuh (`550`/
`554` e correlatas) cobrem o alerta em si, uma vez que os diretórios estejam
monitorados.

## Runbook de validação (no lab)

Rodar cada cenário no lab completo e conferir o alerta esperado no
Wazuh dashboard (ou `/var/ossec/logs/alerts/alerts.json`).

### Brute force (100101 → 100102)

1. Confirmar que o decoder JSON de `url`/`status` está carregado (ver
   pré-requisito acima).
2. No Kali (ou outro host de ataque), repetir `POST /api/auth/login` com
   senha errada, mesmo IP, ≥6 vezes em 60s — o loop de tentativas de senha
   descrito no README do repo principal serve como script de ataque.
3. Esperado: um alerta rule `100101` por tentativa (nível 3) e um alerta
   rule `100102` (nível 10) assim que a 6ª falha ocorrer dentro da janela de
   60s, citando `same_source_ip` e a técnica MITRE T1110.

### Command injection / RCE (100110)

1. Confirmar `auditd` + regra de `execve` + módulo de audit do Wazuh ativos
   no host do backend (ver pré-requisito acima).
2. Disparar o vetor de command injection do endpoint de export de PDF, com
   um payload que anexe um comando ao parâmetro `nome`, por exemplo:
   ```bash
   curl "http://<host>:3001/api/chamados/1/pdf?nome=x;whoami" \
     -H "Authorization: Bearer <token>"
   ```
3. Esperado: alerta rule `100110` (nível 12) citando `audit.execve.a0` com
   um dos binários da lista (`sh`, `whoami`, etc.) e a técnica MITRE T1059.

### FIM em `vendor/` (backdoor slopsquattado)

1. Confirmar que `backend/vendor/` e `backend/node_modules/` estão em
   `<syscheck>` no `ossec.conf` do agente (ver pré-requisito acima).
2. Tocar ou modificar um arquivo dentro de `backend/vendor/`, por exemplo:
   ```bash
   touch backend/vendor/express-audit-log/index.js
   ```
3. Esperado: alerta de integridade de arquivo do Wazuh (regra FIM padrão,
   não uma das três acima) referenciando o caminho modificado.

Nenhum destes três resultados foi observado nesta revisão — este README
descreve o que rodar e o que esperar, não uma execução já feita.

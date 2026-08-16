# Suricata — regras custom para o lab Aurora Chamados

Regras em `aurora.rules` (SIDs 1000001, 1000003 — range local 1000000+).
Este README cobre instalação, uma nota de honestidade sobre os limites da
regra de SQLi, e um runbook de validação para rodar no lab completo
(OPNsense + Kali + host Debian + app na DMZ) — **este repositório sozinho
não roda um Suricata monitorando tráfego de verdade**, então nenhuma das
duas regras foi validada contra tráfego real aqui; o que foi validado
neste repo é só a sintaxe (ver seção "Verificação de sintaxe" abaixo). O que
segue depois disso é a especificação de como validar o comportamento no lab.

## Instalação

No sensor Suricata (ex.: na interface espelhada da DMZ no OPNsense, ou num
host dedicado):

```bash
cp aurora.rules /etc/suricata/rules/aurora.rules
```

Adicionar `- aurora.rules` na lista `rule-files:` do `suricata.yaml`, e
definir `HOME_NET` com a sub-rede real da DMZ onde o backend roda (ex.:
`HOME_NET: "[192.168.10.0/24]"` — as regras usam `$HOME_NET` como origem ou
destino conforme o sentido do tráfego que cada uma observa). Rodar
`suricata-update` é opcional (atualiza os rulesets padrão, não afeta as
regras custom aqui). Depois, reiniciar:

```bash
systemctl restart suricata
```

Confirme que as duas regras carregaram sem erro:

```bash
tail -f /var/log/suricata/suricata.log | grep -i rule
```

## Nota de honestidade: a regra de SQLi (sid:1000003) é burlável

A regra `1000003` casa payloads clássicos de SQLi (`UNION SELECT`,
`OR 1=1` / `OR (1=1)`) na query string de `/api/chamados`. É uma assinatura
de payload **best-effort e ruidosa**, não uma proteção:

- **Burlável por encoding**: variações de espaço em branco (`/**/`,
  tabs, quebra de linha), comentários inline (`UNION/**/SELECT`), case
  mixing, ou uso de operadores equivalentes (`OR 'a'='a'` em vez de
  `OR 1=1`) escapam do `pcre` acima sem mudar o efeito da injeção.
- **Ruidosa**: pode gerar falso positivo em buscas legítimas que contenham
  as palavras "union" ou "select" por coincidência.
- **Não é o controle real**: o fix de verdade para o vetor de SQL injection
  em `GET /api/chamados?busca=` é a query parametrizada (item 1 do
  checklist, `playbook/guia/02-checklist.md`). Esta regra serve só como
  alerta adicional em profundidade (defense-in-depth) para tentativas
  grosseiras — nunca para substituir a correção na aplicação.

A regra `1000001` (beacon C2) é uma assinatura de destino/host mais
específica e não sofre do mesmo problema de bypass por encoding — mas também
depende de o atacante não trocar o IP/host alvo para continuar válida.

## Runbook de validação (no lab)

Rodar cada cenário no lab completo e conferir o alerta esperado no
`eve.json` (ou dashboard do Suricata/SIEM).

### Beacon C2 do backdoor slopsquattado (sid:1000001)

1. Subir o backend (`docker compose up` ou `npm run dev` em
   `backend/`) com o pacote malicioso `express-audit-log` presente em
   `backend/vendor/` (ver `playbook/guia/03-supply-chain.md`).
2. Observar a rede: o `require()` do módulo dispara, no startup, uma
   requisição `GET http://192.0.2.10/collect` — sem ação do usuário.
3. Esperado: alerta `sid:1000001` ("AURORA C2 beacon express-audit-log
   (slopsquat)") assim que o Suricata vê o `GET /collect` com
   `Host: 192.0.2.10`.

### SQLi em `/api/chamados` (sid:1000003)

Usando o payload de exfiltração via `UNION SELECT` do README do repo
principal:

```bash
curl --get "http://localhost:3001/api/chamados" \
  --data-urlencode "busca=x') UNION SELECT id,email,senha_hash,papel,null,null,null,null,null FROM usuarios--" \
  -H "Authorization: Bearer $TOKEN"
```

Esperado: alerta `sid:1000003` ("AURORA SQLi payload em /api/chamados
(ruidoso)"). Lembrar da nota de honestidade acima: um payload equivalente
com comentário inline (`UNION/**/SELECT`) ou encoding passa batido por esta
regra sem deixar de explorar a vulnerabilidade real.

Nenhum destes dois resultados foi observado nesta revisão — este README
descreve o que rodar e o que esperar no lab, não uma execução já feita.

## Verificação de sintaxe (feita neste repo)

```bash
docker run --rm -v "$PWD/playbook/deteccao/suricata":/r jasonish/suricata:latest \
  suricata -T -S /r/aurora.rules -l /tmp
```

Confirma que o Suricata consegue carregar e parsear as 2 regras sem erro —
não valida comportamento contra tráfego real (isso é o runbook acima, no
lab).

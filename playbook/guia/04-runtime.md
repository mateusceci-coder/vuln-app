# 04 — Runtime: a rede de segurança quando o shift-left falha

Os guias 01–03 tratam do que dá pra evitar antes do deploy: checklist de
código seguro, gate de CI com Trivy. Esta seção trata do que sobra depois —
o que fazer quando algo escapa do shift-left e chega em homologação ou
produção. É aqui que Wazuh (`deteccao/wazuh/`) e Suricata
(`deteccao/suricata/`) entram: a segunda rede, não a primeira.

Ela é *a única rede* pra uma classe de vulnerabilidade: o backdoor
slopsquattado (`express-audit-log`). Como a Seção 03 estabeleceu, SCA
funciona por correlação com CVE conhecido — sem CVE publicado, não há linha
pra casar, por mais crítico que seja o payload. Nenhum ajuste de threshold
resolve isso; só observação de comportamento em runtime (FIM no arquivo,
beacon de rede) pega.

## Onde runtime é o herói

Em ordem de prioridade neste laboratório:

1. **Backdoor / beacon C2** — `express-audit-log` chamando
   `192.0.2.10/collect` no startup e forjando JWT admin via header
   `X-Debug`. Só detecção runtime pega (FIM + assinatura de rede).
2. **Command injection / RCE** — `GET /api/chamados/:id/pdf?nome=`
   passa input do usuário pro shell. Se o shift-left falhar, o processo
   `node` gerando `sh`/`whoami`/`curl` é o sinal.
3. **SSRF pra rede interna/metadata** — `GET /api/admin/kb?ref=` com bypass
   de `baseURL` do axios (CVE-2024-39338). Runtime pega a saída de rede pro
   destino interno que não deveria ser alcançado.
4. **Brute force de login** — `POST /api/auth/login` sem rate-limit. Runtime
   conta falhas por IP; não impede a primeira tentativa, mas sinaliza a
   varredura.

## Onde runtime é secundário

Para SQLi, IDOR e escalonamento de privilégio, detecção em runtime é
**secundária e ruidosa**: depende de assinatura (burlável por quem varia o
payload) ou de heurística fraca sobre tráfego legítimo de aplicação. Ali o
fix real é shift-left — query parametrizada, checagem de dono, checagem de
papel no servidor (guias 01–02). Runtime não substitui isso; na melhor das
hipóteses, avisa depois do fato.

## Próximos passos

Regras Wazuh custom para este laboratório estão em `deteccao/wazuh/`
(`local_rules.xml` + `README.md` com instalação, pré-requisitos e runbook de
validação no lab). Assinaturas Suricata ficam em `deteccao/suricata/`.

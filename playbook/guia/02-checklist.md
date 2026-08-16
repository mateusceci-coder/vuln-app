# Checklist de código seguro para dev com IA

Estes são exatamente os padrões que uma IA tende a emitir sem revisão — cada
item abaixo corresponde a uma linha da tabela-espinha, com o trecho real do
app vulnerável, a correção e o ponteiro no código.

1. ☐ **Query parametrizada, nunca concatenar.**
   *Padrão inseguro (o que a IA gerou):* `` `... ILIKE '%${busca}%'` `` (`backend/src/routes/chamados.js:25`).
   *Correção:* placeholders `$1` + array de params no `pool.query`.
   *Onde no app:* `backend/src/routes/chamados.js:25`.

2. ☐ **Autorização por dono no servidor.**
   *Padrão inseguro:* `GET /api/chamados/:id` retorna qualquer chamado (`backend/src/routes/chamados.js`).
   *Correção:* `WHERE solicitante_id = $usuario` (ou 403).
   *Onde no app:* `backend/src/routes/chamados.js`.

3. ☐ **Autorização por papel no servidor.**
   *Padrão inseguro:* `GET /api/usuarios` só exige JWT, não papel (`backend/src/routes/usuarios.js`).
   *Correção:* checar `req.usuario.papel === 'admin'` no servidor — nunca confiar no papel lido do token no front.
   *Onde no app:* `backend/src/routes/usuarios.js`.

4. ☐ **Cliente não altera campo sensível.**
   *Padrão inseguro:* `PATCH /api/usuarios/:id` aceita `papel` (`backend/src/routes/usuarios.js`).
   *Correção:* allowlist de campos editáveis; `papel` só via rota admin.
   *Onde no app:* `backend/src/routes/usuarios.js`.

5. ☐ **Nunca passar input do usuário pra shell.**
   *Padrão inseguro:* `exec(\`echo "Chamado: ${titulo}" > /tmp/${nome}.pdf ...\`)` (`backend/src/routes/chamados.js:104`).
   *Correção:* `execFile`/`spawn` com args array; validar contra allowlist.
   *Onde no app:* `backend/src/routes/chamados.js:104`.

6. ☐ **Limitar upload.**
   *Padrão inseguro:* multer sem `limits` (`backend/src/routes/anexos.js`).
   *Correção:* `multer({ limits: { fileSize, files } })` + atualizar multer.
   *Onde no app:* `backend/src/routes/anexos.js`.

7. ☐ **Auth forte.**
   *Padrão inseguro:* MD5 sem salt (`backend/src/auth.js:9`), `jwt.verify` sem `algorithms` (`backend/src/auth.js:29`), segredo `'aurora'` (`backend/src/auth.js:5`), sem rate-limit no login.
   *Correção:* argon2/bcrypt + salt; `jwt.verify(t, s, { algorithms: ['HS256'] })`; segredo forte só via env (falhar se ausente); rate-limit no `/login`.
   *Onde no app:* `backend/src/auth.js:5`, `backend/src/auth.js:9`, `backend/src/auth.js:29`.

8. ☐ **Revisar toda dependência nova.**
   *Padrão inseguro:* `express-audit-log` adicionado sem auditoria (`backend/vendor/express-audit-log/`) — tem beacon C2 + backdoor de auth.
   *Correção:* antes de adicionar, checar nome (typo/slopsquat), downloads, mantenedor, idade, e **ler o `index.js`**; `npm ci` + lockfile; a SCA (Task 3) **não** substitui essa revisão.
   *Onde no app:* `backend/vendor/express-audit-log/`.

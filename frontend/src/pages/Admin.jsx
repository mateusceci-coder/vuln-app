import { useEffect, useState } from "react";
import { UserPlus, Trash2, Activity, Terminal, Globe, Radio } from "lucide-react";
import {
  PageHeader, Card, Table, Button, Input, Select, Avatar, Modal, Loading, EmptyState, useToast,
} from "../components/ui";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";
import { PAPEL_OPCOES } from "../lib/format";
import styles from "./Admin.module.css";

export default function Admin() {
  const toast = useToast();
  const [usuarios, setUsuarios] = useState(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [excluir, setExcluir] = useState(null);

  const carregar = () => apiGet("/usuarios").then(setUsuarios).catch(() => setUsuarios([]));
  useEffect(() => {
    carregar();
  }, []);

  // ⚠️ PATCH de papel sem checagem → escalonamento de privilégio.
  async function mudarPapel(u, papel) {
    try {
      await apiPatch(`/usuarios/${u.id}`, { papel });
      setUsuarios((lista) => lista.map((x) => (x.id === u.id ? { ...x, papel } : x)));
      toast.success(`${u.nome} agora é ${papel}.`);
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function confirmarExcluir() {
    try {
      await apiDelete(`/usuarios/${excluir.id}`);
      setUsuarios((lista) => lista.filter((x) => x.id !== excluir.id));
      toast.success("Usuário removido.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setExcluir(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Painel administrativo"
        subtitle="Gestão de usuários e verificação do ambiente."
        actions={
          <Button variant="primary" onClick={() => setNovoAberto(true)}>
            <UserPlus size={16} /> Novo usuário
          </Button>
        }
      />

      <HealthCheck />

      <Card className={styles.usersCard} padded={false}>
        <div className={styles.usersHead}>
          <h2 className={styles.blocoTitulo}>Usuários</h2>
          <span className={styles.usersCount}>{usuarios?.length ?? "—"} contas</span>
        </div>
        {usuarios === null ? (
          <Loading />
        ) : usuarios.length === 0 ? (
          <EmptyState title="Nenhum usuário" />
        ) : (
          <Table minWidth={860}>
            <thead>
              <tr>
                <th>Usuário</th>
                <th style={{ width: 150 }}>Papel</th>
                <th>Telefone</th>
                <th>CPF</th>
                <th>Empresa</th>
                <th style={{ width: 52 }}></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.userCell}>
                      <Avatar nome={u.nome} size={34} />
                      <div className={styles.userInfo}>
                        <span className={styles.userNome}>{u.nome}</span>
                        <span className={styles.userEmail}>{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Select
                      value={u.papel}
                      onChange={(e) => mudarPapel(u, e.target.value)}
                      options={PAPEL_OPCOES}
                    />
                  </td>
                  <td className="mono" style={{ fontSize: 13, color: "var(--text-muted)" }}>{u.telefone || "—"}</td>
                  <td className="mono" style={{ fontSize: 13, color: "var(--text-muted)" }}>{u.cpf || "—"}</td>
                  <td style={{ fontSize: 13.5 }}>{u.empresa || "—"}</td>
                  <td>
                    <button className={styles.del} onClick={() => setExcluir(u)} aria-label={`Remover ${u.nome}`}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <NovoUsuario open={novoAberto} onClose={() => setNovoAberto(false)} onCriado={carregar} />

      <Modal
        open={!!excluir}
        onClose={() => setExcluir(null)}
        title="Remover usuário"
        footer={
          <>
            <Button variant="ghost" onClick={() => setExcluir(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmarExcluir}><Trash2 size={15} /> Remover</Button>
          </>
        }
      >
        Remover <strong>{excluir?.nome}</strong> ({excluir?.email})? Essa ação não pode ser desfeita.
      </Modal>
    </>
  );
}

function HealthCheck() {
  const [host, setHost] = useState("");
  const [url, setUrl] = useState("");
  const [saidaHost, setSaidaHost] = useState(null);
  const [saidaUrl, setSaidaUrl] = useState(null);
  const [rodandoHost, setRodandoHost] = useState(false);
  const [rodandoUrl, setRodandoUrl] = useState(false);

  // ⚠️ command injection ({host} → exec) + SSRF ({url} → axios.get).
  async function pingar(e) {
    e.preventDefault();
    setRodandoHost(true);
    try {
      const r = await apiPost("/admin/health-check", { host });
      const h = r.host || {};
      setSaidaHost(h.saida || h.erro || JSON.stringify(r));
    } catch (err) {
      setSaidaHost(err.message);
    } finally {
      setRodandoHost(false);
    }
  }

  async function requisitar(e) {
    e.preventDefault();
    setRodandoUrl(true);
    try {
      const r = await apiPost("/admin/health-check", { url });
      const u = r.url || {};
      if (u.erro) setSaidaUrl(u.erro);
      else setSaidaUrl(`status ${u.status}\n\n` + (typeof u.corpo === "string" ? u.corpo : JSON.stringify(u.corpo, null, 2)));
    } catch (err) {
      setSaidaUrl(err.message);
    } finally {
      setRodandoUrl(false);
    }
  }

  return (
    <Card className={styles.health}>
      <h2 className={styles.blocoTitulo}>
        <Activity size={18} /> Verificar ambiente
      </h2>
      <p className={styles.healthSub}>Testes de conectividade a partir do servidor da aplicação.</p>

      <div className={styles.healthGrid}>
        <form className={styles.healthCol} onSubmit={pingar}>
          <label className={styles.healthLabel}><Radio size={14} /> Ping de host</label>
          <div className={styles.healthRow}>
            <Input placeholder="8.8.8.8 ou servidor.interno" value={host} onChange={(e) => setHost(e.target.value)} className="mono" />
            <Button type="submit" variant="secondary" loading={rodandoHost}>Ping</Button>
          </div>
          {saidaHost !== null && (
            <pre className={styles.terminal}>
              <span className={styles.terminalHead}><Terminal size={12} /> ping</span>
              {saidaHost}
            </pre>
          )}
        </form>

        <form className={styles.healthCol} onSubmit={requisitar}>
          <label className={styles.healthLabel}><Globe size={14} /> Requisição HTTP</label>
          <div className={styles.healthRow}>
            <Input placeholder="http://servico.interno/status" value={url} onChange={(e) => setUrl(e.target.value)} className="mono" />
            <Button type="submit" variant="secondary" loading={rodandoUrl}>GET</Button>
          </div>
          {saidaUrl !== null && (
            <pre className={styles.terminal}>
              <span className={styles.terminalHead}><Terminal size={12} /> resposta</span>
              {saidaUrl}
            </pre>
          )}
        </form>
      </div>
    </Card>
  );
}

function NovoUsuario({ open, onClose, onCriado }) {
  const toast = useToast();
  const [form, setForm] = useState({ nome: "", email: "", senha: "", papel: "cliente", telefone: "", cpf: "", empresa: "" });
  const [salvando, setSalvando] = useState(false);
  const set = (c) => (e) => setForm((f) => ({ ...f, [c]: e.target.value }));

  async function criar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await apiPost("/usuarios", form);
      toast.success("Usuário criado.");
      onClose();
      setForm({ nome: "", email: "", senha: "", papel: "cliente", telefone: "", cpf: "", empresa: "" });
      onCriado();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo usuário"
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={criar} loading={salvando}><UserPlus size={15} /> Criar</Button>
        </>
      }
    >
      <form className={styles.novoForm} onSubmit={criar}>
        <Input label="Nome" value={form.nome} onChange={set("nome")} required />
        <div className={styles.novoGrid}>
          <Input label="E-mail" type="email" value={form.email} onChange={set("email")} required />
          <Input label="Senha" type="password" value={form.senha} onChange={set("senha")} />
        </div>
        <div className={styles.novoGrid}>
          <Select label="Papel" value={form.papel} onChange={set("papel")} options={PAPEL_OPCOES} />
          <Input label="Empresa" value={form.empresa} onChange={set("empresa")} />
        </div>
        <div className={styles.novoGrid}>
          <Input label="Telefone" value={form.telefone} onChange={set("telefone")} />
          <Input label="CPF" value={form.cpf} onChange={set("cpf")} />
        </div>
      </form>
    </Modal>
  );
}

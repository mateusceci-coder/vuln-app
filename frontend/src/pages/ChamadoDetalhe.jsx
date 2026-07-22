import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Pencil, Trash2, FileDown, Paperclip, Send, Lock,
  Building2, Mail, Phone, IdCard, Upload, MessageSquare, Terminal,
} from "lucide-react";
import {
  Card, Button, Input, Select, Textarea, Avatar, Modal, Loading, EmptyState,
  StatusBadge, PrioridadeBadge, PapelBadge, useToast,
} from "../components/ui";
import { apiGet, apiPatch, apiDelete, apiPost, apiUpload } from "../lib/api";
import { STATUS_OPCOES, PRIORIDADE_OPCOES, formatDate, relativo } from "../lib/format";
import { useAuth } from "../auth/AuthContext";
import styles from "./ChamadoDetalhe.module.css";

export default function ChamadoDetalhe() {
  const { id } = useParams();
  const { papel } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const podeGerir = papel === "agente" || papel === "admin";

  const [chamado, setChamado] = useState(null);
  const [erro, setErro] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [anexos, setAnexos] = useState([]);
  const [agentes, setAgentes] = useState([]);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);

  const carregarComentarios = () =>
    apiGet(`/chamados/${id}/comentarios`).then(setComentarios).catch(() => {});
  const carregarAnexos = () =>
    apiGet(`/chamados/${id}/anexos`).then(setAnexos).catch(() => {});

  useEffect(() => {
    setChamado(null);
    setErro(null);
    apiGet(`/chamados/${id}`).then(setChamado).catch(setErro);
    carregarComentarios();
    carregarAnexos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!podeGerir) return;
    apiGet("/usuarios")
      .then((lista) => setAgentes(lista.filter((u) => u.papel === "agente" || u.papel === "admin")))
      .catch(() => {});
  }, [podeGerir]);

  async function patchCampo(campo, valor) {
    try {
      const upd = await apiPatch(`/chamados/${id}`, { [campo]: valor });
      setChamado((c) => ({ ...c, ...upd }));
      toast.success("Chamado atualizado.");
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function excluir() {
    try {
      await apiDelete(`/chamados/${id}`);
      toast.success("Chamado excluído.");
      navigate("/chamados", { replace: true });
    } catch (e) {
      toast.error(e.message);
    }
  }

  if (erro) {
    return (
      <Card>
        <EmptyState
          icon={<MessageSquare />}
          title="Chamado não encontrado"
          action={<Button as={Link} to="/chamados" variant="secondary"><ArrowLeft size={16} /> Voltar</Button>}
        >
          {erro.status === 404 ? "Esse chamado não existe." : erro.message}
        </EmptyState>
      </Card>
    );
  }
  if (!chamado) return <Loading />;

  return (
    <>
      <Link to="/chamados" className={styles.back}>
        <ArrowLeft size={16} /> Chamados
      </Link>

      <div className={styles.head}>
        <div className={styles.headText}>
          <span className={styles.id}>#{chamado.id}</span>
          <h1 className={styles.titulo}>{chamado.titulo}</h1>
          <div className={styles.meta}>
            <StatusBadge status={chamado.status} />
            <PrioridadeBadge prioridade={chamado.prioridade} />
            <span className={styles.metaSep}>·</span>
            <span className={styles.metaData}>Aberto {relativo(chamado.criado_em)}</span>
          </div>
        </div>
        <div className={styles.headActions}>
          <Button as={Link} to={`/chamados/${id}/editar`} variant="secondary" size="sm">
            <Pencil size={15} /> Editar
          </Button>
          {podeGerir && (
            <Button variant="danger" size="sm" onClick={() => setConfirmarExcluir(true)}>
              <Trash2 size={15} /> Excluir
            </Button>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        {/* -------- coluna principal -------- */}
        <div className={styles.main}>
          <Card>
            <h2 className={styles.sectionTitle}>Descrição</h2>
            <p className={styles.descricao}>{chamado.descricao || "Sem descrição."}</p>
          </Card>

          <Card>
            <h2 className={styles.sectionTitle}>
              <MessageSquare size={17} /> Comentários
              <span className={styles.count}>{comentarios.length}</span>
            </h2>
            <Comentarios
              id={id}
              itens={comentarios}
              podeInterno={podeGerir}
              onNovo={carregarComentarios}
            />
          </Card>

          <Card>
            <h2 className={styles.sectionTitle}>
              <Paperclip size={17} /> Anexos
              <span className={styles.count}>{anexos.length}</span>
            </h2>
            <Anexos id={id} itens={anexos} onNovo={carregarAnexos} />
          </Card>
        </div>

        {/* -------- coluna lateral -------- */}
        <aside className={styles.aside}>
          <Card>
            <h2 className={styles.sectionTitle}>Solicitante</h2>
            <div className={styles.solic}>
              <Avatar nome={chamado.solicitante_nome} size={44} />
              <div>
                <div className={styles.solicNome}>{chamado.solicitante_nome}</div>
                {chamado.solicitante_empresa && (
                  <div className={styles.solicEmpresa}>
                    <Building2 size={13} /> {chamado.solicitante_empresa}
                  </div>
                )}
              </div>
            </div>
            <dl className={styles.dados}>
              <Dado icon={<Mail size={14} />} label="E-mail" valor={chamado.solicitante_email} />
              <Dado icon={<Phone size={14} />} label="Telefone" valor={chamado.solicitante_telefone} mono />
              <Dado icon={<IdCard size={14} />} label="CPF" valor={chamado.solicitante_cpf} mono />
            </dl>
          </Card>

          {podeGerir && (
            <Card>
              <h2 className={styles.sectionTitle}>Ações do agente</h2>
              <div className={styles.acoes}>
                <Select
                  label="Status"
                  value={chamado.status}
                  onChange={(e) => patchCampo("status", e.target.value)}
                  options={STATUS_OPCOES}
                />
                <Select
                  label="Prioridade"
                  value={chamado.prioridade}
                  onChange={(e) => patchCampo("prioridade", e.target.value)}
                  options={PRIORIDADE_OPCOES}
                />
                <Select
                  label="Agente responsável"
                  value={chamado.agente_id || ""}
                  onChange={(e) => patchCampo("agente_id", Number(e.target.value))}
                  placeholder="Atribuir a…"
                  options={agentes.map((a) => ({ value: a.id, label: a.nome }))}
                />
              </div>
            </Card>
          )}

          <ExportarPdf id={id} />

          <Card padded>
            <dl className={styles.timeline}>
              <div>
                <dt>Criado</dt>
                <dd>{formatDate(chamado.criado_em)}</dd>
              </div>
              <div>
                <dt>Atualizado</dt>
                <dd>{formatDate(chamado.atualizado_em)}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>

      <Modal
        open={confirmarExcluir}
        onClose={() => setConfirmarExcluir(false)}
        title="Excluir chamado"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmarExcluir(false)}>Cancelar</Button>
            <Button variant="danger" onClick={excluir}><Trash2 size={15} /> Excluir</Button>
          </>
        }
      >
        Tem certeza que deseja excluir o chamado <strong>#{chamado.id}</strong>? Essa ação não pode ser desfeita.
      </Modal>
    </>
  );
}

function Dado({ icon, label, valor, mono }) {
  return (
    <div className={styles.dado}>
      <dt>
        <span className={styles.dadoIcon}>{icon}</span>
        {label}
      </dt>
      <dd className={mono ? "mono" : undefined}>{valor || "—"}</dd>
    </div>
  );
}

function Comentarios({ id, itens, podeInterno, onNovo }) {
  const toast = useToast();
  const [corpo, setCorpo] = useState("");
  const [interno, setInterno] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (!corpo.trim()) return;
    setEnviando(true);
    try {
      await apiPost(`/chamados/${id}/comentarios`, { corpo, interno });
      setCorpo("");
      setInterno(false);
      await onNovo();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      {itens.length === 0 ? (
        <p className={styles.vazio}>Nenhum comentário ainda.</p>
      ) : (
        <ul className={styles.comentarios}>
          {itens.map((c) => (
            <li key={c.id} className={`${styles.comentario} ${c.interno ? styles.interno : ""}`}>
              <Avatar nome={c.autor_nome} size={34} />
              <div className={styles.comBody}>
                <div className={styles.comHead}>
                  <span className={styles.comAutor}>{c.autor_nome}</span>
                  <PapelBadge papel={c.autor_papel} />
                  {c.interno && (
                    <span className={styles.internoTag}>
                      <Lock size={11} /> interno
                    </span>
                  )}
                  <span className={styles.comData}>{relativo(c.criado_em)}</span>
                </div>
                <p className={styles.comTexto}>{c.corpo}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className={styles.comForm} onSubmit={enviar}>
        <Textarea
          placeholder="Escreva um comentário…"
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          rows={3}
        />
        <div className={styles.comFormBar}>
          {podeInterno && (
            <label className={styles.check}>
              <input type="checkbox" checked={interno} onChange={(e) => setInterno(e.target.checked)} />
              <Lock size={13} /> Comentário interno
            </label>
          )}
          <Button type="submit" variant="primary" size="sm" loading={enviando} className={styles.comSend}>
            <Send size={15} /> Enviar
          </Button>
        </div>
      </form>
    </div>
  );
}

function Anexos({ id, itens, onNovo }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (!arquivo) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      await apiUpload(`/chamados/${id}/anexos`, fd);
      setArquivo(null);
      if (inputRef.current) inputRef.current.value = "";
      await onNovo();
      toast.success("Anexo enviado.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      {itens.length === 0 ? (
        <p className={styles.vazio}>Nenhum anexo.</p>
      ) : (
        <ul className={styles.anexos}>
          {itens.map((a) => (
            <li key={a.id} className={styles.anexo}>
              <span className={styles.anexoIcon}><Paperclip size={15} /></span>
              <span className={styles.anexoNome}>{a.nome_arquivo}</span>
              <span className={styles.anexoData}>{relativo(a.criado_em)}</span>
            </li>
          ))}
        </ul>
      )}

      <form className={styles.upload} onSubmit={enviar}>
        <label className={styles.fileLabel}>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            onChange={(e) => setArquivo(e.target.files?.[0] || null)}
          />
          <Upload size={15} />
          {arquivo ? arquivo.name : "Escolher arquivo"}
        </label>
        <Button type="submit" variant="secondary" size="sm" loading={enviando} disabled={!arquivo}>
          Enviar
        </Button>
      </form>
    </div>
  );
}

function ExportarPdf({ id }) {
  const [nome, setNome] = useState(`chamado_${id}`);
  const [saida, setSaida] = useState(null);
  const [exportando, setExportando] = useState(false);

  async function exportar(e) {
    e.preventDefault();
    setExportando(true);
    try {
      // ⚠️ Command injection: `nome` é interpolado no shell pelo backend.
      const texto = await apiGet(`/chamados/${id}/pdf?nome=` + encodeURIComponent(nome));
      setSaida(typeof texto === "string" ? texto : JSON.stringify(texto));
    } catch (err) {
      setSaida(err.message);
    } finally {
      setExportando(false);
    }
  }

  return (
    <Card>
      <h2 className={styles.sectionTitle}><FileDown size={17} /> Exportar PDF</h2>
      <form className={styles.pdfForm} onSubmit={exportar}>
        <Input label="Nome do arquivo" value={nome} onChange={(e) => setNome(e.target.value)} className="mono" />
        <Button type="submit" variant="secondary" size="sm" loading={exportando}>
          <FileDown size={15} /> Gerar
        </Button>
      </form>
      {saida !== null && (
        <pre className={styles.terminal}>
          <span className={styles.terminalHead}><Terminal size={12} /> saída</span>
          {saida}
        </pre>
      )}
    </Card>
  );
}

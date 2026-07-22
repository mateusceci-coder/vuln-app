import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Ticket, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, Card, Table, Button, Input, Select, Loading, EmptyState, StatusBadge, PrioridadeBadge } from "../components/ui";
import { apiGet } from "../lib/api";
import { STATUS_OPCOES, formatDateShort } from "../lib/format";
import styles from "./Chamados.module.css";

const POR_PAGINA = 10;

export default function Chamados() {
  const [chamados, setChamados] = useState(null);
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState(""); // termo aplicado (submetido)
  const [status, setStatus] = useState("");
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    setChamados(null);
    // ⚠️ SQLi: busca concatenada na query pelo backend.
    const qs = termo ? "?busca=" + encodeURIComponent(termo) : "";
    apiGet("/chamados" + qs)
      .then(setChamados)
      .catch(() => setChamados([]));
  }, [termo]);

  const filtrados = useMemo(() => {
    if (!chamados) return [];
    return status ? chamados.filter((c) => c.status === status) : chamados;
  }, [chamados, status]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  function aplicarBusca(e) {
    e.preventDefault();
    setPagina(1);
    setTermo(busca.trim());
  }

  return (
    <>
      <PageHeader
        eyebrow="Suporte"
        title="Chamados"
        subtitle="Todos os chamados registrados no portal."
        actions={
          <Button as={Link} to="/chamados/novo" variant="primary">
            <Plus size={16} />
            Novo chamado
          </Button>
        }
      />

      <Card className={styles.toolbar} padded={false}>
        <form className={styles.searchForm} onSubmit={aplicarBusca}>
          <Input
            icon={<Search />}
            placeholder="Buscar por título ou descrição…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </form>
        <Select
          value={status}
          onChange={(e) => {
            setPagina(1);
            setStatus(e.target.value);
          }}
          placeholder="Todos os status"
          options={STATUS_OPCOES}
          className={styles.filtro}
        />
      </Card>

      {chamados === null ? (
        <Loading />
      ) : filtrados.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Ticket />}
            title="Nenhum chamado"
            action={
              <Button as={Link} to="/chamados/novo" variant="secondary">
                <Plus size={16} /> Abrir chamado
              </Button>
            }
          >
            {termo || status ? "Nada corresponde ao filtro atual." : "Ainda não há chamados por aqui."}
          </EmptyState>
        </Card>
      ) : (
        <>
          <Table minWidth={720}>
            <thead>
              <tr>
                <th style={{ width: 64 }}>ID</th>
                <th>Título</th>
                <th style={{ width: 150 }}>Status</th>
                <th style={{ width: 120 }}>Prioridade</th>
                <th style={{ width: 120 }}>Criado</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => (
                <tr key={c.id}>
                  <td className="mono" style={{ color: "var(--text-faint)" }}>#{c.id}</td>
                  <td>
                    <Link to={`/chamados/${c.id}`}>{c.titulo}</Link>
                    {c.descricao && <div className={styles.desc}>{c.descricao}</div>}
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                  <td><PrioridadeBadge prioridade={c.prioridade} /></td>
                  <td className="muted" style={{ fontSize: 13 }}>{formatDateShort(c.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className={styles.paginacao}>
            <span className={styles.contagem}>
              {filtrados.length} chamado{filtrados.length !== 1 ? "s" : ""}
            </span>
            <div className={styles.pager}>
              <button
                className={styles.pagerBtn}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaAtual <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className={styles.pagerInfo}>
                {paginaAtual} / {totalPaginas}
              </span>
              <button
                className={styles.pagerBtn}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual >= totalPaginas}
                aria-label="Próxima página"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

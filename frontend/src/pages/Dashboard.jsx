import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Ticket, Inbox, CheckCircle2, Users, Search, ArrowUpRight } from "lucide-react";
import { PageHeader, Card, Input, Loading, EmptyState, StatusBadge, PrioridadeBadge } from "../components/ui";
import { apiGet } from "../lib/api";
import { STATUS, PRIORIDADE, relativo } from "../lib/format";
import { useAuth } from "../auth/AuthContext";
import styles from "./Dashboard.module.css";

export default function Dashboard() {
  const { usuario } = useAuth();
  const [relatorio, setRelatorio] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    apiGet("/admin/relatorio")
      .then(setRelatorio)
      .catch(() => setRelatorio(null))
      .finally(() => setCarregando(false));
  }, []);

  const stats = useMemo(() => {
    const t = relatorio?.totais || {};
    const porStatus = Object.fromEntries((relatorio?.chamados_por_status || []).map((r) => [r.status, r.total]));
    const abertos = (porStatus.aberto || 0) + (porStatus.em_andamento || 0);
    const resolvidos = (porStatus.resolvido || 0) + (porStatus.fechado || 0);
    return [
      { label: "Chamados", value: t.chamados ?? "—", icon: Ticket, color: "var(--aurora-teal)" },
      { label: "Em aberto", value: abertos, icon: Inbox, color: "var(--st-aberto)" },
      { label: "Resolvidos", value: resolvidos, icon: CheckCircle2, color: "var(--st-resolvido)" },
      { label: "Usuários", value: t.usuarios ?? "—", icon: Users, color: "var(--aurora-violet)" },
    ];
  }, [relatorio]);

  // ⚠️ SQLi: o termo vai direto para a query (concatenação no backend).
  async function onBuscar(e) {
    e.preventDefault();
    setBuscando(true);
    try {
      const rows = await apiGet("/chamados?busca=" + encodeURIComponent(busca));
      setResultados(rows);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title={`Olá, ${usuario?.nome?.split(" ")[0] || "bem-vindo"}`}
        subtitle="Acompanhe os chamados e o pulso do suporte."
      />

      {carregando ? (
        <Loading />
      ) : (
        <>
          <div className={styles.stats}>
            {stats.map((s) => (
              <Card key={s.label} className={styles.stat}>
                <span className={styles.statIcon} style={{ "--c": s.color }}>
                  <s.icon size={19} />
                </span>
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </Card>
            ))}
          </div>

          <div className={styles.charts}>
            <Distribuicao titulo="Chamados por status" dados={relatorio?.chamados_por_status} mapa={STATUS} chave="status" />
            <Distribuicao titulo="Chamados por prioridade" dados={relatorio?.chamados_por_prioridade} mapa={PRIORIDADE} chave="prioridade" />
          </div>
        </>
      )}

      <Card className={styles.searchCard}>
        <div className={styles.searchHead}>
          <div>
            <h2 className={styles.searchTitle}>Buscar chamados</h2>
            <p className={styles.searchSub}>Pesquise por título ou descrição em toda a base.</p>
          </div>
        </div>
        <form onSubmit={onBuscar} className={styles.searchForm}>
          <Input
            icon={<Search />}
            placeholder="Ex.: PDV, nota fiscal, certificado…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={styles.searchInput}
          />
          <button className={styles.searchBtn} disabled={buscando}>
            {buscando ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {resultados !== null && (
          <div className={styles.results}>
            {resultados.length === 0 ? (
              <EmptyState icon={<Search />} title="Nenhum resultado" >
                Nada encontrado para essa busca.
              </EmptyState>
            ) : (
              resultados.map((c) => (
                <Link key={c.id} to={`/chamados/${c.id}`} className={styles.resultRow}>
                  <span className={styles.resultId}>#{c.id}</span>
                  <span className={styles.resultTitulo}>{c.titulo}</span>
                  <span className={styles.resultBadges}>
                    <StatusBadge status={c.status} />
                    <PrioridadeBadge prioridade={c.prioridade} />
                  </span>
                  <span className={styles.resultData}>{relativo(c.criado_em)}</span>
                  <ArrowUpRight size={16} className={styles.resultArrow} />
                </Link>
              ))
            )}
          </div>
        )}
      </Card>
    </>
  );
}

function Distribuicao({ titulo, dados = [], mapa, chave }) {
  const total = (dados || []).reduce((s, r) => s + r.total, 0) || 1;
  return (
    <Card className={styles.chart}>
      <h2 className={styles.chartTitle}>{titulo}</h2>
      {!dados || dados.length === 0 ? (
        <p className={styles.chartVazio}>Sem dados ainda.</p>
      ) : (
        <div className={styles.bars}>
          {dados.map((r) => {
            const meta = mapa[r[chave]] || { label: r[chave], color: "var(--text-muted)" };
            return (
              <div key={r[chave]} className={styles.barRow}>
                <span className={styles.barLabel}>{meta.label}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(r.total / total) * 100}%`, background: meta.color }}
                  />
                </div>
                <span className={styles.barValue}>{r.total}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

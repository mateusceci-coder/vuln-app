import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { PageHeader, Card, Input, Textarea, Select, Button, Loading, useToast } from "../components/ui";
import { apiGet, apiPost, apiPatch } from "../lib/api";
import { PRIORIDADE_OPCOES } from "../lib/format";
import styles from "./ChamadoForm.module.css";

export default function ChamadoForm() {
  const { id } = useParams();
  const edicao = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({ titulo: "", descricao: "", prioridade: "media" });
  const [carregando, setCarregando] = useState(edicao);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!edicao) return;
    apiGet(`/chamados/${id}`)
      .then((c) => setForm({ titulo: c.titulo || "", descricao: c.descricao || "", prioridade: c.prioridade || "media" }))
      .catch((e) => toast.error(e.message))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      if (edicao) {
        await apiPatch(`/chamados/${id}`, form);
        toast.success("Chamado atualizado.");
        navigate(`/chamados/${id}`);
      } else {
        const novo = await apiPost("/chamados", form);
        toast.success("Chamado aberto.");
        navigate(`/chamados/${novo.id}`);
      }
    } catch (err) {
      toast.error(err.message);
      setSalvando(false);
    }
  }

  const voltar = edicao ? `/chamados/${id}` : "/chamados";

  return (
    <div className={styles.wrap}>
      <Link to={voltar} className={styles.back}>
        <ArrowLeft size={16} /> Voltar
      </Link>

      <PageHeader
        eyebrow={edicao ? "Editar" : "Novo"}
        title={edicao ? "Editar chamado" : "Abrir chamado"}
        subtitle={edicao ? "Atualize os detalhes do chamado." : "Descreva o problema para nossa equipe de suporte."}
      />

      <Card className={styles.card}>
        {carregando ? (
          <Loading />
        ) : (
          <form className={styles.form} onSubmit={onSubmit}>
            <Input
              label="Título"
              placeholder="Resuma o problema em uma frase"
              value={form.titulo}
              onChange={set("titulo")}
              required
            />
            <Textarea
              label="Descrição"
              placeholder="O que está acontecendo? Quando começou? Alguma mensagem de erro?"
              value={form.descricao}
              onChange={set("descricao")}
              rows={6}
            />
            <Select label="Prioridade" value={form.prioridade} onChange={set("prioridade")} options={PRIORIDADE_OPCOES} />

            <div className={styles.actions}>
              <Button as={Link} to={voltar} variant="ghost">Cancelar</Button>
              <Button type="submit" variant="primary" loading={salvando}>
                <Check size={16} /> {edicao ? "Salvar alterações" : "Abrir chamado"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

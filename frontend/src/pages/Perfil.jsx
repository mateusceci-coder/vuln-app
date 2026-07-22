import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { PageHeader, Card, Input, Button, Avatar, PapelBadge, Loading, useToast } from "../components/ui";
import { apiPatch } from "../lib/api";
import { formatDate } from "../lib/format";
import { useAuth } from "../auth/AuthContext";
import styles from "./Perfil.module.css";

export default function Perfil() {
  const { usuario, papel, refreshMe } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (usuario) {
      setForm({
        nome: usuario.nome || "",
        email: usuario.email || "",
        telefone: usuario.telefone || "",
        cpf: usuario.cpf || "",
        empresa: usuario.empresa || "",
      });
    }
  }, [usuario]);

  if (!usuario || !form) return <Loading />;

  const set = (c) => (e) => setForm((f) => ({ ...f, [c]: e.target.value }));

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await apiPatch(`/usuarios/${usuario.id}`, form);
      await refreshMe();
      toast.success("Perfil atualizado.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <PageHeader eyebrow="Conta" title="Meu perfil" subtitle="Seus dados pessoais e de contato." />

      <Card className={styles.card}>
        <div className={styles.top}>
          <Avatar nome={usuario.nome} size={64} />
          <div className={styles.topInfo}>
            <h2 className={styles.nome}>{usuario.nome}</h2>
            <div className={styles.topMeta}>
              <PapelBadge papel={papel} />
              <span className={styles.desde}>Na Aurora desde {formatDate(usuario.criado_em)}</span>
            </div>
          </div>
        </div>

        <form className={styles.form} onSubmit={salvar}>
          <Input label="Nome completo" value={form.nome} onChange={set("nome")} required />
          <Input label="E-mail" type="email" value={form.email} onChange={set("email")} required />
          <div className={styles.grid}>
            <Input label="Telefone" value={form.telefone} onChange={set("telefone")} />
            <Input label="CPF" value={form.cpf} onChange={set("cpf")} />
          </div>
          <Input label="Empresa" value={form.empresa} onChange={set("empresa")} />

          <div className={styles.actions}>
            <Button type="submit" variant="primary" loading={salvando}>
              <Check size={16} /> Salvar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

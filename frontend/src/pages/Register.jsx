import { useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, Phone, IdCard, Building2, ArrowRight } from "lucide-react";
import Aurora from "../components/Aurora";
import Logo from "../components/Logo";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useAuth } from "../auth/AuthContext";
import styles from "./Auth.module.css";

export default function Register() {
  const { register, autenticado } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    telefone: "",
    cpf: "",
    empresa: "",
  });
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  if (autenticado) return <Navigate to="/dashboard" replace />;

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      await register(form);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setErro(err.message || "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <Aurora variant="full" />

      <Card className={`${styles.card} ${styles.cardWide}`}>
        <div className={styles.brand}>
          <Logo size={40} />
          <div>
            <div className={styles.word}>
              Aurora<span className={styles.wordThin}>Chamados</span>
            </div>
            <div className={styles.tag}>Crie sua conta de cliente</div>
          </div>
        </div>

        <h1 className={styles.heading}>Criar conta</h1>
        <p className={styles.sub}>Abra e acompanhe seus chamados de suporte.</p>

        <form className={styles.form} onSubmit={onSubmit}>
          <Input label="Nome completo" icon={<User />} placeholder="Seu nome" value={form.nome} onChange={set("nome")} required />
          <Input label="E-mail" type="email" icon={<Mail />} placeholder="voce@empresa.com" value={form.email} onChange={set("email")} required />
          <Input label="Senha" type="password" icon={<Lock />} placeholder="••••••••" value={form.senha} onChange={set("senha")} required />

          <div className={styles.grid2}>
            <Input label="Telefone" icon={<Phone />} placeholder="+55 11 90000-0000" value={form.telefone} onChange={set("telefone")} />
            <Input label="CPF" icon={<IdCard />} placeholder="000.000.000-00" value={form.cpf} onChange={set("cpf")} />
          </div>
          <Input label="Empresa" icon={<Building2 />} placeholder="Nome da empresa" value={form.empresa} onChange={set("empresa")} />

          {erro && <div className={styles.erro}>{erro}</div>}

          <Button type="submit" variant="primary" size="lg" loading={loading} className={styles.submit}>
            Criar conta
            {!loading && <ArrowRight size={17} />}
          </Button>
        </form>

        <p className={styles.switch}>
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </Card>
    </div>
  );
}

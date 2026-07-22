import { useState } from "react";
import { Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight } from "lucide-react";
import Aurora from "../components/Aurora";
import Logo from "../components/Logo";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useAuth } from "../auth/AuthContext";
import styles from "./Auth.module.css";

// Contas semeadas no backend (documentadas para o laboratório).
const DEMO = [
  { papel: "Admin", email: "admin@aurora.local", senha: "admin123" },
  { papel: "Agente", email: "agente@aurora.local", senha: "agente123" },
  { papel: "Cliente", email: "cliente1@exemplo.com", senha: "cliente123" },
];

export default function Login() {
  const { login, autenticado } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const solicitada = location.state?.from;
  const from = solicitada && solicitada !== "/" ? solicitada : "/dashboard";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  if (autenticado) return <Navigate to={from} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      await login(email, senha);
      navigate(from, { replace: true });
    } catch (err) {
      setErro(err.message || "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  function preencher(conta) {
    setEmail(conta.email);
    setSenha(conta.senha);
    setErro("");
  }

  return (
    <div className={styles.page}>
      <Aurora variant="full" />

      <Card className={styles.card}>
        <div className={styles.brand}>
          <Logo size={40} />
          <div>
            <div className={styles.word}>
              Aurora<span className={styles.wordThin}>Chamados</span>
            </div>
            <div className={styles.tag}>Portal de suporte · homologação</div>
          </div>
        </div>

        <h1 className={styles.heading}>Bem-vindo de volta</h1>
        <p className={styles.sub}>Entre com sua conta para acompanhar seus chamados.</p>

        <form className={styles.form} onSubmit={onSubmit}>
          <Input
            label="E-mail"
            type="email"
            autoComplete="username"
            placeholder="voce@empresa.com"
            icon={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            icon={<Lock />}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          {erro && <div className={styles.erro}>{erro}</div>}

          <Button type="submit" variant="primary" size="lg" loading={loading} className={styles.submit}>
            Entrar
            {!loading && <ArrowRight size={17} />}
          </Button>
        </form>

        <p className={styles.switch}>
          Não tem conta? <Link to="/register">Criar conta</Link>
        </p>

        <div className={styles.demo}>
          <span className={styles.demoLabel}>Contas de demonstração</span>
          <div className={styles.demoGrid}>
            {DEMO.map((c) => (
              <button key={c.email} type="button" className={styles.demoRow} onClick={() => preencher(c)}>
                <span className={styles.demoPapel}>{c.papel}</span>
                <span className={`${styles.demoEmail} mono`}>{c.email}</span>
                <span className={styles.demoUse}>usar</span>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

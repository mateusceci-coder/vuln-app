import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import Aurora from "../components/Aurora";
import Logo from "../components/Logo";
import Button from "../components/ui/Button";
import styles from "./NotFound.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <Aurora variant="full" />
      <div className={styles.content}>
        <Logo size={44} />
        <div className={styles.code}>404</div>
        <h1 className={styles.title}>Página não encontrada</h1>
        <p className={styles.text}>A página que você procura não existe ou foi movida.</p>
        <Button as={Link} to="/dashboard" variant="primary" size="lg">
          <Home size={17} /> Voltar ao início
        </Button>
      </div>
    </div>
  );
}

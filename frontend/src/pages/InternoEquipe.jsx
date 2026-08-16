import { useEffect, useState } from "react";
import Card from "../components/ui/Card";
import Table from "../components/ui/Table";
import { apiGet } from "../lib/api";
import styles from "./InternoEquipe.module.css";

// Página interna esquecida em produção, sem link em nenhum menu — ver
// GET /api/interno/equipe (sem authMiddleware).
export default function InternoEquipe() {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    apiGet("/interno/equipe").then(setDados).catch(() => setDados([]));
  }, []);

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <h1 className={styles.titulo}>Acessos da equipe — rascunho</h1>
        <p className={styles.sub}>
          Página de onboarding interno. Tirar do ar depois do deploy em homologação.
        </p>

        {dados === null ? (
          <p>Carregando…</p>
        ) : (
          <Table minWidth={640}>
            <thead>
              <tr>
                <th>Sistema</th>
                <th>Usuário</th>
                <th>Senha</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((d) => (
                <tr key={d.sistema}>
                  <td>{d.sistema}</td>
                  <td className="mono">{d.usuario}</td>
                  <td className="mono">{d.senha}</td>
                  <td>{d.observacao || "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

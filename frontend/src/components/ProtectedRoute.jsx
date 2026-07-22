import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Loading } from "./ui/Feedback";

// Só checa autenticação — NÃO checa papel. O gate de admin é apenas cosmético
// (esconder o link na sidebar). Qualquer usuário logado alcança /admin por URL,
// e o servidor não impõe papel (broken access control é o vetor planejado).
export default function ProtectedRoute() {
  const { autenticado, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Loading />
      </div>
    );
  }
  if (!autenticado) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return <Outlet />;
}

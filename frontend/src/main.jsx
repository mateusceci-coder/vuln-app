import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";

import { ThemeProvider } from "./theme";
import { AuthProvider } from "./auth/AuthContext";
import { ToastProvider } from "./components/ui";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Chamados from "./pages/Chamados";
import ChamadoDetalhe from "./pages/ChamadoDetalhe";
import ChamadoForm from "./pages/ChamadoForm";
import Admin from "./pages/Admin";
import Perfil from "./pages/Perfil";
import InternoEquipe from "./pages/InternoEquipe";
import NotFound from "./pages/NotFound";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              {/* ⚠️ página interna esquecida — sem ProtectedRoute, não linkada no menu */}
              <Route path="/interno-equipe" element={<InternoEquipe />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/chamados" element={<Chamados />} />
                  <Route path="/chamados/novo" element={<ChamadoForm />} />
                  <Route path="/chamados/:id" element={<ChamadoDetalhe />} />
                  <Route path="/chamados/:id/editar" element={<ChamadoForm />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/perfil" element={<Perfil />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);

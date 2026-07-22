import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiGet, apiPost, getToken, setToken } from "../lib/api";

const AuthContext = createContext(null);

// Decodifica o payload do JWT NO CLIENTE, sem verificar assinatura.
// Convenção intencional do laboratório: o papel do usuário é lido do token
// no front-end (confiança indevida no cliente). O servidor também não checa
// papel — o gate de UID por papel aqui é apenas cosmético e contornável.
function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const json = decodeURIComponent(
      escape(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setTok] = useState(() => getToken());
  const [claims, setClaims] = useState(() => {
    const t = getToken();
    return t ? decodeJwt(t) : null;
  });
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const aplicarToken = useCallback((novo) => {
    setToken(novo);
    setTok(novo);
    setClaims(novo ? decodeJwt(novo) : null);
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await apiGet("/auth/me");
    setUsuario(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost("/auth/logout");
    } catch {
      /* stateless — ignora falha */
    }
    aplicarToken(null);
    setUsuario(null);
  }, [aplicarToken]);

  const login = useCallback(
    async (email, senha) => {
      const { token: novo } = await apiPost("/auth/login", { email, senha });
      aplicarToken(novo);
      await refreshMe();
    },
    [aplicarToken, refreshMe]
  );

  const register = useCallback(
    async (dados) => {
      const { usuario: u, token: novo } = await apiPost("/auth/register", dados);
      aplicarToken(novo);
      setUsuario(u);
    },
    [aplicarToken]
  );

  // Ao montar com token: carrega o perfil; se o token não vale mais, desloga.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    let vivo = true;
    refreshMe()
      .catch(() => {
        aplicarToken(null);
        setUsuario(null);
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, [refreshMe, aplicarToken]);

  // Papel lido do token (intencional). Cai para o perfil se necessário.
  const papel = claims?.papel || usuario?.papel || null;

  const value = {
    token,
    usuario,
    papel,
    claims,
    loading,
    autenticado: !!token,
    login,
    register,
    logout,
    refreshMe,
    setUsuario,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}

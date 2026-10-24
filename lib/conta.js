// Acesso dos amigos (contas do Cantus): guardado no aparelho depois de abrir o link pessoal
const CHAVE = 'cantus:conta';

export function lerConta() {
  if (typeof window === 'undefined') return null;
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (!c?.jwt || !c.exp || c.exp * 1000 < Date.now()) return null;
    return c;
  } catch { return null; }
}
export function gravarConta(c) { try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch {} }
export function apagarConta() { try { localStorage.removeItem(CHAVE); } catch {} }
export const ehConta = () => !!lerConta();

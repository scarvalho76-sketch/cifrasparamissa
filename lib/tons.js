// Tom preferido de cada música, por pessoa (administrador ou amigo cadastrado).
// Quando o cantor muda o tom no Modo celebração, o último tom fica guardado na conta dele
// e é usado nas próximas vezes em que a mesma música aparecer. Convidados e músicos (sem login) não guardam.
import { supabase } from './supabase';
import { lerConta } from './conta';
import { lerPref, gravarPref } from './util';

const chave = () => 'missa:tons:' + (lerConta() ? 'conta' : 'admin');
const chavePend = () => chave() + ':pend';

// Quem tem login (amigo com link pessoal ou administrador)
async function temLogin() {
  if (lerConta()) return true;
  try { const { data } = await supabase.auth.getSession(); return !!data?.session; } catch { return false; }
}

// Tons guardados neste aparelho: { musica_id: 'G', ... }
export function tonsLocais() { return lerPref(chave(), {}) || {}; }

// Envia ao servidor o que ficou pendente (ex.: mudou sem internet) e traz os tons da conta
export async function sincronizarTons() {
  if (!(await temLogin())) return tonsLocais();
  const pend = lerPref(chavePend(), []) || [];
  const restantes = [];
  for (const p of pend) {
    const { error } = await supabase.rpc('missa_tom_salvar', { p_musica: p.musica, p_tom: p.tom });
    if (error) restantes.push(p);
  }
  gravarPref(chavePend(), restantes);
  if (restantes.length === 0) {
    const { data, error } = await supabase.rpc('missa_tons_meus');
    if (!error && data && typeof data === 'object' && !Array.isArray(data)) gravarPref(chave(), data);
  }
  return tonsLocais();
}

// Guarda o último tom usado para a música ('' = volta ao tom cadastrado)
export async function salvarTomPreferido(musica, tom) {
  if (!musica || !(await temLogin())) return tonsLocais();
  const mapa = { ...tonsLocais() };
  if (tom) mapa[musica] = tom; else delete mapa[musica];
  gravarPref(chave(), mapa);
  const pend = (lerPref(chavePend(), []) || []).filter(p => p.musica !== musica);
  gravarPref(chavePend(), [...pend, { musica, tom: tom || '' }]);
  return sincronizarTons();
}

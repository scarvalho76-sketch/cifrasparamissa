import { supabase } from './supabase';

// Biblioteca com os momentos de cada música (para buscar por nome, cantor ou momento)
export async function carregarBiblioteca() {
  const [a, b, c] = await Promise.all([
    supabase.from('missa_musicas').select('id, nome, artista, cifra, letra, grade, tom_original, tom_padrao, capo').order('nome'),
    supabase.from('missa_musicas_momentos').select('musica_id, momento_id'),
    supabase.from('missa_momentos').select('id, nome, ordem').eq('ativo', true).order('ordem')
  ]);
  const nomeMom = Object.fromEntries((c.data || []).map(m => [m.id, m.nome]));
  const porMusica = {};
  (b.data || []).forEach(l => { if (nomeMom[l.momento_id]) (porMusica[l.musica_id] ||= []).push(nomeMom[l.momento_id]); });
  return {
    musicas: (a.data || []).map(m => ({ ...m, momentos: porMusica[m.id] || [] })),
    momentos: (c.data || []).map(m => m.nome)
  };
}

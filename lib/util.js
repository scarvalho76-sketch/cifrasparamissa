// Pequenas funções usadas em várias telas
export const chave = (nome, artista) => (String(nome || '').trim() + '|' + String(artista || '').trim()).toLowerCase();
export const simples = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Datas sempre no formato brasileiro: dd/mm/aaaa e hora em 24 horas
const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const p2 = n => String(n).padStart(2, '0');
export const fmtData = s => { const d = new Date(s); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const fmtHora = s => { const d = new Date(s); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export const dataLonga = s => `${DIAS[new Date(s).getDay()]}, ${fmtData(s)} às ${fmtHora(s)}`;
export const dataCurta = s => `${DIAS_CURTOS[new Date(s).getDay()]} ${fmtData(s)} ${fmtHora(s)}`;
export const dataHoraCurta = s => `${fmtData(s)} ${fmtHora(s)}`;

// Campos de digitação: "25102026" vira "25/10/2026"; "1930" vira "19:30"
export const mascaraData = v => { const d = String(v).replace(/\D/g, '').slice(0, 8); return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/'); };
export const mascaraHora = v => { const d = String(v).replace(/\D/g, '').slice(0, 4); return d.length > 2 ? d.slice(0, 2) + ':' + d.slice(2) : d; };
// Junta data e hora digitadas numa data do sistema; devolve null se estiver incompleta ou inválida
export function juntarDataHora(data, hora) {
  const md = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data || ''); const mh = /^(\d{2}):(\d{2})$/.exec(hora || '');
  if (!md || !mh) return null;
  const [dd, mm, aa, hh, mi] = [+md[1], +md[2], +md[3], +mh[1], +mh[2]];
  const d = new Date(aa, mm - 1, dd, hh, mi);
  if (d.getDate() !== dd || d.getMonth() !== mm - 1 || hh > 23 || mi > 59) return null;
  return d;
}
export const TEMPOS = ['Tempo Comum', 'Advento', 'Natal', 'Quaresma', 'Semana Santa', 'Páscoa', 'Solenidade / Festa'];
// Tempos que uma música pode ter só para si (sem marcação = todos os tempos)
// ("Comum" = só no Tempo Comum, não aparece no Advento, Quaresma etc.)
export const TEMPOS_ESPECIFICOS = TEMPOS;
export const nomeTempo = t => t === 'Tempo Comum' ? 'Comum' : t;
// A música serve para a missa deste tempo? (sem tempos marcados = serve sempre)
export const serveNoTempo = (musica, tempo) => !musica?.tempos?.length || musica.tempos.includes(tempo);
export function lerPref(k, padrao) { try { const v = localStorage.getItem(k); return v === null ? padrao : JSON.parse(v); } catch { return padrao; } }
export function gravarPref(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

// Data no formato do site da CNBB (aaaa-mm-dd), no horário do aparelho
export const dataIso = s => { const d = new Date(s); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };

// Consulta a Liturgia Diária (CNBB) de um dia; devolve null se não conseguir
export async function buscarLiturgia(data, completo = false) {
  try {
    const r = await fetch('/api/liturgia?data=' + dataIso(data) + (completo ? '&completo=1' : ''));
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
export const ehAclamacao = nome => /^aclama/i.test(String(nome || '').trim());
// Tempo litúrgico do sistema a partir do que a CNBB informa
export function tempoDaLiturgia(l) {
  if (!l) return '';
  if (/solenidade|festa\b/i.test(l.celebracao)) return 'Solenidade / Festa';
  const t = (l.tempo + ' ' + l.celebracao).toLowerCase();
  if (t.includes('advento')) return 'Advento';
  if (t.includes('quaresma')) return 'Quaresma';
  if (t.includes('natal')) return 'Natal';
  if (t.includes('páscoa') || t.includes('pascoa') || t.includes('pentecostes')) return 'Páscoa';
  if (t.includes('comum')) return 'Tempo Comum';
  return '';
}

// Tipos de evento (em ordem alfabética)
export const TIPOS_EVENTO = ['Adoração', 'Almoço', 'Animação', 'Encontro Jovem', 'Luau', 'Mariano', 'Terço'];

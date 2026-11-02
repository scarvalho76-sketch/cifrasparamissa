// Lembretes de devoção pela data da missa: primeira sexta-feira do mês e dias dos santos de devoção.
// "busca" encontra na Biblioteca músicas ligadas ao lembrete (pelo nome ou observação).
import { simples } from './util';

const SANTOS = [
  { dia: 1, mes: 1, icone: '💙', curto: 'Santa Maria, Mãe de Deus', titulo: 'Santa Maria, Mãe de Deus', texto: 'Mãe de Jesus e figura central na devoção mariana.', busca: /\b(maria|mae de deus|nossa senhora|ave)\b/ },
  { dia: 31, mes: 1, icone: '✝️', curto: 'São João Bosco', titulo: 'São João Bosco', texto: 'Fundador dos Salesianos e defensor dos jovens e dos pobres.', busca: /\b(bosco|dom bosco)\b/ },
  { dia: 29, mes: 6, domingo: true, icone: '🗝️', curto: 'São Pedro', titulo: 'São Pedro (e São Paulo)', texto: 'Apóstolo de Jesus e o primeiro Papa. No Brasil, quando 29 de junho cai em dia de semana, a solenidade passa para o domingo seguinte.', busca: /\b(pedro|pescador|pedra|tu es pedro)\b/ },
  { dia: 15, mes: 8, domingo: true, icone: '💙', curto: 'Assunção de Nossa Senhora', titulo: 'Assunção de Nossa Senhora', texto: 'Maria elevada ao céu em corpo e alma. No Brasil, quando 15 de agosto cai em dia de semana, a solenidade passa para o domingo seguinte.', busca: /\b(maria|nossa senhora|assuncao|rainha|ave)\b/ },
  { dia: 23, mes: 9, icone: '✝️', curto: 'São Padre Pio', titulo: 'São Padre Pio de Pietrelcina', texto: 'Frade capuchinho e sacerdote italiano.', busca: /\b(padre pio|pio)\b/ },
  { dia: 1, mes: 10, icone: '🌹', curto: 'Santa Teresinha', titulo: 'Santa Teresinha do Menino Jesus', texto: 'Também chamada Santa Teresinha de Lisieux, uma das santas mais populares da era moderna.', busca: /\b(teresinha|teresa|rosas?)\b/ },
  { dia: 4, mes: 10, icone: '🕊️', curto: 'São Francisco de Assis', titulo: 'São Francisco de Assis', texto: 'Fundador da Ordem Franciscana, padroeiro dos animais e do meio ambiente.', busca: /\b(francisco|assis|instrumento de (tua|vossa) paz|irmao sol)\b/ },
  { dia: 12, mes: 10, icone: '💙', curto: 'N. Sra. Aparecida', titulo: 'Nossa Senhora Aparecida', texto: 'Padroeira do Brasil.', busca: /\b(aparecida|maria|nossa senhora|mae|ave)\b/ },
  { dia: 22, mes: 10, icone: '✝️', curto: 'São João Paulo II', titulo: 'São João Paulo II', texto: 'Papa polonês que guiou a Igreja de 1978 a 2005.', busca: /\b(joao paulo|totus tuus)\b/ },
  { dia: 8, mes: 12, icone: '💙', curto: 'Imaculada Conceição', titulo: 'Imaculada Conceição de Nossa Senhora', texto: 'Maria concebida sem pecado.', busca: /\b(imaculada|conceicao|maria|nossa senhora|ave)\b/ }
];

export function lembretesDoDia(data) {
  if (!data) return [];
  const d = new Date(data);
  if (isNaN(d)) return [];
  const dia = d.getDate(), mes = d.getMonth() + 1, sem = d.getDay();
  const out = [];
  if (sem === 5 && dia <= 7) out.push({ icone: '❤️', curto: 'Sagrado Coração (1ª sexta)', titulo: 'Primeira sexta-feira do mês', texto: 'Devoção ao Sagrado Coração de Jesus. Lembre-se das músicas ao Sagrado Coração.', busca: /\bcoracao\b/ });
  for (const s of SANTOS) {
    // No Brasil, algumas solenidades (São Pedro e São Paulo, Assunção) vão para o domingo seguinte
    // quando o dia cai em semana: o lembrete aparece no dia e nesse domingo (até 6 dias depois)
    const festa = new Date(d.getFullYear(), s.mes - 1, s.dia);
    const depois = Math.round((new Date(d.getFullYear(), mes - 1, dia) - festa) / 864e5);
    const noDomingo = s.domingo && sem === 0 && depois >= 1 && depois <= 6;
    if ((s.dia === dia && s.mes === mes) || noDomingo) out.push({ ...s, titulo: (s.icone === '💙' ? '' : 'Dia de ') + s.titulo });
  }
  return out;
}

export const musicasDoLembrete = (l, musicas) => (musicas || []).filter(m => l.busca.test(simples(m.nome + ' ' + (m.obs || ''))));

// Missa "específica" (solenidade, festa, Fiéis Defuntos, dia de santo de devoção): só nelas faz sentido
// começar copiando as músicas de uma missa anterior da mesma celebração.
const COMUNS = new Set(['domingo', 'tempo', 'comum', 'semana', 'missa', 'solenidade', 'festa', 'memoria', 'feira', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'senhor', 'nosso', 'nossa']);
const fortes = t => simples(t).split(' ').filter(p => p.length >= 4 && !COMUNS.has(p) && !/^\d/.test(p) && !/^(\d+a|ano)$/.test(p));
export function ehMissaEspecial({ data, titulo = '', tempo = '', celebracao = '' }) {
  if (tempo === 'Solenidade / Festa') return true;
  if (/solenidade|festa\b|defuntos|comemora|natal|pascoa|pentecostes|cinzas|ramos|santissima|corpus|cristo rei/i.test(titulo + ' ' + celebracao)) return true;
  return lembretesDoDia(data).length > 0;
}
// Missas anteriores da mesma celebração: mesmo nome (palavras principais), mesmo dia do ano ou mesmo santo
export function missasParecidas(anteriores, { data, titulo = '' }) {
  const alvo = fortes(titulo);
  const d = data ? new Date(data) : null;
  const meus = new Set(lembretesDoDia(data).map(l => l.curto));
  return (anteriores || []).map(a => {
    const ws = new Set(fortes(a.titulo));
    const nome = alvo.length ? alvo.filter(w => ws.has(w)).length / alvo.length : 0;
    const ad = new Date(a.data_hora);
    const mesmoDia = d && ad.getDate() === d.getDate() && ad.getMonth() === d.getMonth();
    const mesmoSanto = lembretesDoDia(a.data_hora).some(l => meus.has(l.curto));
    const nota = (nome >= 0.6 ? 3 + nome : 0) + (mesmoDia ? 2 : 0) + (mesmoSanto ? 2 : 0);
    return { a, nota };
  }).filter(x => x.nota >= 2).sort((x, y) => y.nota - x.nota).map(x => x.a);
}

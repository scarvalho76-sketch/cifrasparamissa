// Lembretes de devoção pela data da missa: primeira sexta-feira do mês e dias dos santos de devoção.
// "busca" encontra na Biblioteca músicas ligadas ao lembrete (pelo nome ou observação).
import { simples } from './util';

const SANTOS = [
  { dia: 1, mes: 1, icone: '💙', curto: 'Santa Maria, Mãe de Deus', titulo: 'Santa Maria, Mãe de Deus', texto: 'Mãe de Jesus e figura central na devoção mariana.', busca: /\b(maria|mae de deus|nossa senhora|ave)\b/ },
  { dia: 31, mes: 1, icone: '✝️', curto: 'São João Bosco', titulo: 'São João Bosco', texto: 'Fundador dos Salesianos e defensor dos jovens e dos pobres.', busca: /\b(bosco|dom bosco)\b/ },
  { dia: 29, mes: 6, icone: '🗝️', curto: 'São Pedro', titulo: 'São Pedro (e São Paulo)', texto: 'Apóstolo de Jesus e o primeiro Papa. No Brasil, quando 29 de junho cai em dia de semana, a solenidade passa para o domingo seguinte.', busca: /\b(pedro|pescador|pedra|tu es pedro)\b/ },
  { dia: 23, mes: 9, icone: '✝️', curto: 'São Padre Pio', titulo: 'São Padre Pio de Pietrelcina', texto: 'Frade capuchinho e sacerdote italiano.', busca: /\b(padre pio|pio)\b/ },
  { dia: 1, mes: 10, icone: '🌹', curto: 'Santa Teresinha', titulo: 'Santa Teresinha do Menino Jesus', texto: 'Também chamada Santa Teresinha de Lisieux, uma das santas mais populares da era moderna.', busca: /\b(teresinha|teresa|rosas?)\b/ },
  { dia: 4, mes: 10, icone: '🕊️', curto: 'São Francisco de Assis', titulo: 'São Francisco de Assis', texto: 'Fundador da Ordem Franciscana, padroeiro dos animais e do meio ambiente.', busca: /\b(francisco|assis|instrumento de (tua|vossa) paz|irmao sol)\b/ },
  { dia: 22, mes: 10, icone: '✝️', curto: 'São João Paulo II', titulo: 'São João Paulo II', texto: 'Papa polonês que guiou a Igreja de 1978 a 2005.', busca: /\b(joao paulo|totus tuus)\b/ }
];

export function lembretesDoDia(data) {
  if (!data) return [];
  const d = new Date(data);
  if (isNaN(d)) return [];
  const dia = d.getDate(), mes = d.getMonth() + 1, sem = d.getDay();
  const out = [];
  if (sem === 5 && dia <= 7) out.push({ icone: '❤️', curto: 'Sagrado Coração (1ª sexta)', titulo: 'Primeira sexta-feira do mês', texto: 'Devoção ao Sagrado Coração de Jesus. Lembre-se das músicas ao Sagrado Coração.', busca: /\bcoracao\b/ });
  for (const s of SANTOS) {
    // São Pedro e São Paulo: no Brasil, vai para o domingo entre 30/06 e 05/07 quando 29/06 não é domingo
    const pedroNoDomingo = s.mes === 6 && sem === 0 && ((mes === 6 && dia === 30) || (mes === 7 && dia <= 5));
    if ((s.dia === dia && s.mes === mes) || pedroNoDomingo) out.push({ ...s, titulo: 'Dia de ' + s.titulo });
  }
  return out;
}

export const musicasDoLembrete = (l, musicas) => (musicas || []).filter(m => l.busca.test(simples(m.nome + ' ' + (m.obs || ''))));

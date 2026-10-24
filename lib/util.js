// Pequenas funções usadas em várias telas
export const chave = (nome, artista) => (String(nome || '').trim() + '|' + String(artista || '').trim()).toLowerCase();
export const simples = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const dataLonga = s => { const t = new Date(s).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }); return t.charAt(0).toUpperCase() + t.slice(1); };
export const dataCurta = s => new Date(s).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const TEMPOS = ['Tempo Comum', 'Advento', 'Natal', 'Quaresma', 'Semana Santa', 'Páscoa', 'Solenidade / Festa'];
export function lerPref(k, padrao) { try { const v = localStorage.getItem(k); return v === null ? padrao : JSON.parse(v); } catch { return padrao; } }
export function gravarPref(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

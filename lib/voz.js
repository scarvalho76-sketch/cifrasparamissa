// Microfone compartilhado pela calibração e pela rolagem por voz (Modo celebração / Modo evento)
import { lerPref, gravarPref, simples } from './util';

const st = { an: null, buf: null, n: 0, quadro: 0, fluxo: null, ctx: null };

export async function abrirMicrofone() {
  if (st.an) { if (st.ctx?.state === 'suspended') await st.ctx.resume(); return true; }
  const fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const an = ctx.createAnalyser(); an.fftSize = 1024;
  ctx.createMediaStreamSource(fluxo).connect(an);
  Object.assign(st, { fluxo, ctx, an, buf: new Float32Array(an.fftSize) });
  const medir = () => {
    an.getFloatTimeDomainData(st.buf);
    let s = 0; for (const v of st.buf) s += v * v;
    const db = 20 * Math.log10(Math.sqrt(s / st.buf.length) + 1e-8);
    st.n = Math.max(0, Math.min(100, (db + 80) * 1.25));
    st.quadro = requestAnimationFrame(medir);
  };
  medir();
  return true;
}
export function fecharMicrofone() {
  cancelAnimationFrame(st.quadro);
  try { st.fluxo?.getTracks().forEach(t => t.stop()); st.ctx?.close(); } catch {}
  Object.assign(st, { an: null, buf: null, n: 0, fluxo: null, ctx: null });
}
export const nivel = () => st.n;

export const lerCalibracao = () => lerPref('missa:voz', null);
export const limiar = () => lerCalibracao()?.limiar ?? 45;

const mediana = ms => new Promise(res => {
  const vals = []; const t = setInterval(() => vals.push(st.n), 50);
  setTimeout(() => { clearInterval(t); vals.sort((a, b) => a - b); res(vals[Math.floor(vals.length / 2)] || 0); }, ms);
});
// 3 s de silêncio (ambiente) + 3,5 s cantando; o limiar fica entre os dois
export async function calibrar(aoEtapa) {
  await abrirMicrofone();
  aoEtapa('silencio'); const fundo = await mediana(3000);
  aoEtapa('cante'); const voz = await mediana(3500);
  const c = { fundo: Math.round(fundo), voz: Math.round(voz), limiar: Math.round(fundo + Math.max(6, (voz - fundo) * 0.45)), em: Date.now() };
  gravarPref('missa:voz', c);
  return c;
}

// Reconhecimento de palavras (precisa de internet no Chrome); devolve uma função para parar
export function ouvirPalavras(aoTexto, aoErro) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { aoErro?.('sem-reconhecimento'); return () => {}; }
  let ativo = true;
  const r = new SR(); r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true;
  r.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript + ' '; aoTexto(t.trim()); };
  r.onerror = e => aoErro?.(e.error);
  r.onend = () => { if (ativo) { try { r.start(); } catch {} } };
  try { r.start(); } catch (e) { aoErro?.(e.message); }
  return () => { ativo = false; try { r.stop(); } catch {} };
}

export const palavras = t => simples(t).split(' ').filter(p => p.length >= 3);

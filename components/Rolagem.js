'use client';
import { useEffect, useRef, useState } from 'react';
import { lerPref, gravarPref } from '@/lib/util';
import { ehLinhaDeAcordes } from '@/lib/musica';
import { abrirMicrofone, nivel, limiar, lerCalibracao, ouvirPalavras, palavras } from '@/lib/voz';

// Rolagem automática do momento aberto: rola a tela até o botão do próximo momento aparecer.
// Velocidade de 1 a 10, lembrada no aparelho. Tocar no texto também pausa/retoma.
const PX_POR_SEG = v => Math.round(6 * Math.pow(1.38, v - 1)); // 1 ≈ 6 px/s … 10 ≈ 110 px/s
export default function Rolagem({ alvoId }) {
  const [rolando, setRolando] = useState(false);
  const [voz, setVoz] = useState(false);        // rolagem guiada pela voz
  const [cantando, setCantando] = useState(false);
  const [avisoVoz, setAvisoVoz] = useState('');
  const [vel, setVel] = useState(4);
  const barra = useRef(null);
  const estado = useRef({ resto: 0, ultimo: 0, quadro: 0 });
  useEffect(() => { setVel(lerPref('missa:rolagem', 4)); }, []);
  // Pedal (seta para a esquerda) liga/desliga a rolagem do momento aberto
  const alternarRef = useRef(null);
  useEffect(() => {
    const h = () => alternarRef.current?.();
    window.addEventListener('cantus:rolagem', h);
    return () => window.removeEventListener('cantus:rolagem', h);
  }, []);
  const mudarVel = d => setVel(v => { const n = Math.min(10, Math.max(1, v + d)); gravarPref('missa:rolagem', n); return n; });

  const chegou = () => {
    const alvo = document.getElementById(alvoId);
    const alturaBarra = barra.current?.offsetHeight || 60;
    const fimDaPagina = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    return fimDaPagina || (alvo && alvo.getBoundingClientRect().bottom <= window.innerHeight - alturaBarra - 12);
  };

  useEffect(() => {
    if (!rolando) return;
    const e = estado.current; e.ultimo = 0; e.resto = 0;
    const passo = t => {
      if (!e.ultimo) e.ultimo = t;
      const dt = Math.min(0.1, (t - e.ultimo) / 1000); e.ultimo = t;
      e.resto += PX_POR_SEG(vel) * dt;
      const px = Math.floor(e.resto);
      if (px >= 1) { window.scrollBy(0, px); e.resto -= px; }
      if (chegou()) { setRolando(false); return; }
      e.quadro = requestAnimationFrame(passo);
    };
    e.quadro = requestAnimationFrame(passo);
    // tocar no texto da música pausa
    const tocar = ev => { if (!barra.current?.contains(ev.target)) setRolando(false); };
    const sumiu = () => { if (document.visibilityState !== 'visible') setRolando(false); };
    document.addEventListener('pointerdown', tocar); document.addEventListener('visibilitychange', sumiu);
    return () => { cancelAnimationFrame(e.quadro); document.removeEventListener('pointerdown', tocar); document.removeEventListener('visibilitychange', sumiu); };
  }, [rolando, vel, alvoId]);

  // Rolagem por voz: desce enquanto há voz (acima do limiar calibrado) e,
  // quando reconhece palavras da letra, reposiciona a tela na região certa
  useEffect(() => {
    if (!voz) return;
    let ativo = true, quadro = 0, ultimo = 0, resto = 0, pararPalavras = () => {};
    const card = document.getElementById(alvoId)?.closest('.cer-mom');
    // só as linhas com letra (sem as linhas de acordes); linhas quebradas contam separadas
    const linhas = card ? [...card.querySelectorAll('pre > span, .oe-texto p')]
      .filter(el => { const t = el.textContent.trim(); return palavras(t).length && !ehLinhaDeAcordes(t); }) : [];
    const pal = linhas.map(el => new Set(palavras(el.textContent)));
    const ALTURA = () => window.innerHeight / 3;
    // linha que está agora na altura de leitura (1/3 da tela)
    const naLeitura = () => { const i = linhas.findIndex(el => el.getBoundingClientRect().bottom > ALTURA()); return i < 0 ? linhas.length - 1 : i; };
    function localizar(texto) {
      const ouvidas = [...new Set(palavras(texto).slice(-8))]; if (ouvidas.length < 2) return;
      const atual = naLeitura();
      let melhor = -1, nota = 0;
      for (let i = Math.max(0, atual - 4); i <= Math.min(linhas.length - 1, atual + 24); i++) {
        // palavras na própria linha valem mais que na seguinte (linha quebrada)
        let n = 0, peso = 0;
        for (const p of ouvidas) { if (pal[i].has(p)) { n++; peso += 1; } else if (pal[i + 1]?.has(p)) { n++; peso += 0.6; } }
        if (n < Math.min(3, ouvidas.length)) continue;
        const s = peso - (i < atual ? 0.5 : 0) - Math.abs(i - atual) * 0.04;
        if (s > nota) { nota = s; melhor = i; }
      }
      if (melhor < 0) return;
      const r = linhas[melhor].getBoundingClientRect();
      if (Math.abs(r.top - ALTURA()) < r.height * 1.5) return; // já está no lugar
      resto = 0;
      window.scrollTo({ top: r.top + window.scrollY - ALTURA(), behavior: 'smooth' });
    }
    (async () => {
      try { await abrirMicrofone(); } catch (e) { setAvisoVoz('Microfone indisponível: ' + e.message); setVoz(false); return; }
      if (!ativo) return;
      if (!lerCalibracao()) setAvisoVoz('Dica: calibre a voz no topo da página.');
      pararPalavras = ouvirPalavras(localizar, er => { if (er === 'sem-reconhecimento') setAvisoVoz('Sem reconhecimento de palavras neste navegador: só pelo volume da voz.'); });
      const passo = t => {
        if (!ultimo) ultimo = t;
        const dt = Math.min(0.1, (t - ultimo) / 1000); ultimo = t;
        const canta = nivel() > limiar(); setCantando(canta);
        if (canta) { resto += PX_POR_SEG(vel) * 0.8 * dt; const px = Math.floor(resto); if (px >= 1) { window.scrollBy(0, px); resto -= px; } }
        if (chegou()) { setVoz(false); return; }
        quadro = requestAnimationFrame(passo);
      };
      quadro = requestAnimationFrame(passo);
    })();
    const sumiu = () => { if (document.visibilityState !== 'visible') setVoz(false); };
    document.addEventListener('visibilitychange', sumiu);
    return () => { ativo = false; cancelAnimationFrame(quadro); pararPalavras(); setCantando(false); document.removeEventListener('visibilitychange', sumiu); };
  }, [voz, vel, alvoId]);

  function alternarVoz() {
    setAvisoVoz('');
    if (voz) return setVoz(false);
    setRolando(false); setVoz(true);
  }

  alternarRef.current = () => (voz ? setVoz(false) : alternar());
  function alternar() {
    if (rolando) return setRolando(false);
    setVoz(false);
    if (chegou()) { // já no fim: volta ao começo do momento antes de rolar
      const card = document.getElementById(alvoId)?.closest('.cer-mom');
      if (card) window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 8 });
    }
    setRolando(true);
  }

  return (
    <div ref={barra} className="cer-rolagem" role="group" aria-label="Rolagem automática">
      <button type="button" className={'cer-mini' + (rolando ? '' : ' sec')} onClick={alternar} style={{ minWidth: 92 }}>{rolando ? '⏸ Pausar' : '▶ Rolar'}</button>
      <button type="button" className={'cer-mini' + (voz ? '' : ' sec')} onClick={alternarVoz} title="Rolagem guiada pela voz" aria-pressed={voz}>
        🎤 {voz ? (cantando ? 'Ouvindo ♪' : 'Ouvindo') : 'Voz'}
      </button>
      <span className="mut" style={{ fontSize: '.85rem', marginLeft: 'auto' }}>Velocidade</span>
      <button type="button" className="sec cer-mini" onClick={() => mudarVel(-1)} aria-label="Mais devagar" disabled={vel <= 1}>−</button>
      <strong style={{ minWidth: 18, textAlign: 'center' }}>{vel}</strong>
      <button type="button" className="sec cer-mini" onClick={() => mudarVel(1)} aria-label="Mais rápido" disabled={vel >= 10}>+</button>
      {avisoVoz && <div className="mut" style={{ flexBasis: '100%', fontSize: '.8rem' }}>{avisoVoz}</div>}
    </div>
  );
}


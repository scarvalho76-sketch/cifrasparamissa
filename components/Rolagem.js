'use client';
import { useEffect, useRef, useState } from 'react';
import { lerPref, gravarPref } from '@/lib/util';

// Rolagem automática do momento aberto: rola a tela até o botão do próximo momento aparecer.
// Velocidade de 1 a 10, lembrada no aparelho. Tocar no texto também pausa/retoma.
const PX_POR_SEG = v => Math.round(6 * Math.pow(1.38, v - 1)); // 1 ≈ 6 px/s … 10 ≈ 110 px/s
export default function Rolagem({ alvoId }) {
  const [rolando, setRolando] = useState(false);
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

  alternarRef.current = () => alternar();
  function alternar() {
    if (rolando) return setRolando(false);
    if (chegou()) { // já no fim: volta ao começo do momento antes de rolar
      const card = document.getElementById(alvoId)?.closest('.cer-mom');
      if (card) window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 8 });
    }
    setRolando(true);
  }

  return (
    <div ref={barra} className="cer-rolagem" role="group" aria-label="Rolagem automática">
      <button type="button" className={'cer-mini' + (rolando ? '' : ' sec')} onClick={alternar} style={{ minWidth: 104 }}>{rolando ? '⏸ Pausar' : '▶ Rolar'}</button>
      <span className="mut" style={{ fontSize: '.85rem', marginLeft: 'auto' }}>Velocidade</span>
      <button type="button" className="sec cer-mini" onClick={() => mudarVel(-1)} aria-label="Mais devagar" disabled={vel <= 1}>−</button>
      <strong style={{ minWidth: 18, textAlign: 'center' }}>{vel}</strong>
      <button type="button" className="sec cer-mini" onClick={() => mudarVel(1)} aria-label="Mais rápido" disabled={vel >= 10}>+</button>
    </div>
  );
}


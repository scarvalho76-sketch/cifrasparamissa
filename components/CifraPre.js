'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { quebrarCifra } from '@/lib/quebra';
import { destacarPartes } from '@/components/Destaque';

// Cifra/grade na tela: mede quantos caracteres cabem e, se "quebrar" estiver ligado,
// quebra as linhas longas sem desalinhar acordes e letra. Recalcula ao girar a tela ou mudar a letra.
export default function CifraPre({ texto, fonte = 1, quebrar = true }) {
  const ref = useRef(null);
  const [colunas, setColunas] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const medir = () => {
      const cs = getComputedStyle(el);
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const larguraLetra = ctx.measureText('0000000000').width / 10 || parseFloat(cs.fontSize) * 0.6;
      const util = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setColunas(Math.max(12, Math.floor(util / larguraLetra)));
    };
    medir();
    const ro = new ResizeObserver(medir); ro.observe(el);
    return () => ro.disconnect();
  }, [fonte]);
  const mostrado = quebrar && colunas ? quebrarCifra(texto, colunas) : texto;
  return (
    <pre ref={ref} className="cer-cifra" style={{ fontSize: `${fonte}rem`, overflowX: quebrar ? 'hidden' : 'auto' }}>
      {destacarPartes(mostrado, true)}
    </pre>
  );
}

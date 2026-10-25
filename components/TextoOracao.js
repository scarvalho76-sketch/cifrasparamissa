'use client';
import { blocosOracao } from '@/lib/oracao';

// Mostra uma Oração Eucarística: presidente normal, respostas em negrito, Santo no lugar marcado
export default function TextoOracao({ texto, santo, onSantoCantado, fonte = 1 }) {
  const blocos = blocosOracao(texto);
  const santoBlocos = blocosOracao(santo);
  return (
    <div className="oe-texto" style={{ fontSize: `${1.05 * fonte}rem` }}>
      {blocos.map((b, k) => {
        if (b.tipo === 'parte') return <div key={k} className="oe-parte">{b.t}</div>;
        if (b.tipo === 'santo') return (
          <div key={k} id="oe-santo" className="oe-santo">
            <div className="row" style={{ marginBottom: 6 }}>
              <strong>Santo</strong>
              {onSantoCantado && <button type="button" className="cer-mini" onClick={onSantoCantado}>♪ Santo cantado ▸</button>}
            </div>
            {santoBlocos.length
              ? santoBlocos.map((s, j) => <p key={j} className={s.tipo === 'resp' ? 'resp' : 'pres'} style={{ whiteSpace: 'pre-wrap' }}>{s.t}</p>)
              : <p className="mut" style={{ margin: 0 }}>(texto do Santo rezado ainda não cadastrado)</p>}
          </div>
        );
        return (
          <p key={k} className={b.tipo} style={{ whiteSpace: 'pre-wrap' }}>
            <i>{b.tipo === 'resp' ? 'Todos' : 'Pres.'}</i>{b.t}
          </p>
        );
      })}
    </div>
  );
}

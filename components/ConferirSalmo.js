'use client';
import { letraDaCifra } from '@/lib/musica';
import { conferirLetra } from '@/lib/salmo';

// Mostra a letra cantada frase por frase: em vermelho o que não confere com o salmo do dia (CNBB)
export default function ConferirSalmo({ cifra, letra, salmo, aberto = false }) {
  const frases = conferirLetra(letra?.trim() ? letra : letraDaCifra(cifra || ''), salmo);
  if (!salmo || !frases.length) return null;
  const erradas = frases.filter(f => !f.ok).length;
  return (
    <details className="conferir-salmo" open={aberto || undefined}>
      <summary>
        <strong>Conferir com o salmo do dia (CNBB)</strong>{' '}
        {erradas ? <span className="conferir-erro">· {erradas} {erradas === 1 ? 'frase diferente' : 'frases diferentes'}</span>
          : <span className="okmsg">· ✓ a letra confere</span>}
      </summary>
      <div className="conferir-lista">
        {frases.map((f, k) => (
          <div key={k} className={f.ok ? '' : 'conferir-erro'}>
            {f.texto}
            {!f.ok && f.sugestao && <span className="conferir-cnbb">CNBB: {f.sugestao}</span>}
          </div>
        ))}
      </div>
      <p className="mut" style={{ fontSize: '.8rem', margin: '6px 0 0' }}>Em vermelho: frase que não está no texto da Liturgia Diária deste dia{salmo.referencia ? ` (${salmo.referencia})` : ''}.</p>
    </details>
  );
}

import { ehLinhaDeAcordes } from '@/lib/musica';

// Partes entre colchetes ([Refrão]...) em negrito dourado; na cifra/grade, acordes em negrito
export function destacarPartes(texto, comAcordes = false) {
  const linhas = String(texto).split('\n');
  return linhas.map((linha, n) => (
    <span key={n}>
      {linha.split(/(\[[^\]\n]+\])/).map((t, k) => {
        if (k % 2) return <strong key={k} className="cer-parte">{t}</strong>;
        if (comAcordes && t.trim() && ehLinhaDeAcordes(t.trim())) return <strong key={k} className="cer-acorde">{t}</strong>;
        return t;
      })}
      {n < linhas.length - 1 ? '\n' : null}
    </span>
  ));
}

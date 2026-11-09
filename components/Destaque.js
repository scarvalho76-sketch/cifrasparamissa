import { ehLinhaDeAcordes } from '@/lib/musica';

// Marcação de refrão no texto: uma linha só com [Refrão] (ou [Refrão 2] etc.)
const ehMarcaRefrao = l => /^\s*\[\s*refr[aã]o[^\]\n]*\]\s*$/i.test(l);
const ehMarcaQualquer = l => /^\s*\[[^\]\n]+\]\s*$/.test(l);
const rotuloRefrao = l => (l.match(/\[\s*([^\]\n]*)\]/)?.[1] || 'Refrão').trim();

// Uma linha: partes entre colchetes em negrito dourado; na cifra/grade, linhas de acordes em negrito
function linhaNodes(linha, comAcordes) {
  return linha.split(/(\[[^\]\n]+\])/).map((t, k) => {
    if (k % 2) return <strong key={k} className="cer-parte">{t}</strong>;
    if (comAcordes && t.trim() && ehLinhaDeAcordes(t.trim())) return <strong key={k} className="cer-acorde">{t}</strong>;
    return t;
  });
}

// Partes entre colchetes ([Refrão]...) em negrito dourado; na cifra/grade, acordes em negrito.
// O bloco que segue uma marca [Refrão] até a linha em branco (ou outra marca) vira uma caixa destacada.
export function destacarPartes(texto, comAcordes = false) {
  const linhas = String(texto).split('\n');
  const itens = [];
  let dentro = false;
  linhas.forEach(linha => {
    if (ehMarcaRefrao(linha)) { dentro = true; itens.push({ marca: true, rotulo: rotuloRefrao(linha) }); return; }
    if (dentro && (!linha.trim() || ehMarcaQualquer(linha))) dentro = false;
    itens.push({ linha, refrao: dentro });
  });

  const saida = [];
  let caixa = null;
  const ultimo = itens.length - 1;
  itens.forEach((it, n) => {
    if (it.marca || it.refrao) {
      if (!caixa) {
        caixa = { key: n, nos: [], rotulo: it.rotulo || 'Refrão' };
        saida.push(caixa);
      }
      if (!it.marca) {
        // quebra de linha antes de cada linha da caixa, exceto a primeira
        caixa.nos.push(<span key={n}>{caixa.nos.length ? '\n' : null}{linhaNodes(it.linha, comAcordes)}</span>);
      }
      return;
    }
    caixa = null;
    saida.push(<span key={n}>{linhaNodes(it.linha, comAcordes)}{n < ultimo ? '\n' : null}</span>);
  });

  return saida.map(s => (s.nos ? (
    <span key={s.key} className="cer-refrao">
      <span className="cer-refrao-aba">{s.rotulo}</span>
      {s.nos}
    </span>
  ) : s));
}

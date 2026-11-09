import { ehLinhaDeAcordes } from '@/lib/musica';

// Marcas especiais no texto, cada uma numa linha só:
//   [Refrão] → caixa dourada com aba "Refrão"
//   [FEMININO] / [MASCULINO] → faixa azul e rosa, para duetos
//   [AMBOS] → faixa dourada, para trechos cantados por todos
// O bloco que segue a marca vai até a linha em branco ou até outra marca.
const ehMarcaRefrao = l => /^\s*\[\s*refr[aã]o[^\]\n]*\]/i.test(l);
const ehMarcaVoz = l => /^\s*\[\s*(feminino|masculino|ambos)\s*\]/i.test(l);
const ehMarcaQualquer = l => /^\s*\[[^\]\n]+\]/.test(l);
// nome da marca + o que vem depois (ex.: "[Refrão] 2x" vira "Refrão 2x")
const rotuloDaMarca = l => { const m = l.match(/^\s*\[\s*([^\]\n]*)\]\s*(.*)$/); return m ? [m[1], m[2]].map(x => x.trim()).filter(Boolean).join(' ') : ''; };

// Uma linha: partes entre colchetes em negrito dourado; na cifra/grade, linhas de acordes em negrito
function linhaNodes(linha, comAcordes) {
  return linha.split(/(\[[^\]\n]+\])/).map((t, k) => {
    if (k % 2) return <strong key={k} className="cer-parte">{t}</strong>;
    if (comAcordes && t.trim() && ehLinhaDeAcordes(t.trim())) return <strong key={k} className="cer-acorde">{t}</strong>;
    return t;
  });
}

export function destacarPartes(texto, comAcordes = false) {
  const linhas = String(texto).split('\n');
  const itens = [];
  let tipo = null; // 'refrao' | 'fem' | 'masc' | null
  let rotulo = '';
  linhas.forEach(linha => {
    if (ehMarcaRefrao(linha)) { tipo = 'refrao'; rotulo = rotuloDaMarca(linha) || 'Refrão'; itens.push({ marca: true, tipo, rotulo }); return; }
    if (ehMarcaVoz(linha)) {
      tipo = /fem/i.test(linha) ? 'fem' : /ambos/i.test(linha) ? 'ambos' : 'masc';
      itens.push({ marca: true, tipo, rotulo });
      return;
    }
    if (tipo && (!linha.trim() || ehMarcaQualquer(linha))) tipo = null;
    itens.push({ linha, tipo });
  });

  const saida = [];
  let bloco = null;
  const ultimo = itens.length - 1;
  itens.forEach((it, n) => {
    if (it.marca || it.tipo) {
      // abre um bloco novo quando começa uma marca ou muda o tipo
      if (!bloco || it.marca || bloco.tipo !== it.tipo) {
        if (it.marca || !bloco || bloco.tipo !== it.tipo) {
          bloco = { key: n, tipo: it.tipo, rotulo: it.rotulo, nos: [] };
          saida.push(bloco);
        }
      }
      if (!it.marca) bloco.nos.push(<span key={n}>{bloco.nos.length ? '\n' : null}{linhaNodes(it.linha, comAcordes)}</span>);
      return;
    }
    bloco = null;
    saida.push(<span key={n}>{linhaNodes(it.linha, comAcordes)}{n < ultimo ? '\n' : null}</span>);
  });

  return saida.map(s => {
    if (!s.nos) return s;
    if (s.tipo === 'refrao') {
      return (
        <span key={s.key} className="cer-refrao">
          <span className="cer-refrao-aba">{s.rotulo}</span>
          {s.nos}
        </span>
      );
    }
    return (
      <span key={s.key} className={`cer-voz cer-voz-${s.tipo}`}>
        {s.nos}
      </span>
    );
  });
}

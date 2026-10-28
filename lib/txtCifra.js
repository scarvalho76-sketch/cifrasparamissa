// Importação de cifras em arquivo de texto (.txt) já no formato da caixa de texto:
// acordes em cima da letra. O nome vem do nome do arquivo ("Nome - Cantor.txt").
// Se as primeiras linhas trouxerem "Tom: G" ou "Capotraste na 2ª casa", esses dados são aproveitados.
import { lerTom } from './musica';

// UTF-8; se o arquivo foi salvo no Bloco de Notas antigo (Windows-1252), os acentos são corrigidos
async function lerTexto(arquivo) {
  const buf = await arquivo.arrayBuffer();
  let t = new TextDecoder('utf-8').decode(buf);
  if (t.includes('�')) { try { t = new TextDecoder('windows-1252').decode(buf); } catch {} }
  return t.replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
}

export async function lerTxtDeCifra(arquivo) {
  const texto = await lerTexto(arquivo);
  const base = arquivo.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  const [nome, ...resto] = base.split(/\s+-\s+/);
  let tom = '', tomReal = '', capo = 0;
  const linhas = texto.split('\n');
  // cabeçalho opcional no começo do arquivo
  while (linhas.length) {
    const l = linhas[0].trim();
    const mt = /^tom\s*:\s*(.+)$/i.exec(l);
    const mc = /^capo(traste)?\s*(na\s*)?:?\s*(\d{1,2})/i.exec(l);
    if (mt) {
      const forma = (/forma dos acordes no tom de\s+([A-G][#b]?m?)/i.exec(mt[1]) || [])[1];
      const real = (mt[1].match(/^\S+/) || [''])[0];
      tom = forma || real; if (forma && lerTom(real)) tomReal = real;
    } else if (mc) capo = Number(mc[3]);
    else if (l) break;
    linhas.shift();
  }
  const cifra = linhas.join('\n').replace(/[ ]+$/gm, '').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  if (!cifra) throw new Error('O arquivo está vazio.');
  return { nome: nome || '', artista: resto.join(' - '), tom: lerTom(tom) ? tom : '', cifra, capo, tomReal };
}

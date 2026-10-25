// Texto das Orações Eucarísticas com marcação simples:
//   "# Título"  -> título de parte          "T: ..." -> resposta do povo (negrito)
//   "P: ..."    -> fala do presidente        "[SANTO]" -> lugar do Santo
//   linha sem marcação continua o bloco anterior; linha em branco começa outro bloco
export function blocosOracao(texto) {
  const blocos = []; let anterior = null; let quebra = true;
  for (const bruta of String(texto || '').split('\n')) {
    const l = bruta.trim();
    if (!l) { quebra = true; continue; }
    let b = null;
    if (/^\[santo\]$/i.test(l)) b = { tipo: 'santo' };
    else if (l.startsWith('#')) b = { tipo: 'parte', t: l.replace(/^#+\s*/, '') };
    else if (/^T:/i.test(l)) b = { tipo: 'resp', t: l.replace(/^T:\s*/i, '') };
    else if (/^P:/i.test(l)) b = { tipo: 'pres', t: l.replace(/^P:\s*/i, '') };
    else if (anterior && !quebra && (anterior.tipo === 'pres' || anterior.tipo === 'resp')) { anterior.t += '\n' + l; continue; }
    else b = { tipo: 'pres', t: l };
    blocos.push(b); anterior = b; quebra = false;
  }
  return blocos;
}

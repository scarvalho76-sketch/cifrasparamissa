// Deixa o telefone no formato 55 + DDD + número (ex.: 5524998339627)
export function normalizarTelefone(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length <= 11) d = '55' + d;
  return d;
}

export function linkWhatsApp(telefone, texto) {
  return `https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`;
}

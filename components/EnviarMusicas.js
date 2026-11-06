'use client';
// Só estes momentos entram na mensagem, na ordem da missa
const MOMENTOS_DA_MENSAGEM = ['entrada', 'ato penitencial', 'glória', 'ofertório', 'santo', 'cordeiro', 'comunhão', 'ação de graças', 'saída'];

// Monta o texto: só a lista "Momento - música - autor"
export function mensagemDasMusicas(celebracao, itens, musicas) {
  const porId = Object.fromEntries((musicas || []).map(m => [m.id, m]));
  const linhas = (itens || [])
    .filter(i => MOMENTOS_DA_MENSAGEM.includes((i.momento || '').trim().toLowerCase()))
    .map(i => {
      const m = porId[i.musica_id];
      const quem = m ? [m.nome, m.artista].filter(Boolean).join(' - ') : 'a definir';
      return `${i.momento} - ${quem}`;
    });
  return linhas.join('\n');
}

// Botão ao lado do link para convidados: abre o WhatsApp com a mensagem pronta; você escolhe o destinatário lá
export default function EnviarMusicas({ celebracao, itens, musicas }) {
  const texto = mensagemDasMusicas(celebracao, itens, musicas);
  return (
    <a className="botao sec" style={{ textDecoration: 'none', minHeight: 32, padding: '2px 10px', fontSize: '.85rem', display: 'inline-flex', alignItems: 'center' }} href={'https://wa.me/?text=' + encodeURIComponent(texto)} target="_blank" rel="noreferrer">💬 Enviar músicas</a>
  );
}

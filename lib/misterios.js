// Mistérios do Santo Rosário: cada conjunto tem cinco mistérios, rezados em cinco dezenas
export const CONJUNTOS_MISTERIOS = [
  { chave: 'gozosos', nome: 'Gozosos', dias: 'segunda e sábado', lista: [
    'Anunciação do Anjo a Maria', 'Visitação de Maria a Isabel', 'Nascimento de Jesus em Belém',
    'Apresentação de Jesus no Templo', 'Perda e encontro do Menino Jesus no Templo'] },
  { chave: 'luminosos', nome: 'Luminosos', dias: 'quinta-feira', lista: [
    'Batismo de Jesus no Jordão', 'Autorrevelação de Jesus nas Bodas de Caná', 'Anúncio do Reino de Deus e convite à conversão',
    'Transfiguração de Jesus no monte Tabor', 'Instituição da Eucaristia'] },
  { chave: 'dolorosos', nome: 'Dolorosos', dias: 'terça e sexta-feira', lista: [
    'Agonia de Jesus no Horto das Oliveiras', 'Flagelação de Jesus', 'Coroação de espinhos',
    'Jesus carrega a cruz até o Calvário', 'Crucifixão e morte de Jesus'] },
  { chave: 'gloriosos', nome: 'Gloriosos', dias: 'quarta e domingo', lista: [
    'Ressurreição de Jesus', 'Ascensão de Jesus ao Céu', 'Vinda do Espírito Santo sobre os Apóstolos',
    'Assunção de Maria ao Céu', 'Coroação de Maria como Rainha do Céu e da Terra'] },
];
export const conjuntoDosMisterios = chave => CONJUNTOS_MISTERIOS.find(c => c.chave === chave) || null;

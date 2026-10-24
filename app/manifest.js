// Permite "Adicionar à tela inicial" no celular, com o nome e o ícone do Cantus
export default function manifest() {
  return {
    name: 'Cantus · Músicas para a Santa Missa', short_name: 'Cantus',
    start_url: '/', display: 'standalone', background_color: '#f7f1e4', theme_color: '#fdf8ee',
    icons: [{ src: '/icon.png', sizes: '192x192', type: 'image/png' }, { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' }]
  };
}

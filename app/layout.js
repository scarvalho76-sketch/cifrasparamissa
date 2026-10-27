import './globals.css';

export const metadata = {
  title: 'Cantus · Músicas para a Santa Missa',
  description: 'Letras, cifras e roteiro musical das missas',
  applicationName: 'Cantus',
  appleWebApp: { title: 'Cantus', capable: true }
};
export const viewport = {
  width: 'device-width', initialScale: 1,
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#fdf8ee' }, { media: '(prefers-color-scheme: dark)', color: '#1b1510' }]
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="topo">
          <a href="/" aria-label="Cantus: início">
            <img src="/emblema.webp" alt="" />
            <span className="marca"><strong>CANTUS</strong><small>Músicas para a Santa Missa</small></span>
          </a>
          <a className="credito" href="https://instagram.com/scarvalh05" target="_blank" rel="noopener noreferrer">@Sergio Carvalho</a>
        </header>
        {children}
      </body>
    </html>
  );
}

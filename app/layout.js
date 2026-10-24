import './globals.css';

export const metadata = {
  title: 'Cifras para Missas',
  description: 'Letras, cifras e roteiro musical das missas'
};
export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="topo">
          <a href="/">Cifras para Missas<small>roteiro musical</small></a>
        </header>
        {children}
      </body>
    </html>
  );
}

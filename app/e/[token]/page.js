'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { gravarConta } from '@/lib/conta';

// Link pessoal de um amigo (conta do Cantus): entra direto no painel, sem e-mail e senha
export default function EntrarConta() {
  const { token } = useParams();
  const [erro, setErro] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/conta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
        const j = await r.json();
        if (!r.ok) return setErro(j.erro || 'Link inválido.');
        gravarConta({ jwt: j.jwt, exp: j.exp, nome: j.nome });
        location.replace('/painel'); // recarrega para o sistema usar o acesso novo
      } catch { setErro('Falha de conexão. Tente de novo.'); }
    })();
  }, [token]);
  return (
    <div className="wrap">
      <div className="card" style={{ marginTop: 40 }}>
        {erro ? (<><h2>Não foi possível entrar</h2><p className="err">{erro}</p><p className="mut">Peça um novo link a quem cadastrou você.</p></>) : <p className="mut">Entrando…</p>}
      </div>
    </div>
  );
}

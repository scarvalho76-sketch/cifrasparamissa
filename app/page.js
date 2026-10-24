'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Entrada do administrador (mesmo e-mail e senha do Sonata Casamentos).
// Músicos não passam por aqui: entram pelo link pessoal.
export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(false);

  async function ir() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setPronto(true); return; }
    const { data: admin } = await supabase.rpc('eh_admin');
    if (admin) return r.replace('/painel');
    let token = null; try { token = localStorage.getItem('missa:token'); } catch {}
    if (token) return r.replace('/m/' + token);
    setErro('Este acesso não é de administrador.'); setPronto(true);
  }
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const querEntrar = new URLSearchParams(location.search).has('entrar');
      if (!session && !querEntrar) {
        let token = null; try { token = localStorage.getItem('missa:token'); } catch {}
        if (token) return r.replace('/m/' + token);
      }
      ir();
    })();
  }, []);

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) return setErro('E-mail ou senha incorretos.');
    ir();
  }

  if (!pronto) return <div className="wrap mut">Carregando…</div>;
  return (
    <div className="wrap">
      <div className="capa"><img src="/emblema.webp" alt="" /></div>
      <div className="card" style={{ marginTop: 16 }}>
        <h1>Entrar</h1>
        <p className="mut">Área do administrador. Músicos entram pelo link pessoal.</p>
        <form onSubmit={entrar}>
          <label>E-mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label>Senha</label>
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required />
          {erro && <p className="err">{erro}</p>}
          <button type="submit">Entrar</button>
        </form>
      </div>
    </div>
  );
}

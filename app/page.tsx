// Página inicial pública (vendas). Quem já está logado vai direto para o painel.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentProfile, supabaseAdmin } from '@/lib/supabase';
import { PostivaLogo } from '@/components/Logo';
import { PLANS, weeklyQuota, type PlanId } from '@/lib/plans';
import { artUrl } from '@/lib/art/url';
import { CONTATO } from '@/lib/contato';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Postiva Design · Instagram da sua empresa no automático',
  description: 'Stories, posts e reels com a marca da sua empresa, prontos para aprovar no celular e publicados no horário certo. Teste 7 dias grátis.',
};

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

async function exemplos() {
  try {
    const db = supabaseAdmin();
    const { data: s } = await db.from('app_settings').select('value').eq('key', 'landing_exemplos').maybeSingle();
    const ids = String(s?.value ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8);
    if (!ids.length) return [];
    const { data } = await db.from('posts').select('id, kind, title, art_version, art_png_path').in('id', ids);
    return ids.map((id) => (data ?? []).find((p) => p.id === id)).filter((p) => p?.art_png_path)
      .map((p) => ({ id: p!.id, kind: p!.kind, title: p!.title, src: artUrl(p!.id, p!.art_version ?? 1, false) }));
  } catch { return []; }
}

export default async function Home() {
  const me = await currentProfile().catch(() => null);
  if (me) redirect(me.role === 'gestor' ? '/gestor' : '/painel');
  const artes = await exemplos();
  const ids = (Object.keys(PLANS) as PlanId[]).filter((id) => PLANS[id].priceBRL != null);
  const wa = CONTATO.whatsapp ? `https://wa.me/${CONTATO.whatsapp.length <= 11 ? `55${CONTATO.whatsapp}` : CONTATO.whatsapp}?text=${encodeURIComponent('Olá! Quero saber mais sobre a Postiva.')}` : null;

  return (
    <main className="lp">
      <header className="lp-topo">
        <PostivaLogo size={44} />
        <nav aria-label="Principal"><a href="#como">Como funciona</a><a href="#planos">Planos</a><a href="#duvidas">Dúvidas</a><Link href="/login">Entrar</Link></nav>
      </header>

      <section className="lp-hero">
        <div>
          <span className="lp-selo">7 dias grátis · sem cartão</span>
          <h1>O Instagram da sua empresa, pronto todo dia.</h1>
          <p>Stories, posts e reels com a sua marca, os seus produtos e as datas certas. Você aprova pelo celular em segundos e a Postiva publica no horário.</p>
          <div className="lp-acoes">
            <Link className="btn" href="/cadastro">Testar 7 dias grátis</Link>
            {wa && <a className="btn ghost" href={wa} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>}
          </div>
          <ul className="lp-check">
            <li>Arte com o seu logo e as suas cores</li><li>Produtos reais, com foto da embalagem</li><li>Regras do seu setor respeitadas</li>
          </ul>
        </div>
        {artes.length > 0 && (
          <div className="lp-mosaico" aria-label="Exemplos de artes feitas pela Postiva">
            {artes.slice(0, 4).map((a) => <img key={a.id} src={a.src} alt={`Exemplo de ${a.kind}: ${a.title}`} className={a.kind === 'story' ? 'story' : ''} loading="lazy" />)}
          </div>
        )}
      </section>

      <section className="lp-faixa" aria-label="Números">
        <div><b>6</b><span>stories por dia nos planos maiores</span></div>
        <div><b>2</b><span>posts no feed por dia</span></div>
        <div><b>1 toque</b><span>para aprovar tudo da semana</span></div>
        <div><b>0</b><span>preço inventado: só o que você informa</span></div>
      </section>

      <section id="como" className="lp-sec">
        <h2>Como funciona</h2>
        <ol className="lp-passos">
          <li><strong>Conte sobre a sua empresa</strong><span>Endereço, horário, produtos que mais vendem e o seu logo. Leva 3 minutos.</span></li>
          <li><strong>Receba a semana pronta</strong><span>Em até 24 horas chegam as primeiras artes com legenda, hashtags e horário marcado.</span></li>
          <li><strong>Aprove pelo celular</strong><span>Gostou? Aprove. Quer mudar? Peça o ajuste e a nova versão volta para você.</span></li>
          <li><strong>A Postiva publica</strong><span>Tudo sai no horário certo, com botão para o cliente chamar no seu WhatsApp.</span></li>
        </ol>
      </section>

      {artes.length > 4 && (
        <section className="lp-sec">
          <h2>Feito para empresas de verdade</h2>
          <p className="lp-sub">Artes reais criadas pela Postiva para farmácias de Cabo Frio.</p>
          <div className="lp-galeria">
            {artes.map((a) => <img key={a.id} src={a.src} alt={`Exemplo de ${a.kind}: ${a.title}`} className={a.kind === 'story' ? 'story' : ''} loading="lazy" />)}
          </div>
        </section>
      )}

      <section id="planos" className="lp-sec">
        <h2>Planos</h2>
        <p className="lp-sub">Comece com 7 dias grátis em qualquer plano. Sem cartão no teste.</p>
        <div className="planos-grade">
          {ids.map((id) => {
            const p = PLANS[id]; const q = weeklyQuota(p);
            return (
              <div key={id} className={`plano-card${p.badge ? ' destaque' : ''}`}>
                {p.badge && <span className="plano-selo">{p.badge}</span>}
                <strong className="plano-nome">{p.name}</strong>
                <span className="plano-preco">{brl(p.priceBRL!)}<small>/mês</small></span>
                <ul>
                  <li>{p.storiesPerDay} stories por dia</li>
                  {p.postsPerDay > 0 && <li>{p.postsPerDay} {p.postsPerDay === 1 ? 'post' : 'posts'} no feed por dia</li>}
                  <li>{p.reelsPerWeek} reels por semana</li>
                  <li>{q.story + q.post + q.reels} peças por semana</li>
                  {p.humanAnalysis && <li>Análise mensal com especialista</li>}
                  {p.extras?.map((e) => <li key={e}>{e}</li>)}
                </ul>
                <Link className={p.badge ? 'btn' : 'btn ghost'} href={`/cadastro?plano=${id}`}>Começar grátis</Link>
              </div>
            );
          })}
        </div>
      </section>

      <section id="duvidas" className="lp-sec">
        <h2>Dúvidas frequentes</h2>
        <div className="lp-faq">
          <details><summary>Preciso pagar para testar?</summary><p>Não. São 7 dias grátis, sem cartão. No fim do teste você escolhe o plano e faz o pagamento para continuar.</p></details>
          <details><summary>Quem cria as artes?</summary><p>A Postiva cria com a sua marca, os seus produtos e as datas comemorativas da semana. Você só aprova ou pede ajuste.</p></details>
          <details><summary>Vocês colocam preço e promoção?</summary><p>Só os que você informar ou que estiverem no seu site. Nunca inventamos preço, desconto ou estoque.</p></details>
          <details><summary>Serve para farmácia?</summary><p>Sim. Seguimos as regras do setor: nada de remédio com tarja vermelha ou preta, sem promessa de cura e com o aviso obrigatório nos de venda livre.</p></details>
          <details><summary>Posso cancelar?</summary><p>Quando quiser. Veja os <Link href="/termos">Termos de uso</Link>.</p></details>
        </div>
      </section>

      <section className="lp-final">
        <h2>Pronto para ter um Instagram que vende?</h2>
        <Link className="btn" href="/cadastro">Testar 7 dias grátis</Link>
      </section>

      <footer className="lp-rodape">
        <span>© {new Date().getFullYear()} {CONTATO.empresa}{CONTATO.cnpj ? ` · CNPJ ${CONTATO.cnpj}` : ''}</span>
        <nav aria-label="Rodapé"><Link href="/termos">Termos de uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/login">Entrar</Link></nav>
      </footer>
    </main>
  );
}

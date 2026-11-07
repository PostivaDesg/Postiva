// Política de privacidade (versão básica, LGPD - Lei 13.709/2018). Revise com um advogado antes de escalar.
import LegalPage from '@/components/LegalPage';
import { CONTATO, canalContato } from '@/lib/contato';

export const metadata = { title: 'Política de privacidade · Postiva Design' };

export default function Privacidade() {
  return (
    <LegalPage title="Política de privacidade" updated="07/11/2026">
      <p>A {CONTATO.empresa}{CONTATO.cnpj ? ` (CNPJ ${CONTATO.cnpj})` : ''} trata dados pessoais conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018). Aqui explicamos quais dados usamos, para quê e quais são os seus direitos.</p>
      <h2>1. Dados que coletamos</h2>
      <ul>
        <li><strong>Da conta:</strong> nome, e-mail, senha (guardada de forma criptografada) e, quando houver, CPF ou CNPJ para cobrança.</li>
        <li><strong>Da empresa:</strong> nome, endereço, horário, WhatsApp, Instagram, site, logo, produtos e preços informados.</li>
        <li><strong>De uso:</strong> aprovações, pedidos de ajuste e cliques nos links de WhatsApp das publicações (sem identificar quem clicou).</li>
      </ul>
      <h2>2. Para que usamos</h2>
      <ul>
        <li>Criar e agendar o conteúdo da sua empresa (execução do contrato).</li>
        <li>Cobrar e emitir nota fiscal (obrigação legal e contrato).</li>
        <li>Mandar avisos sobre o serviço, como peças para aprovar e vencimentos.</li>
        <li>Melhorar as próximas peças com base no que você aprova ou pede para ajustar.</li>
      </ul>
      <h2>3. Com quem compartilhamos</h2>
      <p>Só com os serviços necessários para funcionar: hospedagem e banco de dados (Vercel e Supabase), criação de artes (Canva), agendamento no Instagram (Metricool), inteligência artificial (Anthropic) e pagamento (Mercado Pago ou outro meio escolhido). Não vendemos dados.</p>
      <h2>4. Por quanto tempo guardamos</h2>
      <p>Enquanto a conta estiver ativa e, depois, pelo prazo exigido por lei (por exemplo, dados de cobrança). Você pode pedir a exclusão a qualquer momento.</p>
      <h2>5. Seus direitos</h2>
      <p>Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados e saber com quem eles foram compartilhados. Para isso, fale {canalContato()}.</p>
      <h2>6. Segurança</h2>
      <p>Usamos conexão criptografada, senhas protegidas e acesso restrito por empresa. Cada cliente só vê os dados da própria empresa.</p>
      <h2>7. Cookies</h2>
      <p>Usamos apenas os cookies necessários para manter você conectado. Não usamos cookies de publicidade.</p>
      <h2>8. Mudanças</h2>
      <p>Se esta política mudar, avisamos no painel. A data da última atualização fica no topo da página.</p>
    </LegalPage>
  );
}

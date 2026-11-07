// Termos de uso (versão básica). Revise com um advogado antes de escalar.
import LegalPage from '@/components/LegalPage';
import { CONTATO, canalContato } from '@/lib/contato';
import { PLANS } from '@/lib/plans';

export const metadata = { title: 'Termos de uso · Postiva Design' };

export default function Termos() {
  return (
    <LegalPage title="Termos de uso" updated="07/11/2026">
      <p>Estes termos valem para quem usa a {CONTATO.empresa}{CONTATO.cnpj ? ` (CNPJ ${CONTATO.cnpj})` : ''}, serviço que cria, organiza e agenda conteúdo para o Instagram de empresas. Ao criar uma conta, você concorda com eles.</p>
      <h2>1. O serviço</h2>
      <p>A Postiva prepara artes, legendas, stories, posts e reels com base nas informações da sua empresa. Você aprova cada peça pelo painel antes de ela ser agendada. As quantidades de cada plano estão na página de planos e no cadastro.</p>
      <h2>2. Teste grátis</h2>
      <p>Toda conta nova tem 7 dias grátis, sem cartão. Ao fim do teste, para continuar, é preciso escolher um plano e pagar. Sem pagamento, a criação de peças e os agendamentos ficam pausados, mas nada do que já foi feito é apagado.</p>
      <h2>3. Planos e pagamento</h2>
      <p>Os planos são mensais: {Object.values(PLANS).filter((p) => p.priceBRL != null).map((p) => `${p.name} (R$ ${p.priceBRL}/mês)`).join(', ')}. Os valores podem mudar; quem já é cliente é avisado com antecedência. Com pagamento em atraso, a produção é pausada até a regularização.</p>
      <h2>4. Responsabilidades do cliente</h2>
      <ul>
        <li>Informar dados verdadeiros da empresa (endereço, horário, preços e promoções).</li>
        <li>Revisar e aprovar as peças antes da publicação. A aprovação confirma que o conteúdo está correto para a sua empresa.</li>
        <li>Ter autorização para usar logos, fotos e marcas que enviar.</li>
        <li>Cumprir as regras do seu setor (por exemplo, normas da Anvisa para farmácias).</li>
      </ul>
      <h2>5. O que a Postiva não faz</h2>
      <ul>
        <li>Não inventa preços, descontos ou promoções: usa só o que a empresa informa ou o que está no site dela.</li>
        <li>Não anuncia medicamentos de venda sob prescrição (tarja vermelha ou preta) nem promete cura.</li>
        <li>Não garante número de seguidores, curtidas ou vendas: resultados dependem de vários fatores.</li>
      </ul>
      <h2>6. Conteúdo e imagens</h2>
      <p>As artes feitas para a sua empresa podem ser usadas por ela enquanto for cliente e depois. Algumas imagens são geradas com inteligência artificial e são identificadas como tal nas plataformas quando exigido. A Postiva pode mostrar artes como exemplo de trabalho, sem dados pessoais de clientes, salvo pedido em contrário.</p>
      <h2>7. Cancelamento</h2>
      <p>Você pode cancelar quando quiser, {canalContato()}. O acesso continua até o fim do período já pago. A Postiva pode suspender contas que violem estes termos ou a lei.</p>
      <h2>8. Contato e foro</h2>
      <p>Dúvidas: {canalContato()}. Fica eleito o foro da comarca de Cabo Frio/RJ.</p>
    </LegalPage>
  );
}

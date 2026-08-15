// /api/historico.js
// Lista as identificações já feitas por essa conta (mais recentes primeiro),
// pra montar a tela de "Histórico". Não devolve foto aqui — isso só vem no
// /api/obter, quando a pessoa abre uma identificação específica. Evita
// respostas pesadas quando a lista tem várias fotos.
//
// Também devolve um "valor_exibicao" numérico por item (extraído da faixa de
// preço que a IA gerou), usado pelo front-end para somar o valor estimado
// total da coleção do usuário (mostrado no header, ao lado do saldo).

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function pegarToken(req) {
  const cabecalho = req.headers.authorization || '';
  if (cabecalho.indexOf('Bearer ') === 0) {
    return cabecalho.slice(7);
  }
  return null;
}

// Mesma lógica usada em /api/vitrine.js — extrai o maior número encontrado
// no texto livre da faixa de preço (ex: "R$20 a R$150 por grama" → 150).
// Mantém os dois endpoints consistentes quanto ao que "valor_exibicao" significa.
function extrairValorExibicao(faixaTexto) {
  if (!faixaTexto) return null;
  const numeros = String(faixaTexto).match(/\d+[\.,]?\d*/g);
  if (!numeros || !numeros.length) return null;

  const maior = numeros
    .map(function (n) { return parseFloat(n.replace(/\./g, '').replace(',', '.')); })
    .filter(function (n) { return !isNaN(n); })
    .sort(function (a, b) { return b - a; })[0];

  return typeof maior === 'number' && !isNaN(maior) ? maior : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const token = pegarToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Você precisa entrar na sua conta primeiro.' });
  }

  const { data: userData, error: erroAuth } = await supabase.auth.getUser(token);
  if (erroAuth || !userData || !userData.user || !userData.user.email) {
    return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
  }

  const email = userData.user.email.toLowerCase();

  const { data: linhas, error } = await supabase
    .from('identificacoes')
    .select('id, nome_provavel, confianca, desbloqueada, criado_em, faixa_preco_brasil')
    .eq('email', email)
    .order('criado_em', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Erro Supabase (historico):', error);
    return res.status(500).json({ error: 'Erro ao buscar seu histórico.' });
  }

  const itens = (linhas || []).map(function (item) {
    return {
      id: item.id,
      nome_provavel: item.nome_provavel,
      confianca: item.confianca,
      desbloqueada: item.desbloqueada,
      criado_em: item.criado_em,
      valor_exibicao: extrairValorExibicao(item.faixa_preco_brasil)
    };
  });

  return res.status(200).json({ itens: itens });
};

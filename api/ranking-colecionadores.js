// /api/ranking-colecionadores.js
// Endpoint PÚBLICO (sem login) que alimenta o card "Top Colecionadores" da
// home. Agrupa por usuário as identificações que já estão na vitrine pública
// (mesmos critérios de privacidade do /api/vitrine.js: desbloqueada = true e
// permite_vitrine = true) e soma o valor estimado de cada uma, formando um
// ranking pelo valor total catalogado.
//
// Não expõe e-mail: só nome mascarado (mesma função de vitrine.js) e a foto
// da pedra de maior valor de cada colecionador, usada como "avatar" do card
// (não temos foto de perfil do Google salva no banco — só fotos das pedras).

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LIMITE_LINHAS = 500; // teto de segurança pra não varrer a tabela toda a cada request
const TOP_N = 10;

// Mesma lógica de /api/vitrine.js — extrai o maior número da faixa de preço
// (ex: "R$20 a R$150 por grama" → 150). Mantém os endpoints consistentes.
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

// Mesma função de /api/vitrine.js — "José A." em vez do nome completo.
function mascararNome(nomeCompleto) {
  if (!nomeCompleto) return 'Cliente';
  const partes = String(nomeCompleto).trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return partes[0] + ' ' + partes[1].charAt(0).toUpperCase() + '.';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { data: linhas, error } = await supabase
      .from('identificacoes')
      .select('email, nome_exibicao, faixa_preco_brasil, foto_base64, foto_media_type, criado_em')
      .eq('desbloqueada', true)
      .eq('permite_vitrine', true)
      .not('foto_base64', 'is', null)
      .order('criado_em', { ascending: false })
      .limit(LIMITE_LINHAS);

    if (error) {
      console.error('Erro Supabase (ranking-colecionadores):', error);
      return res.status(500).json({ error: 'Erro ao buscar ranking.' });
    }

    // Agrega por e-mail (chave interna, nunca exposta na resposta).
    const porUsuario = new Map();

    (linhas || []).forEach(function (item) {
      if (!item.email) return;
      const chave = item.email.toLowerCase();
      const valor = extrairValorExibicao(item.faixa_preco_brasil) || 0;

      if (!porUsuario.has(chave)) {
        porUsuario.set(chave, {
          nome: mascararNome(item.nome_exibicao),
          valor_total: 0,
          total_pedras: 0,
          foto_destaque: null,
          _maiorValor: -1
        });
      }

      const registro = porUsuario.get(chave);
      registro.valor_total += valor;
      registro.total_pedras += 1;

      // A foto de destaque do colecionador é a da pedra de maior valor dele.
      if (valor > registro._maiorValor) {
        registro._maiorValor = valor;
        registro.foto_destaque = item.foto_base64
          ? 'data:' + (item.foto_media_type || 'image/jpeg') + ';base64,' + item.foto_base64
          : null;
      }
    });

    const ranking = Array.from(porUsuario.values())
      .map(function (r) {
        delete r._maiorValor;
        r.valor_total = Math.round(r.valor_total * 100) / 100;
        return r;
      })
      .sort(function (a, b) { return b.valor_total - a.valor_total; })
      .slice(0, TOP_N);

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
    return res.status(200).json({ ranking: ranking });

  } catch (err) {
    console.error('Erro inesperado (ranking-colecionadores):', err);
    return res.status(500).json({ error: 'Erro interno. Tente novamente em instantes.' });
  }
};

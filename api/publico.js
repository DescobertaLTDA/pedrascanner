// /api/publico.js
// Função consolidada (Vercel Hobby permite no máximo 12 Serverless Functions
// por deployment). Este arquivo junta 5 endpoints públicos (sem login) que
// antes eram arquivos separados: stats.js, vitrine.js, obter-publico.js,
// maps-key.js e lojas-proximas.js.
//
// As URLs públicas continuam as mesmas (/api/stats, /api/vitrine, etc.) —
// o roteamento é feito pelo vercel.json, que reescreve cada URL antiga pra
// /api/publico?_fn=<nome>, preservando também a query string original
// (?pagina=1, ?id=..., ?ref=...), sem precisar mudar nada no front-end.
//
// Inclui também /api/ranking-colecionadores (handlerRankingColecionadores),
// reconstruído do zero — agrupa por email as identificações desbloqueadas
// e com permite_vitrine = true, somando o valor de cada pedra.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SUPABASE_URL_REST = process.env.SUPABASE_URL;

// Extrai o maior número do texto livre da faixa de preço (ex: "R$20 a R$150" → 150).
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

// ============================================================================
// /api/stats — estatísticas gerais da comunidade (membros, pedras, hoje)
// ============================================================================
function formatarNumero(num) {
  if (!num || num === 0) return '0';
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

async function handlerStats(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    let totalMembros = 0;

    try {
      const { data: viewData, error: errView } = await supabase
        .from('view_total_usuarios')
        .select('total')
        .single();

      if (!errView && viewData && viewData.total > 0) {
        totalMembros = viewData.total;
      } else {
        throw new Error('Não foi possível acessar a view');
      }
    } catch (err) {
      const { data: membrosData, error: errMembrosData } = await supabase
        .from('identificacoes')
        .select('email');

      if (!errMembrosData && membrosData) {
        const emailsUnicos = new Set();
        membrosData.forEach(row => {
          if (row.email) emailsUnicos.add(row.email.toLowerCase());
        });
        totalMembros = emailsUnicos.size;
      }
      if (errMembrosData) {
        console.error('Erro ao buscar membros (fallback):', errMembrosData);
      }
    }

    const { count: totalPedras, error: errPedras } = await supabase
      .from('identificacoes')
      .select('id', { count: 'exact', head: true })
      .eq('publica', true);

    if (errPedras) {
      console.error('Erro ao buscar pedras:', errPedras);
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeISO = hoje.toISOString();

    const { count: avaliacoesHoje, error: errHoje } = await supabase
      .from('identificacoes')
      .select('id', { count: 'exact', head: true })
      .eq('publica', true)
      .gte('criado_em', hojeISO);

    if (errHoje) {
      console.error('Erro ao buscar avaliações de hoje:', errHoje);
    }

    const { data: membrosHojeData, error: errMembrosHoje } = await supabase
      .from('identificacoes')
      .select('email')
      .eq('publica', true)
      .gte('criado_em', hojeISO);

    let membrosHoje = 0;
    if (!errMembrosHoje && membrosHojeData) {
      const emailsUnicosHoje = new Set();
      membrosHojeData.forEach(row => {
        if (row.email) emailsUnicosHoje.add(row.email.toLowerCase());
      });
      membrosHoje = emailsUnicosHoje.size;
    }

    const { count: totalAvaliacoes, error: errTotal } = await supabase
      .from('identificacoes')
      .select('id', { count: 'exact', head: true });

    if (errTotal) {
      console.error('Erro ao buscar total de avaliações:', errTotal);
    }

    return res.status(200).json({
      membros: formatarNumero(totalMembros || 0),
      membros_raw: totalMembros || 0,
      pedras: formatarNumero(totalPedras || 0),
      pedras_raw: totalPedras || 0,
      hoje: '+' + (avaliacoesHoje || 0),
      hoje_raw: avaliacoesHoje || 0,
      membros_hoje: membrosHoje || 0,
      total_avaliacoes: totalAvaliacoes || 0,
      _debug: {
        total_membros_raw: totalMembros,
        total_pedras_raw: totalPedras,
        avaliacoes_hoje_raw: avaliacoesHoje
      }
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return res.status(500).json({
      error: 'Erro ao buscar estatísticas da comunidade',
      membros: '0',
      pedras: '0',
      hoje: '+0',
      membros_raw: 0,
      pedras_raw: 0,
      hoje_raw: 0
    });
  }
}

// ============================================================================
// /api/vitrine — identificações desbloqueadas e com permissão de exibição
// pública, paginadas (10 por página).
// ============================================================================
const VITRINE_POR_PAGINA = 10;

function mascararNome(nomeCompleto) {
  if (!nomeCompleto) return 'Cliente';
  const partes = String(nomeCompleto).trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return partes[0] + ' ' + partes[1].charAt(0).toUpperCase() + '.';
}

async function handlerVitrine(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const paginaBruta = (req.query && req.query.pagina) || (req.body && req.body.pagina) || '1';
  const pagina = Math.max(1, parseInt(paginaBruta, 10) || 1);
  const de = (pagina - 1) * VITRINE_POR_PAGINA;
  const ate = de + VITRINE_POR_PAGINA - 1;

  try {
    const { data: linhas, error, count } = await supabase
      .from('identificacoes')
      .select('id, nome_exibicao, whatsapp, nome_provavel, faixa_preco_brasil, foto_base64, foto_media_type, criado_em', { count: 'exact' })
      .eq('desbloqueada', true)
      .eq('permite_vitrine', true)
      .not('foto_base64', 'is', null)
      .order('criado_em', { ascending: false })
      .range(de, ate);

    if (error) {
      console.error('Erro Supabase (vitrine):', error);
      return res.status(500).json({ error: 'Erro ao buscar vitrine.' });
    }

    const itens = (linhas || []).map(function (item) {
      return {
        id: item.id,
        nome: mascararNome(item.nome_exibicao),
        whatsapp: item.whatsapp || null,
        pedra: item.nome_provavel,
        valor_exibicao: extrairValorExibicao(item.faixa_preco_brasil),
        foto: 'data:' + (item.foto_media_type || 'image/jpeg') + ';base64,' + item.foto_base64
      };
    });

    const totalPaginas = Math.max(1, Math.ceil((count || itens.length) / VITRINE_POR_PAGINA));

    return res.status(200).json({
      itens: itens,
      pagina: pagina,
      total_paginas: totalPaginas
    });
  } catch (err) {
    console.error('Erro inesperado (vitrine):', err);
    return res.status(500).json({ error: 'Erro interno. Tente novamente em instantes.' });
  }
}

// ============================================================================
// /api/pedras-venda — lista pública das pedras que os membros colocaram à
// venda (esta_a_venda = true), paginada (10 por página), com ordenação por
// mais recentes / mais baratas / mais caras (baseado em valor_venda, texto
// livre digitado pelo usuário no formulário de venda).
// ============================================================================
const PEDRAS_VENDA_POR_PAGINA = 10;

function extrairValorVenda(valorTexto) {
  if (!valorTexto) return null;
  var limpo = String(valorTexto).replace(/[^\d.,]/g, '');
  if (!limpo) return null;
  // Se tiver os dois separadores, assume "." como milhar e "," como decimal
  // (padrão brasileiro). Se só tiver um dos dois, trata como decimal.
  if (limpo.indexOf('.') !== -1 && limpo.indexOf(',') !== -1) {
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else {
    limpo = limpo.replace(',', '.');
  }
  var numero = parseFloat(limpo);
  return isNaN(numero) ? null : numero;
}

async function handlerPedrasVenda(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const paginaBruta = (req.query && req.query.pagina) || (req.body && req.body.pagina) || '1';
  const pagina = Math.max(1, parseInt(paginaBruta, 10) || 1);
  const ordenar = (req.query && req.query.ordenar) || (req.body && req.body.ordenar) || 'recentes';
  const de = (pagina - 1) * PEDRAS_VENDA_POR_PAGINA;
  const ate = de + PEDRAS_VENDA_POR_PAGINA - 1;

  try {
    const baseSelect = 'id, nome_exibicao, nome_provavel, valor_venda, telefone_venda, observacao_venda, negociavel_venda, venda_criada_em, foto_base64, foto_media_type';
    const ordenarPorPreco = ordenar === 'baratas' || ordenar === 'caras';

    let linhas, count, error;

    if (!ordenarPorPreco) {
      // Ordenação por data: o próprio banco já pagina certo.
      const resp = await supabase
        .from('identificacoes')
        .select(baseSelect, { count: 'exact' })
        .eq('esta_a_venda', true)
        .not('foto_base64', 'is', null)
        .order('venda_criada_em', { ascending: false })
        .range(de, ate);
      linhas = resp.data; count = resp.count; error = resp.error;
    } else {
      // Ordenação por preço: valor_venda é texto livre digitado pelo usuário,
      // então não dá pra ordenar no banco — busca tudo (tabela ainda pequena),
      // ordena em memória e pagina depois.
      const resp = await supabase
        .from('identificacoes')
        .select(baseSelect, { count: 'exact' })
        .eq('esta_a_venda', true)
        .not('foto_base64', 'is', null)
        .order('venda_criada_em', { ascending: false })
        .limit(500);
      linhas = resp.data; count = resp.count; error = resp.error;
    }

    if (error) {
      console.error('Erro Supabase (pedras-venda):', error);
      return res.status(500).json({ error: 'Erro ao buscar pedras à venda.' });
    }

    let itens = (linhas || []).map(function (item) {
      return {
        id: item.id,
        nome: mascararNome(item.nome_exibicao),
        pedra: item.nome_provavel,
        valor_venda: item.valor_venda,
        valor_venda_num: extrairValorVenda(item.valor_venda),
        telefone_venda: item.telefone_venda,
        observacao_venda: item.observacao_venda,
        negociavel_venda: !!item.negociavel_venda,
        criado_em: item.venda_criada_em,
        foto: 'data:' + (item.foto_media_type || 'image/jpeg') + ';base64,' + item.foto_base64
      };
    });

    if (ordenarPorPreco) {
      if (ordenar === 'baratas') {
        itens.sort(function (a, b) { return (a.valor_venda_num || 0) - (b.valor_venda_num || 0); });
      } else {
        itens.sort(function (a, b) { return (b.valor_venda_num || 0) - (a.valor_venda_num || 0); });
      }
      itens = itens.slice(de, ate + 1);
    }

    const totalPaginas = Math.max(1, Math.ceil((count || itens.length) / PEDRAS_VENDA_POR_PAGINA));

    return res.status(200).json({
      itens: itens,
      pagina: pagina,
      total_paginas: totalPaginas
    });
  } catch (err) {
    console.error('Erro inesperado (pedras-venda):', err);
    return res.status(500).json({ error: 'Erro interno. Tente novamente em instantes.' });
  }
}

// ============================================================================
// /api/obter-publico — dados públicos de uma identificação (dossiê da vitrine)
// ============================================================================
async function handlerObterPublico(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const id = req.query.id;
  if (!id) {
    return res.status(400).json({ error: 'ID não informado' });
  }

  try {
    const { data, error } = await supabase
      .from('identificacoes')
      .select('id, nome_provavel, confianca, caracteristicas, faixa_preco_brasil, onde_vender, desbloqueada, observacao, criado_em, esta_a_venda, valor_venda, telefone_venda, observacao_venda, negociavel_venda')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Identificação não encontrada' });
    }

    if (!data.desbloqueada) {
      data.onde_vender = null;
    }
    if (!data.esta_a_venda) {
      data.valor_venda = null;
      data.telefone_venda = null;
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('Erro ao buscar identificação pública:', error);
    return res.status(500).json({ error: 'Erro ao buscar dados' });
  }
}

// ============================================================================
// /api/ranking-colecionadores — top colecionadores por valor total em pedras
// catalogadas (soma da faixa de preço de cada identificação desbloqueada e
// com permite_vitrine = true), agrupado por conta (email).
// ============================================================================
const RANKING_COLECIONADORES_LIMITE = 20;

async function handlerRankingColecionadores(req, res) {
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
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('Erro Supabase (ranking-colecionadores):', error);
      return res.status(500).json({ error: 'Erro ao buscar ranking.' });
    }

    // Agrupa por email — cada colecionador vira uma entrada, somando o
    // valor de todas as pedras e usando a foto mais recente como destaque.
    const porEmail = {};
    (linhas || []).forEach(function (item) {
      const chave = (item.email || '').toLowerCase();
      if (!chave) return;
      if (!porEmail[chave]) {
        porEmail[chave] = {
          nome: item.nome_exibicao || 'Colecionador',
          total_pedras: 0,
          valor_total: 0,
          foto_destaque: null
        };
      }
      const grupo = porEmail[chave];
      grupo.total_pedras += 1;
      const valor = extrairValorExibicao(item.faixa_preco_brasil);
      if (valor) grupo.valor_total += valor;
      // Como as linhas já vêm ordenadas por criado_em desc, a primeira foto
      // encontrada por email é a mais recente — vira a foto de destaque.
      if (!grupo.foto_destaque && item.foto_base64) {
        grupo.foto_destaque = 'data:' + (item.foto_media_type || 'image/jpeg') + ';base64,' + item.foto_base64;
      }
      // Nome de exibição pode ter sido preenchido só depois — prioriza o
      // primeiro nome não vazio encontrado no grupo.
      if (!grupo.nome || grupo.nome === 'Colecionador') {
        grupo.nome = item.nome_exibicao || grupo.nome;
      }
    });

    const ranking = Object.keys(porEmail)
      .map(function (chave) { return porEmail[chave]; })
      .sort(function (a, b) { return b.valor_total - a.valor_total; })
      .slice(0, RANKING_COLECIONADORES_LIMITE);

    return res.status(200).json({ ranking: ranking });
  } catch (err) {
    console.error('Erro inesperado (ranking-colecionadores):', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
}

// ============================================================================
// /api/maps-key — expõe a chave do Google Maps/Places pro front-end
// ============================================================================
async function handlerMapsKey(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY || '';
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  return res.status(200).json({ key: key });
}

// ============================================================================
// /api/lojas-proximas — lojas de pedras/minerais perto de uma coordenada
// (cache no Supabase por célula de grade) + proxy de foto (GET ?ref=...)
// ============================================================================
const TAMANHO_GRADE = 0.1; // ~11km por célula
const CACHE_TTL_DIAS = 30;
const RAIO_BUSCA_METROS = 20000;
const LARGURA_MAX_FOTO_PX = 400;

function arredondarGrade(valor) {
  return Number((Math.round(valor / TAMANHO_GRADE) * TAMANHO_GRADE).toFixed(2));
}

async function buscarNoCacheLojas(gradeLat, gradeLng) {
  const url = SUPABASE_URL_REST + '/rest/v1/lojas_cache?grid_lat=eq.' + gradeLat +
    '&grid_lng=eq.' + gradeLng + '&select=lugares,atualizado_em';
  const res = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  });
  if (!res.ok) return null;
  const linhas = await res.json();
  if (!linhas || linhas.length === 0) return null;
  const registro = linhas[0];
  const idadeDias = (Date.now() - new Date(registro.atualizado_em).getTime()) / 86400000;
  if (idadeDias > CACHE_TTL_DIAS) return null;
  const lugares = registro.lugares;
  if (!lugares || lugares.length === 0 || !('foto_ref' in lugares[0])) return null;
  return lugares;
}

async function salvarNoCacheLojas(gradeLat, gradeLng, lugares) {
  const url = SUPABASE_URL_REST + '/rest/v1/lojas_cache?on_conflict=grid_lat,grid_lng';
  await fetch(url, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify([{
      grid_lat: gradeLat,
      grid_lng: gradeLng,
      lugares: lugares,
      atualizado_em: new Date().toISOString()
    }])
  });
}

async function buscarNoGooglePlaces(lat, lng) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.photos'
    },
    body: JSON.stringify({
      textQuery: 'loja de pedras e minerais joalheria gemologista',
      locationBias: {
        circle: { center: { latitude: lat, longitude: lng }, radius: RAIO_BUSCA_METROS }
      },
      maxResultCount: 10,
      languageCode: 'pt-BR'
    })
  });
  if (!res.ok) {
    const corpoErro = await res.text().catch(function() { return ''; });
    throw new Error('Places API respondeu ' + res.status + ': ' + corpoErro);
  }
  const data = await res.json();
  return (data.places || []).map(function(p) {
    var fotoRef = (p.photos && p.photos.length > 0) ? p.photos[0].name : null;
    return {
      place_id: p.id,
      nome: p.displayName && p.displayName.text,
      endereco: p.formattedAddress,
      rating: p.rating || null,
      total_avaliacoes: p.userRatingCount || null,
      lat: p.location && p.location.latitude,
      lng: p.location && p.location.longitude,
      foto_ref: fotoRef
    };
  }).slice(0, 6);
}

async function servirFotoLoja(req, res) {
  const ref = req.query && req.query.ref;
  if (!ref || typeof ref !== 'string') {
    res.status(400).json({ erro: 'parâmetro ref é obrigatório' });
    return;
  }
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(ref)) {
    res.status(400).json({ erro: 'ref inválida' });
    return;
  }
  try {
    const url = 'https://places.googleapis.com/v1/' + ref +
      '/media?maxWidthPx=' + LARGURA_MAX_FOTO_PX + '&key=' + process.env.GOOGLE_MAPS_API_KEY;
    const resposta = await fetch(url);
    if (!resposta.ok) { res.status(404).json({ erro: 'Foto não encontrada' }); return; }
    const buffer = Buffer.from(await resposta.arrayBuffer());
    const contentType = resposta.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate');
    res.status(200).send(buffer);
  } catch (erro) {
    console.error('Erro ao buscar foto da loja:', erro);
    res.status(500).json({ erro: 'Não foi possível carregar a foto' });
  }
}

async function handlerLojasProximas(req, res) {
  // GET /api/lojas-proximas?ref=places/XXX/photos/YYY → proxy de foto
  if (req.method === 'GET') { await servirFotoLoja(req, res); return; }

  if (req.method !== 'POST') { res.status(405).json({ erro: 'Método não permitido' }); return; }

  const body = req.body || {};
  const lat = typeof body.lat === 'number' ? body.lat : parseFloat(body.lat);
  const lng = typeof body.lng === 'number' ? body.lng : parseFloat(body.lng);
  if (!isFinite(lat) || !isFinite(lng)) {
    res.status(400).json({ erro: 'lat e lng são obrigatórios e devem ser números' });
    return;
  }

  const gradeLat = arredondarGrade(lat);
  const gradeLng = arredondarGrade(lng);

  try {
    let lugares = await buscarNoCacheLojas(gradeLat, gradeLng);
    let origem = 'cache';
    if (!lugares) {
      lugares = await buscarNoGooglePlaces(lat, lng);
      origem = 'google';
      await salvarNoCacheLojas(gradeLat, gradeLng, lugares);
    }
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json({ lugares: lugares, origem: origem });
  } catch (erro) {
    console.error('Erro ao buscar lojas próximas:', erro);
    res.status(500).json({ erro: 'Não foi possível buscar lojas agora' });
  }
}

// ============================================================================
// DISPATCHER — decide qual sub-endpoint chamar, com base no parâmetro _fn
// (definido pelos rewrites no vercel.json, transparente pro front-end)
// ============================================================================
const ROTAS = {
  'stats': handlerStats,
  'vitrine': handlerVitrine,
  'obter-publico': handlerObterPublico,
  'maps-key': handlerMapsKey,
  'lojas-proximas': handlerLojasProximas,
  'pedras-venda': handlerPedrasVenda,
  'ranking-colecionadores': handlerRankingColecionadores
};

module.exports = async function handler(req, res) {
  const nomeRota = req.query && req.query._fn;
  const fn = ROTAS[nomeRota];

  if (!fn) {
    return res.status(404).json({ error: 'Rota desconhecida em /api/publico.' });
  }

  return fn(req, res);
};

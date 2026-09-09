// /api/conta.js
// Função consolidada (Vercel Hobby permite no máximo 12 Serverless Functions
// por deployment). Este arquivo junta 5 endpoints que antes eram arquivos
// separados: status.js, historico.js, obter.js, desbloquear.js e reivindicar.js.
// Todos agem sobre a CONTA de um usuário específico (autenticado ou por
// cookie de sessão, no caso de reivindicar).
//
// As URLs públicas continuam as mesmas (/api/status, /api/historico, etc.) —
// o roteamento é feito pelo vercel.json, que reescreve cada URL antiga pra
// /api/conta?_fn=<nome>, sem precisar mudar nada no front-end (index.html).
//
// Pra adicionar um novo endpoint autenticado no futuro sem estourar o limite
// de funções: crie uma função handlerAlgumaCoisa(req, res) aqui embaixo,
// registre no dispatcher (const ROTAS = {...}) e adicione o rewrite
// correspondente no vercel.json.

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mantido igual ao definido originalmente em identificar.js / status.js
const LIMITE_AVALIACOES_GRATIS = 1;

// ---- Contas com acesso ilimitado (mesma lista usada em identificar.js) ----
const EMAILS_ACESSO_ILIMITADO = ['empresarialgerenciador@gmail.com'];

function pegarToken(req) {
  const cabecalho = req.headers.authorization || '';
  if (cabecalho.indexOf('Bearer ') === 0) {
    return cabecalho.slice(7);
  }
  return null;
}

function lerCookie(req, nome) {
  const cabecalho = req.headers.cookie || '';
  const partes = cabecalho.split(';').map(function (p) { return p.trim(); });
  for (const parte of partes) {
    if (parte.indexOf(nome + '=') === 0) {
      return decodeURIComponent(parte.slice(nome.length + 1));
    }
  }
  return null;
}

// Extrai o maior número do texto livre da faixa de preço (ex: "R$20 a R$150" → 150).
// Mesma lógica usada em vitrine.js — mantém "valor_exibicao" consistente entre endpoints.
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

async function autenticar(req, res) {
  const token = pegarToken(req);
  if (!token) {
    res.status(401).json({ error: 'Você precisa entrar na sua conta primeiro.' });
    return null;
  }
  const { data: userData, error: erroAuth } = await supabase.auth.getUser(token);
  if (erroAuth || !userData || !userData.user || !userData.user.email) {
    res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
    return null;
  }
  return userData.user.email.toLowerCase();
}

// ============================================================================
// /api/status — diz se a conta já pagou, quantos usos restam e quantas
// avaliações grátis ainda tem direito. Não consome nada, só consulta.
// ============================================================================
async function handlerStatus(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const email = await autenticar(req, res);
  if (!email) return;

  // Fonte confiável de "já aceitou os termos", consultada 1x e reaproveitada
  // em qualquer branch de resposta abaixo (ilimitado, grátis ou pago).
  const { data: perfil, error: erroPerfil } = await supabase
    .from('perfis_usuario')
    .select('aceitou_termos')
    .eq('email', email)
    .single();

  if (erroPerfil && erroPerfil.code !== 'PGRST116') {
    console.error('Erro Supabase (busca perfis_usuario):', erroPerfil);
  }

  const aceitouTermos = !!(perfil && perfil.aceitou_termos === true);

  if (EMAILS_ACESSO_ILIMITADO.includes(email)) {
    return res.status(200).json({
      pago: true,
      email: email,
      usos: 0,
      limite: 999999,
      saldo: 999999,
      avaliacoes_gratis_restantes: 999999,
      acesso_ilimitado: true,
      aceitou_termos: aceitouTermos
    });
  }

  const { count: avaliacoesGratisUsadas, error: erroContagem } = await supabase
    .from('identificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .eq('consumiu_credito_pago', false);

  if (erroContagem) {
    console.error('Erro Supabase (contagem avaliações grátis):', erroContagem);
  }

  const avaliacoesGratisRestantes = Math.max(
    0,
    LIMITE_AVALIACOES_GRATIS - (avaliacoesGratisUsadas || 0)
  );

  const { data: registro, error: erroBusca } = await supabase
    .from('creditos_avaliacao')
    .select('status, usos, limite, valor_pago')
    .eq('email', email)
    .single();

  if (erroBusca || !registro || registro.status !== 'pago') {
    return res.status(200).json({
      pago: false,
      email: email,
      avaliacoes_gratis_restantes: avaliacoesGratisRestantes,
      aceitou_termos: aceitouTermos
    });
  }

  var usosRestantes = registro.limite - registro.usos;
  var saldo = registro.limite > 0
    ? Math.round((registro.valor_pago * usosRestantes / registro.limite) * 100) / 100
    : 0;

  return res.status(200).json({
    pago: true,
    email: email,
    usos: registro.usos,
    limite: registro.limite,
    saldo: saldo,
    avaliacoes_gratis_restantes: avaliacoesGratisRestantes,
    aceitou_termos: aceitouTermos
  });
}

// ============================================================================
// /api/historico — lista as identificações da conta (mais recentes primeiro),
// sem foto (foto só vem em /api/obter, pra não pesar a lista).
// ============================================================================
async function handlerHistorico(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const email = await autenticar(req, res);
  if (!email) return;

  const { data: linhas, error } = await supabase
    .from('identificacoes')
    .select('id, nome_provavel, confianca, desbloqueada, criado_em, faixa_preco_brasil, esta_a_venda, venda_status, valor_venda, telefone_venda, observacao_venda, negociavel_venda, foto_base64, foto_media_type')
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
      valor_exibicao: extrairValorExibicao(item.faixa_preco_brasil),
      esta_a_venda: !!item.esta_a_venda,
      venda_status: item.venda_status || 'ativo',
      valor_venda: item.valor_venda || null,
      telefone_venda: item.telefone_venda || null,
      observacao_venda: item.observacao_venda || null,
      negociavel_venda: !!item.negociavel_venda,
      foto: item.foto_base64 ? ('data:' + (item.foto_media_type || 'image/jpeg') + ';base64,' + item.foto_base64) : null
    };
  });

  return res.status(200).json({ itens: itens });
}

// ============================================================================
// /api/obter — reabre uma identificação específica já feita antes (com foto).
// Não roda IA de novo, não consome crédito.
// ============================================================================
async function handlerObter(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { identificacao_id } = req.body || {};
  if (!identificacao_id) {
    return res.status(400).json({ error: 'identificacao_id não enviado' });
  }

  const email = await autenticar(req, res);
  if (!email) return;

  const { data: identificacao, error } = await supabase
    .from('identificacoes')
    .select('*')
    .eq('id', identificacao_id)
    .single();

  if (error || !identificacao) {
    return res.status(404).json({ error: 'Identificação não encontrada.' });
  }
  if (identificacao.email !== email) {
    return res.status(403).json({ error: 'Essa identificação não pertence a essa conta.' });
  }

  const desbloqueada = !!identificacao.desbloqueada;

  return res.status(200).json({
    identificacao_id: identificacao.id,
    nome_provavel: identificacao.nome_provavel,
    confianca: identificacao.confianca,
    nomes_alternativos: identificacao.nomes_alternativos,
    caracteristicas: identificacao.caracteristicas,
    observacao: identificacao.observacao,
    desbloqueado: desbloqueada,
    faixa_preco_brasil: identificacao.faixa_preco_brasil,
    onde_vender: desbloqueada ? identificacao.onde_vender : '',
    foto_base64: identificacao.foto_base64,
    foto_media_type: identificacao.foto_media_type,
    criado_em: identificacao.criado_em,
    esta_a_venda: !!identificacao.esta_a_venda,
    venda_status: identificacao.venda_status || 'ativo',
    valor_venda: identificacao.valor_venda || null,
    telefone_venda: identificacao.telefone_venda || null,
    observacao_venda: identificacao.observacao_venda || null,
    negociavel_venda: !!identificacao.negociavel_venda
  });
}

// ============================================================================
// /api/desbloquear — libera o "onde vender" de UMA identificação já feita,
// consumindo 1 crédito pago. Idempotente: se já estava desbloqueada, só devolve.
// ============================================================================
function montarRespostaDesbloqueio(identificacao) {
  const desbloqueada = !!identificacao.desbloqueada;
  return {
    identificacao_id: identificacao.id,
    nome_provavel: identificacao.nome_provavel,
    confianca: identificacao.confianca,
    nomes_alternativos: identificacao.nomes_alternativos,
    caracteristicas: identificacao.caracteristicas,
    observacao: identificacao.observacao,
    desbloqueado: desbloqueada,
    faixa_preco_brasil: identificacao.faixa_preco_brasil,
    onde_vender: desbloqueada ? identificacao.onde_vender : ''
  };
}

async function handlerDesbloquear(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { identificacao_id } = req.body || {};
  if (!identificacao_id) {
    return res.status(400).json({ error: 'identificacao_id não enviado' });
  }

  const email = await autenticar(req, res);
  if (!email) return;

  try {
    const { data: identificacao, error: erroIdent } = await supabase
      .from('identificacoes')
      .select('*')
      .eq('id', identificacao_id)
      .single();

    if (erroIdent || !identificacao) {
      return res.status(404).json({ error: 'Identificação não encontrada.' });
    }
    if (identificacao.email !== email) {
      return res.status(403).json({ error: 'Essa identificação não pertence a essa conta.' });
    }

    if (identificacao.desbloqueada) {
      return res.status(200).json(montarRespostaDesbloqueio(identificacao));
    }

    const { data: credito, error: erroCredito } = await supabase
      .from('creditos_avaliacao')
      .select('*')
      .eq('email', email)
      .eq('status', 'pago')
      .single();

    if (erroCredito || !credito || credito.usos >= credito.limite) {
      return res.status(402).json({ error: 'Você ainda não pagou pela avaliação.', desbloqueado: false });
    }

    const { error: erroUpdateCredito } = await supabase
      .from('creditos_avaliacao')
      .update({ usos: credito.usos + 1 })
      .eq('email', email);

    if (erroUpdateCredito) {
      console.error('Erro Supabase (update crédito):', erroUpdateCredito);
      return res.status(500).json({ error: 'Erro ao liberar o resultado. Tente novamente.' });
    }

    const { data: identAtualizada, error: erroUpdateIdent } = await supabase
      .from('identificacoes')
      .update({ desbloqueada: true, consumiu_credito_pago: true })
      .eq('id', identificacao_id)
      .select('*')
      .single();

    if (erroUpdateIdent) {
      console.error('Erro Supabase (update identificacao):', erroUpdateIdent);
    }

    const usosRestantes = credito.limite - (credito.usos + 1);
    const resposta = montarRespostaDesbloqueio(identAtualizada || { ...identificacao, desbloqueada: true });
    resposta.usos_restantes = usosRestantes;
    resposta.saldo_restante = credito.limite > 0
      ? Math.round((credito.valor_pago * usosRestantes / credito.limite) * 100) / 100
      : 0;

    return res.status(200).json(resposta);

  } catch (err) {
    console.error('Erro inesperado:', err);
    return res.status(500).json({ error: 'Erro interno. Tente novamente em instantes.' });
  }
}

// ============================================================================
// /api/colocar-venda — publica (ou atualiza) o anúncio de venda de UMA
// identificação já feita pela própria conta. Exige valor e telefone.
// ============================================================================
async function handlerColocarVenda(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { identificacao_id, valor, telefone, observacao, negociavel } = req.body || {};

  if (!identificacao_id) {
    return res.status(400).json({ error: 'identificacao_id não enviado' });
  }
  const valorLimpo = (valor || '').toString().trim();
  if (!valorLimpo) {
    return res.status(400).json({ error: 'Informe o valor de venda.' });
  }
  const telefoneLimpo = (telefone || '').toString().replace(/\D/g, '');
  if (!telefoneLimpo || telefoneLimpo.length < 10) {
    return res.status(400).json({ error: 'Informe um telefone de contato válido, com DDD.' });
  }

  const email = await autenticar(req, res);
  if (!email) return;

  const { data: identificacao, error: erroIdent } = await supabase
    .from('identificacoes')
    .select('id, email')
    .eq('id', identificacao_id)
    .single();

  if (erroIdent || !identificacao) {
    return res.status(404).json({ error: 'Identificação não encontrada.' });
  }
  if (identificacao.email !== email) {
    return res.status(403).json({ error: 'Essa identificação não pertence a essa conta.' });
  }

  const { data: atualizado, error: erroUpdate } = await supabase
    .from('identificacoes')
    .update({
      esta_a_venda: true,
      venda_status: 'ativo',
      valor_venda: valorLimpo,
      telefone_venda: telefoneLimpo,
      observacao_venda: (observacao || '').toString().trim().slice(0, 200) || null,
      negociavel_venda: !!negociavel,
      venda_criada_em: new Date().toISOString()
    })
    .eq('id', identificacao_id)
    .select('id, esta_a_venda, venda_status, valor_venda, telefone_venda, observacao_venda, negociavel_venda, venda_criada_em')
    .single();

  if (erroUpdate) {
    console.error('Erro Supabase (colocar-venda):', erroUpdate);
    return res.status(500).json({ error: 'Erro ao publicar o anúncio. Tente novamente.' });
  }

  return res.status(200).json(atualizado);
}

// ============================================================================
// /api/remover-venda — tira uma pedra da lista de "Pedras à venda" (marcar
// como vendida ou apenas desistir do anúncio, sem apagar a identificação).
// ============================================================================
// ============================================================================
// /api/remover-venda — gerencia o status de um anúncio já publicado.
// Aceita { identificacao_id, acao } onde acao é 'pausar' (padrão), 'excluir'
// ou 'vendida'. 'pausar' e 'vendida' só escondem o anúncio da vitrine pública
// (esta_a_venda=false) mantendo os dados; 'excluir' apaga valor/telefone/obs.
// ============================================================================
async function handlerRemoverVenda(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { identificacao_id, acao } = req.body || {};
  if (!identificacao_id) {
    return res.status(400).json({ error: 'identificacao_id não enviado' });
  }
  const acaoValida = ['pausar', 'excluir', 'vendida'].indexOf(acao) !== -1 ? acao : 'pausar';

  const email = await autenticar(req, res);
  if (!email) return;

  const { data: identificacao, error: erroIdent } = await supabase
    .from('identificacoes')
    .select('id, email')
    .eq('id', identificacao_id)
    .single();

  if (erroIdent || !identificacao) {
    return res.status(404).json({ error: 'Identificação não encontrada.' });
  }
  if (identificacao.email !== email) {
    return res.status(403).json({ error: 'Essa identificação não pertence a essa conta.' });
  }

  let camposUpdate;
  if (acaoValida === 'excluir') {
    camposUpdate = {
      esta_a_venda: false,
      venda_status: 'ativo',
      valor_venda: null,
      telefone_venda: null,
      observacao_venda: null,
      negociavel_venda: false,
      venda_criada_em: null
    };
  } else if (acaoValida === 'vendida') {
    camposUpdate = { esta_a_venda: false, venda_status: 'vendido' };
  } else {
    camposUpdate = { esta_a_venda: false, venda_status: 'pausado' };
  }

  const { error: erroUpdate } = await supabase
    .from('identificacoes')
    .update(camposUpdate)
    .eq('id', identificacao_id);

  if (erroUpdate) {
    console.error('Erro Supabase (remover-venda):', erroUpdate);
    return res.status(500).json({ error: 'Erro ao atualizar o anúncio. Tente novamente.' });
  }

  return res.status(200).json({ ok: true, venda_status: camposUpdate.venda_status });
}

// ============================================================================
// /api/reivindicar — vincula o navegador ao crédito de compra mais antigo
// ainda não usado, via cookie de sessão (sem token/e-mail). Mantido por
// compatibilidade; status.js/desbloquear.js já cobrem o fluxo atual com
// login por e-mail via Supabase Auth.
// ============================================================================
async function handlerReivindicar(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const sessaoExistente = lerCookie(req, 'sessao_pedra');

  if (sessaoExistente) {
    const { data: registro, error } = await supabase
      .from('creditos_avaliacao')
      .select('usos, limite, status')
      .eq('sessao_id', sessaoExistente)
      .eq('status', 'reivindicado')
      .single();

    if (!error && registro) {
      return res.status(200).json({ ok: true, usos: registro.usos, limite: registro.limite });
    }
  }

  const novaSessao = crypto.randomUUID();

  const { data: registro, error } = await supabase.rpc('reivindicar_credito', {
    p_sessao_id: novaSessao
  });

  if (error) {
    console.error('Erro ao reivindicar crédito:', error);
    return res.status(500).json({ error: 'Erro ao verificar seu acesso. Tente novamente.' });
  }

  if (!registro) {
    return res.status(403).json({
      error: 'Não encontramos uma compra recente vinculada a este acesso. Se você acabou de pagar, aguarde alguns segundos e recarregue a página.'
    });
  }

  res.setHeader(
    'Set-Cookie',
    'sessao_pedra=' + novaSessao + '; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax'
  );

  return res.status(200).json({ ok: true, usos: registro.usos, limite: registro.limite });
}

// ============================================================================
// /api/excluir-identificacao — apaga permanentemente uma identificação
// (foto + dados) da conta autenticada. Diferente de /api/remover-venda
// (que só tira o anúncio de venda, mantendo a identificação no histórico),
// este endpoint remove a linha inteira — usado no botão de lixeira da
// vitrine/catálogo, quando a pessoa se arrepende de ter catalogado algo.
// ============================================================================
async function handlerExcluirIdentificacao(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { identificacao_id } = req.body || {};
  if (!identificacao_id) {
    return res.status(400).json({ error: 'identificacao_id não enviado' });
  }

  const email = await autenticar(req, res);
  if (!email) return;

  const { data: identificacao, error: erroIdent } = await supabase
    .from('identificacoes')
    .select('id, email')
    .eq('id', identificacao_id)
    .single();

  if (erroIdent || !identificacao) {
    return res.status(404).json({ error: 'Identificação não encontrada.' });
  }
  if (identificacao.email !== email) {
    return res.status(403).json({ error: 'Essa identificação não pertence a essa conta.' });
  }

  const { error: erroDelete } = await supabase
    .from('identificacoes')
    .delete()
    .eq('id', identificacao_id);

  if (erroDelete) {
    console.error('Erro Supabase (excluir-identificacao):', erroDelete);
    return res.status(500).json({ error: 'Erro ao excluir. Tente novamente.' });
  }

  return res.status(200).json({ ok: true });
}

// ============================================================================
// /api/aceitar-termos — grava o consentimento (tabela perfis_usuario) e
// sincroniza permite_vitrine em TODAS as identificações já salvas dessa
// conta, pra fotos antigas ficarem visíveis na vitrine/rankings sem precisar
// enviar uma foto nova. Usa a service role key (ignora RLS), então funciona
// de forma confiável mesmo se a gravação direta do client (perfis_usuario
// via supabase-js) falhar por política de RLS.
// ============================================================================
async function handlerAceitarTermos(req, res) {
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

  const userId = userData.user.id;
  const email = userData.user.email.toLowerCase();
  const permiteVitrine = !!(req.body && req.body.permite_vitrine);

  try {
    const { error: erroUpsert } = await supabase
      .from('perfis_usuario')
      .upsert({
        user_id: userId,
        email: email,
        aceitou_termos: true,
        termos_aceitos_em: new Date().toISOString(),
        permite_vitrine: permiteVitrine
      }, { onConflict: 'user_id' });

    if (erroUpsert) {
      console.error('Erro Supabase (upsert perfis_usuario):', erroUpsert);
      return res.status(500).json({ error: 'Erro ao registrar aceite dos termos.' });
    }

    const { error: erroUpdate, count } = await supabase
      .from('identificacoes')
      .update({ permite_vitrine: permiteVitrine }, { count: 'exact' })
      .eq('email', email);

    if (erroUpdate) {
      console.error('Erro Supabase (sync permite_vitrine em identificacoes):', erroUpdate);
      // Não falha a resposta por causa disso — o consentimento em si já foi salvo.
    }

    return res.status(200).json({
      ok: true,
      aceitou_termos: true,
      permite_vitrine: permiteVitrine,
      identificacoes_sincronizadas: count || 0
    });
  } catch (err) {
    console.error('Erro inesperado (aceitar-termos):', err);
    return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
}

// ============================================================================
// DISPATCHER — decide qual sub-endpoint chamar, com base no parâmetro _fn
// (definido pelos rewrites no vercel.json, transparente pro front-end)
// ============================================================================
const ROTAS = {
  status: handlerStatus,
  historico: handlerHistorico,
  obter: handlerObter,
  desbloquear: handlerDesbloquear,
  reivindicar: handlerReivindicar,
  'colocar-venda': handlerColocarVenda,
  'remover-venda': handlerRemoverVenda,
  'aceitar-termos': handlerAceitarTermos,
  'excluir-identificacao': handlerExcluirIdentificacao
};

module.exports = async function handler(req, res) {
  const nomeRota = req.query && req.query._fn;
  const fn = ROTAS[nomeRota];

  if (!fn) {
    return res.status(404).json({ error: 'Rota desconhecida em /api/conta.' });
  }

  return fn(req, res);
};

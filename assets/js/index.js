// ========================================================================
    // CONFIGURAÇÃO
    // ========================================================================
    var SUPABASE_URL = 'https://yztcocshrimzwxoxsyhx.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dGNvY3Nocmltend4b3hzeWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTM2NjIsImV4cCI6MjEwNDUyOTY2Mn0.QjiBXngULPu7YzCAmxvBLvpS9svDBgWM5wEfVDhqQBE';
    var LINK_CHECKOUT_CAKTO = 'https://pay.cakto.com.br/jfotn5o_1030574';
    var catalogoDados = [];
    var catalogoDadosCarregados = false;
    // Preenchidos após o login: token da sessão (pra chamadas autenticadas
    // fora do fluxo de login) e o conjunto de IDs que pertencem à própria
    // conta — usado pra só mostrar o ícone de lixeira nas próprias fotos.
    var sessaoTokenGlobal = null;
    var meusIdsIdentificacao = {};
    var feedDados = [];

    function formatarMoedaBR(valor) {
      if (typeof valor !== 'number' || isNaN(valor)) return null;
      return 'R$ ' + valor.toFixed(2).replace('.', ',');
    }

    // Extrai um valor numérico estimado de um item do histórico, tentando os
    // possíveis formatos que a API pode retornar (número pronto ou texto em faixa).
    function extrairValorItem(item) {
      if (!item) return 0;
      if (typeof item.valor_exibicao === 'number' && !isNaN(item.valor_exibicao)) return item.valor_exibicao;
      if (typeof item.valor_estimado === 'number' && !isNaN(item.valor_estimado)) return item.valor_estimado;
      if (typeof item.preco_estimado === 'number' && !isNaN(item.preco_estimado)) return item.preco_estimado;
      var textoFaixa = item.faixa_preco_brasil || item.valor || item.valor_exibicao;
      if (typeof textoFaixa === 'string') {
        var numeros = textoFaixa.match(/[\d.,]+/g);
        if (numeros && numeros.length) {
          var valoresParseados = numeros.map(function(n) {
            return parseFloat(n.replace(/\./g, '').replace(',', '.'));
          }).filter(function(n) { return !isNaN(n); });
          if (valoresParseados.length >= 2) return (valoresParseados[0] + valoresParseados[1]) / 2;
          if (valoresParseados.length === 1) return valoresParseados[0];
        }
      }
      return 0;
    }

    function atualizarValorColecao(accessToken) {
      sessaoTokenGlobal = accessToken;
      var pillColecao = document.getElementById('nav-colecao');
      var dropdownColecaoValor = document.getElementById('nav-dropdown-colecao-valor');
      fetch('/api/historico', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + accessToken }
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          var itens = data.itens || [];
          var total = itens.reduce(function(soma, item) { return soma + extrairValorItem(item); }, 0);
          var totalFormatado = formatarMoedaBR(total) || 'R$ 0,00';
          if (pillColecao) pillColecao.innerHTML = '💎 ' + totalFormatado;
          if (dropdownColecaoValor) dropdownColecaoValor.textContent = totalFormatado;
          meusIdsIdentificacao = {};
          itens.forEach(function(item) { meusIdsIdentificacao[item.id] = true; });
          // Se a vitrine já tinha sido renderizada antes do login terminar,
          // renderiza de novo agora que já sabemos quais itens são seus —
          // é o que faz o ícone de lixeira aparecer nas suas próprias fotos.
          if (catalogoDadosCarregados) carregarVitrine(paginaVitrineAtual || 1);
        })
        .catch(function() {
          if (pillColecao) pillColecao.innerHTML = '💎 R$ 0,00';
          if (dropdownColecaoValor) dropdownColecaoValor.textContent = 'R$ 0,00';
        });
    }

    function tempoRelativo(dataIso) {
      if (!dataIso) return '';
      var diffMin = Math.max(0, Math.round((Date.now() - new Date(dataIso).getTime()) / 60000));
      if (diffMin < 1) return 'agora há pouco';
      if (diffMin < 60) return 'há ' + diffMin + ' min';
      var diffH = Math.round(diffMin / 60);
      if (diffH < 24) return 'há ' + diffH + 'h';
      var diffD = Math.round(diffH / 24);
      if (diffD < 7) return 'há ' + diffD + 'd';
      var diffSem = Math.round(diffD / 7);
      if (diffD < 30) return 'há ' + diffSem + (diffSem === 1 ? ' semana' : ' semanas');
      var diffMes = Math.round(diffD / 30);
      if (diffD < 365) return 'há ' + diffMes + (diffMes === 1 ? ' mês' : ' meses');
      var diffAno = Math.round(diffD / 365);
      return 'há ' + diffAno + (diffAno === 1 ? ' ano' : ' anos');
    }

    var MAX_PAGINAS_API = 15;

    // ========================================================================
    // PEDRAS À VENDA (dados reais, separados da vitrine "Descobertas da comunidade")
    // ========================================================================
    var pedrasVendaDados = { recentes: null, baratas: null, caras: null };

    function carregarPedrasVenda(tipo) {
      tipo = tipo || 'recentes';
      return fetch('/api/pedras-venda?pagina=1&ordenar=' + tipo)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var itens = (data.itens || []).map(function(item) {
            return {
              id: item.id,
              nome: item.pedra || 'Pedra não identificada',
              valor: formatarMoedaBR(item.valor_venda_num) || item.valor_venda || null,
              negociavel: !!item.negociavel_venda,
              data: item.criado_em || null,
              avaliador: item.nome || 'cliente',
              foto: item.foto || null,
              telefone: item.telefone_venda || null
            };
          });
          pedrasVendaDados[tipo] = itens;
          return itens;
        })
        .catch(function(err) {
          console.error('Erro ao carregar pedras à venda:', err);
          pedrasVendaDados[tipo] = [];
          return [];
        });
    }

    function carregarDadosPublicos() {
      return fetch('/api/vitrine?pagina=1')
        .then(function(r) { return r.json(); })
        .then(function(primeira) {
          var totalPaginas = Math.min(primeira.total_paginas || 1, MAX_PAGINAS_API);
          var promessas = [Promise.resolve(primeira)];
          for (var p = 2; p <= totalPaginas; p++) {
            promessas.push(
              fetch('/api/vitrine?pagina=' + p).then(function(r) { return r.json(); })
            );
          }
          return Promise.all(promessas);
        })
        .then(function(paginas) {
          var todos = [];
          paginas.forEach(function(pg) {
            (pg.itens || []).forEach(function(item) {
              todos.push({
                id: item.id,
                nome: item.pedra || 'Pedra não identificada',
                valor: formatarMoedaBR(item.valor_exibicao),
                data: item.criado_em || null,
                avaliador: item.nome || 'cliente',
                foto: item.foto || null
              });
            });
          });
          catalogoDados = todos;
          catalogoDadosCarregados = true;
          gerarFeedReal(todos);
        })
        .catch(function(err) {
          console.error('Erro ao carregar dados públicos (vitrine/catálogo):', err);
          catalogoDados = [];
          catalogoDadosCarregados = true;
          gerarFeedFallback();
        });
    }

    function gerarFeedReal(dados) {
      var recentes = dados.slice().sort(function(a, b) { return new Date(b.data) - new Date(a.data); }).slice(0, 5);
      feedDados = recentes.map(function(item) {
        var acao = '';
        if (item.valor && item.valor !== 'Valor sob consulta') {
          acao = 'avaliou <strong>' + item.nome + '</strong> por ' + item.valor;
        } else {
          acao = 'descobriu <strong>' + item.nome + '</strong>';
        }
        return { nome: item.avaliador || 'Cliente', acao: acao, tempo: tempoRelativo(item.data) || 'agora', foto: item.foto || null };
      });
      renderizarFeed(feedDados);
    }

    function gerarFeedFallback() {
      var fallback = [
        { nome: 'Tania', acao: 'descobriu <strong>Minério de Manganês</strong>!', tempo: 'agora' },
        { nome: 'LUCAS', acao: 'avaliou uma <strong>Turmalina Negra</strong> de R$ 400', tempo: '5 min' },
        { nome: 'Marcos', acao: 'encontrou <strong>Calcário</strong> na serra', tempo: '12 min' },
        { nome: 'Ana', acao: 'identificou um <strong>Quartzo Rosa</strong> raro', tempo: '23 min' },
        { nome: 'Sofia', acao: 'descobriu o valor de um <strong>Rubi</strong>', tempo: '1h' }
      ];
      renderizarFeed(fallback);
    }

    function renderizarFeed(atividades) {
      var feed = document.getElementById('community-feed');
      feed.innerHTML = '';
      if (!atividades || atividades.length === 0) {
        feed.innerHTML = '<p style="text-align:center;color:var(--ink-mute2);padding:8px 0;">Nenhuma atividade recente.</p>';
        return;
      }
      atividades.forEach(function(a) {
        var div = document.createElement('div');
        div.className = 'feed-item';
        div.style.display = 'flex';
        div.style.alignItems = 'flex-start';
        div.style.gap = '12px';
        div.style.padding = '10px 0';
        div.style.borderBottom = '1px solid var(--line)';

        var avatar;
        if (a.foto) {
          avatar = document.createElement('img');
          avatar.className = 'feed-avatar';
          avatar.src = a.foto;
          avatar.alt = a.nome || 'Foto da pedra avaliada';
          avatar.style.width = '36px';
          avatar.style.height = '36px';
          avatar.style.borderRadius = '10px';
          avatar.style.objectFit = 'cover';
          avatar.style.flexShrink = '0';
        } else {
          avatar = document.createElement('div');
          avatar.className = 'feed-avatar';
          avatar.style.width = '36px';
          avatar.style.height = '36px';
          avatar.style.borderRadius = '50%';
          avatar.style.background = 'var(--accent-light)';
          avatar.style.display = 'flex';
          avatar.style.alignItems = 'center';
          avatar.style.justifyContent = 'center';
          avatar.style.fontSize = '13px';
          avatar.style.fontWeight = '700';
          avatar.style.color = 'var(--accent-dark)';
          avatar.style.flexShrink = '0';
          avatar.style.fontFamily = "'Space Mono',monospace";
          avatar.textContent = (a.nome || '?').charAt(0).toUpperCase();
        }

        var conteudo = document.createElement('div');
        conteudo.style.display = 'flex';
        conteudo.style.flexDirection = 'column';
        conteudo.style.gap = '3px';
        conteudo.style.minWidth = '0';
        conteudo.style.flex = '1';

        var text = document.createElement('div');
        text.className = 'feed-text';
        text.style.fontSize = '13px';
        text.style.lineHeight = '1.4';
        text.style.color = 'var(--ink-soft)';
        text.style.wordBreak = 'break-word';
        text.innerHTML = '<strong style="color:var(--ink);">' + (a.nome || 'Cliente') + '</strong> ' + (a.acao || 'avaliou uma pedra');

        var time = document.createElement('span');
        time.className = 'feed-time';
        time.style.fontSize = '11px';
        time.style.color = 'var(--ink-mute2)';
        time.textContent = a.tempo || 'agora';

        conteudo.appendChild(text);
        conteudo.appendChild(time);
        div.appendChild(avatar);
        div.appendChild(conteudo);
        feed.appendChild(div);
      });
    }

    // ========================================================================
    // SUPABASE CLIENT
    // ========================================================================
    var supa;
    try {
      if (!window.supabase) throw new Error('Biblioteca Supabase não carregada');
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (erroInicSupabase) {
      console.error('Falha ao iniciar Supabase, usando modo de segurança:', erroInicSupabase);
      supa = {
        auth: {
          getSession: function() { return Promise.reject(erroInicSupabase); },
          onAuthStateChange: function() { return { data: { subscription: { unsubscribe: function() {} } } }; },
          signInWithOAuth: function() { return Promise.reject(erroInicSupabase); },
          signOut: function() { return Promise.reject(erroInicSupabase); }
        }
      };
      var scriptRetrySupabase = document.createElement('script');
      scriptRetrySupabase.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      scriptRetrySupabase.onload = function() {
        try {
          supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          atualizarHeader();
        } catch (erroRetry) {
          console.error('Retentativa de carregar Supabase falhou:', erroRetry);
        }
      };
      document.head.appendChild(scriptRetrySupabase);
    }

    // ========================================================================
    // VARIÁVEIS GLOBAIS
    // ========================================================================
    var ehNavegadorInterno = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly/i.test(navigator.userAgent || '');
    if (ehNavegadorInterno) {
      var modalNavInterno = document.getElementById('modal-navegador-interno');
      if (modalNavInterno) {
        modalNavInterno.style.display = 'flex';
        var btnCopiarLinkModal = document.getElementById('btn-copiar-link-modal');
        var btnFecharModalNavInterno = document.getElementById('btn-fechar-modal-navinterno');
        if (btnCopiarLinkModal) {
          btnCopiarLinkModal.addEventListener('click', function() {
            var url = window.location.href;
            function marcarCopiado() {
              btnCopiarLinkModal.textContent = 'Copiado!';
              setTimeout(function() { btnCopiarLinkModal.textContent = 'Copiar link'; }, 2000);
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(url).then(marcarCopiado).catch(function() {
                window.prompt('Copie o link abaixo e cole no seu navegador:', url);
              });
            } else {
              window.prompt('Copie o link abaixo e cole no seu navegador:', url);
            }
          });
        }
        if (btnFecharModalNavInterno) {
          btnFecharModalNavInterno.addEventListener('click', function() {
            modalNavInterno.style.display = 'none';
          });
        }
      }
    }
    var dropzone = document.getElementById('dropzone');
    var inputFoto = document.getElementById('input-foto');
    var preview = document.getElementById('preview');
    var previewImg = document.getElementById('preview-img');
    var actions = document.getElementById('actions');
    var btnTrocar = document.getElementById('btn-trocar');
    var btnVerResultado = document.getElementById('btn-ver-resultado');
    var btnVerResultadoLabel = document.getElementById('btn-ver-resultado-label');
    var btnProgressFill = document.getElementById('btn-progress-fill');
    var scannerOverlay = document.getElementById('scanner-overlay');
    var erroEl = document.getElementById('erro');
    var resultadoEl = document.getElementById('resultado');
    var btnDesbloquearOnde = document.getElementById('btn-desbloquear-onde');
    var headerAuthArea = document.getElementById('header-auth-area');
    var painelLogin = document.getElementById('painel-login');
    var btnFecharLogin = document.getElementById('btn-fechar-login');
    var painelPerfil = document.getElementById('painel-perfil');
    var painelVender = document.getElementById('painel-vender');
    var btnFecharVender = document.getElementById('btn-fechar-vender');
    var listaVenderEl = document.getElementById('lista-vender');
    var venderVazioEl = document.getElementById('vender-vazio');
    var btnFecharPerfil = document.getElementById('btn-fechar-perfil');
    var btnPerfilAvatar = document.getElementById('btn-perfil-avatar');
    var inputPerfilFoto = document.getElementById('input-perfil-foto');
    var perfilAvatarFoto = document.getElementById('perfil-avatar-foto');
    var perfilAvatarInicial = document.getElementById('perfil-avatar-inicial');
    var inputPerfilNome = document.getElementById('input-perfil-nome');
    var perfilEmailAtual = document.getElementById('perfil-email-atual');
    var btnSalvarPerfil = document.getElementById('btn-salvar-perfil');
    var perfilStatusEl = document.getElementById('perfil-status');
    var perfilArquivoFotoSelecionado = null;
    var perfilUsuarioAtual = null;
    var painelBoasVindas = document.getElementById('painel-boas-vindas');
    var btnFecharBoasVindas = document.getElementById('btn-fechar-boas-vindas');
    var btnContinuarBoasVindas = document.getElementById('btn-continuar-boas-vindas');
    var painelTermos = document.getElementById('painel-termos');
    var checkAceitaTermos = document.getElementById('check-aceita-termos');
    var checkAceitaVitrine = document.getElementById('check-aceita-vitrine');
    var btnAceitarTermos = document.getElementById('btn-aceitar-termos');
    var btnRecusarTermos = document.getElementById('btn-recusar-termos');
    var erroTermosEl = document.getElementById('erro-termos');
    var painelNomePerfil = document.getElementById('painel-nome-perfil');
    var inputNomePerfilOnboarding = document.getElementById('input-nome-perfil-onboarding');
    var btnSalvarNomeOnboarding = document.getElementById('btn-salvar-nome-onboarding');
    var btnPularNomeOnboarding = document.getElementById('btn-pular-nome-onboarding');
    var erroNomePerfilOnboarding = document.getElementById('erro-nome-perfil-onboarding');
    var btnGoogleLogin = document.getElementById('btn-google-login');
    var erroLoginEl = document.getElementById('erro-login');
    var fotoTiraWrap = document.getElementById('foto-tira-wrap');
    var fotoTira = document.getElementById('foto-tira');
    var fotoContador = document.getElementById('foto-contador');
    var btnAdicionarAngulo = document.getElementById('btn-adicionar-angulo');
    var MAX_FOTOS = 3;
    var fotosSelecionadas = [];
    var fotoCarregada = false;
    var analiseEmAndamento = false;
    var resultadoIAAtual = null;
    var identificacaoIdAtual = null;
    var avaliacoesGratisRestantes = 0;
    var sidebar = document.getElementById('sidebar');
    var sidebarBackdrop = document.getElementById('sidebar-backdrop');
    var btnSidebarClose = document.getElementById('btn-sidebar-close');
    var historicoLista = document.getElementById('historico-lista');
    var historicoVazio = document.getElementById('historico-vazio');
    var btnCtaFinal = document.getElementById('btn-cta-final');
    var navLinkMinhasPedras = document.getElementById('nav-link-minhas-pedras');
    var navLinkVender = document.getElementById('nav-link-vender');
    var navLinkCatalogo = document.getElementById('nav-link-catalogo');
    var navLinkRankings = document.getElementById('nav-link-rankings');
    var navLinkAjuda = document.getElementById('nav-link-ajuda');
    var secaoInstitucional = document.getElementById('secao-institucional');
    var confiancaCores = { alta: '#141414', media: '#8a8a8a', baixa: '#d3302f' };
    var btnMobileMenu = document.getElementById('btn-mobile-menu');
    var navLinksGroup = document.getElementById('nav-links-group');
    var timeoutIds = [];
    var rankingAtual = 'recentes';
    var catalogoPagina = 1;
    var catalogoPorPagina = 6;
    var catalogoFiltro = 'todos';
    var catalogoBusca = '';
    var catalogoFiltroTipo = '';
    var QTD_VITRINE = 8;
    var vitrineGrid = document.getElementById('vitrine-grid');
    var vitrinePaginacao = document.getElementById('vitrine-paginacao');
    var vitrineVazio = document.getElementById('vitrine-vazio');
    var paginaVitrineAtual = 1;
    var carregandoVitrine = false;
    var btnPagar = document.getElementById('btn-pagar');
    var btnComprarEarly = document.getElementById('btn-comprar-early');
    var btnJaPaguei = document.getElementById('btn-ja-paguei');
    var premiumPreview = document.getElementById('premium-preview');
    var areaOferta = document.getElementById('area-oferta');
    var ondeVenderBox = document.getElementById('onde-vender-box');
    var canaisVenda = document.getElementById('canais-venda');
    var mensagemUpsellEl = document.getElementById('mensagem-upsell');

    function limparTimeouts() { timeoutIds.forEach(function(id) { clearTimeout(id); });
      timeoutIds = []; }

    function setTimeoutSeguro(fn, delay) { var id = setTimeout(fn, delay);
      timeoutIds.push(id); return id; }

    function esconderPaineis() {
      painelLogin.classList.remove('active');
      painelBoasVindas.classList.remove('active');
      painelPerfil.classList.remove('active');
      painelVender.classList.remove('active');
      painelTermos.classList.remove('active');
      painelNomePerfil.classList.remove('active');
      document.body.classList.remove('popup-aberto');
      fecharSidebar();
    }

    function escapeHtml(texto) {
      var d = document.createElement('div');
      d.textContent = texto == null ? '' : String(texto);
      return d.innerHTML;
    }

    function fecharSidebar() { sidebar.classList.remove('active');
      sidebarBackdrop.classList.remove('active'); }

    function abrirPopup(painel) { esconderPaineis();
      painel.classList.add('active');
      document.body.classList.add('popup-aberto'); }

    function abrirPainelLogin() { abrirPopup(painelLogin); }

    btnFecharLogin.addEventListener('click', function() { esconderPaineis(); });

    // ========================================================================
    // PAINEL DE EDIÇÃO DE PERFIL
    // ========================================================================
    function abrirPainelPerfil(usuario) {
      perfilUsuarioAtual = usuario;
      perfilArquivoFotoSelecionado = null;
      perfilStatusEl.textContent = '';
      perfilStatusEl.className = 'perfil-status';
      var nomeAtual = (usuario.user_metadata && usuario.user_metadata.full_name) ||
                       (usuario.user_metadata && usuario.user_metadata.name) || '';
      var fotoAtual = usuario.user_metadata && usuario.user_metadata.avatar_url;
      inputPerfilNome.value = nomeAtual;
      perfilEmailAtual.textContent = usuario.email || '';
      if (fotoAtual) {
        perfilAvatarFoto.src = fotoAtual;
        perfilAvatarFoto.style.display = 'block';
        perfilAvatarInicial.style.display = 'none';
      } else {
        perfilAvatarFoto.style.display = 'none';
        perfilAvatarInicial.style.display = 'flex';
        perfilAvatarInicial.textContent = (nomeAtual || usuario.email || '?').trim().charAt(0) || '?';
      }
      abrirPopup(painelPerfil);
    }

    btnFecharPerfil.addEventListener('click', function() { esconderPaineis(); });

    btnPerfilAvatar.addEventListener('click', function() { inputPerfilFoto.click(); });

    inputPerfilFoto.addEventListener('change', function() {
      var arquivo = inputPerfilFoto.files && inputPerfilFoto.files[0];
      if (!arquivo) return;
      if (!arquivo.type || arquivo.type.indexOf('image/') !== 0) {
        perfilStatusEl.textContent = 'Escolha um arquivo de imagem.';
        perfilStatusEl.className = 'perfil-status erro';
        return;
      }
      if (arquivo.size > 5 * 1024 * 1024) {
        perfilStatusEl.textContent = 'A imagem deve ter até 5MB.';
        perfilStatusEl.className = 'perfil-status erro';
        return;
      }
      perfilArquivoFotoSelecionado = arquivo;
      perfilStatusEl.textContent = '';
      perfilStatusEl.className = 'perfil-status';
      var leitor = new FileReader();
      leitor.onload = function(e) {
        perfilAvatarFoto.src = e.target.result;
        perfilAvatarFoto.style.display = 'block';
        perfilAvatarInicial.style.display = 'none';
      };
      leitor.readAsDataURL(arquivo);
    });

    function salvarPerfil() {
      if (!perfilUsuarioAtual) return;
      var novoNome = inputPerfilNome.value.trim();
      if (!novoNome) {
        perfilStatusEl.textContent = 'Digite um nome de exibição.';
        perfilStatusEl.className = 'perfil-status erro';
        return;
      }
      btnSalvarPerfil.disabled = true;
      btnSalvarPerfil.textContent = 'Salvando...';
      perfilStatusEl.textContent = '';
      perfilStatusEl.className = 'perfil-status';

      function aplicarAtualizacao(fotoUrl) {
        var dadosAtualizados = { full_name: novoNome, name: novoNome };
        if (fotoUrl) dadosAtualizados.avatar_url = fotoUrl;
        supa.auth.updateUser({ data: dadosAtualizados }).then(function(resultado) {
          btnSalvarPerfil.disabled = false;
          btnSalvarPerfil.textContent = 'Salvar alterações';
          if (resultado.error) {
            perfilStatusEl.textContent = 'Erro ao salvar: ' + resultado.error.message;
            perfilStatusEl.className = 'perfil-status erro';
            return;
          }
          perfilStatusEl.textContent = 'Perfil atualizado!';
          perfilStatusEl.className = 'perfil-status sucesso';
          atualizarHeader();
          // Sincroniza o nome nas pedras já catalogadas (ranking/vitrine).
          // A checagem de "conta própria vs. precisa ter aceito os termos" é feita
          // dentro da função no banco (sincronizar_nome_exibicao), não aqui no cliente.
          supa.rpc('sincronizar_nome_exibicao', { novo_nome: novoNome }).then(function(rpcResp) {
            if (rpcResp.error) { console.error('Falha ao sincronizar nome na vitrine:', rpcResp.error); return; }
            if (typeof rpcResp.data === 'number' && rpcResp.data > 0) {
              carregarDadosPublicos().then(function() {
                renderizarCatalogo();
                carregarVitrine(1);
                renderizarRankings(rankingAtual);
              });
              carregarRankingColecionadores();
            }
          }).catch(function(erroRpc) { console.error('Falha ao sincronizar nome na vitrine:', erroRpc); });
          setTimeoutSeguro(function() { esconderPaineis(); }, 900);
        }).catch(function(erro) {
          btnSalvarPerfil.disabled = false;
          btnSalvarPerfil.textContent = 'Salvar alterações';
          perfilStatusEl.textContent = 'Erro ao salvar: ' + erro.message;
          perfilStatusEl.className = 'perfil-status erro';
        });
      }

      if (perfilArquivoFotoSelecionado) {
        var extensao = (perfilArquivoFotoSelecionado.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        var caminhoArquivo = perfilUsuarioAtual.id + '/avatar-' + Date.now() + '.' + extensao;
        supa.storage.from('avatars').upload(caminhoArquivo, perfilArquivoFotoSelecionado, { upsert: true }).then(function(resultadoUpload) {
          if (resultadoUpload.error) {
            btnSalvarPerfil.disabled = false;
            btnSalvarPerfil.textContent = 'Salvar alterações';
            perfilStatusEl.textContent = 'Erro ao enviar foto: ' + resultadoUpload.error.message;
            perfilStatusEl.className = 'perfil-status erro';
            return;
          }
          var urlPublica = supa.storage.from('avatars').getPublicUrl(caminhoArquivo).data.publicUrl;
          aplicarAtualizacao(urlPublica);
        }).catch(function(erroUpload) {
          btnSalvarPerfil.disabled = false;
          btnSalvarPerfil.textContent = 'Salvar alterações';
          perfilStatusEl.textContent = 'Erro ao enviar foto: ' + erroUpload.message;
          perfilStatusEl.className = 'perfil-status erro';
        });
      } else {
        aplicarAtualizacao(null);
      }
    }

    btnSalvarPerfil.addEventListener('click', salvarPerfil);

    function fecharBoasVindasEContinuar() {
      painelBoasVindas.classList.remove('active');
      document.body.classList.remove('popup-aberto');
    }
    btnFecharBoasVindas.addEventListener('click', fecharBoasVindasEContinuar);
    btnContinuarBoasVindas.addEventListener('click', fecharBoasVindasEContinuar);

    // ========================================================================
    // TERMOS DE USO (exibidos após o primeiro login com Google)
    // ========================================================================
    var CHAVE_TERMOS = 'scanner35_termos_aceitos_v1';

    function termosJaAceitos(userId) {
      try { return localStorage.getItem(CHAVE_TERMOS + '_' + userId) === '1'; }
      catch (e) { return false; }
    }

    function marcarTermosAceitos(userId) {
      try { localStorage.setItem(CHAVE_TERMOS + '_' + userId, '1'); } catch (e) {}
    }

    checkAceitaTermos.addEventListener('change', function() {
      btnAceitarTermos.disabled = !checkAceitaTermos.checked;
    });

    function abrirPainelTermos() {
      checkAceitaTermos.checked = false;
      btnAceitarTermos.disabled = true;
      erroTermosEl.style.display = 'none';
      abrirPopup(painelTermos);
    }

    btnAceitarTermos.addEventListener('click', function() {
      if (!checkAceitaTermos.checked) return;
      supa.auth.getSession().then(function(sessaoResp) {
        var sessao = sessaoResp.data.session;
        if (!sessao || !sessao.user) return;
        var permiteVitrine = checkAceitaVitrine.checked;
        var checkVitrineUpload = document.getElementById('check-permite-vitrine');
        if (checkVitrineUpload) checkVitrineUpload.checked = permiteVitrine;
        marcarTermosAceitos(sessao.user.id);
        // Registro confiável do consentimento: grava direto na tabela perfis_usuario
        // (o /api/aceitar-termos antigo falhava em silêncio e não persistia nada).
        supa.from('perfis_usuario').upsert({
          user_id: sessao.user.id,
          email: sessao.user.email,
          aceitou_termos: true,
          termos_aceitos_em: new Date().toISOString(),
          permite_vitrine: permiteVitrine
        }, { onConflict: 'user_id' }).then(function(resp) {
          if (resp.error) { console.error('Falha ao registrar aceite dos termos:', resp.error); return; }
          // Sincroniza a permissão de vitrine em TODAS as identificações já
          // salvas dessa conta (fotos antigas ficam visíveis automaticamente).
          supa.rpc('sincronizar_permite_vitrine', { novo_valor: permiteVitrine }).then(function(rpcResp) {
            if (rpcResp.error) { console.error('Falha ao sincronizar vitrine nas fotos antigas:', rpcResp.error); return; }
            carregarDadosPublicos().then(function() {
              renderizarCatalogo();
              carregarVitrine(1);
              renderizarRankings(rankingAtual);
            });
            carregarRankingColecionadores();
          }, function(erroRpc) { console.error('Falha ao sincronizar vitrine nas fotos antigas:', erroRpc); });
        });
        // Mantém a chamada antiga como melhor esforço, caso o endpoint exista e faça algo além disso.
        fetch('/api/aceitar-termos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.access_token },
          body: JSON.stringify({ aceitou_termos: true, permite_vitrine: permiteVitrine })
        }).catch(function() {});
        painelTermos.classList.remove('active');
        document.body.classList.remove('popup-aberto');
        inputNomePerfilOnboarding.value = '';
        erroNomePerfilOnboarding.style.display = 'none';
        abrirPopup(painelNomePerfil);
      });
    });

    function seguirParaBoasVindas() {
      painelNomePerfil.classList.remove('active');
      document.body.classList.remove('popup-aberto');
      abrirPopup(painelBoasVindas);
    }

    btnPularNomeOnboarding.addEventListener('click', function() {
      seguirParaBoasVindas();
    });

    btnSalvarNomeOnboarding.addEventListener('click', function() {
      var nomeEscolhido = inputNomePerfilOnboarding.value.trim();
      if (!nomeEscolhido) {
        // campo é opcional: sem nome digitado, só segue em frente
        seguirParaBoasVindas();
        return;
      }
      btnSalvarNomeOnboarding.disabled = true;
      btnSalvarNomeOnboarding.textContent = 'Salvando...';
      supa.auth.updateUser({ data: { full_name: nomeEscolhido, name: nomeEscolhido } }).then(function(resultado) {
        btnSalvarNomeOnboarding.disabled = false;
        btnSalvarNomeOnboarding.textContent = 'Salvar e continuar';
        if (resultado.error) {
          erroNomePerfilOnboarding.textContent = 'Erro ao salvar: ' + resultado.error.message;
          erroNomePerfilOnboarding.style.display = 'block';
          return;
        }
        atualizarHeader();
        // Melhor esforço: sincroniza o nome nas pedras já catalogadas (o backend checa
        // conta própria vs. consentimento confirmado antes de aplicar).
        supa.rpc('sincronizar_nome_exibicao', { novo_nome: nomeEscolhido }).then(function() {}, function() {});
        seguirParaBoasVindas();
      }).catch(function(erro) {
        btnSalvarNomeOnboarding.disabled = false;
        btnSalvarNomeOnboarding.textContent = 'Salvar e continuar';
        erroNomePerfilOnboarding.textContent = 'Erro ao salvar: ' + erro.message;
        erroNomePerfilOnboarding.style.display = 'block';
      });
    });

    btnRecusarTermos.addEventListener('click', function() {
      supa.auth.signOut().then(function() {
        window.location.reload();
      }).catch(function() {
        window.location.reload();
      });
    });

    navLinkMinhasPedras.addEventListener('click', function(e) { e.preventDefault(); abrirHistorico(); });
    navLinkVender.addEventListener('click', function(e) { e.preventDefault(); abrirPainelVender(); });
    btnSidebarClose.addEventListener('click', fecharSidebar);
    sidebarBackdrop.addEventListener('click', fecharSidebar);

    // Menu mobile: no lugar de simplesmente esconder os links (Minhas Pedras,
    // Vender, Ajuda) sem nenhuma forma de acessá-los, o botão hambúrguer abre
    // um dropdown com os mesmos links/ids/listeners de sempre.
    if (btnMobileMenu && navLinksGroup) {
      btnMobileMenu.addEventListener('click', function(e) {
        e.stopPropagation();
        var aberto = navLinksGroup.classList.toggle('mobile-menu-open');
        btnMobileMenu.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      });
      navLinksGroup.addEventListener('click', function(e) {
        if (e.target.closest('.nav-link')) {
          navLinksGroup.classList.remove('mobile-menu-open');
          btnMobileMenu.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('click', function(e) {
        if (!navLinksGroup.classList.contains('mobile-menu-open')) return;
        if (e.target.closest('#nav-links-group') || e.target.closest('#btn-mobile-menu')) return;
        navLinksGroup.classList.remove('mobile-menu-open');
        btnMobileMenu.setAttribute('aria-expanded', 'false');
      });
    }

    btnCtaFinal.addEventListener('click', function() {
      document.getElementById('area-principal').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    navLinkCatalogo.addEventListener('click', function(e) { e.preventDefault();
      document.getElementById('secao-catalogo').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    navLinkRankings.addEventListener('click', function(e) { e.preventDefault();
      document.getElementById('secao-rankings').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    // "Ajuda" agora é um link de verdade para ajuda.html (página própria, com script separado),
    // por isso não tem mais handler de clique aqui.

    // Mostra quantas avaliações grátis restam dentro do dropdown do perfil
    // (clicando no nome/pill do usuário) em vez de um badge solto na nav,
    // que quebrava o layout no mobile.
    function atualizarContadorGratis() {
      var gratisDropdown = document.getElementById('nav-dropdown-gratis');
      if (!gratisDropdown) return;
      if (avaliacoesGratisRestantes > 0) {
        gratisDropdown.style.display = 'flex';
        gratisDropdown.innerHTML =
          '<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>' +
          avaliacoesGratisRestantes + (avaliacoesGratisRestantes === 1 ? ' avaliação grátis' : ' avaliações grátis');
      } else {
        gratisDropdown.style.display = 'none';
      }
    }

    // ========================================================================
    // AUTENTICAÇÃO COM GOOGLE
    // ========================================================================
    function loginComGoogle() {
      erroLoginEl.style.display = 'none';
      if (fotosSelecionadas.length) { salvarFotosPendentes(); }
      supa.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.href.split('#')[0].split('?')[0]
        }
      }).then(function(result) {
        if (result.error) {
          erroLoginEl.textContent = 'Erro ao fazer login: ' + result.error.message;
          erroLoginEl.style.display = 'block';
        }
      }).catch(function(err) {
        erroLoginEl.textContent = 'Erro ao fazer login: ' + err.message;
        erroLoginEl.style.display = 'block';
      });
    }

    btnGoogleLogin.addEventListener('click', loginComGoogle);

    // Delegação de evento: o clique é escutado no container (que já existe
    // desde o carregamento da página), então "Entrar / Registrar" funciona
    // imediatamente, sem depender do fim da checagem assíncrona de sessão
    // (supa.auth.getSession()) que recria o botão dentro de atualizarHeader().
    headerAuthArea.addEventListener('click', function(e) {
      if (e.target.closest && e.target.closest('#btn-header-entrar')) {
        abrirPainelLogin();
      }
    });

    function atualizarHeader() {
      supa.auth.getSession().then(function(sessaoResp) {
        return sessaoResp;
      }, function(erroSessao) {
        return { data: { session: null } };
      }).then(function(sessaoResp) {
        var sessao = sessaoResp.data.session;
        if (sessao && sessao.user) {
          var nomeExibido = (sessao.user.user_metadata && sessao.user.user_metadata.full_name) || 
                            (sessao.user.user_metadata && sessao.user.user_metadata.name) || 
                            sessao.user.email || 'Usuário';
          var fotoUrl = sessao.user.user_metadata && sessao.user.user_metadata.avatar_url;
          var inicial = nomeExibido.trim().charAt(0) || '?';
          var avatarHtml = fotoUrl ?
            '<img src="' + escapeHtml(fotoUrl) + '" alt="">' :
            escapeHtml(inicial);
          headerAuthArea.innerHTML =
            '<div class="nav-user" id="nav-user">' +
            '<button class="nav-user-btn" id="btn-nav-user-toggle">' +
            '<span class="nav-avatar">' + avatarHtml + '</span>' +
            '<span class="nav-name">' + escapeHtml(nomeExibido) + '</span>' +
            '<span class="nav-colecao-pill" id="nav-colecao" title="Valor estimado total das suas pedras escaneadas">💎 ···</span>' +
            '<span class="nav-saldo-pill" id="nav-saldo">···</span>' +
            '<svg class="nav-chevron" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>' +
            '</button>' +
            '<div class="nav-dropdown" id="nav-dropdown">' +
            '<div class="nav-dropdown-colecao" id="nav-dropdown-colecao"><svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z"/></svg> <span>Coleção: <strong id="nav-dropdown-colecao-valor">···</strong></span></div>' +
            '<div class="nav-dropdown-saldo" id="nav-dropdown-saldo">···</div>' +
            '<div class="nav-dropdown-gratis" id="nav-dropdown-gratis" style="display:none;"></div>' +
            '<button class="editar-perfil" id="btn-header-editar-perfil"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Editar perfil</button>' +
            '<hr class="nav-dropdown-sep">' +
            '<button class="sair" id="btn-header-sair">Sair</button>' +
            '</div>' +
            '</div>';
          var navUser = document.getElementById('nav-user');
          atualizarContadorGratis();
          document.getElementById('btn-header-editar-perfil').addEventListener('click', function() {
            abrirPainelPerfil(sessao.user);
          });
          document.getElementById('btn-nav-user-toggle').addEventListener('click', function(e) {
            e.stopPropagation();
            navUser.classList.toggle('active');
          });
          document.addEventListener('click', function() { navUser.classList.remove('active'); });
          document.getElementById('btn-header-sair').addEventListener('click', function() {
            supa.auth.signOut().then(function() {
              window.location.reload();
            });
          });
          fetch('/api/status', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + sessao.access_token }
            })
            .then(function(res) { return res.json(); })
            .then(function(data) {
              var valorSaldo = data.pago ? formatarMoedaBR(data.saldo) : formatarMoedaBR(0);
              var saldoEl = document.getElementById('nav-saldo');
              if (saldoEl) saldoEl.textContent = valorSaldo;
              var saldoDropdownEl = document.getElementById('nav-dropdown-saldo');
              if (saldoDropdownEl) saldoDropdownEl.innerHTML = '<strong>' + valorSaldo + '</strong> de saldo';
              if (typeof data.avaliacoes_gratis_restantes === 'number') {
                avaliacoesGratisRestantes = data.avaliacoes_gratis_restantes;
                atualizarContadorGratis();
              }
              if (areaOferta) areaOferta.style.display = (data.pago && data.saldo > 0) ? 'none' : '';
              // Fonte confiável: se o backend confirma que os termos já foram aceitos
              // (em qualquer dispositivo), sincroniza o cache local e não reabre o modal.
              if (data.aceitou_termos === true) {
                marcarTermosAceitos(sessao.user.id);
              }
              var jaAceitouTermos = termosJaAceitos(sessao.user.id) || data.aceitou_termos === true;
              if (!jaAceitouTermos && !painelTermos.classList.contains('active')) {
                abrirPainelTermos();
              }
            })
            .catch(function() {
              // Falha ao consultar o backend: usa o que já sabemos localmente, sem bloquear o usuário.
              if (!termosJaAceitos(sessao.user.id) && !painelTermos.classList.contains('active')) {
                abrirPainelTermos();
              }
            });
          atualizarValorColecao(sessao.access_token);
          if (secaoInstitucional) secaoInstitucional.style.display = 'none';
        } else {
          headerAuthArea.innerHTML = '<button class="nav-cta" id="btn-header-entrar"><span class="full">Entrar / Registrar</span><span class="short">Entrar</span></button>';
          if (areaOferta) areaOferta.style.display = '';
          if (secaoInstitucional) secaoInstitucional.style.display = '';
          avaliacoesGratisRestantes = 0;
          atualizarContadorGratis();
        }
      });
    }

    // ========================================================================
    // HISTÓRICO
    // ========================================================================
    function abrirHistorico() {
      supa.auth.getSession().then(function(sessaoResp) {
        var sessao = sessaoResp.data.session;
        if (!sessao) { abrirPainelLogin(); return; }
        sidebar.classList.add('active');
        sidebarBackdrop.classList.add('active');
        historicoLista.innerHTML = '';
        historicoVazio.style.display = 'none';
        historicoVazio.textContent = 'Carregando...';
        historicoVazio.style.display = 'block';
        fetch('/api/historico', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + sessao.access_token }
          })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            renderizarHistorico(data.itens || []);
            var itens = data.itens || [];
            var total = itens.reduce(function(soma, item) { return soma + extrairValorItem(item); }, 0);
            var totalFormatado = formatarMoedaBR(total) || 'R$ 0,00';
            var pillColecao = document.getElementById('nav-colecao');
            var dropdownColecaoValor = document.getElementById('nav-dropdown-colecao-valor');
            if (pillColecao) pillColecao.innerHTML = '💎 ' + totalFormatado;
            if (dropdownColecaoValor) dropdownColecaoValor.textContent = totalFormatado;
          })
          .catch(function() {
            historicoLista.innerHTML = '';
            historicoVazio.textContent = 'Não foi possível carregar seu histórico agora.';
            historicoVazio.style.display = 'block';
          });
      });
    }

    // ========================================================================
    // VENDER — gerenciar os anúncios do próprio usuário (editar, pausar,
    // reativar, marcar como vendida, excluir)
    // ========================================================================
    var STATUS_VENDA_INFO = {
      ativo: { texto: 'Anunciado', cor: 'var(--accent)' },
      pausado: { texto: 'Pausado', cor: 'var(--ink-mute2)' },
      vendido: { texto: 'Vendido', cor: '#4a4a4a' }
    };

    function abrirPainelVender() {
      supa.auth.getSession().then(function(sessaoResp) {
        var sessao = sessaoResp.data.session;
        if (!sessao) { abrirPainelLogin(); return; }
        abrirPopup(painelVender);
        listaVenderEl.innerHTML = '';
        venderVazioEl.style.display = 'block';
        venderVazioEl.textContent = 'Carregando...';
        fetch('/api/historico', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + sessao.access_token }
          })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            var itens = (data.itens || []).filter(function(item) { return !!item.valor_venda; });
            renderizarListaVender(itens, sessao.access_token);
          })
          .catch(function() {
            venderVazioEl.textContent = 'Não foi possível carregar seus anúncios agora.';
            venderVazioEl.style.display = 'block';
          });
      });
    }

    function renderizarListaVender(itens, accessToken) {
      listaVenderEl.innerHTML = '';
      if (!itens.length) {
        venderVazioEl.textContent = 'Você ainda não colocou nenhuma pedra à venda. Abra uma pedra já identificada e toque em "Colocar à venda".';
        venderVazioEl.style.display = 'block';
        return;
      }
      venderVazioEl.style.display = 'none';

      itens.forEach(function(item) {
        var status = item.venda_status || 'ativo';
        var info = STATUS_VENDA_INFO[status] || STATUS_VENDA_INFO.ativo;
        var card = document.createElement('div');
        card.style.cssText = 'border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--card-alt);';

        var cabecalho = document.createElement('div');
        cabecalho.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:10px;';

        var fotoWrapVender = document.createElement('div');
        fotoWrapVender.style.cssText = 'flex-shrink:0;width:52px;height:52px;border-radius:9px;overflow:hidden;background:var(--card);border:1px solid var(--line);';
        if (item.foto) {
          var imgVender = document.createElement('img');
          imgVender.src = item.foto;
          imgVender.alt = item.nome_provavel || 'Pedra';
          imgVender.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
          fotoWrapVender.appendChild(imgVender);
        } else {
          fotoWrapVender.style.display = 'flex';
          fotoWrapVender.style.alignItems = 'center';
          fotoWrapVender.style.justifyContent = 'center';
          fotoWrapVender.style.fontSize = '18px';
          fotoWrapVender.style.color = 'var(--ink-mute2)';
          fotoWrapVender.textContent = '📷';
        }
        cabecalho.appendChild(fotoWrapVender);

        var textoCabecalho = document.createElement('div');
        textoCabecalho.style.cssText = 'flex:1;min-width:0;';
        textoCabecalho.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
          '<div style="font-weight:600;font-size:14px;color:var(--ink);">' + escapeHtml(item.nome_provavel || 'Pedra não identificada') + '</div>' +
          '<span style="flex-shrink:0;font-size:10px;font-weight:700;padding:3px 9px;border-radius:10px;background:' + info.cor + ';color:#fff;white-space:nowrap;">' + info.texto + '</span>' +
          '</div>' +
          '<div style="font-family:\'Space Mono\',monospace;font-weight:700;font-size:15px;color:var(--accent-dark);margin-top:2px;">' + escapeHtml(item.valor_venda) +
          (item.negociavel_venda ? ' <span style="font-weight:600;font-size:10px;color:var(--ink-mute2);">negociável</span>' : '') + '</div>';
        cabecalho.appendChild(textoCabecalho);
        card.appendChild(cabecalho);

        var formEdit = document.createElement('div');
        formEdit.style.cssText = 'display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);';
        var idValor = 'ev-' + item.id, idTel = 'et-' + item.id, idObs = 'eo-' + item.id, idNeg = 'en-' + item.id;
        formEdit.innerHTML =
          '<label style="font-size:11px;font-weight:600;color:var(--ink-mute);display:block;margin-bottom:4px;">Valor</label>' +
          '<input type="text" id="' + idValor + '" value="' + escapeHtml(item.valor_venda || '') + '" style="width:100%;padding:9px 10px;border-radius:8px;border:1px solid var(--line-strong);font-size:13px;font-family:inherit;margin-bottom:8px;">' +
          '<label style="font-size:11px;font-weight:600;color:var(--ink-mute);display:block;margin-bottom:4px;">Telefone (WhatsApp)</label>' +
          '<input type="text" id="' + idTel + '" value="' + escapeHtml(item.telefone_venda || '') + '" style="width:100%;padding:9px 10px;border-radius:8px;border:1px solid var(--line-strong);font-size:13px;font-family:inherit;margin-bottom:8px;">' +
          '<label style="font-size:11px;font-weight:600;color:var(--ink-mute);display:block;margin-bottom:4px;">Observação</label>' +
          '<textarea id="' + idObs + '" rows="2" style="width:100%;padding:9px 10px;border-radius:8px;border:1px solid var(--line-strong);font-size:13px;font-family:inherit;resize:vertical;margin-bottom:8px;">' + escapeHtml(item.observacao_venda || '') + '</textarea>' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink-mute);margin-bottom:10px;"><input type="checkbox" id="' + idNeg + '"' + (item.negociavel_venda ? ' checked' : '') + '> Valor negociável</label>' +
          '<button type="button" class="btn-salvar-edicao-venda" style="width:100%;background:var(--accent);color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;">Salvar alterações</button>' +
          '<p class="erro-edicao-venda" style="display:none;color:var(--danger);font-size:12px;margin-top:6px;text-align:center;"></p>';
        card.appendChild(formEdit);

        var acoes = document.createElement('div');
        acoes.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);';

        function criarBotaoAcao(texto, cor) {
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = texto;
          b.style.cssText = 'flex:1;min-width:100px;background:' + cor + ';border:none;border-radius:8px;padding:8px;font-size:11.5px;font-weight:700;cursor:pointer;';
          return b;
        }

        var btnEditar = criarBotaoAcao('Editar', 'var(--card)');
        btnEditar.style.border = '1px solid var(--line-strong)';
        btnEditar.style.color = 'var(--ink)';
        btnEditar.addEventListener('click', function() {
          formEdit.style.display = formEdit.style.display === 'none' ? 'block' : 'none';
        });
        acoes.appendChild(btnEditar);

        if (status !== 'vendido') {
          var btnPausarReativar = status === 'pausado' ?
            criarBotaoAcao('Reativar', 'var(--accent)') :
            criarBotaoAcao('Pausar', 'var(--card)');
          if (status !== 'pausado') { btnPausarReativar.style.border = '1px solid var(--line-strong)'; btnPausarReativar.style.color = 'var(--ink)'; }
          else { btnPausarReativar.style.color = '#fff'; }
          btnPausarReativar.addEventListener('click', function() {
            btnPausarReativar.disabled = true;
            if (status === 'pausado') {
              // Reativar = reenviar os mesmos dados pro colocar-venda
              fetch('/api/colocar-venda', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
                body: JSON.stringify({
                  identificacao_id: item.id, valor: item.valor_venda, telefone: item.telefone_venda,
                  observacao: item.observacao_venda, negociavel: item.negociavel_venda
                })
              }).then(function() { abrirPainelVender(); invalidarCachePedrasVenda(); }).catch(function() { btnPausarReativar.disabled = false; });
            } else {
              fetch('/api/remover-venda', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
                body: JSON.stringify({ identificacao_id: item.id, acao: 'pausar' })
              }).then(function() { abrirPainelVender(); invalidarCachePedrasVenda(); }).catch(function() { btnPausarReativar.disabled = false; });
            }
          });
          acoes.appendChild(btnPausarReativar);

          var btnVendida = criarBotaoAcao('Marcar vendida', '#4a4a4a');
          btnVendida.style.color = '#fff';
          btnVendida.addEventListener('click', function() {
            btnVendida.disabled = true;
            fetch('/api/remover-venda', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
              body: JSON.stringify({ identificacao_id: item.id, acao: 'vendida' })
            }).then(function() { abrirPainelVender(); invalidarCachePedrasVenda(); }).catch(function() { btnVendida.disabled = false; });
          });
          acoes.appendChild(btnVendida);
        }

        card.appendChild(acoes);

        // "Excluir" fica separado das ações principais (Editar/Pausar/Vendida),
        // que são as usadas no dia a dia — evita confundir com um botão a mais
        // do mesmo tamanho no meio da fileira, já que apagar é irreversível.
        var linhaExcluir = document.createElement('div');
        linhaExcluir.style.cssText = 'display:flex;justify-content:flex-end;margin-top:6px;';
        var btnExcluir = document.createElement('button');
        btnExcluir.type = 'button';
        btnExcluir.textContent = 'Excluir anúncio';
        btnExcluir.style.cssText = 'background:none;border:none;color:var(--danger);font-size:11.5px;font-weight:600;cursor:pointer;padding:4px 2px;text-decoration:underline;';
        btnExcluir.addEventListener('click', function() {
          confirmarPersonalizado('Excluir esse anúncio? Essa ação não pode ser desfeita.', {
            titulo: 'Excluir anúncio',
            textoOk: 'Excluir',
            perigo: true
          }).then(function(confirmou) {
            if (!confirmou) return;
            btnExcluir.disabled = true;
            fetch('/api/remover-venda', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
              body: JSON.stringify({ identificacao_id: item.id, acao: 'excluir' })
            }).then(function() { abrirPainelVender(); invalidarCachePedrasVenda(); }).catch(function() { btnExcluir.disabled = false; });
          });
        });
        linhaExcluir.appendChild(btnExcluir);
        card.appendChild(linhaExcluir);

        var btnSalvarEdicao = formEdit.querySelector('.btn-salvar-edicao-venda');
        var erroEdicao = formEdit.querySelector('.erro-edicao-venda');
        btnSalvarEdicao.addEventListener('click', function() {
          erroEdicao.style.display = 'none';
          var novoValor = document.getElementById(idValor).value.trim();
          var novoTel = document.getElementById(idTel).value.trim().replace(/\D/g, '');
          var novaObs = document.getElementById(idObs).value.trim();
          var novoNeg = document.getElementById(idNeg).checked;
          if (!novoValor) { erroEdicao.textContent = 'Informe o valor.'; erroEdicao.style.display = 'block'; return; }
          if (!novoTel || novoTel.length < 10) { erroEdicao.textContent = 'Informe um telefone válido, com DDD.'; erroEdicao.style.display = 'block'; return; }
          btnSalvarEdicao.disabled = true;
          btnSalvarEdicao.textContent = 'Salvando...';
          fetch('/api/colocar-venda', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
              body: JSON.stringify({ identificacao_id: item.id, valor: novoValor, telefone: novoTel, observacao: novaObs, negociavel: novoNeg })
            })
            .then(function(res) { return res.json(); })
            .then(function() { invalidarCachePedrasVenda(); abrirPainelVender(); })
            .catch(function() {
              erroEdicao.textContent = 'Não foi possível salvar agora. Tente de novo.';
              erroEdicao.style.display = 'block';
              btnSalvarEdicao.disabled = false;
              btnSalvarEdicao.textContent = 'Salvar alterações';
            });
        });

        listaVenderEl.appendChild(card);
      });
    }

    btnFecharVender.addEventListener('click', function() { esconderPaineis(); });
    painelVender.addEventListener('click', function(e) { if (e.target === painelVender) esconderPaineis(); });

    function atualizarNivelColecionador(total) {
      var box = document.getElementById('nivel-colecionador');
      if (!box) return;
      if (!total || total <= 0) { box.style.display = 'none'; return; }
      var niveis = [
        { min: 0,  emoji: '🪨', nome: 'Iniciante' },
        { min: 3,  emoji: '⛏️', nome: 'Garimpeiro' },
        { min: 8,  emoji: '💎', nome: 'Colecionador' },
        { min: 15, emoji: '🔬', nome: 'Gemólogo' },
        { min: 30, emoji: '👑', nome: 'Lendário' }
      ];
      var atual = niveis[0];
      var proximo = niveis[1];
      for (var i = 0; i < niveis.length; i++) {
        if (total >= niveis[i].min) { atual = niveis[i]; proximo = niveis[i + 1] || null; }
      }
      var titulo = document.getElementById('nivel-colecionador-titulo');
      var sub = document.getElementById('nivel-colecionador-sub');
      var emoji = document.getElementById('nivel-colecionador-emoji');
      var barra = document.getElementById('nivel-colecionador-barra');
      titulo.textContent = 'Nível: ' + atual.nome;
      emoji.textContent = atual.emoji;
      if (proximo) {
        var faltam = proximo.min - total;
        sub.textContent = faltam + (faltam === 1 ? ' identificação para ' : ' identificações para ') + proximo.nome;
        var progresso = ((total - atual.min) / (proximo.min - atual.min)) * 100;
        barra.style.width = Math.max(6, Math.min(100, progresso)) + '%';
      } else {
        sub.textContent = 'Nível máximo alcançado!';
        barra.style.width = '100%';
      }
      box.style.display = 'block';
    }

    // ========================================================================
    // CONQUISTAS (BADGES)
    // ========================================================================
    var BADGES = [
      { id: 'primeira', nome: 'Primeira Descoberta', emoji: '🔍', desc: 'Identifique sua primeira pedra.', check: function(ctx) { return ctx.total >= 1; } },
      { id: 'trio', nome: 'Trio de Pedras', emoji: '⛏️', desc: 'Identifique 3 pedras.', check: function(ctx) { return ctx.total >= 3; } },
      { id: 'dezena', nome: 'Uma Dezena', emoji: '💎', desc: 'Identifique 10 pedras.', check: function(ctx) { return ctx.total >= 10; } },
      { id: 'acervo', nome: 'Acervo e Tanto', emoji: '🏛️', desc: 'Identifique 25 pedras.', check: function(ctx) { return ctx.total >= 25; } },
      { id: 'olho', nome: 'Olho Treinado', emoji: '🧭', desc: 'Identifique 5 tipos diferentes de pedra.', check: function(ctx) { return ctx.tiposDistintos >= 5; } },
      { id: 'enciclopedia', nome: 'Enciclopédia Viva', emoji: '📚', desc: 'Identifique 10 tipos diferentes de pedra.', check: function(ctx) { return ctx.tiposDistintos >= 10; } },
      { id: 'quartzo', nome: 'Fã de Quartzo', emoji: '🔷', desc: 'Identifique 3 variações de quartzo.', check: function(ctx) { return ctx.quartzos >= 3; } },
      { id: 'investigador', nome: 'Investigador', emoji: '🔓', desc: 'Desbloqueie o relatório completo de uma pedra.', check: function(ctx) { return ctx.desbloqueadas >= 1; } },
      { id: 'maratona', nome: 'Maratona', emoji: '⚡', desc: 'Identifique 3 pedras no mesmo dia.', check: function(ctx) { return ctx.maxPorDia >= 3; } },
      { id: 'veterano', nome: 'Veterano', emoji: '🗓️', desc: 'Volte para identificar pedras em 5 dias diferentes.', check: function(ctx) { return ctx.diasDistintos >= 5; } },
      { id: 'lendario', nome: 'Nível Lendário', emoji: '👑', desc: 'Alcance 30 identificações e vire lendário.', check: function(ctx) { return ctx.total >= 30; } }
    ];

    function atualizarBadges(itens) {
      var box = document.getElementById('badges-colecionador');
      var grid = document.getElementById('badges-grid');
      var detalhe = document.getElementById('badge-detalhe');
      if (!box || !grid) return;
      if (!itens || itens.length === 0) { box.style.display = 'none'; return; }

      var tiposSet = {};
      var diasSet = {};
      var porDia = {};
      var quartzos = 0;
      var desbloqueadas = 0;
      itens.forEach(function(item) {
        var nome = (item.nome_provavel || '').trim();
        if (nome) tiposSet[nome.toLowerCase()] = true;
        if (nome.toLowerCase().indexOf('quartzo') !== -1) quartzos++;
        if (item.desbloqueada) desbloqueadas++;
        if (item.criado_em) {
          var dia = new Date(item.criado_em).toISOString().slice(0, 10);
          diasSet[dia] = true;
          porDia[dia] = (porDia[dia] || 0) + 1;
        }
      });
      var maxPorDia = 0;
      Object.keys(porDia).forEach(function(d) { if (porDia[d] > maxPorDia) maxPorDia = porDia[d]; });

      var ctx = {
        total: itens.length,
        tiposDistintos: Object.keys(tiposSet).length,
        quartzos: quartzos,
        desbloqueadas: desbloqueadas,
        diasDistintos: Object.keys(diasSet).length,
        maxPorDia: maxPorDia
      };

      grid.innerHTML = '';
      var totalDesbloqueados = 0;
      BADGES.forEach(function(b) {
        var desbloqueado = b.check(ctx);
        if (desbloqueado) totalDesbloqueados++;
        var chip = document.createElement('div');
        chip.style.display = 'flex';
        chip.style.flexDirection = 'column';
        chip.style.alignItems = 'center';
        chip.style.justifyContent = 'center';
        chip.style.gap = '4px';
        chip.style.padding = '10px 4px';
        chip.style.borderRadius = '10px';
        chip.style.border = '1px solid ' + (desbloqueado ? 'var(--accent-medium)' : 'var(--line)');
        chip.style.background = desbloqueado ? 'var(--accent-light)' : 'var(--card-alt)';
        chip.style.cursor = 'pointer';
        chip.title = b.nome + ' — ' + b.desc;
        var iconWrap = document.createElement('div');
        iconWrap.style.fontSize = '22px';
        iconWrap.style.filter = desbloqueado ? 'none' : 'grayscale(1)';
        iconWrap.style.opacity = desbloqueado ? '1' : '0.4';
        iconWrap.textContent = b.emoji;
        var label = document.createElement('div');
        label.style.fontSize = '9px';
        label.style.fontWeight = '700';
        label.style.textAlign = 'center';
        label.style.lineHeight = '1.2';
        label.style.color = desbloqueado ? 'var(--accent-dark)' : 'var(--ink-mute2)';
        label.textContent = b.nome;
        chip.appendChild(iconWrap);
        chip.appendChild(label);
        chip.addEventListener('click', function() {
          detalhe.textContent = (desbloqueado ? '✓ ' : '🔒 ') + b.nome + ' — ' + b.desc;
          detalhe.style.color = desbloqueado ? 'var(--accent-dark)' : 'var(--ink-mute)';
        });
        grid.appendChild(chip);
      });

      var titulo = box.querySelector('div');
      if (titulo) titulo.textContent = 'Conquistas (' + totalDesbloqueados + '/' + BADGES.length + ')';

      box.style.display = 'block';
    }

    function renderizarHistorico(itens) {
      atualizarNivelColecionador(itens.length);
      atualizarBadges(itens);
      historicoLista.innerHTML = '';
      if (itens.length === 0) {
        historicoVazio.textContent = 'Você ainda não fez nenhuma avaliação.';
        historicoVazio.style.display = 'block';
        return;
      }
      historicoVazio.style.display = 'none';
      itens.forEach(function(item) {
        var div = document.createElement('div');
        div.className = 'historico-item';
        div.style.padding = '11px 12px';
        div.style.borderRadius = '8px';
        div.style.background = 'transparent';
        div.style.border = 'none';
        div.style.cursor = 'pointer';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.gap = '10px';
        var fotoWrap = document.createElement('div');
        fotoWrap.style.cssText = 'flex-shrink:0;width:44px;height:44px;aspect-ratio:1/1;border-radius:8px;overflow:hidden;background:var(--card-alt);border:1px solid var(--line);';
        if (item.foto) {
          var imgHist = document.createElement('img');
          imgHist.src = item.foto;
          imgHist.alt = item.nome_provavel || 'Pedra';
          imgHist.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
          fotoWrap.appendChild(imgHist);
        } else {
          fotoWrap.style.display = 'flex';
          fotoWrap.style.alignItems = 'center';
          fotoWrap.style.justifyContent = 'center';
          fotoWrap.style.fontSize = '14px';
          fotoWrap.style.color = 'var(--ink-mute2)';
          fotoWrap.textContent = '📷';
        }
        div.appendChild(fotoWrap);
        var info = document.createElement('div');
        info.style.flex = '1';
        info.style.minWidth = '0';
        var nome = document.createElement('div');
        nome.className = 'historico-nome';
        nome.style.fontWeight = '600';
        nome.style.fontSize = '13px';
        nome.style.overflow = 'hidden';
        nome.style.textOverflow = 'ellipsis';
        nome.style.whiteSpace = 'nowrap';
        nome.textContent = item.nome_provavel || 'Pedra não identificada';
        var data = document.createElement('div');
        data.className = 'historico-data';
        data.style.fontSize = '11px';
        data.style.color = 'var(--ink-mute2)';
        data.textContent = new Date(item.criado_em).toLocaleString('pt-BR');
        info.appendChild(nome);
        info.appendChild(data);
        var badge = document.createElement('span');
        badge.className = 'historico-badge ' + (item.desbloqueada ? 'pago' : 'bloqueado');
        badge.style.flexShrink = '0';
        badge.style.fontSize = '9px';
        badge.style.fontWeight = '700';
        badge.style.padding = '2px 10px';
        badge.style.borderRadius = '10px';
        badge.style.background = item.desbloqueada ? 'var(--accent-light)' : 'var(--card-alt)';
        badge.style.color = item.desbloqueada ? 'var(--accent-dark)' : 'var(--ink-mute2)';
        badge.textContent = item.desbloqueada ? 'desbloqueado' : 'bloqueado';
        div.appendChild(info);
        div.appendChild(badge);
        div.addEventListener('click', function() {
          supa.auth.getSession().then(function(sessaoResp) {
            var sessao = sessaoResp.data.session;
            if (!sessao) return;
            buscarEExibirIdentificacao(item.id, sessao.access_token);
          }).catch(function(erroItem) {
            console.error('Falha ao abrir item do histórico:', erroItem);
            erroEl.textContent = 'Não foi possível abrir essa identificação agora.';
            erroEl.style.display = 'block';
          });
        });
        historicoLista.appendChild(div);
      });
    }

    // Abre o dossiê (popup) de um item do histórico direto, sem passar pela
    // tela de upload/preview — a pedra já foi lida antes, então não faz
    // sentido reaproveitar a tela do "sensor" (que é só pra foto nova).
    function buscarEExibirIdentificacao(id, accessToken) {
      fetch('/api/obter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
          body: JSON.stringify({ identificacao_id: id })
        })
        .then(function(res) {
          return res.json().then(function(data) {
            if (!res.ok || data.error) { throw new Error(data.error || 'Não foi possível abrir essa identificação.'); }
            return data;
          });
        })
        .then(function(data) {
          esconderPaineis();
          var fotoUrl = (data.foto_base64 && data.foto_media_type)
            ? ('data:' + data.foto_media_type + ';base64,' + data.foto_base64)
            : '/assets/img/stone-placeholder.png';
          data.nome = data.nome || data.nome_provavel;
          identificacaoIdAtual = data.identificacao_id || id;
          if (typeof data.avaliacoes_gratis_restantes === 'number') {
            avaliacoesGratisRestantes = data.avaliacoes_gratis_restantes;
            atualizarContadorGratis();
          }
          abrirDossie(data, fotoUrl, { podeColocarVenda: true });
        })
        .catch(function(err) {
          erroEl.textContent = err.message || 'Não foi possível abrir essa identificação.';
          erroEl.style.display = 'block';
        });
    }

    // ========================================================================
    // PERGUNTAS PRÉ-SCAN — contexto extra (não visível na foto) enviado
    // junto com a identificação, pra IA ter mais sinal: onde a pedra foi
    // encontrada, teste simples de dureza e uma noção de peso/densidade.
    // ========================================================================
    var preScanPerguntas = document.getElementById('pre-scan-perguntas');
    var respostasPreScan = { local: null, dureza: null, peso: null };
    preScanPerguntas.querySelectorAll('.pre-scan-chips').forEach(function(grupoEl) {
      var grupo = grupoEl.dataset.grupo;
      grupoEl.addEventListener('click', function(e) {
        var chip = e.target.closest('.pre-scan-chip');
        if (!chip) return;
        var jaAtivo = chip.classList.contains('active');
        grupoEl.querySelectorAll('.pre-scan-chip').forEach(function(c) { c.classList.remove('active'); });
        if (jaAtivo) {
          respostasPreScan[grupo] = null;
        } else {
          chip.classList.add('active');
          respostasPreScan[grupo] = chip.dataset.valor;
        }
      });
    });
    function resetarRespostasPreScan() {
      respostasPreScan = { local: null, dureza: null, peso: null };
      preScanPerguntas.querySelectorAll('.pre-scan-chip').forEach(function(c) { c.classList.remove('active'); });
    }

    // ========================================================================
    // UPLOAD DE FOTO
    // ========================================================================
    function resetarUploadCompleto() {
      fotosSelecionadas = [];
      resultadoIAAtual = null;
      fotoCarregada = false;
      inputFoto.value = '';
      dropzone.style.display = 'flex';
      preview.style.display = 'none';
      actions.style.display = 'none';
      preScanPerguntas.style.display = 'none';
      resetarRespostasPreScan();
      pararFotoRecebida();
      fotoTira.innerHTML = '';
      fotoTiraWrap.style.display = 'none';
      resultadoEl.classList.remove('active');
      erroEl.style.display = 'none';
      esconderPaineis();
      btnVerResultado.disabled = true;
    }

    var MAX_TAMANHO_ARQUIVO_BYTES = 35 * 1024 * 1024;
    var MAX_LADO_PX = 1280;
    var QUALIDADE_JPEG = 0.8;

    function redimensionarEExportar(fonte, larguraOrig, alturaOrig, callback, bitmapParaFechar) {
      try {
        var largura = larguraOrig,
          altura = alturaOrig;
        var maiorLado = Math.max(largura, altura);
        if (maiorLado > MAX_LADO_PX) {
          var escala = MAX_LADO_PX / maiorLado;
          largura = Math.round(largura * escala);
          altura = Math.round(altura * escala);
        }
        var canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(fonte, 0, 0, largura, altura);
        if (bitmapParaFechar && bitmapParaFechar.close) bitmapParaFechar.close();
        if (canvas.toBlob) {
          canvas.toBlob(function(blob) {
            if (!blob) { callback(new Error('Não foi possível processar essa imagem.')); return; }
            var leitorBlob = new FileReader();
            leitorBlob.onload = function() { callback(null, leitorBlob.result); };
            leitorBlob.onerror = function() { callback(new Error('Não foi possível processar essa imagem.')); };
            leitorBlob.readAsDataURL(blob);
          }, 'image/jpeg', QUALIDADE_JPEG);
          return;
        }
        var dataUrl;
        try { dataUrl = canvas.toDataURL('image/jpeg', QUALIDADE_JPEG); } catch (e) { callback(new Error(
            'Não foi possível processar essa imagem.')); return; }
        callback(null, dataUrl);
      } catch (eProc) { callback(new Error('Não foi possível processar essa imagem.')); }
    }

    function comprimirImagemFallback(file, callback) {
      var leitor = new FileReader();
      leitor.onload = function() {
        var img = new Image();
        img.onload = function() { redimensionarEExportar(img, img.width, img.height, callback); };
        img.onerror = function() { callback(new Error('Não foi possível ler essa imagem.')); };
        img.src = leitor.result;
      };
      leitor.onerror = function() { callback(new Error('Não foi possível ler esse arquivo.')); };
      leitor.readAsDataURL(file);
    }

    function comprimirImagem(file, callback) {
      if (file.size && file.size > MAX_TAMANHO_ARQUIVO_BYTES) {
        callback(new Error('Essa foto é muito grande. Tente uma imagem menor que 35MB.'));
        return;
      }
      if (window.createImageBitmap) {
        window.createImageBitmap(file).then(function(bitmap) {
          redimensionarEExportar(bitmap, bitmap.width, bitmap.height, callback, bitmap);
        }).catch(function() { comprimirImagemFallback(file, callback); });
      } else { comprimirImagemFallback(file, callback); }
    }

    function renderizarTiraFotos() {
      fotoTira.innerHTML = '';
      fotosSelecionadas.forEach(function(foto, indice) {
        var item = document.createElement('div');
        item.className = 'foto-tira-item';
        item.style.position = 'relative';
        item.style.width = '64px';
        item.style.height = '64px';
        item.style.borderRadius = '8px';
        item.style.overflow = 'hidden';
        item.style.border = '1px solid var(--line-strong)';
        item.style.flexShrink = '0';
        item.style.background = 'var(--card-alt)';
        var img = document.createElement('img');
        img.src = foto.previewUrl;
        img.alt = 'Ângulo ' + (indice + 1);
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        var btnRemover = document.createElement('button');
        btnRemover.type = 'button';
        btnRemover.className = 'foto-tira-remover';
        btnRemover.style.position = 'absolute';
        btnRemover.style.top = '2px';
        btnRemover.style.right = '2px';
        btnRemover.style.width = '18px';
        btnRemover.style.height = '18px';
        btnRemover.style.borderRadius = '50%';
        btnRemover.style.border = 'none';
        btnRemover.style.background = 'rgba(0,0,0,0.65)';
        btnRemover.style.color = '#fff';
        btnRemover.style.fontSize = '13px';
        btnRemover.style.cursor = 'pointer';
        btnRemover.style.display = 'flex';
        btnRemover.style.alignItems = 'center';
        btnRemover.style.justifyContent = 'center';
        btnRemover.textContent = '×';
        btnRemover.addEventListener('click', function(ev) {
          ev.stopPropagation();
          fotosSelecionadas.splice(indice, 1);
          if (fotosSelecionadas.length === 0) { resetarUploadCompleto(); return; }
          previewImg.src = fotosSelecionadas[0].previewUrl;
          renderizarTiraFotos();
        });
        item.appendChild(img);
        item.appendChild(btnRemover);
        fotoTira.appendChild(item);
      });
      fotoContador.textContent = fotosSelecionadas.length + '/' + MAX_FOTOS + ' fotos';
      fotoTiraWrap.style.display = (fotosSelecionadas.length > 0) ? 'block' : 'none';
      btnAdicionarAngulo.disabled = fotosSelecionadas.length >= MAX_FOTOS;
      btnVerResultado.disabled = fotosSelecionadas.length === 0 || analiseEmAndamento;
    }

    function processarArquivoDeFoto(file) {
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        erroEl.textContent = 'Envie um arquivo de imagem (JPG, PNG, etc).';
        erroEl.style.display = 'block';
        return;
      }
      if (fotosSelecionadas.length >= MAX_FOTOS) return;
      continuarProcessamentoDaFoto(file);
    }

    // ========================================================================
    // PERSISTÊNCIA DA FOTO ENTRE O CLIQUE EM "ANALISAR" E O LOGIN COM GOOGLE
    // (o login redireciona a página inteira, então guardamos a foto em
    // sessionStorage para restaurar e continuar a análise automaticamente)
    // ========================================================================
    var CHAVE_FOTOS_PENDENTES = 'stone_fotos_pendentes_analise';

    function salvarFotosPendentes() {
      try {
        sessionStorage.setItem(CHAVE_FOTOS_PENDENTES, JSON.stringify(fotosSelecionadas));
      } catch (e) { console.error('Não foi possível salvar fotos pendentes:', e); }
    }

    function limparFotosPendentes() {
      try { sessionStorage.removeItem(CHAVE_FOTOS_PENDENTES); } catch (e) {}
    }

    function restaurarFotosPendentesSeExistir() {
      var salvo;
      try { salvo = sessionStorage.getItem(CHAVE_FOTOS_PENDENTES); } catch (e) { return; }
      if (!salvo) return;
      limparFotosPendentes();
      var fotosRestauradas;
      try { fotosRestauradas = JSON.parse(salvo); } catch (e) { return; }
      if (!fotosRestauradas || !fotosRestauradas.length) return;
      supa.auth.getSession().then(function(sessaoResp) {
        if (!sessaoResp.data.session) return;
        fotosSelecionadas = fotosRestauradas;
        fotoCarregada = true;
        resultadoIAAtual = null;
        identificacaoIdAtual = null;
        previewImg.src = fotosSelecionadas[0].previewUrl;
        dropzone.style.display = 'none';
        preview.style.display = 'block';
        actions.style.display = 'flex';
        animarFotoRecebida();
        renderizarTiraFotos();
        iniciarIdentificacao();
      }).catch(function() {});
    }

    function continuarProcessamentoDaFoto(file) {
      resultadoEl.classList.remove('active');
      erroEl.style.display = 'none';
      esconderPaineis();
      comprimirImagem(file, function(err, dataUrl) {
        if (err) { erroEl.textContent = err.message;
          erroEl.style.display = 'block'; return; }
        fotosSelecionadas.push({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg', previewUrl: dataUrl });
        fotoCarregada = true;
        resultadoIAAtual = null;
        identificacaoIdAtual = null;
        previewImg.src = fotosSelecionadas[0].previewUrl;
        dropzone.style.display = 'none';
        preview.style.display = 'block';
        actions.style.display = 'flex';
        preScanPerguntas.style.display = 'block';
        animarFotoRecebida();
        renderizarTiraFotos();
      });
    }

    dropzone.addEventListener('click', function(e) {
      // O input de arquivo fica dentro da dropzone (escondido) e é clicado
      // via JS (inputFoto.click()) quando a pessoa escolhe "Fazer upload de
      // foto" no popup. Esse clique programático borbulha até aqui e, sem
      // esse guard, reabria o popup de escolha por cima da foto recém-
      // carregada. Ignorando cliques vindos do próprio input, resolve.
      if (e.target === inputFoto) return;
      if (ehNavegadorInterno) {
        e.preventDefault();
        var modalAviso = document.getElementById('modal-navegador-interno');
        if (modalAviso) { modalAviso.style.display = 'flex'; }
        return;
      }
      abrirEscolhaFoto();
    });
    inputFoto.addEventListener('change', function(e) {
      var file = e.target.files[0];
      inputFoto.value = '';
      inputFoto.removeAttribute('capture');
      processarArquivoDeFoto(file);
    });
    btnAdicionarAngulo.addEventListener('click', function() {
      if (fotosSelecionadas.length >= MAX_FOTOS) return;
      abrirEscolhaFoto();
    });
    btnTrocar.addEventListener('click', resetarUploadCompleto);

    var btnUploadHint = document.getElementById('btn-upload-hint');
    if (btnUploadHint) {
      btnUploadHint.addEventListener('click', function() {
        if (ehNavegadorInterno) {
          var modalAviso = document.getElementById('modal-navegador-interno');
          if (modalAviso) { modalAviso.style.display = 'flex'; }
          return;
        }
        abrirEscolhaFoto();
      });
    }

    // ========================================================================
    // ESCOLHA CÂMERA x GALERIA + CÂMERA AO VIVO COM "SENSOR"
    // ========================================================================
    var modalEscolhaFoto = document.getElementById('modal-escolha-foto');
    var btnEscolhaCamera = document.getElementById('btn-escolha-camera');
    var btnEscolhaGaleria = document.getElementById('btn-escolha-galeria');
    var btnEscolhaCancelar = document.getElementById('btn-escolha-cancelar');
    var modalCamera = document.getElementById('modal-camera');
    var cameraVideo = document.getElementById('camera-video');
    var cameraCanvas = document.getElementById('camera-canvas');
    var btnCameraCapturar = document.getElementById('btn-camera-capturar');
    var btnCameraFechar = document.getElementById('btn-camera-fechar');
    var streamCameraAtual = null;

    function abrirEscolhaFoto() {
      if (fotosSelecionadas.length >= MAX_FOTOS) return;
      modalEscolhaFoto.style.display = 'flex';
    }
    function fecharEscolhaFoto() {
      modalEscolhaFoto.style.display = 'none';
    }
    btnEscolhaCancelar.addEventListener('click', fecharEscolhaFoto);
    modalEscolhaFoto.addEventListener('click', function(e) {
      if (e.target === modalEscolhaFoto) fecharEscolhaFoto();
    });
    btnEscolhaGaleria.addEventListener('click', function() {
      fecharEscolhaFoto();
      inputFoto.removeAttribute('capture');
      inputFoto.click();
    });
    btnEscolhaCamera.addEventListener('click', function() {
      fecharEscolhaFoto();
      abrirCamera();
    });

    function abrirCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        abrirCameraFallback();
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        .then(function(stream) {
          streamCameraAtual = stream;
          cameraVideo.srcObject = stream;
          modalCamera.style.display = 'flex';
        })
        .catch(function() {
          // Sem permissão ou sem câmera acessível via navegador — deixa o
          // próprio celular abrir o app de câmera nativo (input com capture).
          abrirCameraFallback();
        });
    }

    function abrirCameraFallback() {
      inputFoto.setAttribute('capture', 'environment');
      inputFoto.click();
    }

    function pararCamera() {
      if (streamCameraAtual) {
        streamCameraAtual.getTracks().forEach(function(t) { t.stop(); });
        streamCameraAtual = null;
      }
      cameraVideo.srcObject = null;
    }

    function fecharCamera() {
      pararCamera();
      modalCamera.style.display = 'none';
    }
    btnCameraFechar.addEventListener('click', fecharCamera);

    btnCameraCapturar.addEventListener('click', function() {
      if (!cameraVideo.videoWidth) return;
      cameraCanvas.width = cameraVideo.videoWidth;
      cameraCanvas.height = cameraVideo.videoHeight;
      cameraCanvas.getContext('2d').drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
      cameraCanvas.toBlob(function(blob) {
        if (!blob) return;
        fecharCamera();
        processarArquivoDeFoto(blob);
      }, 'image/jpeg', 0.9);
    });

    // ========================================================================
    // SCANNER E PROGRESSO
    // ========================================================================
    // Efeito de "recebendo/processando a foto" em loop — dispara assim que a
    // imagem entra no preview e continua até o usuário clicar em "ver
    // resultado" (quando o scanner de análise de verdade assume, via
    // pararFotoRecebida() dentro de iniciarScanner()).
    function animarFotoRecebida() {
      preview.classList.add('foto-recebida');
    }
    function pararFotoRecebida() {
      preview.classList.remove('foto-recebida');
    }

    function iniciarScanner() {
      pararFotoRecebida();
      scannerOverlay.classList.add('active');
    }

    function pararScanner() { scannerOverlay.classList.remove('active'); }

    var progressoInterval = null;

    function iniciarProgresso() {
      var pct = 0;
      btnProgressFill.style.transition = 'none';
      btnProgressFill.style.width = '0%';
      btnVerResultadoLabel.textContent = 'Analisando... 0%';
      clearInterval(progressoInterval);
      progressoInterval = setInterval(function() {
        pct += (90 - pct) * 0.08 + 0.3;
        if (pct > 90) pct = 90;
        btnProgressFill.style.transition = 'width .25s linear';
        btnProgressFill.style.width = pct + '%';
        btnVerResultadoLabel.textContent = 'Analisando... ' + Math.round(pct) + '%';
      }, 130);
    }

    function pararProgresso(sucesso) {
      clearInterval(progressoInterval);
      btnProgressFill.style.transition = 'width .35s ease-out';
      btnProgressFill.style.width = sucesso ? '100%' : '0%';
      if (sucesso) {
        btnVerResultadoLabel.textContent = 'Analisando... 100%';
        setTimeoutSeguro(function() {
          btnProgressFill.style.transition = 'none';
          btnProgressFill.style.width = '0%';
        }, 500);
      }
    }

    // ========================================================================
    // IDENTIFICAÇÃO
    // ========================================================================
    function iniciarIdentificacao() {
      if (!fotosSelecionadas.length || !fotoCarregada) return;
      supa.auth.getSession().then(function(sessaoResp) {
        var sessao = sessaoResp.data.session;
        if (!sessao) { salvarFotosPendentes(); abrirPainelLogin(); return; }
        analiseEmAndamento = true;
        btnVerResultado.disabled = true;
        btnAdicionarAngulo.disabled = true;
        btnVerResultadoLabel.textContent = 'Analisando...';
        iniciarScanner();
        iniciarProgresso();
        identificarPedra(sessao.access_token);
      });
    }

    btnVerResultado.addEventListener('click', function() {
      if (!fotosSelecionadas.length || !fotoCarregada) return;
      if (analiseEmAndamento) return;
      if (resultadoIAAtual) { mostrarResultado(resultadoIAAtual); return; }
      iniciarIdentificacao();
    });

    function identificarPedra(accessToken) {
      if (analiseEmAndamento && resultadoIAAtual) {
        pararScanner();
        pararProgresso(true);
        mostrarResultado(resultadoIAAtual);
        return;
      }
      btnVerResultado.disabled = true;
      btnAdicionarAngulo.disabled = true;
      btnVerResultadoLabel.textContent = 'Analisando...';
      iniciarScanner();
      iniciarProgresso();
      erroEl.style.display = 'none';
      resultadoEl.classList.remove('active');
      fetch('/api/identificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
          body: JSON.stringify({
            fotos: fotosSelecionadas.map(function(foto) { return { base64: foto.base64, mediaType: foto.mediaType }; }),
            permitirVitrine: document.getElementById('check-permite-vitrine').checked,
            contextoUsuario: respostasPreScan
          })
        })
        .then(function(res) {
          return res.json().then(function(data) {
            if (!res.ok || data.error) { throw new Error(data.error || 'Falha na resposta'); }
            return data;
          });
        })
        .then(function(data) {
          resultadoIAAtual = data;
          pararProgresso(true);
          mostrarResultado(data);
          atualizarHeader();
          if (document.getElementById('check-permite-vitrine').checked) {
            carregarDadosPublicos().then(function() {
              renderizarCatalogo();
              carregarVitrine(1);
              renderizarRankings(rankingAtual);
            });
          }
        })
        .catch(function(err) {
          pararProgresso(false);
          var msg = err.message || 'Não foi possível identificar a pedra agora. Tente novamente.';
          if (/gratuita|gr[aá]tis/i.test(msg)) {
            abrirPaywall(msg);
          } else {
            erroEl.textContent = msg;
            erroEl.style.display = 'block';
          }
        })
        .finally(function() {
          btnVerResultado.disabled = false;
          btnAdicionarAngulo.disabled = fotosSelecionadas.length >= MAX_FOTOS;
          btnVerResultadoLabel.textContent = 'Ver resultado';
          pararScanner();
          analiseEmAndamento = false;
        });
    }

    // ========================================================================
    // MOSTRAR RESULTADO
    // ========================================================================
    function mostrarResultado(data) {
      document.getElementById('res-nome').textContent = data.nome_provavel || '';
      var termoBusca = (data.nome_provavel || 'pedras').trim();
      var termoBuscaEnc = encodeURIComponent(termoBusca);
      var termoBuscaTraco = termoBuscaEnc.replace(/%20/g, '-');
      document.getElementById('canal-mfrural').href = 'https://www.mfrural.com.br/busca/' + termoBuscaEnc;
      document.getElementById('canal-ml').href = 'https://lista.mercadolivre.com.br/' + termoBuscaTraco;
      document.getElementById('canal-olx').href = 'https://www.olx.com.br/brasil?q=' + termoBuscaEnc;
      var confEl = document.getElementById('res-confianca');
      var cor = confiancaCores[data.confianca] || '#a6a6a6';
      confEl.textContent = 'confiança ' + (data.confianca || '');
      confEl.style.color = cor;
      var altEl = document.getElementById('res-alternativos');
      if (data.nomes_alternativos && data.nomes_alternativos.length > 0) {
        altEl.textContent = 'Também pode ser: ' + data.nomes_alternativos.join(', ');
        altEl.style.display = 'block';
      } else { altEl.style.display = 'none'; }
      var listaEl = document.getElementById('res-caracteristicas');
      listaEl.innerHTML = '';
      (data.caracteristicas || []).forEach(function(c) { var li = document.createElement('li');
        li.textContent = c;
        listaEl.appendChild(li); });
      identificacaoIdAtual = data.identificacao_id || null;
      document.getElementById('res-preco').textContent = data.faixa_preco_brasil || 'Não disponível';
      var desbloqueado = !!data.desbloqueado;
      var ondeVenderEl = document.getElementById('res-onde');
      if (desbloqueado) {
        ondeVenderEl.innerHTML = data.onde_vender || '';
        canaisVenda.style.display = 'block';
        btnDesbloquearOnde.style.display = 'none';
        premiumPreview.style.display = 'none';
        mensagemUpsellEl.textContent = '';
      } else {
        ondeVenderEl.innerHTML = '<span style="color:var(--ink-mute2);">🔒 Desbloqueie para ver onde vender essa pedra</span>';
        canaisVenda.style.display = 'none';
        btnDesbloquearOnde.style.display = 'block';
        premiumPreview.style.display = 'block';
        if (data.mensagem_upsell) { mensagemUpsellEl.textContent = data.mensagem_upsell; } else if (typeof data
          .avaliacoes_gratis_restantes === 'number' && data.avaliacoes_gratis_restantes > 0) {
          mensagemUpsellEl.textContent = 'Você ainda tem ' + data.avaliacoes_gratis_restantes + ' avaliações grátis.';
        } else { mensagemUpsellEl.textContent = 'Compre o pacote de 10 leituras por R$ 5,99.'; }
      }
      document.getElementById('res-observacao').textContent = data.observacao || '';
      if (typeof data.avaliacoes_gratis_restantes === 'number') {
        avaliacoesGratisRestantes = data.avaliacoes_gratis_restantes;
        atualizarContadorGratis();
      }
      var fotoUrl = previewImg.src || '/assets/img/stone-placeholder.png';
      // normaliza o campo de nome: a API de identificação retorna
      // "nome_provavel", mas abrirDossie() espera "nome" — sem isso o
      // modal caía no fallback "Pedra não identificada" mesmo quando a
      // IA tinha identificado a pedra com confiança alta.
      data.nome = data.nome || data.nome_provavel;
      abrirDossie(data, fotoUrl, { podeColocarVenda: true });
    }

    // ========================================================================
    // DOSSIÊ MODAL
    // ========================================================================
    function abrirDossie(data, fotoUrl, opts) {
      var modal = document.getElementById('modal-dossie');
      var img = document.getElementById('modal-dossie-img');
      var nome = document.getElementById('modal-dossie-nome');
      var confianca = document.getElementById('modal-dossie-confianca');
      var alternativos = document.getElementById('modal-dossie-alternativos');
      var caracteristicas = document.getElementById('modal-dossie-caracteristicas');
      var preco = document.getElementById('modal-dossie-preco');
      var onde = document.getElementById('modal-dossie-onde');
      var observacao = document.getElementById('modal-dossie-observacao');
      img.src = fotoUrl || '/assets/img/stone-placeholder.png';
      img.alt = data.nome || 'Pedra';
      nome.textContent = data.nome || 'Pedra não identificada';
      var cor = confiancaCores[data.confianca] || '#a6a6a6';
      confianca.textContent = 'confiança ' + (data.confianca || '');
      confianca.style.color = cor;
      confianca.style.borderColor = cor;
      if (data.nomes_alternativos && data.nomes_alternativos.length > 0) {
        alternativos.textContent = 'Também pode ser: ' + data.nomes_alternativos.join(', ');
        alternativos.style.display = 'block';
      } else { alternativos.style.display = 'none'; }
      caracteristicas.innerHTML = '';
      if (data.caracteristicas && data.caracteristicas.length > 0) {
        data.caracteristicas.forEach(function(c) { var li = document.createElement('li');
          li.textContent = c;
          caracteristicas.appendChild(li); });
      } else { var li = document.createElement('li');
        li.textContent = 'Nenhuma característica específica observada.';
        caracteristicas.appendChild(li); }
      preco.textContent = data.faixa_preco_brasil || 'Não disponível';
      var desbloqueado = !!data.desbloqueado;
      if (desbloqueado && data.onde_vender) { onde.textContent = data.onde_vender; } else { onde.textContent =
          '🔒 Desbloqueie para ver onde vender essa pedra'; }
      observacao.textContent = data.observacao || '';

      // ---- Bloco de venda (colocar à venda / falar no WhatsApp) ----
      var blocoColocarVenda = document.getElementById('bloco-colocar-venda');
      var blocoContatoVenda = document.getElementById('bloco-contato-venda');
      var btnColocarVenda = document.getElementById('btn-colocar-venda');
      var formVenda = document.getElementById('form-colocar-venda');
      var confirmacaoVenda = document.getElementById('confirmacao-venda');
      var erroVendaEl = document.getElementById('erro-venda');
      formVenda.style.display = 'none';
      confirmacaoVenda.style.display = 'none';
      erroVendaEl.style.display = 'none';
      btnColocarVenda.style.display = 'flex';
      document.getElementById('input-venda-valor').value = '';
      document.getElementById('input-venda-telefone').value = '';
      document.getElementById('input-venda-obs').value = '';
      document.getElementById('check-venda-negociavel').checked = false;
      if (data.valor_venda) {
        blocoContatoVenda.style.display = 'block';
        blocoColocarVenda.style.display = 'none';
        document.getElementById('texto-valor-venda').textContent = data.valor_venda +
          (data.negociavel_venda ? ' (negociável)' : '');
        document.getElementById('texto-obs-venda').textContent = data.observacao_venda || '';
        var telLimpo = (data.telefone_venda || '').replace(/\D/g, '');
        if (telLimpo && telLimpo.length <= 11) { telLimpo = '55' + telLimpo; }
        var msgWhats = encodeURIComponent('Olá! Vi a ' + (data.nome || 'pedra') + ' à venda por ' + data.valor_venda +
          ' no SCANNER 3.5. Ainda está disponível?');
        document.getElementById('btn-whatsapp-venda').href = 'https://wa.me/' + telLimpo + '?text=' + msgWhats;
      } else if (opts && opts.podeColocarVenda) {
        blocoColocarVenda.style.display = 'block';
        blocoContatoVenda.style.display = 'none';
      } else {
        blocoColocarVenda.style.display = 'none';
        blocoContatoVenda.style.display = 'none';
      }

      dossieCompartilhamentoAtual = {
        nome: data.nome || 'uma pedra misteriosa',
        preco: data.faixa_preco_brasil || '',
        confianca: data.confianca || '',
        caracteristicas: data.caracteristicas || [],
        foto: fotoUrl || ''
      };
      document.body.classList.add('popup-aberto');
      modal.classList.add('active');
    }

    var dossieCompartilhamentoAtual = null;
    var btnCompartilharDossie = document.getElementById('btn-compartilhar-dossie');
    if (btnCompartilharDossie) {
      btnCompartilharDossie.addEventListener('click', function() {
        var info = dossieCompartilhamentoAtual || { nome: 'uma pedra misteriosa', preco: '' };
        var texto = '💎 Identifiquei minha pedra com IA: ' + info.nome + '!' +
          (info.preco ? ' Faixa de preço estimada: ' + info.preco + '.' : '') +
          ' Descubra a sua também 👇';
        var url = window.location.origin + window.location.pathname;
        if (navigator.share) {
          navigator.share({ title: 'Identifiquei minha pedra!', text: texto, url: url }).catch(function() {});
        } else {
          var textoCompleto = texto + ' ' + url;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textoCompleto).then(function() {
              btnCompartilharDossie.textContent = 'Copiado! Cole onde quiser';
              setTimeout(function() {
                btnCompartilharDossie.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:#fff;stroke-width:2;fill:none;"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Compartilhar essa descoberta';
              }, 2500);
            }).catch(function() { window.prompt('Copie e compartilhe:', textoCompleto); });
          } else { window.prompt('Copie e compartilhe:', textoCompleto); }
        }
      });
    }

    // ========================================================================
    // COLOCAR PEDRA À VENDA
    // ========================================================================
    var btnColocarVendaEl = document.getElementById('btn-colocar-venda');
    if (btnColocarVendaEl) {
      btnColocarVendaEl.addEventListener('click', function() {
        document.getElementById('form-colocar-venda').style.display = 'block';
        btnColocarVendaEl.style.display = 'none';
      });
    }

    var btnConfirmarVenda = document.getElementById('btn-confirmar-venda');
    if (btnConfirmarVenda) {
      btnConfirmarVenda.addEventListener('click', function() {
        var erroVenda = document.getElementById('erro-venda');
        erroVenda.style.display = 'none';
        var valor = document.getElementById('input-venda-valor').value.trim();
        var telefone = document.getElementById('input-venda-telefone').value.trim();
        var obs = document.getElementById('input-venda-obs').value.trim();
        var negociavel = document.getElementById('check-venda-negociavel').checked;
        if (!valor) {
          erroVenda.textContent = 'Informe o valor de venda.';
          erroVenda.style.display = 'block';
          return;
        }
        var telefoneDigitos = telefone.replace(/\D/g, '');
        if (!telefoneDigitos || telefoneDigitos.length < 10) {
          erroVenda.textContent = 'Informe um telefone de contato válido, com DDD.';
          erroVenda.style.display = 'block';
          return;
        }
        if (!identificacaoIdAtual) {
          erroVenda.textContent = 'Não foi possível identificar essa pedra. Tente novamente.';
          erroVenda.style.display = 'block';
          return;
        }
        btnConfirmarVenda.disabled = true;
        btnConfirmarVenda.textContent = 'Publicando...';
        var controladorTempoLimite = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timeoutId = controladorTempoLimite ? setTimeout(function() { controladorTempoLimite.abort(); }, 15000) : null;
        supa.auth.getSession().then(function(sessaoResp) {
          var sessao = sessaoResp.data.session;
          if (!sessao || !sessao.access_token) {
            erroVenda.textContent = 'Sua sessão expirou. Faça login novamente.';
            erroVenda.style.display = 'block';
            btnConfirmarVenda.disabled = false;
            btnConfirmarVenda.textContent = 'Confirmar';
            if (timeoutId) clearTimeout(timeoutId);
            return null;
          }
          return fetch('/api/colocar-venda', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.access_token },
            body: JSON.stringify({
              identificacao_id: identificacaoIdAtual,
              valor: valor,
              telefone: telefoneDigitos,
              observacao: obs,
              negociavel: negociavel
            }),
            signal: controladorTempoLimite ? controladorTempoLimite.signal : undefined
          });
        })
          .then(function(res) {
            if (!res) return null; // sessão expirada, já tratado acima
            return res.json().catch(function() {
              // Resposta não veio em JSON (ex: rota /api/colocar-venda ainda não
              // publicada no servidor) — trata como erro genérico em vez de travar.
              throw new Error('O servidor não respondeu como esperado (status ' + res.status + '). Verifique se o backend foi publicado.');
            }).then(function(d) {
              if (!res.ok || d.error) { throw new Error(d.error || 'Falha ao publicar o anúncio.'); }
              return d;
            });
          })
          .then(function(resultado) {
            if (resultado === null) return; // sessão expirada, já tratado acima
            document.getElementById('form-colocar-venda').style.display = 'none';
            document.getElementById('confirmacao-venda').style.display = 'block';
            invalidarCachePedrasVenda();
            renderizarRankings(rankingAtual);
          })
          .catch(function(err) {
            var mensagem = (err && err.name === 'AbortError')
              ? 'A publicação demorou demais e foi cancelada. Verifique sua conexão e tente de novo.'
              : ((err && err.message) || 'Não foi possível publicar o anúncio agora. Tente novamente.');
            erroVenda.textContent = mensagem;
            erroVenda.style.display = 'block';
          })
          .finally(function() {
            if (timeoutId) clearTimeout(timeoutId);
            btnConfirmarVenda.disabled = false;
            btnConfirmarVenda.textContent = 'Publicar anúncio';
          });
      });
    }

    function fecharDossie() {
      var modal = document.getElementById('modal-dossie');
      modal.classList.remove('active');
      document.body.classList.remove('popup-aberto');
    }
    document.getElementById('modal-dossie-close').addEventListener('click', fecharDossie);
    document.getElementById('modal-dossie').addEventListener('click', function(e) { if (e.target === this) fecharDossie(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { fecharDossie(); fecharPaywall(); fecharEscolhaFoto(); fecharCamera(); } });

    // ========================================================================
    // MODAL DE CONFIRMAÇÃO / ALERTA — substitui window.confirm() e window.alert(),
    // que no navegador aparecem com o domínio do site ("pedrascanner.vercel.app
    // diz"), quebrando a sensação de app nativo.
    // ========================================================================
    var modalConfirm = document.getElementById('modal-confirm');
    var modalConfirmIcon = document.getElementById('modal-confirm-icon');
    var modalConfirmTitulo = document.getElementById('modal-confirm-titulo');
    var modalConfirmTexto = document.getElementById('modal-confirm-texto');
    var modalConfirmBotoes = document.getElementById('modal-confirm-botoes');
    var modalConfirmCancelar = document.getElementById('modal-confirm-cancelar');
    var modalConfirmOk = document.getElementById('modal-confirm-ok');

    // Mostra o modal e devolve uma Promise que resolve:
    // - true/false quando tem os dois botões (uso: confirmarPersonalizado)
    // - undefined quando é só aviso, com um botão (uso: alertarPersonalizado)
    function _abrirModalConfirm(mensagem, opcoes) {
      opcoes = opcoes || {};
      modalConfirmTitulo.textContent = opcoes.titulo || 'Confirmar';
      modalConfirmTexto.textContent = mensagem || '';
      modalConfirmOk.textContent = opcoes.textoOk || 'OK';
      modalConfirmCancelar.textContent = opcoes.textoCancelar || 'Cancelar';
      modalConfirmIcon.classList.toggle('perigo', !!opcoes.perigo);
      modalConfirmOk.classList.toggle('perigo', !!opcoes.perigo);
      modalConfirmBotoes.classList.toggle('somente-ok', !!opcoes.somenteOk);
      document.body.classList.add('popup-aberto');
      modalConfirm.classList.add('active');
      return new Promise(function(resolve) {
        function limpar(valor) {
          modalConfirm.classList.remove('active');
          document.body.classList.remove('popup-aberto');
          modalConfirmOk.removeEventListener('click', onOk);
          modalConfirmCancelar.removeEventListener('click', onCancelar);
          modalConfirm.removeEventListener('click', onOverlay);
          resolve(valor);
        }
        function onOk() { limpar(opcoes.somenteOk ? undefined : true); }
        function onCancelar() { limpar(false); }
        function onOverlay(e) { if (e.target === modalConfirm && !opcoes.somenteOk) limpar(false); }
        modalConfirmOk.addEventListener('click', onOk);
        modalConfirmCancelar.addEventListener('click', onCancelar);
        modalConfirm.addEventListener('click', onOverlay);
      });
    }
    // Substituto do window.confirm(). Resolve true (confirmou) ou false (cancelou).
    // opcoes: { titulo, textoOk, textoCancelar, perigo: true para ação destrutiva }
    function confirmarPersonalizado(mensagem, opcoes) {
      return _abrirModalConfirm(mensagem, opcoes);
    }
    // Substituto do window.alert(). Resolve quando o usuário fecha o aviso.
    function alertarPersonalizado(mensagem, opcoes) {
      opcoes = Object.assign({ somenteOk: true }, opcoes || {});
      return _abrirModalConfirm(mensagem, opcoes);
    }

    // ========================================================================
    // PAYWALL — popup de "avaliações grátis esgotadas"
    // ========================================================================
    var modalPaywall = document.getElementById('modal-paywall');
    var modalPaywallTexto = document.getElementById('modal-paywall-texto');

    function abrirPaywall(mensagem) {
      modalPaywallTexto.textContent = mensagem || 'Você já usou suas avaliações gratuitas. Para continuar identificando pedras, desbloqueie um pacote de leituras.';
      document.body.classList.add('popup-aberto');
      modalPaywall.classList.add('active');
    }
    function fecharPaywall() {
      modalPaywall.classList.remove('active');
      document.body.classList.remove('popup-aberto');
    }
    document.getElementById('modal-paywall-close').addEventListener('click', fecharPaywall);
    document.getElementById('btn-paywall-depois').addEventListener('click', fecharPaywall);
    modalPaywall.addEventListener('click', function(e) { if (e.target === this) fecharPaywall(); });
    document.getElementById('btn-paywall-adquirir').addEventListener('click', function() {
      fecharPaywall();
      abrirCheckout();
    });

    // ========================================================================
    // CHECKOUT
    // ========================================================================
    function abrirCheckout() {
      supa.auth.getSession().then(function(sessaoResp) {
        var sessao = sessaoResp.data.session;
        if (!sessao) { abrirPainelLogin(); return; }
        var email = sessao.user ? sessao.user.email : '';
        var separador = LINK_CHECKOUT_CAKTO.indexOf('?') > -1 ? '&' : '?';
        var url = LINK_CHECKOUT_CAKTO + separador + 'email=' + encodeURIComponent(email);
        if (identificacaoIdAtual) { url += '&identificacao_id=' + encodeURIComponent(identificacaoIdAtual); }
        window.open(url, '_blank');
      }).catch(function(erroCheckout) { console.error('Falha ao abrir checkout:', erroCheckout);
        abrirPainelLogin(); });
    }
    btnPagar.addEventListener('click', abrirCheckout);
    btnComprarEarly.addEventListener('click', abrirCheckout);
    btnDesbloquearOnde.addEventListener('click', abrirCheckout);

    btnJaPaguei.addEventListener('click', function() {
      if (!identificacaoIdAtual) return;
      supa.auth.getSession().then(function(sessaoResp) {
        var sessao = sessaoResp.data.session;
        if (!sessao) return;
        btnJaPaguei.disabled = true;
        var textoOriginal = btnJaPaguei.textContent;
        btnJaPaguei.textContent = 'Checando compra...';
        erroEl.style.display = 'none';
        fetch('/api/desbloquear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessao.access_token },
            body: JSON.stringify({ identificacao_id: identificacaoIdAtual })
          })
          .then(function(res) {
            return res.json().then(function(data) {
              if (!res.ok || data.error) { throw new Error(data.error || 'Ainda não encontramos sua compra.'); }
              return data;
            });
          })
          .then(function(data) {
            resultadoIAAtual = data;
            mostrarResultado(data);
            atualizarHeader();
          })
          .catch(function(err) {
            erroEl.textContent = err.message || 'Ainda não encontramos sua compra. Aguarde alguns segundos e tente de novo.';
            erroEl.style.display = 'block';
          })
          .finally(function() { btnJaPaguei.disabled = false;
            btnJaPaguei.textContent = textoOriginal; });
      });
    });

    // ========================================================================
    // VITRINE
    // ========================================================================
    function obterIdsVitrine() {
      var todos = catalogoDados.slice();
      todos.sort(function(a, b) { return new Date(b.data) - new Date(a.data); });
      return todos.slice(0, QTD_VITRINE).map(function(item) { return item.id; });
    }

    function carregarVitrine(pagina) {
      if (carregandoVitrine) return;
      carregandoVitrine = true;
      paginaVitrineAtual = pagina || 1;
      var idsVitrine = obterIdsVitrine();
      var itens = catalogoDados.filter(function(item) { return idsVitrine.indexOf(item.id) !== -1; });
      itens.sort(function(a, b) { return new Date(b.data) - new Date(a.data); });
      var totalPaginas = Math.max(1, Math.ceil(itens.length / QTD_VITRINE));
      if (paginaVitrineAtual > totalPaginas) paginaVitrineAtual = totalPaginas;
      var inicio = (paginaVitrineAtual - 1) * QTD_VITRINE;
      var itensPagina = itens.slice(inicio, inicio + QTD_VITRINE);
      renderizarVitrine({ itens: itensPagina, pagina: paginaVitrineAtual, total_paginas: totalPaginas });
      carregandoVitrine = false;
    }

    function renderizarVitrine(data) {
      var itens = data.itens || [];
      vitrineGrid.innerHTML = '';
      vitrinePaginacao.innerHTML = '';
      if (itens.length === 0) { vitrineVazio.style.display = 'block'; return; }
      vitrineVazio.style.display = 'none';
      var isMobile = window.innerWidth <= 480;
      var cols = isMobile ? 2 : 4;
      if (itens.length <= 2) cols = 2;
      else if (itens.length <= 4) cols = 3;
      vitrineGrid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
      itens.forEach(function(item) {
        var card = document.createElement('div');
        card.className = 'vitrine-card';
        card.style.cursor = 'pointer';
        var fav = document.createElement('div');
        fav.className = 'vitrine-fav';
        fav.style.position = 'absolute';
        fav.style.top = '8px';
        fav.style.right = '8px';
        fav.style.width = '24px';
        fav.style.height = '24px';
        fav.style.borderRadius = '50%';
        fav.style.background = 'rgba(255,255,255,0.94)';
        fav.style.display = 'flex';
        fav.style.alignItems = 'center';
        fav.style.justifyContent = 'center';
        fav.style.boxShadow = '0 1px 4px rgba(0,0,0,0.18)';
        fav.style.zIndex = '2';
        fav.style.pointerEvents = 'none';
        fav.innerHTML = '<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:var(--ink-soft);stroke-width:1.9;fill:none;"><path d="M12 21s-7.5-4.6-10-9.1C.6 8.4 2.3 5 5.8 5c2 0 3.4 1 6.2 3.6C14.8 6 16.2 5 18.2 5c3.5 0 5.2 3.4 3.8 6.9C19.5 16.4 12 21 12 21z"/></svg>';
        var ehMinha = !!meusIdsIdentificacao[item.id];
        var lixeira = null;
        if (ehMinha) {
          lixeira = document.createElement('button');
          lixeira.type = 'button';
          lixeira.className = 'vitrine-lixeira';
          lixeira.title = 'Apagar essa foto';
          lixeira.style.position = 'absolute';
          lixeira.style.top = '8px';
          lixeira.style.left = '8px';
          lixeira.style.width = '24px';
          lixeira.style.height = '24px';
          lixeira.style.borderRadius = '50%';
          lixeira.style.border = 'none';
          lixeira.style.background = 'rgba(255,255,255,0.94)';
          lixeira.style.display = 'flex';
          lixeira.style.alignItems = 'center';
          lixeira.style.justifyContent = 'center';
          lixeira.style.boxShadow = '0 1px 4px rgba(0,0,0,0.18)';
          lixeira.style.zIndex = '3';
          lixeira.style.cursor = 'pointer';
          lixeira.style.padding = '0';
          lixeira.innerHTML = '<svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:var(--danger);stroke-width:1.9;fill:none;"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
          lixeira.addEventListener('click', function(e) {
            e.stopPropagation();
            excluirItemVitrine(item, lixeira, card);
          });
        }
        var foto = document.createElement('div');
        foto.className = 'vitrine-foto';
        foto.style.aspectRatio = '1/1';
        foto.style.background = 'var(--card-alt)';
        foto.style.borderBottom = '1px solid var(--line)';
        foto.style.display = 'flex';
        foto.style.alignItems = 'center';
        foto.style.justifyContent = 'center';
        var img = document.createElement('img');
        img.loading = 'lazy';
        img.src = item.foto || '/assets/img/stone-placeholder.png';
        img.alt = item.nome || 'Pedra identificada';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.onerror = function() { this.style.display = 'none'; };
        foto.appendChild(img);
        var info = document.createElement('div');
        info.className = 'vitrine-info';
        info.style.padding = '9px 9px 11px';
        var nome = document.createElement('div');
        nome.className = 'vitrine-nome';
        nome.style.fontFamily = "'Inter',sans-serif";
        nome.style.fontSize = '12.5px';
        nome.style.fontWeight = '500';
        nome.style.lineHeight = '1.35';
        nome.style.color = 'var(--ink)';
        nome.style.display = '-webkit-box';
        nome.style.webkitLineClamp = '2';
        nome.style.webkitBoxOrient = 'vertical';
        nome.style.overflow = 'hidden';
        nome.style.height = '2.7em';
        nome.textContent = item.nome || 'Pedra não identificada';
        var badge = document.createElement('div');
        badge.className = 'vitrine-badge';
        badge.style.display = 'inline-block';
        badge.style.marginTop = '6px';
        badge.style.fontSize = '9px';
        badge.style.fontWeight = '700';
        badge.style.color = 'var(--accent-dark)';
        badge.style.background = 'var(--accent-light)';
        badge.style.padding = '2px 7px';
        badge.style.borderRadius = '4px';
        badge.textContent = 'Avaliada por IA';
        var valor = document.createElement('div');
        valor.className = 'vitrine-valor';
        valor.style.marginTop = '6px';
        valor.style.fontFamily = "'Inter',sans-serif";
        valor.style.fontSize = '15px';
        valor.style.fontWeight = '700';
        valor.style.color = 'var(--ink)';
        valor.textContent = item.valor || 'Valor sob consulta';
        var meta = document.createElement('div');
        meta.className = 'vitrine-meta';
        meta.style.marginTop = '4px';
        meta.style.fontSize = '10px';
        meta.style.color = 'var(--ink-mute2)';
        meta.style.whiteSpace = 'nowrap';
        meta.style.overflow = 'hidden';
        meta.style.textOverflow = 'ellipsis';
        var quando = tempoRelativo(item.data);
        meta.textContent = (quando ? quando + ' · ' : '') + 'por ' + (item.avaliador || 'cliente');
        info.appendChild(nome);
        info.appendChild(badge);
        info.appendChild(valor);
        info.appendChild(meta);
        card.style.position = 'relative';
        card.appendChild(fav);
        if (lixeira) card.appendChild(lixeira);
        card.appendChild(foto);
        card.appendChild(info);
        card.addEventListener('click', function() {
          abrirDossiePorItem(item);
        });
        vitrineGrid.appendChild(card);
      });
      var totalPaginas = data.total_paginas || 1;
      if (totalPaginas > 1) {
        for (var p = 1; p <= totalPaginas; p++) {
          (function(numeroPagina) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'vitrine-pag-btn' + (numeroPagina === data.pagina ? ' active' : '');
            btn.style.fontFamily = "'Space Mono',monospace";
            btn.style.fontSize = '12px';
            btn.style.fontWeight = '700';
            btn.style.width = '30px';
            btn.style.height = '30px';
            btn.style.borderRadius = '6px';
            btn.style.border = '1px solid var(--line-strong)';
            btn.style.background = 'var(--card)';
            btn.style.color = 'var(--ink-mute)';
            btn.style.cursor = 'pointer';
            if (numeroPagina === data.pagina) { btn.style.background = 'var(--accent)';
              btn.style.borderColor = 'var(--accent)';
              btn.style.color = '#fff'; }
            btn.textContent = numeroPagina;
            btn.addEventListener('click', function() { carregarVitrine(numeroPagina); });
            vitrinePaginacao.appendChild(btn);
          })(p);
        }
      }
    }

    // Apaga permanentemente uma identificação (usada pelo ícone de lixeira,
    // que só aparece nas próprias fotos). Some com a linha inteira no banco —
    // diferente de "pausar anúncio", que só tira da área de vendas.
    function excluirItemVitrine(item, botaoLixeira, cardEl) {
      if (!sessaoTokenGlobal) return;
      confirmarPersonalizado('Apagar essa foto para sempre? Essa ação não pode ser desfeita.', {
        titulo: 'Apagar foto',
        textoOk: 'Apagar',
        perigo: true
      }).then(function(confirmou) {
        if (!confirmou) return;
        botaoLixeira.disabled = true;
        botaoLixeira.style.opacity = '0.5';
        fetch('/api/excluir-identificacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessaoTokenGlobal },
          body: JSON.stringify({ identificacao_id: item.id })
        })
          .then(function(res) { return res.json().then(function(corpo) { return { ok: res.ok, corpo: corpo }; }); })
          .then(function(resultado) {
            if (!resultado.ok) {
              alertarPersonalizado((resultado.corpo && resultado.corpo.error) || 'Não foi possível apagar. Tente novamente.', { titulo: 'Ops', perigo: true });
              botaoLixeira.disabled = false;
              botaoLixeira.style.opacity = '1';
              return;
            }
            delete meusIdsIdentificacao[item.id];
            catalogoDados = catalogoDados.filter(function(i) { return i.id !== item.id; });
            if (cardEl && cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
            carregarVitrine(paginaVitrineAtual || 1);
            if (typeof carregarRankingColecionadores === 'function') carregarRankingColecionadores();
            if (typeof atualizarValorColecao === 'function') atualizarValorColecao(sessaoTokenGlobal);
          })
          .catch(function() {
            alertarPersonalizado('Não foi possível apagar agora. Tente novamente.', { titulo: 'Ops', perigo: true });
            botaoLixeira.disabled = false;
            botaoLixeira.style.opacity = '1';
          });
      });
    }

    function abrirDossiePorItem(item) {
      fetch('/api/obter-publico?id=' + item.id)
        .then(function(r) { return r.json(); })
        .then(function(dados) {
          dados.nome = dados.nome || dados.nome_provavel || item.nome;
          abrirDossie(dados, item.foto);
        })
        .catch(function() {
          var dadosFallback = {
            nome: item.nome,
            confianca: 'alta',
            nomes_alternativos: [],
            caracteristicas: ['Cor predominante observada', 'Textura característica'],
            faixa_preco_brasil: item.valor || 'Não disponível',
            onde_vender: '🔒 Desbloqueie para ver',
            observacao: 'Clique em "Ver resultado" para uma análise completa.'
          };
          abrirDossie(dadosFallback, item.foto);
        });
    }

    // ========================================================================
    // CATÁLOGO
    // ========================================================================
    function popularFiltroTipoCatalogo() {
      var select = document.getElementById('catalogo-filtro-tipo');
      if (!select) return;
      var tipos = [];
      catalogoDados.forEach(function(item) { if (item.nome && tipos.indexOf(item.nome) === -1) tipos.push(item.nome); });
      tipos.sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); });
      var valorAtual = select.value;
      select.innerHTML = '<option value="">Todos os tipos de pedra</option>';
      tipos.forEach(function(nome) { var opt = document.createElement('option');
        opt.value = nome;
        opt.textContent = nome;
        select.appendChild(opt); });
      if (valorAtual && tipos.indexOf(valorAtual) !== -1) { select.value = valorAtual; } else { catalogoFiltroTipo = ''; }
    }

    function renderizarCatalogo() {
      var grid = document.getElementById('catalogo-grid');
      var paginacao = document.getElementById('catalogo-paginacao');
      popularFiltroTipoCatalogo();
      var dados = catalogoDados.filter(function(item) {
        var matchBusca = item.nome.toLowerCase().includes(catalogoBusca.toLowerCase());
        if (!matchBusca) return false;
        if (catalogoFiltroTipo && item.nome !== catalogoFiltroTipo) return false;
        if (catalogoFiltro === 'recentes') return true;
        if (!item.valor) return catalogoFiltro === 'todos';
        if (catalogoFiltro === 'baratos') {
          var valorNum = parseFloat(item.valor.replace('R$ ', '').replace('.', '').replace(',', '.'));
          return valorNum < 50;
        }
        if (catalogoFiltro === 'caros') {
          var valorNum2 = parseFloat(item.valor.replace('R$ ', '').replace('.', '').replace(',', '.'));
          return valorNum2 > 200;
        }
        return true;
      });
      dados.sort(function(a, b) { return new Date(b.data) - new Date(a.data); });
      var total = dados.length;
      var totalPaginas = Math.ceil(total / catalogoPorPagina);
      if (totalPaginas < 1) totalPaginas = 1;
      if (catalogoPagina > totalPaginas) catalogoPagina = totalPaginas;
      var inicio = (catalogoPagina - 1) * catalogoPorPagina;
      var fim = Math.min(inicio + catalogoPorPagina, total);
      var paginaDados = dados.slice(inicio, fim);
      grid.innerHTML = '';
      if (paginaDados.length === 0) {
        grid.innerHTML =
          '<p style="text-align:center;color:var(--ink-mute2);padding:20px 0;grid-column:1/-1;">Nenhuma pedra encontrada.</p>';
      } else {
        paginaDados.forEach(function(item) {
          var div = document.createElement('div');
          div.className = 'catalogo-item';
          div.style.background = 'var(--card-alt)';
          div.style.borderRadius = '10px';
          div.style.border = '1px solid var(--line)';
          div.style.overflow = 'hidden';
          div.style.cursor = 'pointer';
          var fotoHtml = item.foto ?
            '<img src="' + item.foto + '" alt="' + item.nome + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">' :
            '<div class="no-image" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink-mute2);font-size:11px;">📷</div>';
          div.innerHTML =
            '<div class="cat-foto" style="aspect-ratio:1/1;background:var(--card);overflow:hidden;display:flex;align-items:center;justify-content:center;">' +
            fotoHtml + '</div>' +
            '<div class="cat-info" style="padding:10px 12px 12px;">' +
            '<div class="cat-nome" style="font-weight:600;font-size:13px;color:var(--ink);line-height:1.3;">' + item
            .nome + '</div>' +
            '<div class="cat-meta" style="font-size:11px;color:var(--ink-mute2);margin-top:2px;">por ' + item
            .avaliador + ' · ' + tempoRelativo(item.data) + '</div>' +
            '<div class="cat-preco" style="font-weight:700;font-size:14px;color:var(--accent-dark);margin-top:4px;">' +
            (item.valor || 'Valor sob consulta') + '</div>' +
            '<span class="cat-badge" style="display:inline-block;font-size:9px;font-weight:700;padding:2px 10px;border-radius:10px;background:var(--accent-light);color:var(--accent-dark);margin-top:4px;">avaliado</span>' +
            '</div>';
          div.addEventListener('click', function() {
            abrirDossiePorItem(item);
          });
          grid.appendChild(div);
        });
      }
      paginacao.innerHTML = '';
      for (var i = 1; i <= totalPaginas; i++) {
        (function(pag) {
          var btn = document.createElement('button');
          btn.className = (pag === catalogoPagina) ? 'active' : '';
          btn.style.fontFamily = "'Space Mono',monospace";
          btn.style.fontSize = '12px';
          btn.style.fontWeight = '700';
          btn.style.width = '30px';
          btn.style.height = '30px';
          btn.style.borderRadius = '6px';
          btn.style.border = '1px solid var(--line-strong)';
          btn.style.background = 'var(--card)';
          btn.style.color = 'var(--ink-mute)';
          btn.style.cursor = 'pointer';
          if (pag === catalogoPagina) { btn.style.background = 'var(--accent)';
            btn.style.borderColor = 'var(--accent)';
            btn.style.color = '#fff'; }
          btn.textContent = pag;
          btn.addEventListener('click', function() { catalogoPagina = pag;
            renderizarCatalogo(); });
          paginacao.appendChild(btn);
        })(i);
      }
    }

    document.getElementById('catalogo-filtros').addEventListener('click', function(e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      document.querySelectorAll('#catalogo-filtros button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      catalogoFiltro = btn.dataset.filtro;
      catalogoPagina = 1;
      renderizarCatalogo();
    });
    document.getElementById('catalogo-busca-input').addEventListener('input', function() {
      catalogoBusca = this.value;
      catalogoPagina = 1;
      renderizarCatalogo();
    });
    document.getElementById('catalogo-filtro-tipo').addEventListener('change', function() {
      catalogoFiltroTipo = this.value;
      catalogoPagina = 1;
      renderizarCatalogo();
    });

    // ========================================================================
    // RANKINGS
    // ========================================================================
    function renderizarGridVenda(itens, tipo) {
      var grid = document.getElementById('rankings-grid');
      grid.innerHTML = '';
      if (!itens || itens.length === 0) {
        grid.innerHTML =
          '<p style="text-align:center;color:var(--ink-mute2);padding:20px 0;grid-column:1/-1;">Ainda não tem nenhuma pedra à venda por aqui. Identifique a sua e seja o primeiro a anunciar!</p>';
        return;
      }
      var top6 = itens.slice(0, 6);
      var badgeIcon = '';
      var badgeTexto = '';
      if (tipo === 'recentes') {
        badgeIcon =
          '<svg viewBox="0 0 24 24" style="width:10px;height:10px;stroke:currentColor;stroke-width:2;fill:none;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
        badgeTexto = 'recente';
      } else if (tipo === 'baratas') {
        badgeIcon =
          '<svg viewBox="0 0 24 24" style="width:10px;height:10px;stroke:currentColor;stroke-width:2;fill:none;"><circle cx="12" cy="12" r="10"/><path d="M8 8l8 8M8 16l8-8"/></svg>';
        badgeTexto = 'barata';
      } else if (tipo === 'caras') {
        badgeIcon =
          '<svg viewBox="0 0 24 24" style="width:10px;height:10px;stroke:currentColor;stroke-width:2;fill:none;"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>';
        badgeTexto = 'premium';
      }
      top6.forEach(function(item, index) {
        var div = document.createElement('div');
        div.className = 'rank-item';
        div.style.background = 'var(--card-alt)';
        div.style.borderRadius = '8px';
        div.style.padding = '10px 12px';
        div.style.border = '1px solid var(--line)';
        div.style.cursor = 'pointer';
        var fotoHtml = item.foto ?
          '<img src="' + item.foto + '" alt="' + item.nome + '" style="width:100%;height:100%;object-fit:cover;display:block;">' :
          '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink-mute2);font-size:11px;">📷</div>';
        div.innerHTML =
          '<div style="position:relative;aspect-ratio:1/1;background:var(--card);border-radius:6px;overflow:hidden;margin-bottom:8px;border:1px solid var(--line);">' +
          fotoHtml +
          '<span style="position:absolute;top:6px;left:6px;font-family:\'Space Mono\',monospace;font-size:10px;font-weight:700;color:#fff;background:rgba(0,0,0,0.55);padding:2px 6px;border-radius:6px;">#' +
          (index + 1) + '</span>' +
          '<span style="position:absolute;top:6px;right:6px;display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;background:var(--accent);color:#fff;">' +
          badgeIcon + badgeTexto + '</span>' +
          '</div>' +
          '<div class="rank-name" style="font-weight:600;font-size:13px;color:var(--ink);line-height:1.3;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' +
          (item.nome || 'Pedra não identificada') + '</div>' +
          (item.valor ? '<div class="rank-preco" style="font-family:\'Space Mono\',monospace;font-weight:700;font-size:16px;color:var(--accent-dark);">' +
            item.valor + (item.negociavel ? ' <span style="font-weight:600;font-size:10px;color:var(--ink-mute2);">negociável</span>' : '') + '</div>' : '') +
          '<div class="rank-meta" style="font-size:11px;color:var(--ink-mute2);margin-top:2px;">' + 'por ' + (item.avaliador || 'cliente') + (item.data ?
            ' · ' + tempoRelativo(item.data) : '') + '</div>';
        if (item.telefone) {
          var telLimpoCard = String(item.telefone).replace(/\D/g, '');
          if (telLimpoCard && telLimpoCard.length <= 11) { telLimpoCard = '55' + telLimpoCard; }
          var msgWhatsCard = encodeURIComponent('Olá! Vi a ' + (item.nome || 'pedra') + ' à venda por ' +
            (item.valor || 'esse valor') + ' no SCANNER 3.5. Ainda está disponível?');
          var btnWhatsCard = document.createElement('a');
          btnWhatsCard.href = 'https://wa.me/' + telLimpoCard + '?text=' + msgWhatsCard;
          btnWhatsCard.target = '_blank';
          btnWhatsCard.rel = 'noopener';
          btnWhatsCard.style.cssText = 'width:100%;margin-top:8px;background:#000000;color:#fff;border:none;border-radius:7px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;text-decoration:none;';
          btnWhatsCard.innerHTML =
            '<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:#fff;"><path d="M17.6 6.3A8.9 8.9 0 0012 4a8.9 8.9 0 00-7.7 13.4L3 21l3.7-1.3A8.9 8.9 0 0012 20.9 8.9 8.9 0 0017.6 6.3zM12 19.1a7.1 7.1 0 01-3.6-1l-.3-.1-2.2.8.8-2.1-.2-.3A7.1 7.1 0 1119 12a7.1 7.1 0 01-7 7.1zm3.9-5.3c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1-.1.2-.5.7-.6.8-.1.1-.2.1-.4 0-.2-.1-.9-.3-1.7-1a6.3 6.3 0 01-1.2-1.5c-.1-.2 0-.3.1-.4l.3-.4.2-.3v-.3c0-.1-.5-1.2-.7-1.6-.2-.4-.4-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2 1 2.4c.1.1 1.6 2.5 3.9 3.4.5.2 1 .4 1.3.5.5.2 1 .1 1.4.1.4-.1 1.2-.5 1.4-1 .2-.4.2-.8.1-1z"/></svg>' +
            'WhatsApp';
          btnWhatsCard.addEventListener('click', function(e) { e.stopPropagation(); });
          div.appendChild(btnWhatsCard);
        }
        div.addEventListener('click', function() {
          abrirDossiePorItem(item);
        });
        grid.appendChild(div);
      });
    }

    function carregarRankingsComFotos(tipo) {
      var cache = pedrasVendaDados[tipo];
      if (cache) { renderizarGridVenda(cache, tipo); return; }
      var grid = document.getElementById('rankings-grid');
      grid.innerHTML =
        '<p style="text-align:center;color:var(--ink-mute2);padding:20px 0;grid-column:1/-1;">Carregando...</p>';
      carregarPedrasVenda(tipo).then(function(itens) { renderizarGridVenda(itens, tipo); });
    }

    // Ao publicar um novo anúncio, ou reabrir a página, o cache fica velho —
    // limpa pra forçar buscar de novo na próxima chamada.
    function invalidarCachePedrasVenda() {
      pedrasVendaDados = { recentes: null, baratas: null, caras: null };
    }

    function renderizarRankings(tipo) { carregarRankingsComFotos(tipo); }
    document.getElementById('rankings-tabs').addEventListener('click', function(e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      document.querySelectorAll('.rankings-tabs button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      rankingAtual = btn.dataset.rank;
      renderizarRankings(rankingAtual);
    });

    // ========================================================================
    // PARALLAX DAS MONTANHAS NO HERO
    // ========================================================================
    (function() {
      var camadas = document.querySelectorAll('.hm-layer');
      if (!camadas.length) return;
      var reduzMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduzMovimento) return;

      var ticking = false;
      function atualizarParallax() {
        var scrollY = window.scrollY || window.pageYOffset;
        camadas.forEach(function(camada) {
          var velocidade = parseFloat(camada.dataset.speed) || 0.1;
          camada.style.transform = 'translateY(' + (scrollY * velocidade) + 'px)';
        });
        ticking = false;
      }
      window.addEventListener('scroll', function() {
        if (!ticking) {
          requestAnimationFrame(atualizarParallax);
          ticking = true;
        }
      }, { passive: true });
      atualizarParallax();
    })();

    // ========================================================================
    // AVATARES DE PROVA SOCIAL (fotos das últimas pedras identificadas)
    // ========================================================================
    function carregarAvataresProvaSocial() {
      var slots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function(n) { return document.getElementById('sp-avatar-' + n); });
      if (!slots[0]) return;
      fetch('/api/vitrine?pagina=1')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          var itens = (data && data.itens) || [];
          itens.slice(0, 10).forEach(function(item, i) {
            var slot = slots[i];
            if (!slot || !item.foto) return;
            slot.style.background = 'transparent';
            slot.textContent = '';
            var img = document.createElement('img');
            img.src = item.foto;
            img.alt = item.pedra || 'Pedra avaliada';
            slot.appendChild(img);
          });
        })
        .catch(function(err) {
          console.error('Erro ao carregar avatares de prova social:', err);
          // mantém as iniciais fixas como fallback
        });
    }

    // ========================================================================
    // ESTATÍSTICAS
    // ========================================================================
    function carregarEstatisticas() {
      var statMembros = document.getElementById('stat-membros');
      var statPedras = document.getElementById('stat-pedras');
      var statHoje = document.getElementById('stat-hoje');
      var statAtualizado = document.getElementById('stat-atualizado');
      var socialProofCount = document.getElementById('social-proof-count');
      if (!statMembros) return;
      statMembros.textContent = '...';
      statPedras.textContent = '...';
      statHoje.textContent = '...';
      if (statAtualizado) statAtualizado.textContent = 'Atualizando...';
      fetch('/api/stats').then(function(res) {
        if (!res.ok) throw new Error('Erro na API');
        return res.json();
      }).then(function(data) {
        statMembros.textContent = data.membros || '0';
        statPedras.textContent = data.pedras || '0';
        statHoje.textContent = data.hoje || '+0';
        if (socialProofCount) socialProofCount.textContent = data.membros || '0';
        if (statAtualizado) {
          var agora = new Date();
          var hora = String(agora.getHours()).padStart(2, '0');
          var minuto = String(agora.getMinutes()).padStart(2, '0');
          statAtualizado.textContent = 'Atualizado às ' + hora + ':' + minuto;
          statAtualizado.style.color = 'var(--accent-dark)';
        }
        return data;
      }).catch(function(err) {
        console.error('Erro ao carregar estatísticas:', err);
        statMembros.textContent = '0';
        statPedras.textContent = '0';
        statHoje.textContent = '+0';
        if (socialProofCount) socialProofCount.textContent = '0';
        if (statAtualizado) statAtualizado.textContent = 'Erro ao atualizar';
      });
    }

    // ========================================================================
    // VOTAÇÃO ESTILO SWIPE — "Vote nas pedras da comunidade"
    // PROTÓTIPO FRONT-END: o voto ainda não é salvo no servidor. Antes de ir
    // pra produção é preciso criar endpoints (/api/curtir-pedra, etc.) que
    // validem no backend: (1) usuário autenticado, (2) já fez pelo menos 1
    // identificação própria, (3) 1 voto por pedra por usuário, (4) limite
    // diário de votos por conta — pra evitar farm de curtidas com contas fake.
    // Os "Rocks" são uma moeda 100% fictícia, só de entretenimento, sem
    // qualquer valor monetário ou conversão pra dinheiro real.
    // ========================================================================
    var ROCKS_BASE_POR_LIKE = 2;
    var swipeFila = [];
    var swipeRocksHoje = 0;
    var swipeChaveVotados = 'rocco_swipe_votados';

    function swipeObterVotados() {
      try {
        return JSON.parse(localStorage.getItem(swipeChaveVotados) || '[]');
      } catch (e) { return []; }
    }
    function swipeRegistrarVoto(id) {
      try {
        var votados = swipeObterVotados();
        votados.push(id);
        localStorage.setItem(swipeChaveVotados, JSON.stringify(votados));
      } catch (e) { /* localStorage indisponível — segue sem persistir */ }
    }

    function calcularRaridade(valor) {
      if (!valor || valor <= 50) return { label: 'Comum', mult: 1, classe: '' };
      if (valor <= 200) return { label: 'Incomum', mult: 2, classe: 'raridade-incomum' };
      if (valor <= 800) return { label: 'Rara', mult: 5, classe: 'raridade-rara' };
      return { label: 'Raríssima', mult: 10, classe: 'raridade-raríssima' };
    }

    function swipeCriarCard(item, indice) {
      var raridade = calcularRaridade(item.valor_exibicao);
      var rocks = ROCKS_BASE_POR_LIKE * raridade.mult;
      var card = document.createElement('div');
      card.className = 'swipe-card';
      card.dataset.id = item.id;
      card.dataset.rocks = rocks;
      card.style.zIndex = String(100 - indice);
      card.classList.add('swipe-lvl-' + Math.min(indice, 2));
      card.innerHTML =
        '<img src="' + item.foto + '" alt="' + (item.pedra || 'Pedra da comunidade') + '">' +
        '<div class="swipe-card-stamp like">Curtir</div>' +
        '<div class="swipe-card-stamp nope">Pular</div>' +
        '<div class="swipe-card-overlay">' +
          '<span class="swipe-card-raridade ' + raridade.classe + '">' + raridade.label + (raridade.mult > 1 ? ' ×' + raridade.mult : '') + '</span>' +
          '<div class="swipe-card-info">' +
            '<strong>' + (item.pedra || 'Pedra não identificada') + '</strong>' +
            '<span>por ' + (item.nome || 'Membro da comunidade') + '</span>' +
            '<span class="swipe-card-rocks">+' + rocks + ' Rocks</span>' +
          '</div>' +
        '</div>';
      return card;
    }

    function swipeRenderizarStage() {
      var stage = document.getElementById('swipe-stage');
      var vazio = document.getElementById('swipe-empty');
      if (!stage) return;
      Array.prototype.slice.call(stage.querySelectorAll('.swipe-card')).forEach(function(c) { c.remove(); });
      if (!swipeFila.length) {
        if (vazio) vazio.style.display = 'flex';
        return;
      }
      if (vazio) vazio.style.display = 'none';
      swipeFila.slice(0, 3).forEach(function(item, i) {
        stage.appendChild(swipeCriarCard(item, i));
      });
      swipeAtivarDragNoTopo();
    }

    function swipeResolverVoto(direcao) {
      var stage = document.getElementById('swipe-stage');
      if (!stage) return;
      var topo = stage.querySelector('.swipe-card');
      if (!topo || !swipeFila.length) return;
      var item = swipeFila.shift();
      var saiX = direcao === 'like' ? 600 : -600;
      var rotacao = direcao === 'like' ? 18 : -18;
      topo.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
      topo.style.transform = 'translateX(' + saiX + 'px) rotate(' + rotacao + 'deg)';
      topo.style.opacity = '0';
      var carimbo = topo.querySelector('.swipe-card-stamp.' + (direcao === 'like' ? 'like' : 'nope'));
      if (carimbo) carimbo.style.opacity = '1';

      if (direcao === 'like') {
        var rocksGanhos = parseInt(topo.dataset.rocks, 10) || 0;
        swipeRocksHoje += rocksGanhos;
        var totalEl = document.getElementById('swipe-rocks-total');
        if (totalEl) totalEl.textContent = swipeRocksHoje;
        // TODO produção: POST /api/curtir-pedra { id: item.id } — validar no
        // servidor antes de creditar Rocks de verdade na conta de quem postou.
      }
      swipeRegistrarVoto(item.id);

      setTimeout(swipeRenderizarStage, 260);
    }

    function swipeAtivarDragNoTopo() {
      var stage = document.getElementById('swipe-stage');
      var topo = stage && stage.querySelector('.swipe-card');
      if (!topo) return;
      var arrastando = false, inicioX = 0, inicioY = 0, atualX = 0;

      function aoIniciar(x, y) {
        arrastando = true;
        inicioX = x; inicioY = y; atualX = 0;
        topo.style.transition = 'none';
      }
      function aoMover(x, y) {
        if (!arrastando) return;
        atualX = x - inicioX;
        var rot = atualX / 18;
        topo.style.transform = 'translateX(' + atualX + 'px) translateY(' + (y - inicioY) * 0.15 + 'px) rotate(' + rot + 'deg)';
        var like = topo.querySelector('.swipe-card-stamp.like');
        var nope = topo.querySelector('.swipe-card-stamp.nope');
        if (like) like.style.opacity = String(Math.max(0, atualX / 100));
        if (nope) nope.style.opacity = String(Math.max(0, -atualX / 100));
      }
      function aoSoltar() {
        if (!arrastando) return;
        arrastando = false;
        if (atualX > 90) {
          swipeResolverVoto('like');
        } else if (atualX < -90) {
          swipeResolverVoto('dislike');
        } else {
          topo.style.transition = 'transform 0.3s ease';
          topo.style.transform = 'translateX(0) translateY(0) rotate(0)';
          var like = topo.querySelector('.swipe-card-stamp.like');
          var nope = topo.querySelector('.swipe-card-stamp.nope');
          if (like) like.style.opacity = '0';
          if (nope) nope.style.opacity = '0';
        }
      }

      topo.addEventListener('pointerdown', function(e) { aoIniciar(e.clientX, e.clientY); topo.setPointerCapture(e.pointerId); });
      topo.addEventListener('pointermove', function(e) { aoMover(e.clientX, e.clientY); });
      topo.addEventListener('pointerup', aoSoltar);
      topo.addEventListener('pointercancel', aoSoltar);
    }

    var swipeJaCarregou = false;

    function abrirSwipeOverlay() {
      var overlay = document.getElementById('swipe-overlay');
      if (!overlay) return;
      overlay.classList.add('aberto');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('swipe-aberto');
      if (!swipeJaCarregou) {
        swipeJaCarregou = true;
        iniciarSwipeComunidade();
      }
    }

    function fecharSwipeOverlay() {
      var overlay = document.getElementById('swipe-overlay');
      if (!overlay) return;
      overlay.classList.remove('aberto');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('swipe-aberto');
    }

    function iniciarBotaoSwipeFlutuante() {
      var btnAbrir = document.getElementById('heart-float-btn');
      var btnFechar = document.getElementById('swipe-overlay-fechar');
      var overlay = document.getElementById('swipe-overlay');
      if (btnAbrir) btnAbrir.addEventListener('click', abrirSwipeOverlay);
      if (btnFechar) btnFechar.addEventListener('click', fecharSwipeOverlay);
      if (overlay) overlay.addEventListener('click', function(e) { if (e.target === overlay) fecharSwipeOverlay(); });
      document.addEventListener('keydown', function(e) { if (e.key === 'Escape') fecharSwipeOverlay(); });
    }

    function iniciarSwipeComunidade() {
      var stage = document.getElementById('swipe-stage');
      var btnLike = document.getElementById('swipe-like');
      var btnDislike = document.getElementById('swipe-dislike');
      if (!stage) return;

      var votados = swipeObterVotados();
      fetch('/api/vitrine?pagina=1')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          var itens = (data && data.itens) || [];
          swipeFila = itens.filter(function(item) {
            return item.foto && votados.indexOf(item.id) === -1;
          });
          swipeRenderizarStage();
        })
        .catch(function(err) {
          console.error('Erro ao carregar pedras para votação:', err);
          var vazio = document.getElementById('swipe-empty');
          if (vazio) {
            vazio.style.display = 'flex';
            vazio.textContent = 'Não foi possível carregar as pedras agora. Tente novamente mais tarde.';
          }
        });

      if (btnLike) btnLike.addEventListener('click', function() { swipeResolverVoto('like'); });
      if (btnDislike) btnDislike.addEventListener('click', function() { swipeResolverVoto('dislike'); });
    }

    // ========================================================================
    // RANKING DE COLECIONADORES
    // ========================================================================
    function formatarMoedaCompacta(valor) {
      if (typeof valor !== 'number' || isNaN(valor)) return 'R$ 0';
      if (valor >= 1000) return 'R$ ' + (valor / 1000).toFixed(1).replace('.', ',') + 'k';
      return 'R$ ' + valor.toFixed(0);
    }

    function carregarRankingColecionadores() {
      var lista = document.getElementById('colecionadores-lista');
      var vazio = document.getElementById('colecionadores-vazio');
      if (!lista) return;
      fetch('/api/ranking-colecionadores')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          var ranking = data.ranking || [];
          lista.innerHTML = '';
          if (ranking.length === 0) {
            vazio.style.display = 'block';
            return;
          }
          vazio.style.display = 'none';
          var medalhas = ['🥇', '🥈', '🥉'];
          ranking.forEach(function(pessoa, indice) {
            var row = document.createElement('div');
            row.className = 'colecionador-row';

            var pos = document.createElement('div');
            pos.className = 'colecionador-pos';
            pos.textContent = medalhas[indice] || ('#' + (indice + 1));
            row.appendChild(pos);

            if (pessoa.foto_destaque) {
              var img = document.createElement('img');
              img.className = 'colecionador-foto';
              img.src = pessoa.foto_destaque;
              img.alt = pessoa.nome;
              row.appendChild(img);
            } else {
              var fotoVazia = document.createElement('div');
              fotoVazia.className = 'colecionador-foto-vazia';
              fotoVazia.textContent = '🪨';
              row.appendChild(fotoVazia);
            }

            var info = document.createElement('div');
            info.className = 'colecionador-info';
            var nome = document.createElement('div');
            nome.className = 'colecionador-nome';
            nome.textContent = pessoa.nome;
            var sub = document.createElement('div');
            sub.className = 'colecionador-sub';
            sub.textContent = pessoa.total_pedras + (pessoa.total_pedras === 1 ? ' pedra catalogada' : ' pedras catalogadas');
            info.appendChild(nome);
            info.appendChild(sub);
            row.appendChild(info);

            var valor = document.createElement('div');
            valor.className = 'colecionador-valor';
            valor.textContent = formatarMoedaCompacta(pessoa.valor_total);
            row.appendChild(valor);

            lista.appendChild(row);
          });
        })
        .catch(function() {
          vazio.textContent = 'Não foi possível carregar o ranking agora.';
          vazio.style.display = 'block';
        });
    }

    // Foto fixa de demonstração do scanner — Jaspe Bumble Bee (Jaspe Abelha), id 1d4ae7d6-50ac-457b-88e8-3108185ee77e
    var FOTO_DEMO_SCAN_FIXA = '/assets/img/stone-placeholder.png';
    function carregarFotoDemoScan() {
      var demoImg = document.getElementById('dz-scan-photo');
      if (!demoImg) return;
      demoImg.onload = function() { demoImg.classList.add('loaded'); };
      demoImg.src = FOTO_DEMO_SCAN_FIXA;
      if (demoImg.complete && demoImg.naturalWidth > 0) { demoImg.classList.add('loaded'); }
    }

    // Header agora é position:fixed (fica fixo ao rolar a página), então
    // precisamos reservar no topo do body o mesmo espaço que a altura real
    // do header ocupa — recalculado sempre que o tamanho do header mudar
    // (rotação de tela, fontes carregando, etc.) para nunca sobrepor o conteúdo.
    function ajustarEspacoHeaderFixo() {
      var headerEl = document.querySelector('header');
      if (!headerEl) return;
      document.body.style.paddingTop = headerEl.offsetHeight + 'px';
    }
    (function iniciarAjusteHeaderFixo() {
      var headerEl = document.querySelector('header');
      ajustarEspacoHeaderFixo();
      window.addEventListener('resize', ajustarEspacoHeaderFixo);
      window.addEventListener('load', ajustarEspacoHeaderFixo);
      if (headerEl && window.ResizeObserver) {
        new ResizeObserver(ajustarEspacoHeaderFixo).observe(headerEl);
      }
    })();

    // ========================================================================
    // INICIALIZAÇÃO
    // ========================================================================
    atualizarHeader();
    atualizarContadorGratis();
    renderizarRankings('recentes');
    document.getElementById('catalogo-grid').innerHTML =
      '<p style="text-align:center;color:var(--ink-mute2);padding:20px 0;grid-column:1/-1;">Carregando pedras da comunidade...</p>';
    carregarFotoDemoScan();
    carregarDadosPublicos().then(function() {
      renderizarCatalogo();
      carregarVitrine(1);
      renderizarRankings(rankingAtual);
    });
    carregarEstatisticas();
    carregarRankingColecionadores();
    carregarAvataresProvaSocial();
    iniciarBotaoSwipeFlutuante();
    setInterval(carregarEstatisticas, 60000);
    setInterval(carregarRankingColecionadores, 120000);
    document.addEventListener('visibilitychange', function() { if (!document.hidden) carregarEstatisticas(); });

    supa.auth.getSession().then(function(sessaoResp) {
      if (sessaoResp.data.session) { atualizarHeader(); }
      restaurarFotosPendentesSeExistir();
      // Abre o histórico automaticamente quando chega aqui vindo de outra página
      // (ex: header.js das páginas secundárias linka para /index.html?abrir=historico).
      var paramsUrl = new URLSearchParams(window.location.search);
      if (paramsUrl.get('abrir') === 'historico') {
        var sessaoAtual = sessaoResp.data.session;
        if (sessaoAtual) {
          abrirHistorico();
        } else {
          abrirPainelLogin();
        }
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }).catch(function(erroInit) { console.error('Falha ao checar sessão na inicialização:', erroInit); });

    window.addEventListener('beforeunload', function() { limparTimeouts(); });

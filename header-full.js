// header-full.js — header funcional (login, saldo, histórico) para páginas
// secundárias (ajuda.html, política de privacidade, termos, etc).
//
// Requisitos na página que usa este script:
//   <link rel="stylesheet" href="/header-full.css">
//   <div id="header-placeholder"></div>
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
//   <script src="/header-full.js"></script>
//
// O botão de histórico não duplica a lógica de badges/níveis/resultado —
// ele leva para /index.html?abrir=historico, que já sabe abrir o histórico
// (ver alteração feita em index.html).

(function () {
  var SUPABASE_URL = 'https://lflqjmbygghuikwuoimd.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbHFqbWJ5Z2dodWlrd3VvaW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNjU1NTMsImV4cCI6MjEwMTg0MTU1M30.tMrllUj-s0ZxahNbrazuGlWq6bT16o2E6hpbchhxqFU';

  function formatarMoedaBR(valor) {
    if (typeof valor !== 'number' || isNaN(valor)) return null;
    return 'R$ ' + valor.toFixed(2).replace('.', ',');
  }

  fetch('/header-full.html')
    .then(function (res) {
      if (!res.ok) throw new Error('Falha ao carregar header-full.html: ' + res.status);
      return res.text();
    })
    .then(function (html) {
      var placeholder = document.getElementById('header-placeholder');
      if (!placeholder) {
        console.error('Elemento #header-placeholder não encontrado na página.');
        return;
      }
      placeholder.innerHTML = html;
      iniciar();
    })
    .catch(function (err) {
      console.error('Erro ao carregar o header:', err);
    });

  function iniciar() {
    // --- Cliente Supabase ---
    var supa;
    try {
      if (!window.supabase) throw new Error('Biblioteca Supabase não carregada');
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (erroInicSupabase) {
      console.error('Falha ao iniciar Supabase:', erroInicSupabase);
      supa = {
        auth: {
          getSession: function () { return Promise.reject(erroInicSupabase); },
          signInWithOAuth: function () { return Promise.reject(erroInicSupabase); },
          signOut: function () { return Promise.reject(erroInicSupabase); }
        }
      };
    }

    var headerAuthArea = document.getElementById('header-auth-area');
    var painelLogin = document.getElementById('painel-login');
    var btnFecharLogin = document.getElementById('btn-fechar-login');
    var btnGoogleLogin = document.getElementById('btn-google-login');
    var erroLoginEl = document.getElementById('erro-login');
    var btnSidebarToggle = document.getElementById('btn-sidebar-toggle');

    function esconderPaineis() {
      painelLogin.classList.remove('active');
      document.body.classList.remove('popup-aberto');
    }
    function abrirPainelLogin() {
      esconderPaineis();
      painelLogin.classList.add('active');
      document.body.classList.add('popup-aberto');
    }
    btnFecharLogin.addEventListener('click', esconderPaineis);
    painelLogin.addEventListener('click', function (e) {
      if (e.target === painelLogin) esconderPaineis();
    });

    function loginComGoogle() {
      erroLoginEl.style.display = 'none';
      supa.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href.split('#')[0].split('?')[0] }
      }).then(function (result) {
        if (result.error) {
          erroLoginEl.textContent = 'Erro ao fazer login: ' + result.error.message;
          erroLoginEl.style.display = 'block';
        }
      }).catch(function (err) {
        erroLoginEl.textContent = 'Erro ao fazer login: ' + err.message;
        erroLoginEl.style.display = 'block';
      });
    }
    btnGoogleLogin.addEventListener('click', loginComGoogle);

    // Botão de histórico: leva ao index.html com o histórico já pronto para abrir.
    if (btnSidebarToggle) {
      btnSidebarToggle.addEventListener('click', function () {
        window.location.href = '/index.html?abrir=historico';
      });
    }

    function atualizarValorColecao(accessToken) {
      var pillColecao = document.getElementById('nav-colecao');
      var dropdownColecaoValor = document.getElementById('nav-dropdown-colecao-valor');
      fetch('/api/historico', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + accessToken }
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var itens = data.itens || [];
          var total = itens.reduce(function (soma, item) {
            var v = typeof item.valor_exibicao === 'number' ? item.valor_exibicao
              : typeof item.valor_estimado === 'number' ? item.valor_estimado
              : typeof item.preco_estimado === 'number' ? item.preco_estimado : 0;
            return soma + v;
          }, 0);
          var totalFormatado = formatarMoedaBR(total) || 'R$ 0,00';
          if (pillColecao) pillColecao.innerHTML = '💎 ' + totalFormatado;
          if (dropdownColecaoValor) dropdownColecaoValor.textContent = totalFormatado;
        })
        .catch(function () {});
    }

    function atualizarHeader() {
      supa.auth.getSession().then(function (sessaoResp) {
        return sessaoResp;
      }, function () {
        return { data: { session: null } };
      }).then(function (sessaoResp) {
        var sessao = sessaoResp.data.session;
        if (sessao && sessao.user) {
          var nomeExibido = (sessao.user.user_metadata && sessao.user.user_metadata.full_name) ||
            (sessao.user.user_metadata && sessao.user.user_metadata.name) ||
            sessao.user.email || 'Usuário';
          var inicial = nomeExibido.trim().charAt(0) || '?';
          headerAuthArea.innerHTML =
            '<div class="nav-user" id="nav-user">' +
            '<button class="nav-user-btn" id="btn-nav-user-toggle">' +
            '<span class="nav-avatar">' + inicial + '</span>' +
            '<span class="nav-name">' + nomeExibido + '</span>' +
            '<span class="nav-colecao-pill" id="nav-colecao" title="Valor estimado total das suas pedras escaneadas">💎 ···</span>' +
            '<span class="nav-saldo-pill" id="nav-saldo">···</span>' +
            '<svg class="nav-chevron" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>' +
            '</button>' +
            '<div class="nav-dropdown" id="nav-dropdown">' +
            '<div class="nav-dropdown-colecao" id="nav-dropdown-colecao"><svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z"/></svg> <span>Coleção: <strong id="nav-dropdown-colecao-valor">···</strong></span></div>' +
            '<div class="nav-dropdown-saldo" id="nav-dropdown-saldo">···</div>' +
            '<button id="btn-nav-historico">Ver histórico</button>' +
            '<button class="sair" id="btn-header-sair">Sair</button>' +
            '</div>' +
            '</div>';
          var navUser = document.getElementById('nav-user');
          document.getElementById('btn-nav-user-toggle').addEventListener('click', function (e) {
            e.stopPropagation();
            navUser.classList.toggle('active');
          });
          document.addEventListener('click', function () { navUser.classList.remove('active'); });
          document.getElementById('btn-nav-historico').addEventListener('click', function () {
            window.location.href = '/index.html?abrir=historico';
          });
          document.getElementById('btn-header-sair').addEventListener('click', function () {
            supa.auth.signOut().then(function () { window.location.reload(); });
          });

          fetch('/api/status', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + sessao.access_token }
          })
            .then(function (res) { return res.json(); })
            .then(function (data) {
              var valorSaldo = data.pago ? formatarMoedaBR(data.saldo) : formatarMoedaBR(0);
              var saldoEl = document.getElementById('nav-saldo');
              if (saldoEl) saldoEl.textContent = valorSaldo;
              var saldoDropdownEl = document.getElementById('nav-dropdown-saldo');
              if (saldoDropdownEl) saldoDropdownEl.innerHTML = '<strong>' + valorSaldo + '</strong> de saldo';
            })
            .catch(function () {});

          atualizarValorColecao(sessao.access_token);
        } else {
          headerAuthArea.innerHTML = '<button class="nav-cta" id="btn-header-entrar"><span class="full">Entrar / Registrar</span><span class="short">Entrar</span></button>';
          document.getElementById('btn-header-entrar').addEventListener('click', abrirPainelLogin);
        }
      });
    }

    atualizarHeader();
  }
})();

// header.js
// Injeta o header padrão do site no elemento com id="header-placeholder".
// Uso: <div id="header-placeholder"></div>  <script src="/header.js"></script>

(function () {
  fetch('/header.html')
    .then(function (res) {
      if (!res.ok) throw new Error('Falha ao carregar header.html: ' + res.status);
      return res.text();
    })
    .then(function (html) {
      var placeholder = document.getElementById('header-placeholder');
      if (placeholder) {
        placeholder.innerHTML = html;
      } else {
        console.error('Elemento #header-placeholder não encontrado na página.');
      }
    })
    .catch(function (err) {
      console.error('Erro ao carregar o header:', err);
    });
})();

# Plano — Redesign da Tela Inicial Mobile (SCANNER 3.5)

Arquivos envolvidos: `index.html`, `assets/css/index.css` (e possivelmente `assets/css/header-full.css`).
Imagens já existentes e reaproveitadas: `assets/img/amethyst-hero.png`, `assets/img/amethyst-result.png`, `assets/img/logo.png`.

## Regras gerais (valem para todas as partes)

- Não remover nenhum `id`, `class` usada pelo JS, listener, evento ou funcionalidade existente (upload, drag&drop, câmera, autenticação, Supabase, modais, pré-scan, histórico, avaliações, vitrine, venda).
- Mudança é visual (HTML/CSS). Se algo antigo precisar sumir da tela no mobile, esconder com CSS (`display:none` em media query), não apagar do DOM, caso o JS ainda dependa do elemento.
- Fundo creme/off-white, verde escuro principal, verde claro secundário, roxo só como destaque de ametista/cristal, dourado só em estrelas.
- Fontes mantidas: Fraunces (títulos), Inter (texto/botões), Space Mono (labels pequenos/eyebrow).
- `border-radius` 14–20px, sombras bem sutis, nada de excesso de cor ou de cards.
- Testar sem overflow horizontal em 375px, 390px, 393px, 414px.
- Círculo verde atrás das pedras é feito em CSS (pseudo-elemento ou `div` separada) — nunca editar os PNGs.
- Nome da pedra ("AMETISTA" etc.) é sempre texto HTML separado da imagem, nunca dentro do PNG.

---

## Parte 1 — Header mobile compacto
**Onde:** `<header>` / `.nav-wrap` em `index.html`, estilos em `index.css` / `header-full.css`.

- Reduzir para ~64px de altura no mobile.
- Manter só: logo + "SCANNER 3.5" à esquerda, botão "Entrar" à direita (`#btn-header-entrar`).
- Esconder no mobile (via media query) os links extras (`#nav-link-minhas-pedras`, `#nav-link-vender`, `#nav-link-catalogo`, `#nav-link-rankings`, `#nav-link-ajuda`) sem removê-los do DOM — eles continuam existindo para desktop/JS.
- Critério de pronto: header enxuto, sem quebra de linha, sem sumir o botão Entrar em nenhuma das 4 larguras de teste.

## Parte 2 — Hero (eyebrow + título + texto + prova social)
**Onde:** bloco `.head` dentro de `.wrap` (eyebrow, `h1`, `.sub-tag`, `.hero-sub`, `.social-proof`).

- Trocar eyebrow "Comunidade de avaliação de pedras" → "IDENTIFICADOR DE PEDRAS COM IA" (Space Mono).
- Trocar `<h1>SCANNER 3.5</h1>` + `.sub-tag` por título Fraunces grande: "Descubra qual é a sua pedra." (2–3 linhas).
- Ajustar `.hero-sub` para: "Identifique com IA, conheça suas características e descubra uma estimativa de valor."
- Prova social: remover avatares com letras (`.sp-avatar`, `#sp-avatar-more`) e substituir por "★★★★★ 4,9/5" + "+1.200 análises realizadas" (estrelas douradas discretas, reaproveitando o SVG de estrela já existente em `.social-proof-stars`).
- Manter `#social-proof-count` funcional se o JS atualizar esse número dinamicamente — só migrar para o novo texto.
- Critério de pronto: hierarquia clara em poucos segundos, sem textos cortados.

## Parte 3 — Ilustração da pedra (fundo verde em CSS)
**Onde:** novo bloco dentro de `.head` ou entre hero e upload-hint.

- Criar estrutura reutilizável:
  ```html
  <div class="stone-visual">
    <div class="stone-bg"></div>
    <img class="stone-image" src="/assets/img/amethyst-hero.png" alt="Ametista">
  </div>
  ```
- `.stone-bg`: círculo verde-claro (~`#DDE8DF`), levemente assimétrico (border-radius irregular tipo `62% 38% 55% 45% / 45% 55% 45% 55%`), atrás da imagem (`z-index` menor).
- Pedra (`.stone-image`) ultrapassando o círculo em ~10–20%, `z-index` maior.
- Detalhes decorativos discretos em CSS/SVG (estrela/brilho no canto superior direito, linhas finas verde-escuras) — sem mexer no PNG.
- Responsivo: ajustar tamanho do círculo/imagem nas 4 larguras de teste.
- Critério de pronto: pedra "flutuando" sobre o círculo, sem caixa retangular verde visível, sem cortar a imagem.

## Parte 4 — Card de upload como CTA principal
**Onde:** `.card#area-principal` e `#dropzone` (mantendo tudo que já existe dentro).

- Reformular a casca visual do card: título "IDENTIFIQUE SUA PEDRA", texto "Tire uma foto ou envie até 3 imagens para uma análise mais precisa.", ícone de câmera grande em círculo verde-claro, texto auxiliar "JPG, PNG • até 10 MB".
- O botão principal deve continuar sendo o mecanismo real de upload já existente (`#dropzone` / `#input-foto` / fluxo de `#modal-escolha-foto`) — apenas restilizar visualmente (largura quase total, fundo verde escuro, texto branco, ícone de câmera + seta), sem criar um botão novo desconectado da lógica.
- Não alterar `#preview`, `#foto-tira-wrap`, `#pre-scan-perguntas`, `#actions`, `#erro` — só o "invólucro" visual do estado inicial (antes de escolher foto).
- Critério de pronto: clicar em qualquer parte do card abre o mesmo fluxo de sempre (câmera/galeria); nada do JS de upload muda de nome ou comportamento.

## Parte 5 — "Veja o que você recebe" (prévia estática de resultado)
**Onde:** nova seção logo abaixo do card de upload, antes da faixa de benefícios.

- Título de seção: "Veja o que você recebe".
- Card de exemplo (estático, apenas demonstrativo — não é o modal/dossiê real):
  ```html
  <div class="stone-visual stone-visual--sm">
    <div class="stone-bg"></div>
    <img class="stone-image" src="/assets/img/amethyst-result.png" alt="Ametista">
  </div>
  <div class="stone-name">AMETISTA</div>
  <p>Confiança da IA 94%</p>
  <p>Quartzo • Roxo • Dureza 7</p>
  <p>Valor estimado<br><strong>R$ 120 — R$ 280</strong></p>
  <svg class="seta">→</svg>
  ```
- "AMETISTA" em Fraunces, verde escuro, ~20px, semibold — texto HTML, nunca dentro do PNG (para no futuro trocar por QUARTZO, ÁGATA, TURMALINA, CITRINO etc.).
- Deixar claro no código (comentário) que esse card é só ilustrativo e não deve ser confundido com o modal real de resultado da IA.
- Critério de pronto: visualmente parecido com o card de upload em estilo (mesma família de cores/raios), mas claramente "exemplo".

## Parte 6 — Faixa de benefícios
**Onde:** logo abaixo da Parte 5.

- 3 itens com ícone simples + texto curto: "Seguro e confiável", "Análise com IA", "Comunidade ativa".
- Layout enxuto (uma linha ou 3 colunas), sem virar mais um "card" pesado.

## Parte 7 — Botão flutuante do WhatsApp
**Onde:** `#wa-float-btn` em `index.html`.

- Reduzir levemente o tamanho no mobile.
- Reposicionar (ex.: mais para a borda/baixo) para não cobrir o card de upload nem o botão principal.
- Manter `href`, `id` e comportamento (`target="_blank"`) intactos.

## Parte 8 — Responsividade e QA final
- Testar em 375px, 390px, 393px, 414px: sem overflow horizontal, sem texto cortado, sem elemento vazando da tela.
- Checklist funcional (nada pode quebrar):
  - [ ] Upload por câmera e por galeria
  - [ ] Múltiplas fotos (até 3 ângulos) / `foto-tira`
  - [ ] Perguntas de pré-scan
  - [ ] Envio para IA e abertura do modal de resultado real
  - [ ] Login/registro (`#btn-header-entrar`)
  - [ ] Histórico ("Minhas Pedras" / sidebar)
  - [ ] Vitrine / rankings / vender
  - [ ] Botão do WhatsApp

---

## Ordem sugerida de aplicação
1. Parte 1 (header) → 2 (hero) → 3 (ilustração) → 4 (card de upload) → 5 (prévia) → 6 (benefícios) → 7 (WhatsApp) → 8 (QA).

Isso permite revisar e aprovar cada bloco visual antes de avançar pro próximo, sem mexer tudo de uma vez no mesmo arquivo.

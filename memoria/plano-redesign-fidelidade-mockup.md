# Plano v2 — Redesign da Tela Inicial Mobile (fidelidade total ao mockup)

Este plano **substitui/complementa** `plano-redesign-mobile-scanner35.md`. O plano anterior tinha os textos/estrutura corretos em vários pontos, mas a implementação divergiu visualmente do mockup em pontos importantes (hero centralizado em vez de alinhado à esquerda, card de upload verde cheio em vez de branco/tracejado, card de resultado vertical em vez de horizontal, ícone errado na faixa de benefícios, elementos soltos que não existem no mock — ex. ícone de hambúrguer sobre a pedra, frase extra "CARREGUE A FOTO ABAIXO..." com seta).

**Regra mestra:** o mockup (`story.png` + os 3 prints de referência do usuário) é a especificação visual. Não reinterpretar, não "melhorar", não criar layout genérico "parecido". O objetivo é que o resultado pareça a implementação literal do mock, não uma versão inspirada nele.

Arquivos envolvidos: `index.html`, `assets/css/index.css` (e `header-full.css` se necessário).
Imagens reaproveitadas: `assets/img/amethyst-hero.png`, `assets/img/amethyst-result.png`, `assets/img/logo.png`.

## Regras gerais (valem para todas as partes)

- Não remover nenhum `id`, `class` usada pelo JS, listener, evento ou funcionalidade existente (upload, drag&drop, câmera, autenticação, Supabase, modais, pré-scan, histórico, avaliações, vitrine, venda).
- Mudança é visual (HTML/CSS). Se algo precisar sumir da tela no mobile, esconder com CSS (`display:none` em media query), nunca apagar do DOM se o JS depender do elemento.
- Ignorar a logo — não é prioridade neste trabalho, manter a atual.
- Não resolver layout com `overflow:hidden` escondendo conteúdo, nem cortar textos/imagens, nem usar alturas fixas que façam conteúdo desaparecer.
- Testar sem overflow horizontal em 375px, 390px, 393px, 414px.
- Fontes mantidas: Fraunces (títulos serifados), Inter (texto/botões/labels), Space Mono possivelmente substituído por Inter uppercase no eyebrow (ver Parte 2).
- Nome da pedra ("AMETISTA"/"Ametista") sempre texto HTML separado da imagem, nunca dentro do PNG.
- Círculo verde atrás da pedra é feito em CSS (pseudo-elemento ou `div` separada) — nunca editar os PNGs.

## Paleta de cores (usar exatamente estes valores)

- Fundo geral: `#F8F7F2` (não branco puro, não cinza escuro, sem gradientes fortes)
- Verde principal: `#064F3D`
- Verde escuro (texto/título/pedra): `#073B31`
- Verde suave (círculo atrás da pedra, ícone do card): `#DCEBE2`
- Branco: `#FFFFFF`
- Dourado das estrelas: `#E6A817`
- Lilás do badge de confiança: `#E9E0F7`
- Texto secundário: `#68736F`

## Sombras e bordas padrão

- Sombra leve: `box-shadow: 0 8px 30px rgba(20, 40, 30, 0.06);` (nunca sombras pesadas)
- Bordas: `1px solid` com baixa opacidade, nada de bordas grossas
- `border-radius`: 20px em cards, 999px (pill) em botões e badges — nunca cards quadrados

---

## Parte 1 — Header

**Onde:** `<header>` / `.nav-wrap` em `index.html`, estilos em `index.css` / `header-full.css`.

- Altura ~80px, fundo branco/off-white, linha divisória extremamente discreta, padding horizontal ~20px.
- Manter só: logo + "SCANNER 3.5" à esquerda (nome com aparência forte mas não gigante), botão "Entrar" à direita (`#btn-header-entrar`).
- Botão "Entrar": fundo transparente/off-white, borda fina, cantos arredondados, texto escuro — **não** virar botão verde preenchido.
- Esconder no mobile (via media query) os links extras (`#nav-link-minhas-pedras`, `#nav-link-vender`, `#nav-link-catalogo`, `#nav-link-rankings`, `#nav-link-ajuda`) sem removê-los do DOM.
- Ignorar a logo em si (manter a atual).
- Critério de pronto: header enxuto, sem quebra de linha, botão Entrar sempre visível nas 4 larguras de teste.

## Parte 2 — Hero (composição lateralizada, não empilhada)

**Onde:** bloco `.head` dentro de `.wrap`.

**Erro a corrigir:** hero atual está centralizado, com a pedra empurrada para baixo do texto e espaçamento vertical enorme entre as linhas do título (parecem parágrafos separados). No mock, texto e pedra dividem a mesma área — pedra ao lado (ou integrada visualmente, dependendo do espaço em mobile), título com as duas linhas coladas.

- Eyebrow: "IDENTIFICADOR DE PEDRAS COM IA" — uppercase, ~12–13px, Inter, letter-spacing, verde escuro, **numa linha só** (não pode quebrar em 2 linhas), com traços finos e discretos dos dois lados (`──── texto ────`).
- Título: `<h1>` "Descubra qual é a sua pedra." em Fraunces, grande, peso forte, verde muito escuro (`#073B31`), alinhado à **esquerda**, line-height compacto — as duas linhas devem ficar coladas como um título único, não como blocos separados.
- Subtítulo: "Identifique com IA, conheça suas características e descubra uma estimativa de valor." — Inter, ~16–18px no mobile, peso normal, cor verde/cinza escuro (`#68736F`), largura limitada para reproduzir as quebras de linha do mock (não ocupar 100% da largura).
- Avaliação: `★★★★★ 4,9/5 · +N análises realizadas` — estrelas em `#E6A817`, "4,9/5" com destaque, texto de análises menor/discreto. Manter `#social-proof-count` funcional (o número dinâmico, ex. hoje mostra "+28", isso está certo — só a disposição muda de centralizada para alinhada à esquerda).
- Remover avatares com letras (`.sp-avatar`, `#sp-avatar-more`) se ainda existirem.
- Alinhamento geral do bloco: **esquerda**, não centralizado.
- Critério de pronto: eyebrow numa linha só com traços, título com linhas coladas, tudo alinhado à esquerda, sem textos cortados.

## Parte 3 — Ilustração da pedra

**Onde:** novo bloco dentro/ao lado de `.head`.

**Erros a corrigir:** ícone de hambúrguer (☰) solto sobre a imagem (remover — não existe no mock), falta a moldura de scanner (cantos brancos tipo mira de câmera), círculo verde de fundo parece maior/desalinhado.

- Estrutura:
  ```html
  <div class="stone-visual">
    <div class="stone-bg"></div>
    <img class="stone-image" src="/assets/img/amethyst-hero.png" alt="Ametista">
  </div>
  ```
- `.stone-bg`: círculo em verde suave (`#DCEBE2`), atrás da imagem.
- Pedra com leve destaque sobre o círculo.
- Adicionar moldura de scanner: 4 cantos brancos estilo mira de câmera nos cantos do bloco da pedra (CSS/SVG), reaproveitando o efeito de scanner que já existe no app se possível.
- Pequeno brilho/estrela dourada próxima da pedra (decorativo, CSS/SVG).
- Remover completamente o ícone de hambúrguer solto sobre a imagem.
- Responsivo nas 4 larguras de teste.
- Critério de pronto: pedra com moldura de scanner, sem ícone solto, círculo verde proporcional, sem cortar a imagem.

## Parte 4 — Card de upload (maior mudança — reconstruir do zero)

**Onde:** `.card#area-principal` e `#dropzone`, mantendo toda a lógica existente dentro.

**Erro a corrigir:** card atual é inteiramente verde escuro, com ícone de câmera solto + setinha redonda no canto (sem texto de botão), e ainda tem uma frase extra acima do card ("CARREGUE A FOTO ABAIXO E VEJA O RESULTADO NA HORA" + seta ↓) que não existe no mock — **remover essa frase e a seta**.

**Distinção fundamental:** o **card** é branco/off-white. O **botão** dentro dele é verde. Não é o card inteiro que é verde.

- Card externo: fundo branco, borda extremamente suave, `border-radius` ~20–24px, sombra leve (`0 8px 30px rgba(20,40,30,0.06)`), padding interno generoso.
- Dentro do card, uma área com **borda pontilhada** (não remover esse detalhe).
- Ícone de câmera grande dentro de um círculo verde-claro (`#DCEBE2`) no topo, ~70–80px.
- Título "IDENTIFIQUE SUA PEDRA": uppercase, Inter, peso forte, letter-spacing, verde escuro, centralizado.
- Texto de ajuda: "Tire uma foto ou envie até 3 imagens para uma análise mais precisa.", Inter, cor secundária, centralizado.
- Botão principal (pill): "Analisar minha pedra →" — fundo verde escuro (`#064F3D` ou `#073B31`), largura quase total do card, altura ~56–60px, `border-radius: 999px`, texto branco Inter semibold, ícone de câmera branco à esquerda, seta à direita.
- Texto auxiliar abaixo do botão: "JPG, PNG · até 10 MB", pequeno, centralizado, cor secundária.
- O botão/card deve continuar sendo o mecanismo real de upload já existente (`#dropzone` / `#input-foto` / `#modal-escolha-foto`) — só restilizar visualmente, sem criar elemento novo desconectado da lógica.
- Não alterar `#preview`, `#foto-tira-wrap`, `#pre-scan-perguntas`, `#actions`, `#erro` — só o "invólucro" visual do estado inicial.

### Subdivisão (aplicar nesta ordem, cada uma testável isoladamente)

**Parte 4a — Estrutura e textos**
- Remover a frase "CARREGUE A FOTO ABAIXO..." + seta ↓ acima do card.
- Trocar `#dz-titulo` para "IDENTIFIQUE SUA PEDRA".
- Trocar texto de ajuda para "Tire uma foto ou envie até 3 imagens para uma análise mais precisa.".
- Adicionar texto auxiliar "JPG, PNG · até 10 MB" (novo elemento, sem estilo ainda).
- Critério de pronto: textos corretos na tela, nenhum `id`/listener removido.

**Parte 4b — Casca branca + ícone em círculo**
- Trocar fundo do card de verde para branco/off-white com sombra leve.
- Criar a área interna com borda pontilhada.
- Ícone de câmera em círculo verde-claro (reaproveitar/adaptar `#dz-icon-desktop` sem remover do DOM).
- Critério de pronto: card branco com ícone em círculo, proporcional nas 4 larguras, sem overflow.

**Parte 4c — Botão pill + QA funcional**
- Criar/restilizar o botão pill verde-escuro "Analisar minha pedra →" dentro do card.
- Garantir que o clique continua chamando o mesmo fluxo (`#dropzone`/`#input-foto`/`#modal-escolha-foto`).
- QA: clicar em qualquer parte do botão/card abre o modal de escolha de foto normalmente; upload por câmera e galeria funcionam; nada do JS muda de nome/comportamento.
- Critério de pronto: card 100% igual ao mock, fluxo de upload intacto.

## Parte 5 — "Veja o que você recebe" (card horizontal)

**Onde:** seção logo abaixo do card de upload.

**Erro a corrigir:** card atual é vertical e centralizado (foto grande no topo, infos empilhadas embaixo). No mock é **horizontal**: foto pequena à esquerda, informações à direita, seta no canto.

- Título de seção com traços dos dois lados: "── Veja o que você recebe ──", fonte serifada (Fraunces), não gigante.
- Card (estático, ilustrativo — comentar no código que não é o modal real de resultado):
  ```html
  <div class="result-preview-card">
    <div class="stone-visual stone-visual--sm">
      <div class="stone-bg"></div>
      <img class="stone-image" src="/assets/img/amethyst-result.png" alt="Ametista">
    </div>
    <div class="result-preview-info">
      <div class="stone-name">Ametista</div>
      <span class="badge-confianca">Confiança da IA 94%</span>
      <p class="stone-props">◇ Quartzo · Roxo · Dureza 7</p>
      <p class="stone-valor">Valor estimado<br><strong>R$ 120 — R$ 280</strong></p>
    </div>
    <svg class="seta">→</svg>
  </div>
  ```
- Imagem da ametista: pequena (~140–160px desktop, menor no mobile), fundo claro, cantos arredondados — **não** gigante/central.
- Nome "Ametista": Fraunces, grande, verde escuro, alinhado à esquerda na coluna de info (texto HTML separado do PNG, para no futuro trocar por QUARTZO/ÁGATA/TURMALINA/CITRINO etc.).
- Badge "Confiança da IA 94%": pill em lilás suave (`#E9E0F7`), não roxo forte.
- Características "Quartzo · Roxo · Dureza 7": com pequeno ícone de diamante, tudo em uma linha quando houver espaço.
- Valor estimado com destaque tipográfico.
- Seta "→" pequena no canto direito do card (não é botão gigante).
- Manter texto "EXEMPLO ILUSTRATIVO" como badge discreto (opcional, reposicionado).
- Critério de pronto: layout horizontal (foto à esquerda, info à direita), visualmente alinhado ao mock, claramente identificado como exemplo.

## Parte 6 — Faixa de benefícios

**Onde:** logo abaixo da Parte 5.

**Erro a corrigir:** ícone do meio está como estrela/sparkle numa posição errada — no mock os 3 ícones são: escudo (Seguro e confiável), **sparkle/estrela** (Análise com IA — confirmar que já está certo, não trocar por raio), pessoas (Comunidade ativa).

- 3 itens em uma única linha horizontal, com pequena divisória vertical entre eles: 🛡 "Seguro e confiável" · ✦ "Análise com IA" · 👥 "Comunidade ativa".
- Layout enxuto, sem virar cards pesados, sem grandes áreas verticais por item.
- Critério de pronto: uma linha só, ícones corretos, sem overflow.

## Parte 7 — Botão flutuante do WhatsApp

**Onde:** `#wa-float-btn`.

- Círculo verde, ~56px, sombra suave, ícone branco, `position: fixed`, canto inferior direito.
- Não cobrir informações importantes (card de upload, botão principal).
- Manter `href`, `id`, `target="_blank"` intactos.

## Parte 8 — Seção "Atividade recente" (fora da composição principal)

- Essa seção existe hoje no site mas **não faz parte do mockup fornecido** — não pode aparecer antes do hero.
- Se precisar continuar existindo por funcionalidade, manter depois de todas as partes principais (1 a 7), visualmente secundária, sem interferir na experiência do hero/upload/resultado.

## Parte 9 — Responsividade e QA final

- Testar em 375px, 390px, 393px, 414px: sem overflow horizontal, sem texto cortado, sem elemento vazando da tela.
- Desktop: usar `max-width` para não deixar os elementos exageradamente largos, preservando a mesma lógica visual do mobile.
- Checklist funcional (nada pode quebrar):
  - [ ] Upload por câmera e por galeria
  - [ ] Múltiplas fotos (até 3 ângulos) / `foto-tira`
  - [ ] Perguntas de pré-scan
  - [ ] Envio para IA e abertura do modal de resultado real
  - [ ] Login/registro (`#btn-header-entrar`)
  - [ ] Histórico ("Minhas Pedras" / sidebar)
  - [ ] Vitrine / rankings / vender
  - [ ] Botão do WhatsApp
- Revisão visual final comparando com o mock: hero, posição da pedra, avaliação, card de upload, seção "Veja o que você recebe", card da ametista, três benefícios, botão WhatsApp, espaçamentos, proporções gerais.

---

## O que NÃO fazer (lista de erros já cometidos — não repetir)

- Não centralizar o hero inteiro (deve ser alinhado à esquerda).
- Não empurrar a pedra para baixo do texto com espaçamento enorme entre as linhas do título.
- Não deixar ícone de hambúrguer ou qualquer elemento solto sobre a imagem da pedra.
- Não transformar o card de upload inteiro em verde (só o botão é verde, o card é branco).
- Não adicionar frases/setas extras que não existem no mock (ex. "CARREGUE A FOTO ABAIXO...").
- Não transformar o card de resultado em layout vertical (deve ser horizontal: foto à esquerda, info à direita).
- Não colocar "Atividade recente" antes do hero.
- Não cortar conteúdo ou escondê-lo com `overflow`.
- Não usar preto puro como cor dominante, nem fundo branco puro (usar `#F8F7F2`).
- Não criar uma "versão inspirada" — o objetivo é fidelidade visual próxima ao literal do mock.

## Ordem sugerida de aplicação

1. Parte 1 (header) → 2 (hero) → 3 (ilustração) → 4 (card de upload, subdividido em 4a/4b/4c) → 5 (prévia de resultado) → 6 (benefícios) → 7 (WhatsApp) → 8 (atividade recente) → 9 (QA final).

Isso permite revisar e aprovar cada bloco visual antes de avançar pro próximo, sem mexer tudo de uma vez no mesmo arquivo — importante para não estourar o limite de uso do plano gratuito numa sessão só.

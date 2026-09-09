# SCANNER 3.5 — PedraScanner

Identificador de pedras e minerais com IA. Site estático (HTML/CSS/JS puro,
sem framework) hospedado na Vercel, com funções serverless em `/api`.

## Estrutura de pastas

```
.
├── api/                      # Serverless functions (Vercel exige que fiquem na raiz)
│   ├── conta.js               # ações autenticadas (histórico, desbloqueio, venda...)
│   ├── identificar.js         # identificação de pedra via IA
│   ├── publico.js              # endpoints públicos (stats, vitrine, ranking...)
│   ├── ranking-colecionadores.js
│   └── webhook-cakto.js       # webhook de pagamento (Cakto)
│
├── assets/
│   ├── css/
│   │   ├── index.css          # estilos da home (extraído do index.html)
│   │   └── header-full.css    # estilos do header usado nas páginas secundárias
│   ├── js/
│   │   ├── index.js           # lógica da home (extraído do index.html)
│   │   └── header-full.js     # header dinâmico (login, saldo, histórico)
│   └── img/
│       ├── logo.png
│       └── stone-placeholder.png
│
├── index.html                 # Home (precisa ficar na raiz para servir "/")
├── ajuda.html
├── contato.html
├── obrigado.html
├── privacidade.html
├── termos.html
├── header-full.html            # fragmento de header injetado via fetch()
│
├── package.json
├── vercel.json                 # rewrites das rotas de API + redirects
└── README.md
```

## Por que essa organização

- **`api/` fica na raiz**: é uma exigência da Vercel — as funções serverless só
  são detectadas automaticamente nesse caminho.
- **Páginas HTML ficam na raiz**: a Vercel serve arquivos estáticos pelo
  caminho do arquivo. Mover `ajuda.html`, `contato.html` etc. para uma subpasta
  mudaria a URL pública (ex: `/paginas/ajuda.html`) e quebraria links já
  existentes. CSS/JS/imagens não têm essa restrição.
- **`index.html` foi dividido**: antes tinha ~5.700 linhas com CSS e JS
  embutidos no meio do HTML. Agora:
  - HTML puro → `index.html`
  - CSS → `assets/css/index.css`
  - JS → `assets/js/index.js`

## Rodando localmente

Não há build step. Basta servir a pasta como estático, por exemplo:

```bash
npx serve .
```

As funções em `/api` só funcionam via `vercel dev` (ou em produção na Vercel).

## Deploy

Deploy automático via Vercel a partir deste repositório. `vercel.json` cuida
dos rewrites de rotas (`/api/status` → `/api/conta?_fn=status`, etc.) e dos
redirects de `index.html`/`index.htm` para `/`.

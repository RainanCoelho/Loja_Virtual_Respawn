# 🎮 Respawn

Loja virtual de periféricos gamer (controles, teclados, mouses, headsets e mais), feita para a disciplina de Banco de Dados com **persistência poliglota**: cada tipo de dado fica no banco mais adequado.

**Site no ar:** https://respawn-rouge.vercel.app

## Funcionalidades

- Vitrine com carrossel 3D e seções de mais vendidos, recomendados, ofertas e novidades
- Catálogo, busca e página de produto com ficha técnica
- Carrinho com finalização do pedido pelo WhatsApp
- Painel do administrador para cadastrar e apagar produtos

## Bancos de dados

| Banco | O que guarda | Por quê |
| --- | --- | --- |
| **MongoDB** | Produtos | Cada produto tem campos diferentes (ex.: mouse tem DPI, monitor tem taxa de atualização) |
| **Supabase** (PostgreSQL) | Login do administrador e fotos dos produtos | Dados fixos e estruturados; a senha é salva só como hash |
| **Redis** | Cache, carrinho, histórico de busca, ranking de vendas e visitas | Fica em memória, então responde na hora |

## Onde está o código

```
LojaVirtualdeProdutos/
└── src/
    └── lojavirtualdeprodutos/
        ├── banco.py      ← conexões e funções dos três bancos
        ├── app.py        ← rotas do site (Flask)
        ├── templates/    ← páginas HTML
        └── static/       ← CSS, JavaScript, modelos 3D e imagens
```

## Tecnologias

Python, Flask, MongoDB Atlas, Supabase, Redis Cloud e Vercel.

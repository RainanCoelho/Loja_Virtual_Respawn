# 🎮 Respawn — loja gamer com banco de dados poliglota

Projeto da disciplina de **Projeto de Banco de Dados**. A **Respawn** é uma loja virtual de periféricos para jogos (controles, teclados, mouses, headsets, monitores, cadeiras e volantes) que divide os dados entre três bancos, usando cada um no que ele faz melhor:

| Banco | Responsabilidade na loja |
|---|---|
| **MongoDB** (Atlas) | Catálogo de produtos em documentos flexíveis: cada produto tem sua própria ficha técnica |
| **Supabase** (PostgreSQL + Storage) | Conta do administrador com senha em hash e fotos dos produtos cadastrados pelo painel |
| **Redis** (Redis Cloud) | Cache do catálogo, carrinho, histórico de busca, ranking de vendas e contador de visitas |

🔗 **Site no ar:** https://respawn-rouge.vercel.app
🎬 **Vídeo de apresentação:** disponível em [Releases](../../releases/latest)

![Página inicial](docs/telas/inicio.jpg)

## Funcionalidades

**Área do cliente**
- Página inicial com **carrossel 3D** (Three.js) de controles, teclados, headsets e mouses, que gira conforme a página é rolada.
- Quatro vitrines montadas a partir dos bancos:
  - **Mais vendidos:** ranking guardado em um ZSET do Redis.
  - **Recomendados para você:** usa o histórico de busca do visitante.
  - **Ofertas imperdíveis:** produtos com o campo livre `desconto` no MongoDB.
  - **Novidades:** produtos cadastrados mais recentemente, ordenados pelo `_id` do MongoDB.
- **Catálogo completo** ordenado por mais recentes, menor preço, maior preço ou nome.
- **Busca** com painel de pesquisas recentes e botão para limpar o histórico.
- **Página do produto** com ficha técnica, preço com desconto, número de visualizações e de pedidos.
- **Carrinho** com aumentar, diminuir e remover itens, além do total atualizado sem recarregar a página.
- **Compra pelo WhatsApp:** o pedido vira uma mensagem pronta, por exemplo:
  `Olá, gostaria de pedir: 2x Mouse RGB Raptor 12K, 1x Cadeira Gamer Throne. Total: R$ 1599,70`
- Layout adaptado ao celular, com barra de navegação fixa embaixo.

**Painel do administrador**
- Login conferido no Supabase com `check_password_hash` (a senha nunca fica salva em texto).
- Resumo com o total de produtos no MongoDB, o preço médio e quantos campos personalizados existem.
- Cadastro de produto com foto (enviada ao Supabase Storage), **campos livres** criados na hora (atalhos como `+ desconto`, `+ conexão` ou um campo em branco) e **prévia ao vivo** do card.
- Exclusão de produto, que também remove a foto, o ranking e o contador de visitas dele.

## Arquitetura

```
Navegador ──► Flask (Python) ── app.py
                 │
                 ├─ MongoDB ─── coleção Produtos (documentos com atributos livres)
                 ├─ Supabase ── tabela usuarios (admin) + bucket de fotos "produtos"
                 └─ Redis ───── cache, carrinho, buscas, ranking e visitas
```

| Arquivo | Função |
|---|---|
| [`banco.py`](LojaVirtualdeProdutos/src/lojavirtualdeprodutos/banco.py) | Conexões com os três bancos e todas as operações (CRUD de produtos, login, carrinho, buscas) |
| [`app.py`](LojaVirtualdeProdutos/src/lojavirtualdeprodutos/app.py) | Rotas do site, vitrines, ranking, contador de visitas, upload de fotos e painel do admin |
| `templates/` | Páginas HTML (Jinja2): início, catálogo, produto, carrinho, login, painel e cadastro |
| `static/` | CSS, JavaScript (animações e cena 3D), modelos `.glb` e fotos dos produtos de exemplo |
| `index.py` | Ponto de entrada usado pela Vercel |

**Caminho até o código dos bancos:** `LojaVirtualdeProdutos → src → lojavirtualdeprodutos → banco.py`

### MongoDB — documento de um produto

Banco `Respawn`, coleção `Produtos`. A ficha técnica fica no objeto `atributos`, e cada produto guarda só os campos que fazem sentido para ele: um teclado tem *switch* e *keycaps*, uma cadeira tem *reclinação* e *peso suportado*. Não precisa mudar nenhum esquema para isso.

```json
{
  "_id": { "$oid": "6af70c3dc661b03481e066be" },
  "nome": "Teclado Mecânico Vector 75%",
  "descricao": "Compacto, sem perder as setas e a fileira de funções. Switches táteis, keycaps PBT e conexão com ou sem fio.",
  "preco": 389.9,
  "imagem": "/static/uploads/prod_teclado_laranja.jpg",
  "loja": "Respawn Store",
  "atributos": {
    "layout": "75% (84 teclas)",
    "switch": "brown tátil",
    "conexão": "USB-C · Bluetooth · 2,4 GHz",
    "keycaps": "PBT",
    "iluminação": "branca",
    "desconto": "15"
  }
}
```

Operações usadas: `insert_one`, `find`, `find_one`, `update_one` e `delete_one`.

### Supabase — PostgreSQL e Storage

| Objeto | Uso |
|---|---|
| Tabela `usuarios` | `id`, `email`, `senha_hash`, `telefone`, `tipo`, `criado_em`. Só contas com `tipo = admin` entram no painel |
| Bucket `produtos` (Storage) | Fotos enviadas no cadastro. O MongoDB guarda apenas o link público da foto |

A senha é gravada com `generate_password_hash` (scrypt) e conferida com `check_password_hash`. A tabela tem **RLS ativado**, então só o servidor da loja, com a chave secreta, consegue ler os usuários.

### Redis — estruturas e chaves

| Chave | Tipo | Expira | Para que serve |
|---|---|---|---|
| `produtos` | STRING (JSON) | 60 s | Cache da lista de produtos: evita consultar o MongoDB a cada página. É apagado (`DEL`) ao cadastrar, editar ou excluir |
| `carrinho:{visitante}` | HASH | — | Produto → quantidade, com `HINCRBY`, `HDEL` e `HGETALL` |
| `buscas:{visitante}` | LIST | — | Últimas 10 pesquisas sem repetição, com `LREM`, `LPUSH` e `LTRIM`. Alimenta os recomendados |
| `mais_vendidos` | ZSET | — | `ZINCRBY` com a quantidade de cada compra; `ZREVRANGE` monta o ranking |
| `visualizacoes:{id}` | STRING | — | `INCR` a cada vez que a página do produto é aberta |

O `{visitante}` é um código aleatório guardado na sessão do navegador, então cada pessoa tem o próprio carrinho e o próprio histórico, sem precisar de cadastro.

## Como rodar localmente

**1. Instale as dependências** (Python 3.11 ou mais novo):

```bash
cd LojaVirtualdeProdutos
python -m venv .venv
.venv\Scripts\activate          # Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
```

**2. Prepare os bancos** (todos têm plano gratuito):

- **MongoDB Atlas:** crie um cluster M0, um usuário em *Database Access* e libere seu IP em *Network Access*. Copie a URI de conexão.
- **Supabase:** crie um projeto, a tabela `usuarios` com as colunas acima (`tipo` com valor padrão `admin` e RLS ativado) e um bucket **público** chamado `produtos` em *Storage*. Copie a URL do projeto e a chave secreta.
- **Redis Cloud:** crie um banco gratuito e copie o host, a porta e a senha.

**3. Crie o arquivo `.env`** na pasta `LojaVirtualdeProdutos`:

```
SUPABASE_URL=
SUPABASE_KEY=
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=
MONGO_URI=
FLASK_SECRET_KEY=
```

**4. Crie o administrador** no console do Python, dentro de `src/lojavirtualdeprodutos`:

```python
from banco import criar_usuario
criar_usuario("seu-email@exemplo.com", "sua-senha")
```

**5. Rode o site:**

```bash
cd src/lojavirtualdeprodutos
python app.py
```

Abra **http://127.0.0.1:5000**. O painel fica em **/admin** (ou no ícone de pessoa no topo).

## Publicação na Vercel

O `index.py` carrega o Flask como função Python, e o `.vercelignore` deixa de fora `.env`, `.venv` e `.idea`. As variáveis do `.env` ficam em *Settings → Environment Variables* do projeto na Vercel.

```bash
vercel deploy --prod
```

Dois cuidados:
- A Vercel não guarda arquivos enviados, por isso as fotos novas vão para o **Supabase Storage**.
- O *Network Access* do MongoDB Atlas precisa liberar `0.0.0.0/0`, porque a Vercel não tem IP fixo.

## Telas

| Vitrines | Página do produto |
|---|---|
| ![Mais vendidos](docs/telas/vitrines.jpg) | ![Produto](docs/telas/produto.jpg) |

| Catálogo | Celular |
|---|---|
| ![Catálogo](docs/telas/catalogo.jpg) | <img src="docs/telas/celular.jpg" alt="Versão para celular" width="260"> |

As fotos dos produtos de exemplo são do Unsplash (licença gratuita). Os modelos 3D do carrossel ficam em `static/modelos`.

## Tecnologias

**Back-end:** Python, Flask, PyMongo, redis-py, supabase-py, Werkzeug e python-dotenv
**Front-end:** Jinja2, CSS, htmx, Alpine.js, GSAP, Lenis, Three.js e ícones Lucide
**Infraestrutura:** MongoDB Atlas, Supabase, Redis Cloud e Vercel

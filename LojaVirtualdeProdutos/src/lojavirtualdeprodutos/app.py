import json
import os
import random
import uuid
from functools import wraps

from bson.errors import InvalidId
from flask import Flask, abort, flash, make_response, redirect, render_template, request, session

from banco import (adicionar_ao_carrinho, apagar_produto, buscar_produto, criar_produto, esvaziar_carrinho,
                   limpar_buscas, link_whatsapp, listar_produto, login, pesquisar, r, remover_do_carrinho,
                   supabase, ultimas_buscas, ver_carrinho)

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "respawn-troque-este-texto")
BALDE_FOTOS = "produtos"   # bucket público do Supabase Storage (a Vercel não guarda arquivos enviados)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024


# ---------------------------------------------------------------------------------------------
# Funções de apoio
def visitante():
    """Identificador do visitante, usado no carrinho e no histórico de pesquisa (Redis)."""
    if "sid" not in session:
        session["sid"] = uuid.uuid4().hex
    return session["sid"]


def produto_ou_404(id):
    try:
        produto = buscar_produto(id)
    except InvalidId:
        produto = None
    if not produto:
        abort(404)
    return produto


def qtd_no_carrinho():
    return sum(int(q) for q in r.hvals(f"carrinho:{visitante()}"))


def veio_do_htmx():
    return request.headers.get("HX-Request") == "true"


def aviso_carrinho(resposta, nome=None):
    """Avisa a página (pelo htmx) que o carrinho mudou, para atualizar o contador."""
    resposta.headers["HX-Trigger"] = json.dumps({"carrinho": {"qtd": qtd_no_carrinho(), "nome": nome}})
    return resposta


def somente_admin(view):
    @wraps(view)
    def protegida(*args, **kwargs):
        if not session.get("admin"):
            return redirect(f"/login?proximo={request.path}")
        return view(*args, **kwargs)
    return protegida


def salvar_foto(arquivo):
    extensao = arquivo.filename.rsplit(".", 1)[-1].lower()
    if extensao not in ("png", "jpg", "jpeg", "webp"):
        return None

    tipo = "image/jpeg" if extensao in ("jpg", "jpeg") else f"image/{extensao}"
    nome = f"{uuid.uuid4().hex}.{extensao}"
    fotos = supabase.storage.from_(BALDE_FOTOS)
    fotos.upload(nome, arquivo.read(), {"content-type": tipo})
    return fotos.get_public_url(nome)


@app.template_filter("reais")
def reais(valor):
    texto = f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {texto}"


@app.template_filter("desconto")
def filtro_desconto(produto):
    return desconto_de(produto)


@app.template_filter("preco_antigo")
def preco_antigo(produto):
    """Preço antes do desconto: o preço cadastrado é o preço com desconto."""
    d = desconto_de(produto)
    return produto["preco"] / (1 - d / 100) if d else produto["preco"]


@app.template_filter("visiveis")
def caracteristicas_visiveis(atributos):
    """Características para mostrar ao cliente (o campo "desconto" vira selo e preço riscado)."""
    return {campo: valor for campo, valor in (atributos or {}).items() if campo.strip().lower() != "desconto"}


@app.context_processor
def dados_de_todas_as_telas():
    return {
        "qtd_carrinho": qtd_no_carrinho(),
        "buscas_recentes": ultimas_buscas(visitante()),
        "admin": session.get("admin"),
    }


# ---------------------------------------------------------------------------------------------
# Cliente: catálogo, produto e pesquisa
def modelos_3d():
    """Quais modelos .glb existem em static/modelos (controle, teclado, fone, mouse)."""
    pasta = os.path.join(app.static_folder, "modelos")
    if not os.path.isdir(pasta):
        return []
    return [arquivo[:-4] for arquivo in os.listdir(pasta) if arquivo.lower().endswith(".glb")]


def mais_vendidos(limite=8):
    """Ranking guardado no Redis (sorted set "mais_vendidos": produto -> unidades pedidas)."""
    lista = []
    for id, quantidade in r.zrevrange("mais_vendidos", 0, limite - 1, withscores=True):
        try:
            produto = buscar_produto(id)
        except InvalidId:
            produto = None
        if produto:
            produto["vendidos"] = int(quantidade)
            produto["posicao"] = len(lista) + 1
            lista.append(produto)
    return lista


def desconto_de(produto):
    """Desconto em % guardado no campo livre "desconto" do produto (ex.: "20" ou "20%"). 0 = sem desconto."""
    for campo, valor in (produto.get("atributos") or {}).items():
        if campo.strip().lower() == "desconto":
            try:
                return max(0, min(90, int(float(str(valor).replace("%", "").replace(",", ".").strip()))))
            except ValueError:
                return 0
    return 0


def recomendados(produtos, limite=4):
    """Usa o histórico de pesquisa do visitante (Redis) para sugerir produtos ligados ao que ele buscou."""
    termos = [t.lower() for t in ultimas_buscas(visitante())]

    def pontos(p):
        texto = " ".join([p["nome"], p.get("descricao", "")] + [str(v) for v in (p.get("atributos") or {}).values()]).lower()
        return sum(1 for termo in termos if termo in texto)

    com_pontos = sorted((p for p in produtos if pontos(p) > 0), key=pontos, reverse=True)
    escolhidos = com_pontos[:limite]
    if len(escolhidos) < limite:   # completa com outros produtos, em ordem aleatória
        restantes = [p for p in produtos if p not in escolhidos]
        escolhidos += random.sample(restantes, min(limite - len(escolhidos), len(restantes)))
    return escolhidos, termos[:3] if com_pontos else []


def prateleiras_da_inicial(produtos):
    """As 4 vitrines da página inicial, na ordem em que aparecem."""
    sugestao, termos = recomendados(produtos)
    ofertas = sorted((p for p in produtos if desconto_de(p) > 0), key=desconto_de, reverse=True)[:4]
    novidades = sorted(produtos, key=lambda p: p["_id"], reverse=True)[:4]   # _id do MongoDB cresce com a data
    return [
        dict(id="mais-vendidos", icone="flame", rotulo="Ranking da loja", titulo="Mais vendidos",
             subtitulo="Os produtos com mais pedidos enviados pelo WhatsApp.",
             produtos=mais_vendidos(4), vazio="Ainda não há vendas. Os mais pedidos aparecem aqui."),
        dict(id="recomendados", icone="sparkles", rotulo="Para você", titulo="Recomendados para você",
             subtitulo=("Com base nas suas pesquisas: " + ", ".join(termos) + ".") if termos
             else "Uma seleção para começar. Pesquise algo e as sugestões passam a seguir seu gosto.",
             produtos=sugestao, vazio="Nenhuma sugestão no momento."),
        dict(id="ofertas", icone="tag", rotulo="Descontos", titulo="Ofertas imperdíveis",
             subtitulo="Produtos com desconto especial por tempo limitado.",
             produtos=ofertas, vazio="Nenhuma oferta no momento. Volte em breve."),
        dict(id="novidades", icone="rocket", rotulo="Acabaram de chegar", titulo="Novidades e lançamentos",
             subtitulo="Os produtos cadastrados mais recentemente na loja.",
             produtos=novidades, selo="novo", vazio="Nenhum produto cadastrado ainda."),
    ]


@app.route("/")
def catalogo():
    produtos = listar_produto()
    return render_template("catalogo.html", produtos=produtos, termo=None, modelos=modelos_3d(),
                           prateleiras=prateleiras_da_inicial(produtos))


@app.route("/catalogo")
def pagina_catalogo():
    """Todos os produtos (a página inicial mostra só as vitrines)."""
    return render_template("catalogo.html", produtos=listar_produto(), termo=None, pagina_catalogo=True)


@app.route("/buscar")
def buscar():
    termo = request.args.get("q", "").strip()
    if not termo:
        return redirect("/")
    return render_template("catalogo.html", produtos=pesquisar(visitante(), termo), termo=termo)


@app.post("/buscas/limpar")
def limpar_historico():
    limpar_buscas(visitante())
    if veio_do_htmx():
        return render_template("_buscas.html", buscas_recentes=[])
    return redirect(request.referrer or "/")


@app.route("/produto/<id>")
def produto(id):
    p = produto_ou_404(id)
    relacionados = [outro for outro in listar_produto() if outro["_id"] != id][:4]
    # Redis: contador de visualizações da página e unidades já pedidas (ranking de mais vendidos)
    visualizacoes = r.incr(f"visualizacoes:{id}")
    pedidos = int(r.zscore("mais_vendidos", id) or 0)
    return render_template("produto.html", p=p, relacionados=relacionados,
                           visualizacoes=visualizacoes, pedidos=pedidos)


# ---------------------------------------------------------------------------------------------
# Cliente: carrinho e compra
@app.route("/carrinho")
def carrinho():
    itens, total = ver_carrinho(visitante())
    return render_template("carrinho.html", itens=itens, total=total)


@app.post("/carrinho/adicionar/<id>")
def carrinho_adicionar(id):
    p = produto_ou_404(id)
    adicionar_ao_carrinho(visitante(), id)
    if request.form.get("ir") == "carrinho":
        return redirect("/carrinho")
    if veio_do_htmx():
        return aviso_carrinho(make_response(""), p["nome"])
    flash(f"{p['nome']} foi para o carrinho.")
    return redirect(request.referrer or "/")


def tela_do_carrinho():
    """Depois de mudar o carrinho: devolve só o pedaço da tela (htmx) ou recarrega a página."""
    if not veio_do_htmx():
        return redirect("/carrinho")
    itens, total = ver_carrinho(visitante())
    return aviso_carrinho(make_response(render_template("_carrinho.html", itens=itens, total=total)))


@app.post("/carrinho/mais/<id>")
def carrinho_mais(id):
    adicionar_ao_carrinho(visitante(), id)
    return tela_do_carrinho()


@app.post("/carrinho/menos/<id>")
def carrinho_menos(id):
    if r.hincrby(f"carrinho:{visitante()}", id, -1) <= 0:
        remover_do_carrinho(visitante(), id)
    return tela_do_carrinho()


@app.post("/carrinho/remover/<id>")
def carrinho_remover(id):
    remover_do_carrinho(visitante(), id)
    return tela_do_carrinho()


@app.post("/comprar")
def comprar():
    link = link_whatsapp(visitante())
    if not link:
        flash("Seu carrinho está vazio.")
        return redirect("/carrinho")
    # cada pedido enviado soma as unidades no ranking de mais vendidos (Redis)
    for id, quantidade in r.hgetall(f"carrinho:{visitante()}").items():
        r.zincrby("mais_vendidos", int(quantidade), id)
    esvaziar_carrinho(visitante())
    return redirect(link)


# ---------------------------------------------------------------------------------------------
# Administrador: login, painel e produtos
@app.route("/login", methods=["GET", "POST"])
def tela_login():
    if request.method == "POST":
        usuario = login(request.form["senha"], request.form["email"].strip().lower())
        if usuario and usuario.get("tipo", "admin") == "admin":
            session["admin"] = usuario["email"]
            proximo = request.args.get("proximo", "/admin")
            return redirect(proximo if proximo.startswith("/") else "/admin")
        flash("E-mail ou senha inválidos.")
    return render_template("login.html")


@app.route("/sair")
def sair():
    session.pop("admin", None)
    return redirect("/")


@app.route("/admin")
@somente_admin
def painel():
    return render_template("admin.html", produtos=listar_produto())


@app.post("/admin/apagar/<id>")
@somente_admin
def apagar(id):
    p = produto_ou_404(id)
    apagar_produto(id)
    r.zrem("mais_vendidos", id)
    r.delete(f"visualizacoes:{id}")
    if f"/storage/v1/object/public/{BALDE_FOTOS}/" in p["imagem"]:
        supabase.storage.from_(BALDE_FOTOS).remove([p["imagem"].rsplit("/", 1)[-1].split("?")[0]])
    flash(f"{p['nome']} foi apagado.")
    return redirect("/admin")


@app.route("/admin/produto", methods=["GET", "POST"])
@somente_admin
def novo_produto():
    if request.method == "POST":
        foto = request.files.get("imagem")
        imagem = salvar_foto(foto) if foto and foto.filename else None

        campos = request.form.getlist("campo")
        valores = request.form.getlist("valor")
        atributos = {c.strip(): v.strip() for c, v in zip(campos, valores) if c.strip() and v.strip()}

        texto_preco = request.form["preco"].strip()
        if "," in texto_preco:  # formato brasileiro: 1.299,90
            texto_preco = texto_preco.replace(".", "").replace(",", ".")
        try:
            preco = float(texto_preco)
        except ValueError:
            flash("Preço inválido. Use o formato 199,90.")
            return redirect("/admin/produto")

        ok = criar_produto(
            request.form["nome"].strip(),
            request.form["descricao"].strip(),
            preco,
            imagem,
            "Respawn Store",
            atributos,
        )
        if ok:
            flash("Produto cadastrado.")
            return redirect("/admin")
        flash("Nome, descrição e foto (png, jpg ou webp) são obrigatórios.")
        return redirect("/admin/produto")

    return render_template("novo_produto.html")


@app.errorhandler(404)
def nao_encontrado(erro):
    return render_template("404.html"), 404


if __name__ == "__main__":
    app.run(debug=True)

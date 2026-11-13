import json
import os

from bson import ObjectId
from dotenv import load_dotenv
from supabase import create_client
from werkzeug.security import generate_password_hash, check_password_hash

from urllib.parse import quote

load_dotenv()

WHATSAPP = "5586994722728"

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

supabase = create_client(SUPABASE_URL,SUPABASE_KEY)

import redis

r = redis.Redis(
    host=os.environ["REDIS_HOST"],
    port=int(os.environ["REDIS_PORT"]),
    decode_responses=True,
    username="default",
    password=os.environ["REDIS_PASSWORD"],
)

success = r.set('foo', 'bar')
# True

result = r.get('foo')
print(result)
# >>> bar

from pymongo import MongoClient
uri = os.environ["MONGO_URI"]
client = MongoClient(uri)
try:
    client.admin.command("ping")
    print("Connected successfully")
    produtos = client["Respawn"]["Produtos"]
except Exception as e:
    raise Exception(
        "The following error occurred: ", e)

#----------------------------------------------------------------------------------------------------------------------------------
#Criação/Login de usuarios
def criar_usuario(email,senha):
    return supabase.table("usuarios").insert({"email": email, "senha_hash":
        generate_password_hash(senha)}).execute().data

def login(senha,email):
    resultado = supabase.table("usuarios").select("*").eq("email", email).execute().data
    if resultado and check_password_hash(resultado[0]["senha_hash"], senha):
        return resultado[0]
    return None

def listar_usuarios():
    return supabase.table("usuarios").select("id, email").execute().data

def apagar_usuarios(id):
    return supabase.table("usuarios").delete().eq("id", id).execute().data

#---------------------------------------------------------------------------------------------------------------------------
#Criação de Produtos
def criar_produto(nome,descricao,preco,imagem,loja,atributos):
    if not nome or not descricao or not imagem:
        return None

    produtos.insert_one({"nome": nome, "descricao": descricao, "preco": preco, "imagem": imagem, "loja": loja,
                         "atributos": atributos})
    r.delete("produtos")
    return True

def listar_produto():
    em_cache = r.get("produtos")
    if em_cache:
        return json.loads(em_cache)

    lista = list(produtos.find())
    for p in lista:
        p["_id"] = str(p["_id"])
    r.set("produtos", json.dumps(lista), ex=60)
    return lista

def buscar_produto(id):
    p = produtos.find_one({"_id": ObjectId(id)})
    if p:
        p["_id"] = str(p["_id"])
    return p

def atualizar_produto(id, nome, descricao, preco, atributos):
    produtos.update_one({"_id": ObjectId(id)}, {"$set": {"nome": nome, "descricao": descricao,
            "preco": preco, "atributos": atributos}})
    r.delete("produtos")

def apagar_produto(id):
    produtos.delete_one({"_id": ObjectId(id)})
    r.delete("produtos")

#----------------------------------------------------------------------------------------------
#Carrinho
def adicionar_ao_carrinho(usuario,  produto_id):
    r.hincrby(f"carrinho:{usuario}", produto_id, 1)

def remover_do_carrinho(usuario, produto_id):
    r.hdel(f"carrinho:{usuario}", produto_id)

def ver_carrinho(usuario):
    itens = []
    total = 0
    for produto_id, quantidade in r.hgetall(f"carrinho:{usuario}").items():
        p = buscar_produto(produto_id)
        if p:
            subtotal = p["preco"] * int(quantidade)
            total += subtotal
            itens.append({"produto": p, "quantidade": int(quantidade), "subtotal": subtotal})
    return itens, total

def esvaziar_carrinho(usuario):
    r.delete(f"carrinho:{usuario}")

#--------------------------------------------------------------------------------------------------------
#Whatsapp

def link_whatsapp(usuario):
    itens,total = ver_carrinho(usuario)
    if not itens:
        return None

    lista = ", ".join(f"{i['quantidade']}x {i['produto']['nome']}" for i in itens)
    valor = f"{total:.2f}".replace(".", ",")
    texto = f"Olá, gostaria de pedir: {lista}. Total: R$ {valor}"
    return f"https://wa.me/{WHATSAPP}?text={quote(texto)}"


#-----------------------------------------------------------------------------------------------------------
#Histórico de Pesquisa
def pesquisar(usuario, termo):
    r.lrem(f"buscas:{usuario}", 0, termo)
    r.lpush(f"buscas:{usuario}", termo)
    r.ltrim(f"buscas:{usuario}", 0, 9)
    return [p for p in listar_produto() if termo.lower() in p["nome"].lower()]

def ultimas_buscas(usuario):
    return r.lrange(f"buscas:{usuario}", 0, 9)

def limpar_buscas(usuario):
    r.delete(f"buscas:{usuario}")


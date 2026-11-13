/* =========================================================================================
   RESPAWN · interações do site
   Usa: GSAP (+ ScrollTrigger e Flip), Lenis, htmx, Alpine.js e Lucide (pasta static/vendor).
   ========================================================================================= */

const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const temMouse = window.matchMedia("(pointer: fine)").matches;
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/* ---------------------------------------------------------------- componentes do Alpine */
document.addEventListener("alpine:init", () => {
  // Formulário de cadastro de produto, com campos livres e prévia ao vivo
  Alpine.data("formProduto", () => ({
    nome: "",
    preco: "",
    foto: null,
    arrastando: false,
    campos: [],
    sugestoes: ["desconto", "cor", "tamanho", "conexão", "dpi", "switch", "layout", "analógico", "compatibilidade", "garantia"],

    adicionar(nome = "") {
      this.campos.push({ id: Date.now() + Math.random(), campo: nome, valor: "" });
      this.$nextTick(() => {
        desenharIcones();
        const linhas = this.$root.querySelectorAll(".linha-campo");
        const ultima = linhas[linhas.length - 1];
        if (!ultima) return;
        if (!reduzido) gsap.from(ultima, { opacity: 0, y: -12, duration: 0.35, ease: "power2.out" });
        ultima.querySelectorAll("input")[nome ? 1 : 0].focus();
      });
    },
    remover(indice) {
      this.campos.splice(indice, 1);
    },
    escolherFoto(evento) {
      const arquivo = evento.target.files[0];
      this.arrastando = false;
      if (!arquivo) return;
      const leitor = new FileReader();
      leitor.onload = (e) => (this.foto = e.target.result);
      leitor.readAsDataURL(arquivo);
    },
    get precoNaPrevia() {
      let texto = String(this.preco).trim();
      if (texto.includes(",")) texto = texto.replace(/\./g, "").replace(",", ".");
      const numero = parseFloat(texto);
      return isNaN(numero) ? "R$ 0,00" : moeda.format(numero);
    },
    get camposPreenchidos() {
      return this.campos.filter((c) => c.campo.trim() && c.valor.trim());
    },
  }));
});

/* ---------------------------------------------------------------- títulos letra por letra */
/** Divide o texto de um título em letras (para animar uma a uma). Partes com estilo próprio,
    como o texto em gradiente, viram um bloco só. Devolve a lista de pedaços animáveis. */
function dividirLetras(el) {
  if (el.dataset.dividido) return [...el.querySelectorAll(".letra")];
  el.dataset.dividido = "1";
  el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
  const pedacos = [];
  [...el.childNodes].forEach((no) => {
    if (no.nodeType === Node.TEXT_NODE) {
      const fragmento = document.createDocumentFragment();
      no.textContent.split(/(\s+)/).forEach((parte) => {
        if (!parte) return;
        if (/^\s+$/.test(parte)) { fragmento.append(" "); return; }
        const palavra = document.createElement("span");
        palavra.className = "palavra";
        [...parte].forEach((letra) => {
          const s = document.createElement("span");
          s.className = "letra";
          s.textContent = letra;
          palavra.append(s);
          pedacos.push(s);
        });
        fragmento.append(palavra);
      });
      no.replaceWith(fragmento);
    } else if (no.nodeType === Node.ELEMENT_NODE && no.tagName !== "BR") {
      no.classList.add("letra");
      pedacos.push(no);
    }
  });
  el.querySelectorAll(".palavra, .letra").forEach((s) => s.setAttribute("aria-hidden", "true"));
  return pedacos;
}

function titulosAnimados() {
  if (reduzido) return;
  document.querySelectorAll("[data-letras]").forEach((titulo) => {
    const pedacos = dividirLetras(titulo);
    gsap.fromTo(pedacos, { yPercent: 110, opacity: 0, filter: "blur(12px)" }, {
      yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 0.9, stagger: 0.025, ease: "power3.out",
      scrollTrigger: { trigger: titulo, start: "top 88%" },
    });
  });
}

/* ---------------------------------------------------------------- clique no card: afunda e abre o produto */
function abrirProdutoComTransicao() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest(".cartao-link");
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const cartao = link.closest(".cartao");
    // dá o nome da transição só à foto clicada, para ela "virar" a foto grande da página do produto
    document.querySelectorAll(".cartao-foto img, .cartao-nome").forEach((el) => (el.style.viewTransitionName = ""));
    cartao.querySelector(".cartao-foto img").style.viewTransitionName = "foto-produto";
    cartao.querySelector(".cartao-nome").style.viewTransitionName = "nome-produto";
    cartao.classList.add("abrindo");
    setTimeout(() => (window.location.href = link.href), reduzido ? 0 : 220);
  });
  // ao voltar para o catálogo pelo botão do navegador, desfaz o estado "abrindo"
  window.addEventListener("pageshow", () => document.querySelectorAll(".cartao.abrindo").forEach((c) => c.classList.remove("abrindo")));
}

/* ---------------------------------------------------------------- links internos (#catalogo) */
/** Rola suave até a seção e, se o botão pedir (data-abrir-aba), já abre a aba do catálogo. */
function linksInternos() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || link.getAttribute("href") === "#") return;
    const alvo = document.querySelector(link.getAttribute("href"));
    if (!alvo) return;
    e.preventDefault();
    if (link.dataset.abrirAba) window.dispatchEvent(new CustomEvent("abrir-aba", { detail: link.dataset.abrirAba }));
    window.lenis ? lenis.scrollTo(alvo, { offset: -20, duration: 1.4 }) : alvo.scrollIntoView({ behavior: "smooth" });
  });
}

/* ---------------------------------------------------------------- troca de aba do catálogo */
/** Mostra com animação os cards da aba que acabou de abrir (os de abas escondidas não animam na rolagem). */
function mostrarAba() {
  const escondidos = [...document.querySelectorAll("#catalogo .revelar")].filter(
    (el) => el.offsetParent !== null && getComputedStyle(el).opacity === "0"
  );
  gsap.to(escondidos, { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: "power3.out", overwrite: true, onComplete: () => liberarEstilo(escondidos) });
  ScrollTrigger.refresh();
}

/** Depois da animação de entrada, tira o estilo que o GSAP deixou no elemento, para o CSS
    (como a elevação do card ao passar o mouse) voltar a funcionar. */
function liberarEstilo(elementos) {
  elementos.forEach((el) => {
    el.classList.remove("revelar");
    gsap.set(el, { clearProps: "all" });
  });
}

/* ---------------------------------------------------------------- ícones (Lucide) */
function desenharIcones() {
  if (window.lucide) lucide.createIcons({ attrs: { class: "icone" } });
}

/* ---------------------------------------------------------------- avisos no canto da tela */
function aviso(mensagem, icone = "check-circle-2") {
  const caixa = document.querySelector(".avisos");
  const el = document.createElement("div");
  el.className = "aviso";
  el.innerHTML = `<i data-lucide="${icone}"></i><span></span>`;
  el.querySelector("span").textContent = mensagem;
  caixa.appendChild(el);
  desenharIcones();
  gsap.fromTo(el, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: "back.out(1.6)" });
  gsap.to(el, { x: 60, opacity: 0, duration: 0.35, delay: 3.2, ease: "power2.in", onComplete: () => el.remove() });
}

/* ---------------------------------------------------------------- produto voando até o carrinho */
function voarParaCarrinho(origem) {
  const foto = origem.closest(".cartao, .produto")?.querySelector("img");
  const alvo = document.querySelector("[data-carrinho]");
  if (!foto || !alvo || reduzido) return;

  const de = foto.getBoundingClientRect();
  const para = alvo.getBoundingClientRect();
  const clone = foto.cloneNode();
  Object.assign(clone.style, {
    position: "fixed", left: `${de.left}px`, top: `${de.top}px`, width: `${de.width}px`, height: `${de.height}px`,
    objectFit: "cover", borderRadius: "16px", zIndex: 400, pointerEvents: "none",
    boxShadow: "0 0 40px rgba(57,255,136,.6)",
  });
  document.body.appendChild(clone);

  const tl = gsap.timeline({ onComplete: () => clone.remove() });
  tl.to(clone, { scale: 0.85, duration: 0.18, ease: "power2.out" })
    .to(clone, {
      left: para.left + para.width / 2 - 22, width: 44, height: 44, borderRadius: "50%", scale: 1,
      duration: 0.75, ease: "power2.inOut",
    }, ">")
    .to(clone, { top: para.top + para.height / 2 - 22, duration: 0.75, ease: "back.in(1.4)" }, "<")
    .to(clone, { opacity: 0, duration: 0.15 }, ">-0.1");
}

/* ---------------------------------------------------------------- números que contam até o valor */
const ultimosValores = new Map();
function contarValores(raiz = document) {
  raiz.querySelectorAll("[data-valor]").forEach((el) => {
    const final = parseFloat(el.dataset.valor);
    const chave = el.dataset.chave || "";
    const inicio = ultimosValores.get(chave) ?? 0;
    ultimosValores.set(chave, final);
    if (reduzido) { el.textContent = moeda.format(final); return; }
    const contador = { v: inicio };
    gsap.to(contador, {
      v: final, duration: 0.9, ease: "power2.out",
      onUpdate: () => (el.textContent = moeda.format(contador.v)),
    });
  });
}

/* ---------------------------------------------------------------- inclinação 3D dos cards */
function inclinarCartoes(raiz = document) {
  raiz.querySelectorAll("[data-tilt]").forEach((el) => {
    if (el.dataset.tiltPronto) return;
    el.dataset.tiltPronto = "1";
    if (!temMouse || reduzido) return;

    gsap.set(el, { transformPerspective: 900 });
    const giroX = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3" });
    const giroY = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3" });
    const altura = gsap.quickTo(el, "z", { duration: 0.5, ease: "power3" });

    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      giroY((x - 0.5) * 16);
      giroX((0.5 - y) * 16);
      altura(30);
      el.style.setProperty("--mx", `${x * 100}%`);
      el.style.setProperty("--my", `${y * 100}%`);
    });
    el.addEventListener("pointerleave", () => { giroX(0); giroY(0); altura(0); });
  });
}

/* ---------------------------------------------------------------- botões magnéticos */
function botoesMagneticos(raiz = document) {
  return; // desligado a pedido: os botões não se mexem mais seguindo o mouse
  if (!temMouse || reduzido) return;
  raiz.querySelectorAll("[data-magnetico]").forEach((el) => {
    if (el.dataset.magPronto) return;
    el.dataset.magPronto = "1";
    const x = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
    const y = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.35);
      y((e.clientY - r.top - r.height / 2) * 0.45);
    });
    el.addEventListener("pointerleave", () => { x(0); y(0); });
  });
}

/* ---------------------------------------------------------------- cursor personalizado */
function cursor() {
  if (!temMouse || reduzido) return;
  const anel = document.querySelector(".cursor-anel");
  const ponto = document.querySelector(".cursor-ponto");
  const anelX = gsap.quickTo(anel, "x", { duration: 0.45, ease: "power3" });
  const anelY = gsap.quickTo(anel, "y", { duration: 0.45, ease: "power3" });
  const pontoX = gsap.quickTo(ponto, "x", { duration: 0.08 });
  const pontoY = gsap.quickTo(ponto, "y", { duration: 0.08 });

  window.addEventListener("pointermove", (e) => {
    document.body.classList.add("com-cursor");
    anelX(e.clientX); anelY(e.clientY); pontoX(e.clientX); pontoY(e.clientY);
  });
  document.addEventListener("pointerleave", () => document.body.classList.remove("com-cursor"));
  document.addEventListener("pointerover", (e) => {
    const sobre = e.target.closest("a, button, select, label, input[type=file], [data-tilt]");
    document.body.classList.toggle("cursor-sobre", !!sobre);
  });
}

/* ---------------------------------------------------------------- rolagem suave e animações de rolagem */
function rolagem() {
  gsap.registerPlugin(ScrollTrigger, Flip);

  if (!reduzido && window.Lenis) {
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
    window.lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const topo = document.querySelector(".topo");
  ScrollTrigger.create({ start: 40, end: "max", onToggle: (s) => topo.classList.toggle("rolou", s.isActive) });

  if (reduzido) { document.body.classList.add("sem-animacao"); return; }
  ScrollTrigger.batch(".revelar", {
    start: "top 90%",
    onEnter: (lote) => gsap.to(lote, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: "power3.out", overwrite: true, onComplete: () => liberarEstilo(lote) }),
  });
}

/* ---------------------------------------------------------------- ordenar o catálogo (com animação Flip) */
function ordenarCatalogo() {
  const seletor = document.querySelector("[data-ordenar]");
  const grade = document.querySelector("[data-grade]");
  if (!seletor || !grade) return;
  const original = [...grade.children];

  seletor.addEventListener("change", () => {
    const estado = Flip.getState(grade.children);
    const lista = [...original];
    const preco = (el) => parseFloat(el.dataset.preco);
    if (seletor.value === "menor") lista.sort((a, b) => preco(a) - preco(b));
    if (seletor.value === "maior") lista.sort((a, b) => preco(b) - preco(a));
    if (seletor.value === "nome") lista.sort((a, b) => a.dataset.nome.localeCompare(b.dataset.nome, "pt-BR"));
    lista.forEach((el) => grade.appendChild(el));
    Flip.from(estado, { duration: reduzido ? 0 : 0.7, ease: "power3.inOut", stagger: 0.02 });
  });
}

/* ---------------------------------------------------------------- lupa na foto do produto */
function lupa() {
  document.querySelectorAll(".produto-foto").forEach((caixa) => {
    const img = caixa.querySelector("img");
    caixa.addEventListener("pointermove", (e) => {
      const r = caixa.getBoundingClientRect();
      img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    });
  });
}

/* ---------------------------------------------------------------- htmx: carrinho sem recarregar a página */
function carrinhoAoVivo() {
  document.body.addEventListener("carrinho", (e) => {
    const { qtd, nome } = e.detail;
    document.querySelectorAll("[data-contador]").forEach((c) => {
      c.textContent = qtd;
      c.dataset.qtd = qtd;
      c.classList.remove("pulo");
      void c.offsetWidth;
      c.classList.add("pulo");
    });
    if (nome) {
      voarParaCarrinho(e.target);
      aviso(`${nome} foi para o carrinho`, "shopping-cart");
    }
  });

  document.body.addEventListener("htmx:afterSettle", (e) => {
    desenharIcones();
    contarValores(e.target);
    botoesMagneticos(e.target);
  });
  document.body.addEventListener("htmx:responseError", () => aviso("Algo deu errado. Tente de novo.", "alert-triangle"));
}

/* ---------------------------------------------------------------- mensagens enviadas pelo Flask */
function mensagensDoServidor() {
  const bloco = document.getElementById("mensagens");
  if (!bloco) return;
  JSON.parse(bloco.textContent).forEach((m, i) => setTimeout(() => aviso(m, "bell"), 300 + i * 250));
}

/* ---------------------------------------------------------------- início */
document.addEventListener("DOMContentLoaded", () => {
  desenharIcones();
  rolagem();
  cursor();
  inclinarCartoes();
  botoesMagneticos();
  ordenarCatalogo();
  lupa();
  carrinhoAoVivo();
  contarValores();
  mensagensDoServidor();
  titulosAnimados();
  abrirProdutoComTransicao();
  linksInternos();
});

// Enquanto a tela de carregamento aparece, a página fica travada no topo; quando o 3D fica
// pronto, a rolagem é liberada a partir do começo da vitrine.
if (document.querySelector("[data-carregando]")) {
  history.scrollRestoration = "manual";
  document.documentElement.classList.add("travado");
  const liberar = () => {
    if (!document.documentElement.classList.contains("travado")) return;
    document.documentElement.classList.remove("travado");
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
    else window.lenis ? lenis.scrollTo(0, { immediate: true, force: true }) : window.scrollTo(0, 0);
    window.lenis?.start();
  };
  document.addEventListener("DOMContentLoaded", () => window.lenis?.stop());
  document.addEventListener("respawn:pronto", liberar);
  // segurança: se algo travar o 3D, a tela some e a página é liberada mesmo assim
  window.addEventListener("load", () => setTimeout(() => {
    document.querySelector("[data-carregando]")?.remove();
    liberar();
  }, 9000));
}

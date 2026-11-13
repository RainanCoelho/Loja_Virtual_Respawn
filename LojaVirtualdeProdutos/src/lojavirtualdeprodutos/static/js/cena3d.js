/* =========================================================================================
   RESPAWN · vitrine 3D da página inicial
   Quatro objetos (controle, teclado, fone e mouse) lado a lado num carrossel circular.
   Conforme a página rola, o círculo gira e traz o próximo objeto para a frente, a mensagem dele
   aparece letra por letra e a cor do fundo muda. O mouse move a câmera de leve.

   MODELOS PRÓPRIOS: coloque arquivos .glb em static/modelos/ com estes nomes:
     controle.glb, teclado.glb, fone.glb, mouse.glb
   O que existir lá é carregado no lugar do modelo feito em código.
   ========================================================================================= */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const palco = document.querySelector("[data-palco]");
if (palco) iniciar();

function iniciar() {
  gsap.registerPlugin(ScrollTrigger); // este arquivo roda antes do respawn.js terminar de iniciar
  const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = palco.querySelector("canvas");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (erro) {
    document.body.classList.add("sem-3d");
    document.querySelector("[data-carregando]")?.remove();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const cena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.2, 7.4);

  // Luzes: uma branca principal e duas coloridas que dão o brilho neon nas bordas
  const sol = new THREE.DirectionalLight(0xffffff, 1.4);
  sol.position.set(2, 4, 5);
  const luzVerde = new THREE.PointLight(0x2f8cff, 26, 14);
  luzVerde.position.set(-3.2, 1.6, 2.2);
  const luzRoxa = new THREE.PointLight(0x1fd3f2, 22, 14);
  luzRoxa.position.set(3.2, -1.2, 1.8);
  cena.add(sol, luzVerde, luzRoxa);

  // ------------------------------------------------------------------ materiais
  const brilho = (cor, forca = 2.2) => new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: forca });
  const mat = {
    corpo: new THREE.MeshStandardMaterial({ color: 0x171b26, metalness: 0.6, roughness: 0.3 }),
    escuro: new THREE.MeshStandardMaterial({ color: 0x0b0d12, metalness: 0.3, roughness: 0.65 }),
    tecla: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.25, roughness: 0.45 }),
    botao: new THREE.MeshStandardMaterial({ color: 0x2a3142, metalness: 0.35, roughness: 0.4 }),
    neon: brilho(0x2f8cff),
    roxo: brilho(0x8b5cf6),
    ciano: brilho(0x22d3ee),
    rosa: brilho(0xff4d6d),
    amarelo: brilho(0xffd23f, 1.6),
  };
  const caixa = (l, a, p, raio = 0.04) => new RoundedBoxGeometry(l, a, p, 3, raio);

  /** Coloca uma peça no objeto e guarda para onde ela vai quando o objeto "explode". */
  function peca(grupo, obj, posicao, solta = [0, 0, 0], giro = [0, 0, 0], forcaGiro = 1.4) {
    obj.position.set(...posicao);
    obj.rotation.set(...giro);
    obj.userData.base = obj.position.clone();
    obj.userData.rotBase = obj.rotation.clone();
    obj.userData.solta = new THREE.Vector3(...solta);
    // peças grandes giram pouco ao se soltar; as pequenas giram mais
    obj.userData.giro = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(forcaGiro);
    grupo.add(obj);
    return obj;
  }
  const malha = (geo, material) => new THREE.Mesh(geo, material);

  // ------------------------------------------------------------------ CONTROLE
  function criarControle() {
    const g = new THREE.Group();
    const pecas = [];

    const corpo = new THREE.Group();
    corpo.add(malha(caixa(2.3, 1.05, 0.42, 0.2), mat.corpo));
    [-1, 1].forEach((lado) => {
      const pegada = malha(new THREE.CapsuleGeometry(0.34, 0.55, 8, 20), mat.corpo);
      pegada.position.set(0.82 * lado, -0.48, -0.03);
      pegada.rotation.z = 0.42 * lado;
      pegada.scale.z = 0.85;
      corpo.add(pegada);
    });
    pecas.push(peca(g, corpo, [0, 0.05, 0], [0, -0.15, -0.6], [0, 0, 0], 0.15));

    const analogico = () => {
      const a = new THREE.Group();
      const base = malha(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 32), mat.escuro);
      base.rotation.x = Math.PI / 2;
      const topo = malha(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 32), mat.corpo);
      topo.rotation.x = Math.PI / 2;
      topo.position.z = 0.11;
      const anel = malha(new THREE.TorusGeometry(0.2, 0.016, 8, 40), mat.neon);
      anel.position.z = 0.07;
      a.add(base, topo, anel);
      return a;
    };
    pecas.push(peca(g, analogico(), [-0.48, -0.15, 0.24], [-0.6, -0.4, 1.5]));
    pecas.push(peca(g, analogico(), [0.32, -0.35, 0.24], [0.5, -0.6, 1.4]));

    const cruz = new THREE.Group();
    cruz.add(malha(caixa(0.38, 0.12, 0.08, 0.03), mat.escuro), malha(caixa(0.12, 0.38, 0.08, 0.03), mat.escuro));
    pecas.push(peca(g, cruz, [-0.68, 0.22, 0.24], [-0.9, 0.5, 1.2]));

    [[0, 0.16, mat.neon], [0.16, 0, mat.rosa], [0, -0.16, mat.ciano], [-0.16, 0, mat.roxo]].forEach(([dx, dy, m]) => {
      const botao = malha(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 24), m);
      botao.rotation.x = Math.PI / 2;
      pecas.push(peca(g, botao, [0.68 + dx, 0.22 + dy, 0.24], [dx * 6 + 0.4, dy * 6 + 0.3, 1.3], [Math.PI / 2, 0, 0]));
    });

    [-1, 1].forEach((lado) => {
      pecas.push(peca(g, malha(caixa(0.58, 0.2, 0.3, 0.08), mat.corpo), [0.72 * lado, 0.66, -0.06], [0.5 * lado, 0.9, -0.3], [0, 0, -0.1 * lado]));
    });
    pecas.push(peca(g, malha(caixa(0.62, 0.36, 0.05, 0.02), mat.escuro), [0, 0.2, 0.22], [0, 0.35, 1.0]));
    pecas.push(peca(g, malha(caixa(0.72, 0.05, 0.06, 0.02), mat.neon), [0, 0.47, 0.18], [0, 0.75, 0.7]));

    g.rotation.x = 0.28;
    return { grupo: g, pecas, escala: 1, rotX: 0.28 };
  }

  // ------------------------------------------------------------------ TECLADO
  function criarTeclado() {
    const g = new THREE.Group();
    const pecas = [];

    pecas.push(peca(g, malha(caixa(3.1, 0.16, 1.18, 0.06), mat.corpo), [0, 0, 0], [0, -0.7, 0], [0, 0, 0], 0));
    pecas.push(peca(g, malha(caixa(3.14, 0.03, 1.22, 0.015), mat.neon), [0, -0.09, 0], [0, -1.05, 0], [0, 0, 0], 0));
    pecas.push(peca(g, malha(caixa(1.3, 0.1, 0.17, 0.03), mat.tecla), [0, 0.13, 0.39], [0, 1.25, 0.2], [0, 0, 0], 0.3));
    pecas.at(-1).material = new THREE.MeshStandardMaterial({ color: 0x22283a, metalness: 0.25, roughness: 0.45 });

    const posicoes = [];
    for (let linha = 0; linha < 5; linha++) {
      for (let coluna = 0; coluna < 15; coluna++) {
        if (linha === 4 && coluna > 3 && coluna < 11) continue;
        posicoes.push({ x: -1.365 + coluna * 0.195, z: -0.39 + linha * 0.195, linha, coluna });
      }
    }
    const teclas = new THREE.InstancedMesh(caixa(0.17, 0.1, 0.17, 0.035), mat.tecla, posicoes.length);
    const wasd = (p) => (p.linha === 1 && p.coluna === 2) || (p.linha === 2 && p.coluna >= 1 && p.coluna <= 3);
    posicoes.forEach((p, i) => teclas.setColorAt(i, new THREE.Color(wasd(p) ? 0x2f8cff : 0x22283a)));
    g.add(teclas);

    const auxiliar = new THREE.Object3D();
    let ultimo = -1;
    function atualizarTeclas(solto) {
      if (Math.abs(solto - ultimo) < 0.0005) return;
      ultimo = solto;
      posicoes.forEach((p, i) => {
        const onda = Math.sin(p.coluna * 0.55 + p.linha * 0.9) * 0.5 + 0.5;
        auxiliar.position.set(p.x, 0.13 + solto * (0.35 + 0.95 * onda), p.z);
        auxiliar.rotation.set(solto * (onda - 0.5) * 1.3, 0, solto * (0.5 - onda) * 0.9);
        auxiliar.updateMatrix();
        teclas.setMatrixAt(i, auxiliar.matrix);
      });
      teclas.instanceMatrix.needsUpdate = true;
    }
    atualizarTeclas(0);

    g.rotation.x = 0.6;
    return { grupo: g, pecas, escala: 0.78, rotX: 0.6, extra: atualizarTeclas };
  }

  // ------------------------------------------------------------------ FONE (HEADSET)
  function criarFone() {
    const g = new THREE.Group();
    const pecas = [];

    pecas.push(peca(g, malha(new THREE.TorusGeometry(1.0, 0.075, 16, 72, Math.PI), mat.corpo), [0, 0.05, 0], [0, 0.95, 0]));
    const almofada = malha(new THREE.TorusGeometry(0.93, 0.05, 12, 48, Math.PI * 0.6), mat.escuro);
    pecas.push(peca(g, almofada, [0, 0.05, 0], [0, 0.6, 0], [0, 0, Math.PI * 0.2]));

    [-1, 1].forEach((lado) => {
      const concha = new THREE.Group();
      const corpo = malha(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 40), mat.corpo);
      corpo.rotation.z = Math.PI / 2;
      const tampa = malha(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 40), mat.escuro);
      tampa.rotation.z = Math.PI / 2;
      tampa.position.x = 0.16 * lado;
      const anel = malha(new THREE.TorusGeometry(0.36, 0.022, 8, 48), lado < 0 ? mat.neon : mat.roxo);
      anel.rotation.y = Math.PI / 2;
      anel.position.x = 0.17 * lado;
      const espuma = malha(new THREE.TorusGeometry(0.33, 0.1, 12, 40), mat.escuro);
      espuma.rotation.y = Math.PI / 2;
      espuma.position.x = -0.17 * lado;
      concha.add(corpo, tampa, anel, espuma);
      pecas.push(peca(g, concha, [1.0 * lado, -0.12, 0], [0.95 * lado, -0.25, 0]));
    });

    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.05, -0.38, 0.22), new THREE.Vector3(-0.92, -0.72, 0.6), new THREE.Vector3(-0.5, -0.86, 0.86),
    ]);
    const microfone = new THREE.Group();
    microfone.add(malha(new THREE.TubeGeometry(curva, 32, 0.032, 10), mat.escuro));
    const ponta = malha(new THREE.SphereGeometry(0.07, 20, 16), mat.neon);
    ponta.position.copy(curva.getPoint(1));
    microfone.add(ponta);
    pecas.push(peca(g, microfone, [0, 0, 0], [-0.5, -0.7, 1.0]));

    return { grupo: g, pecas, escala: 1.05, rotX: 0.1, rotY: -0.55 };
  }

  // ------------------------------------------------------------------ MOUSE
  function criarMouse() {
    const g = new THREE.Group();
    const pecas = [];

    const corpo = malha(new THREE.SphereGeometry(1, 56, 36), mat.corpo);
    corpo.scale.set(0.62, 0.36, 1.0);
    pecas.push(peca(g, corpo, [0, 0, 0], [0, -0.55, 0]));

    [-1, 1].forEach((lado) => {
      pecas.push(peca(g, malha(caixa(0.5, 0.06, 0.66, 0.03), mat.escuro), [0.27 * lado, 0.31, -0.42], [0.55 * lado, 0.85, -0.3], [-0.32, 0, -0.12 * lado]));
    });
    const roda = malha(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 28), mat.neon);
    pecas.push(peca(g, roda, [0, 0.38, -0.42], [0, 1.35, -0.2], [0, 0, Math.PI / 2]));

    const faixa = malha(new THREE.TorusGeometry(1, 0.022, 8, 80), mat.roxo);
    faixa.scale.set(0.62, 1.0, 1);
    pecas.push(peca(g, faixa, [0, -0.04, 0], [0, -0.95, 0], [Math.PI / 2, 0, 0]));

    const logo = malha(new THREE.CircleGeometry(0.1, 32), mat.neon);
    pecas.push(peca(g, logo, [0, 0.335, 0.45], [0, 1.0, 0.55], [-Math.PI / 2 + 0.35, 0, 0]));

    const cabo = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.02, -0.98), new THREE.Vector3(0, -0.12, -1.5), new THREE.Vector3(0.35, -0.2, -2.1),
    ]);
    pecas.push(peca(g, malha(new THREE.TubeGeometry(cabo, 30, 0.03, 8), mat.escuro), [0, 0, 0], [0, 0, -0.7]));

    g.scale.setScalar(1.25);
    return { grupo: g, pecas, escala: 1.25, rotX: 0.4, rotY: 0.65 };
  }

  // Os quatro objetos ficam lado a lado num carrossel circular; a rolagem gira o círculo
  // e traz o próximo objeto para a frente.
  const carrossel = new THREE.Group();
  carrossel.userData.indice = 0;   // 0 = controle na frente, 1 = teclado, ... (valor quebrado = girando)
  cena.add(carrossel);

  const nomes = ["controle", "teclado", "fone", "mouse"];
  const objetos = [criarControle(), criarTeclado(), criarFone(), criarMouse()];
  objetos.forEach((o, i) => {
    o.nome = nomes[i];
    o.rotY = o.rotY ?? 0;
    carrossel.add(o.grupo);
  });

  // ------------------------------------------------------------------ modelos .glb enviados (opcional)
  /** Prepara um modelo carregado: centraliza, ajusta o tamanho e transforma cada malha em peça. */
  /** Para modelos que perderam a textura preta na conversão (ficam brancos): deixa as partes claras
      em preto fosco e as partes que brilham em ciano. Partes com textura própria não mudam. */
  function escurecerPartesClaras(malhas) {
    const vistos = new Set();
    malhas.forEach((m) => [].concat(m.material).forEach((material) => {
      if (!material || vistos.has(material) || material.map) return;
      vistos.add(material);
      // só conta como luz o que brilha com cor (ciano, verde...); brilho cinza é só a capa clara
      const tom = material.emissive ? material.emissive.getHSL({}) : { s: 0, l: 0 };
      const brilha = tom.l > 0.15 && tom.s > 0.4;
      if (!brilha && material.emissive) material.emissive.set(0x000000);
      if (brilha) {
        // peças grandes (como os botões) ficam pretas com só um reflexo ciano
        material.color.set(0x14171e);
        material.emissive.set(0x22d3ee);
        material.emissiveIntensity = 0.12;
        material.metalness = 0.3;
        material.roughness = 0.35;
      } else if (material.color.getHSL({}).l > 0.35) {
        material.color.set(0x14171e);
        material.metalness = 0.25;
        material.roughness = 0.45;
      }
    }));
  }

  function prepararModelo(gltf, nome) {
    const modelo = gltf.scene;
    const caixaModelo = new THREE.Box3().setFromObject(modelo);
    const tamanho = caixaModelo.getSize(new THREE.Vector3());
    const centro = caixaModelo.getCenter(new THREE.Vector3());
    const ajuste = 2.5 / Math.max(tamanho.x, tamanho.y, tamanho.z);

    const raiz = new THREE.Group();
    modelo.position.sub(centro);
    const envelope = new THREE.Group();
    envelope.scale.setScalar(ajuste);
    envelope.add(modelo);
    raiz.add(envelope);
    raiz.updateMatrixWorld(true);

    const malhas = [];
    modelo.traverse((filho) => { if (filho.isMesh) malhas.push(filho); });

    if (nome === "mouse") escurecerPartesClaras(malhas);

    // Modelo sem materiais (fica cinza): pinta com as cores da Respawn.
    // A maior peça vira o corpo; logotipo/luzes viram neon; o resto, grafite.
    if (!gltf.parser.json.materials?.length) {
      const volume = (m) => { const s = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()); return s.x * s.y * s.z; };
      const maior = malhas.reduce((a, b) => (volume(b) > volume(a) ? b : a), malhas[0]);
      malhas.forEach((m) => {
        if (m === maior) m.material = mat.corpo;
        else if (/logo|light|led|luz/i.test(m.name)) m.material = mat.neon;
        else m.material = mat.botao;
      });
    }
    const pecas = malhas.map((malhaModelo) => {
      raiz.attach(malhaModelo);   // mantém a posição na tela, mas agora relativa ao grupo
      const centroPeca = new THREE.Box3().setFromObject(malhaModelo).getCenter(new THREE.Vector3());
      const direcao = centroPeca.lengthSq() < 1e-4 ? new THREE.Vector3(0, 0, 1) : centroPeca.clone().normalize();
      const distancia = 0.7 + centroPeca.length() * 0.9;
      const p = malhaModelo;
      p.userData.base = p.position.clone();
      p.userData.rotBase = p.rotation.clone();
      p.userData.solta = direcao.multiplyScalar(distancia);
      p.userData.giro = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.8);
      return p;
    });
    raiz.remove(envelope);
    return { grupo: raiz, pecas };
  }

  const modelosDisponiveis = JSON.parse(palco.dataset.modelos || "[]");
  const gerente = new THREE.LoadingManager();
  const leitor = new GLTFLoader(gerente);
  leitor.setMeshoptDecoder(MeshoptDecoder);

  objetos.forEach((o) => {
    if (!modelosDisponiveis.includes(o.nome)) return;
    leitor.load(`/static/modelos/${o.nome}.glb`, (gltf) => {
      const pronto = prepararModelo(gltf, o.nome);
      carrossel.remove(o.grupo);
      o.grupo = pronto.grupo;
      o.pecas = pronto.pecas;
      o.extra = null;
      // tamanho de cada modelo no carrossel (a inclinação rotX/rotY continua a do objeto original)
      o.escala = { teclado: 1.15, fone: 0.78, mouse: 0.95 }[o.nome] ?? 1;
      carrossel.add(o.grupo);
    }, undefined, () => console.warn(`Não foi possível ler static/modelos/${o.nome}.glb`));
  });

  // ------------------------------------------------------------------ tela de carregamento + entrada
  const telaCarregando = document.querySelector("[data-carregando]");
  const contadorCarregando = telaCarregando?.querySelector("[data-porcentagem]");
  const barraCarregando = telaCarregando?.querySelector("[data-barra]");
  const progresso = { valor: 0, alvo: 0 };
  const intro = { distancia: reduzido ? 0 : 4.5, giro: reduzido ? 0 : -1.4 };

  function mostrarProgresso() {
    if (!contadorCarregando) return;
    contadorCarregando.textContent = `${Math.round(progresso.valor)}%`;
    barraCarregando.style.transform = `scaleX(${progresso.valor / 100})`;
  }
  function seguirProgresso(fim) {
    gsap.to(progresso, { valor: progresso.alvo, duration: 0.6, ease: "power1.out", onUpdate: mostrarProgresso, onComplete: fim });
  }
  function terminarCarregamento() {
    progresso.alvo = 100;
    seguirProgresso(() => {
      gsap.to(telaCarregando, {
        clipPath: "inset(0 0 100% 0)", duration: 0.9, ease: "power4.inOut", delay: 0.15,
        onComplete: () => telaCarregando?.remove(),
      });
      gsap.to(intro, { distancia: 0, giro: 0, duration: 2.2, ease: "power3.out", delay: 0.35 });
      document.dispatchEvent(new CustomEvent("respawn:pronto"));
    });
  }
  gerente.onProgress = (url, carregados, totalItens) => {
    progresso.alvo = Math.max(progresso.alvo, (carregados / totalItens) * 95);
    seguirProgresso();
  };
  gerente.onLoad = terminarCarregamento;
  if (!objetos.some((o) => modelosDisponiveis.includes(o.nome))) {
    // nenhum modelo para baixar: mostra a contagem rapidamente e segue
    progresso.alvo = 95;
    seguirProgresso(terminarCarregamento);
  }

  // ------------------------------------------------------------------ partículas de fundo
  const quantidade = 260;
  const pontos = new Float32Array(quantidade * 3);
  for (let i = 0; i < quantidade; i++) {
    pontos[i * 3] = (Math.random() - 0.5) * 14;
    pontos[i * 3 + 1] = (Math.random() - 0.5) * 8;
    pontos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;
  }
  const geoPontos = new THREE.BufferGeometry();
  geoPontos.setAttribute("position", new THREE.BufferAttribute(pontos, 3));
  const poeira = new THREE.Points(geoPontos, new THREE.PointsMaterial({
    color: 0x9cc9ff, size: 0.025, transparent: true, opacity: 0.55, depthWrite: false,
  }));
  cena.add(poeira);

  // ------------------------------------------------------------------ rolagem → animação
  const vitrine = palco.closest(".vitrine");
  const legendas = [...vitrine.querySelectorAll("[data-legenda]")];
  const marcadores = [...vitrine.querySelectorAll(".progresso-vitrine i")];
  const total = objetos.length;

  const linha = gsap.timeline({
    defaults: { ease: "power2.inOut" },
    scrollTrigger: {
      trigger: vitrine, start: "top top", end: "bottom bottom", scrub: 1.6,
      onUpdate: (st) => {
        const atual = Math.min(total - 1, Math.floor(st.progress * total));
        marcadores.forEach((m, i) => m.classList.toggle("ativo", i === atual));
        const nome = legendas[Math.round(carrossel.userData.indice)]?.dataset.nome;
        if (nomeObjeto && nome && nomeObjeto.textContent !== nome) nomeObjeto.textContent = nome;
      },
    },
  });

  // cada objeto tem seu par de cores: brilho atrás do objeto e faixa diagonal (sempre na família do azul)
  const moldura = palco.querySelector(".moldura");
  const nomeObjeto = palco.querySelector("[data-nome-objeto]");
  const tons = ["rgba(47,140,255,0.38)", "rgba(99,102,241,0.38)", "rgba(31,211,242,0.32)", "rgba(56,120,255,0.4)"];
  const faixas = ["#1fd3f2", "#4f6bff", "#22b8ff", "#2f8cff"];
  gsap.set(moldura, { "--tom": tons[0], "--faixa": faixas[0] });

  // títulos das legendas divididos em letras (função dividirLetras, do respawn.js)
  const letras = legendas.map((l) => {
    const titulo = l.querySelector(".titulo");
    return titulo && window.dividirLetras ? dividirLetras(titulo) : [];
  });
  const detalhes = legendas.map((l) => l.querySelectorAll(".rotulo, p, .botao"));
  const desfocado = { yPercent: 110, opacity: 0, filter: "blur(14px)" };
  const nitido = { yPercent: 0, opacity: 1, filter: "blur(0px)" };

  // Cada trecho da rolagem: a mensagem atual sai, o carrossel gira um quarto de volta
  // (trazendo o próximo objeto para a frente) e a nova mensagem entra letra por letra.
  objetos.forEach((o, i) => {
    if (i > 0) {
      linha.to(carrossel.userData, { indice: i, duration: 0.45, ease: "power2.inOut" }, i - 0.52);
      linha.to(moldura, { "--tom": tons[i], "--faixa": faixas[i], duration: 0.45, ease: "none" }, i - 0.52);
      linha.fromTo(legendas[i], { opacity: 0, y: 0 }, { opacity: 1, duration: 0.04 }, i - 0.2);
      linha.fromTo(letras[i], desfocado, { ...nitido, duration: 0.14, stagger: 0.004 }, i - 0.2);
      linha.fromTo(detalhes[i], { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.14, stagger: 0.03 }, i - 0.13);
    }
    if (i < total - 1) {
      linha.to(legendas[i], { opacity: 0, y: -40, duration: 0.1 }, i + 0.46);
    }
  });
  linha.to(vitrine.querySelector(".palavra-fundo"), { xPercent: -16, duration: total, ease: "none" }, 0);
  linha.set({}, {}, total);

  // a primeira legenda entra sozinha quando o carregamento termina
  if (!reduzido) {
    gsap.set([letras[0], detalhes[0]], { opacity: 0 });
    document.addEventListener("respawn:pronto", () => {
      gsap.fromTo(letras[0], desfocado, { ...nitido, duration: 1, stagger: 0.035, ease: "power3.out", delay: 0.55 });
      gsap.fromTo(detalhes[0], { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.12, ease: "power3.out", delay: 0.9 });
    }, { once: true });
  }

  // ------------------------------------------------------------------ mouse → câmera
  const mira = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    mira.x = (e.clientX / window.innerWidth - 0.5) * 2;
    mira.y = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ------------------------------------------------------------------ tamanho da tela
  let celular = false;
  let distanciaCamera = 7.4;
  function ajustar() {
    const { width, height } = canvas.parentElement.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    celular = width < 700;
    distanciaCamera = celular ? 9.5 : 7.4;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(ajustar).observe(canvas.parentElement);
  ajustar();

  // ------------------------------------------------------------------ desenho de cada quadro
  const relogio = new THREE.Clock();

  function quadro() {
    const t = relogio.getElapsedTime();
    const movimento = reduzido ? 0 : 1;

    camera.position.x += (mira.x * 0.7 - camera.position.x) * 0.05;
    camera.position.y += (0.2 - mira.y * 0.45 - camera.position.y) * 0.05;
    camera.position.z = distanciaCamera - intro.distancia;   // na entrada a câmera começa perto e recua
    camera.lookAt(0, 0, 0);

    poeira.rotation.y = t * 0.02 * movimento;
    poeira.position.y = Math.sin(t * 0.3) * 0.1 * movimento;

    // Carrossel: o centro do círculo fica atrás do objeto da frente. Cada objeto ocupa um ponto do
    // círculo; girar o "indice" traz o próximo para a frente. Os de trás ficam menores.
    // o círculo é uma elipse mais funda que larga: os objetos de lado vão para trás, sem invadir o texto
    // O carrossel fica na metade direita da moldura, qualquer que seja a largura da tela,
    // para nunca passar por cima do texto (que fica sempre à esquerda).
    const meiaLargura = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distanciaCamera * camera.aspect;
    const fator = celular ? 0.7 : THREE.MathUtils.clamp(camera.aspect / 1.75, 0.55, 1);   // telas estreitas: tudo menor
    const raioX = celular ? 1.15 : 1.9;
    const raioZ = celular ? 2.4 : 3.2;
    const passo = (Math.PI * 2) / total;
    carrossel.scale.setScalar(fator);
    const deslocamento = camera.aspect < 1.4 ? 0.52 : 0.42;   // tela mais estreita: carrossel mais para a direita
    carrossel.position.set(celular ? 0 : meiaLargura * deslocamento, celular ? 1.45 : -0.1, -raioZ * fator);   // celular: objeto no alto, texto embaixo
    objetos.forEach((o, i) => {
      const angulo = (i - carrossel.userData.indice) * passo;
      const frente = (Math.cos(angulo) + 1) / 2;   // 1 = na frente, 0 = atrás
      const giroIntro = i === 0 ? intro.giro : 0;
      o.grupo.visible = true;
      o.grupo.position.set(Math.sin(angulo) * raioX, Math.sin(t * 1.1 + i) * 0.06 * movimento, Math.cos(angulo) * raioZ);
      o.grupo.scale.setScalar(o.escala * (0.35 + 0.65 * frente));
      o.grupo.rotation.y = o.rotY + angulo + Math.sin(t * 0.3 + i) * 0.22 * movimento * frente + giroIntro;
      o.grupo.rotation.x = o.rotX + Math.sin(t * 0.7 + i) * 0.03 * movimento;
      o.grupo.rotation.z = 0;
      if (o.extra) o.extra(0);
    });

    renderer.render(cena, camera);
  }

  // Só desenha enquanto a vitrine está na tela, para não gastar processamento
  new IntersectionObserver(([entrada]) => {
    renderer.setAnimationLoop(entrada.isIntersecting ? quadro : null);
  }).observe(palco);
}

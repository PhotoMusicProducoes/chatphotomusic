// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-pedido-de-humano.js
// teste-pedido-de-humano.js - 18/11/2026 (PM): cliente pede "falar com humano/atendente" no meio do orçamento (caso 17:34).
// Antes: 3x "Opção inválida". Agora: avisa a equipe, diz que alguém fala, pede SÓ o que falta e pausa o bot.
// Dirige o handleIncomingMessage REAL; nada vai à rede.  Rodar: node teste-pedido-de-humano.js (conferir o CODIGO DE SAIDA).

const fs = require("fs");
const path = require("path");
const ARQ_SESSOES = path.join(__dirname, "sessions.json");
const ARQ_RR = path.join(__dirname, "followupRespostaRapida.json");
const guardar = (a) => (fs.existsSync(a) ? fs.readFileSync(a, "utf8") : null);
const sessoesAntes = guardar(ARQ_SESSOES), rrAntes = guardar(ARQ_RR);
function devolver(a, c) { if (c === null) { try { fs.unlinkSync(a); } catch (e) {} } else fs.writeFileSync(a, c, "utf8"); }

const enviados = [];
const utils = require("./utils/index.js");
const numerado = (t, o) => t + "\n\n" + (o || []).map(x => `*${x.id}* - ${x.label}`).join("\n");
utils.sendText       = async (c, t) => { enviados.push([String(c), String(t)]); return true; };
utils.sendTyping     = async () => {};
utils.sendButtonList = async (c, t, o) => { enviados.push([String(c), "BOTOES: " + numerado(t, o)]); return true; };
utils.sendOptionList = async (c, t, o) => { enviados.push([String(c), "LISTA: " + numerado(t, o)]); return true; };
utils.sendFileByUrl  = async () => true;
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;

const axios = require("axios");
axios.get = async () => ({ data: {} });
axios.post = async () => ({ data: {} });

const { pedeAtendente } = require("./utils/pedidoDeHumano.js");
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
let falhas = 0, seq = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + String(detalhe).slice(0, 500)}`);
  if (!ok) falhas++;
}
const OP = "5521964428172";
async function cliente(chat, texto) {
  enviados.length = 0;
  await bot.handleIncomingMessage({ phone: chat, messageId: "ph-" + (++seq), text: { message: texto }, fromMe: false });
  await new Promise(r => setTimeout(r, 30));
}
const paraCliente = (chat) => enviados.filter(e => e[0].replace(/\D/g, "").endsWith(chat.slice(-8))).map(e => e[1]).join("\n");
const paraOperador = () => enviados.filter(e => e[0].replace(/\D/g, "").endsWith(OP.slice(-8))).map(e => e[1]).join("\n");

(async () => {
  console.log("— Reconhecimento da frase —");
  for (const f of ["Falsr com humano", "Falar com atendente", "falar com humano", "quero falar com uma pessoa", "quero falar com alguém",
    "atendente", "humano", "Atendimento humano", "me passa para um atendente", "pode chamar o Mario?", "quero conversar com alguem da equipe",
    "FALAR COM ATENDENTE!!!", "preciso falar com um humano por favor", "falar com pessoa de verdade"])
    checar(`pede pessoa: "${f}"`, pedeAtendente(f));
  for (const f of ["50 pessoas", "somos 80 pessoas", "Ok", "1", "Aniversário Adulto", "quero saber o valor", "foto cabine", "o atendente foi muito educado",
    "Rio de Janeiro", "uma pessoa de 15 anos", "casamento com 100 pessoas e quero falar sobre o DJ depois", "Mario", "Bom dia"])
    checar(`NÃO é pedido: "${f}"`, !pedeAtendente(f));

  console.log("\n— Caso real: pede humano na pergunta da celebração (nada informado, só o nome ausente) —");
  const A = "5521900001010";
  sessions[A] = { step: "orcamento_celebracao", menuInicialEnviado: true, orcamento: { servicosEnviados: [] }, servicosEnviados: [] };
  await cliente(A, "Falsr com humano");
  let r = paraCliente(A);
  checar("NÃO diz 'Opção inválida'", !/inválida/i.test(r), r);
  checar("diz que alguém vai falar", /alguém vai falar com você/.test(r), r);
  checar("pede os 7 itens (nada foi informado)", /bairro\/cidade/.test(r) && /Como nos encontrou/.test(r) && /nome/.test(r) && /celebrar/.test(r) && /convidados/.test(r) && /data do evento/.test(r) && /horário de início e término/.test(r), r);
  checar("sem serviço escolhido: lista os 9 serviços ANTES das perguntas", /Escolha os serviços desejados/.test(r) && /0 - Foto Cabine/.test(r) && /8 - Iluminação de Pista/.test(r) && r.indexOf("Escolha os serviços") < r.indexOf("Qual o seu nome"), r);
  checar("usa o cabeçalho pedido pelo Mario", /Para agilizar seu atendimento, por gentileza responda/.test(r), r);
  checar("avisa o operador com o número e a frase", /pediu para falar com uma pessoa/.test(paraOperador()) && /Falsr com humano/.test(paraOperador()), paraOperador());
  checar("bot pausado neste número", sessions[A].step === "pausado_followup", sessions[A].step);
  await cliente(A, "Falar com atendente");
  checar("pedir de novo não gera 'Opção inválida' nem repete a lista", !/inválida/i.test(paraCliente(A)) && !/Para enviar o orçamento personalizado/.test(paraCliente(A)), paraCliente(A));

  console.log("\n— Já informou algumas coisas: só pergunta o que falta —");
  const B = "5521900001020";
  sessions[B] = { step: "orcamento_data", menuInicialEnviado: true, orcamento: { servicosPrevios: [1], nome: "Mey Silva", celebracao: "Aniversário Adulto", convidados: 80, servicosEnviados: [] }, servicosEnviados: [] };
  await cliente(B, "quero falar com um atendente");
  r = paraCliente(B);
  checar("trata pelo primeiro nome", /Claro, \*Mey\*/.test(r), r);
  checar("serviço já escolhido: NÃO repete a lista de serviços", !/Escolha os serviços/.test(r), r);
  checar("NÃO pergunta nome, celebração nem convidados (já informados)", !/Qual o seu nome/.test(r) && !/O que vai celebrar/.test(r) && !/Quantos convidados/.test(r), r);
  checar("pergunta data, horário, bairro/cidade e como encontrou", /data do evento/.test(r) && /horário de início e término/.test(r) && /bairro\/cidade/.test(r) && /Como nos encontrou/.test(r), r);
  checar("aviso ao operador lista o que já veio", /Nome: Mey Silva/.test(paraOperador()) && /Aniversário Adulto/.test(paraOperador()) && /Convidados: 80/.test(paraOperador()), paraOperador());

  console.log("\n— Tudo informado: só diz que alguém vai falar —");
  const C = "5521900001030";
  sessions[C] = { step: "orcamento_bairro", menuInicialEnviado: true, orcamento: { servicosPrevios: [1, 3], nome: "Ana", celebracao: "Casamento", convidados: 100, data: "10/12/2026", horaInicio: "19:00", horaFim: "23:00", bairro: "Barra da Tijuca", cidade: "Rio de Janeiro", ondeEncontrou: "Instagram", servicosEnviados: [] }, servicosEnviados: [] };
  await cliente(C, "humano");
  r = paraCliente(C);
  checar("sem lista de perguntas", /alguém vai falar/.test(r) && !/Para enviar o orçamento personalizado/.test(r), r);

  console.log("\n— Dados ditos antes (dadosLivres) contam como informados —");
  const D = "5521900001040";
  sessions[D] = { step: "orcamento_celebracao", menuInicialEnviado: true, orcamento: { nome: "Bia", servicosEnviados: [] }, dadosLivres: { convidados: 60, data: "05/12/2026" }, servicosEnviados: [] };
  await cliente(D, "falar com atendente");
  r = paraCliente(D);
  checar("não repete convidados e data", !/Quantos convidados/.test(r) && !/data do evento/.test(r) && /celebrar/.test(r) && /horário/.test(r) && /bairro\/cidade/.test(r), r);

  console.log("\n— Já recebeu orçamento: avisa a equipe sem refazer perguntas —");
  const E = "5521900001050";
  sessions[E] = { step: "orcamento_pos", menuInicialEnviado: true, orcamento: { nome: "Leo", servicosEnviados: [1] }, servicosEnviados: [1] };
  await cliente(E, "falar com atendente");
  r = paraCliente(E);
  checar("diz que alguém vai falar, sem perguntas", /alguém vai falar/.test(r) && !/Para enviar o orçamento personalizado/.test(r), r);
  checar("operador sabe que já recebeu orçamento", /Já recebeu orçamento/.test(paraOperador()), paraOperador());

  console.log("\n— Primeira mensagem da conversa já é o pedido —");
  const F = "5521900001060";
  delete sessions[F];
  await cliente(F, "Oi, quero falar com um atendente");
  r = paraCliente(F);
  checar("responde e pede os 5 dados, sem abrir o menu", /alguém vai falar/.test(r) && /Qual o seu nome/.test(r) && !/Aniversário de 15 anos/.test(r), r);
  checar("operador avisado", /pediu para falar com uma pessoa/.test(paraOperador()), paraOperador());

  console.log("\n— Não atrapalha o fluxo normal —");
  const G = "5521900001070";
  sessions[G] = { step: "orcamento_celebracao", menuInicialEnviado: true, orcamento: { nome: "Zé", servicosEnviados: [] }, servicosEnviados: [] };
  await cliente(G, "2");
  checar("'2' continua escolhendo Casamento", sessions[G].orcamento.celebracao === "Casamento" || /Casamento/i.test(JSON.stringify(sessions[G].orcamento)), JSON.stringify(sessions[G].orcamento));
  checar("e não pausou", sessions[G].step !== "pausado_followup", sessions[G].step);

  devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes);
  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ tudo certo");
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes); process.exit(2); });

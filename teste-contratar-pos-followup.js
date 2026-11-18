// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-contratar-pos-followup.js
// teste-contratar-pos-followup.js - 18/11/2026 (PM): o follow-up cai NO MEIO do "quero contratar" (orcamento 726, Karla).
// Cliente respondeu "Quero contratar", o bot perguntou a foto impressa (Cabine x Totem Retro), o follow-up V3 chegou
// e o bot "esqueceu" a pergunta: o cliente digitou "Foto Cabine" e o bot repetiu a mesma pergunta.
// Dirige o handleIncomingMessage REAL com WhatsApp e PhotoMusic Pro trocados por gravadores. Nao toca em producao.
// Rodar:  node teste-contratar-pos-followup.js   (conferir o CODIGO DE SAIDA).

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
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => {};

const axios = require("axios");
// orcamento no formato do 726: foto impressa e UMA entre Cabine e Totem Retro (opcoes) + um servico fixo
const orc726 = { id: 726, criado: "17/11/2026", data_evento: "20/12/2026", celebracao: "Aniversário", empresa: "", total: 4000,
  itens: [{ slug: "som-dj", servico: "Som Completo com DJ", pacote: "Pacote Premium", horas: 5, valor: 1703 }],
  opcoes: [{ slug: "foto-cabine", servico: "Foto Cabine", pacote: "Pacote Premium", horas: 5, valor: 2297 },
           { slug: "totem-retro", servico: "Totem Retrô", pacote: "Pacote Premium", horas: 5, valor: 2297 }],
  pacote_definido: false, pacotes: [], duracoes: [], horas_proposta: 5,
  pagamentos: { pix_avista: "PIX à vista", cartao: "Cartão de crédito (até 10x)" }, pacotes_servico: {} };
let plugin = { ativo: true, orcamentos: [orc726], numero_encontrado: true };
const posts = [];
axios.post = async (url, body) => { posts.push([url, body]); return { data: { v2: true, status: "negociando", id: 1, nome: "Karla", ja_pausado: false } }; };
axios.get  = async (url) => ({ data: /orcamentos-do-cliente/.test(url) ? plugin : {} });

const rr = require("./utils/followupRespostaRapida.js");
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
// o que o envio do follow-up faz com a sessao (copia fiel de encerrarFluxoLead, que nao e exportada)
function encerrarFluxoLead(tel) { const k = Object.keys(sessions).find(x => x.replace(/\D/g, "").slice(-8) === tel.slice(-8)); if (k && sessions[k].step !== "pausado_followup") { sessions[k].stepAnterior = sessions[k].step; sessions[k].step = "pausado_followup"; sessions[k].avisouOperadorFollowup = false; } }

let falhas = 0, seq = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + String(detalhe).slice(0, 500)}`);
  if (!ok) falhas++;
}
async function cliente(chat, texto) {
  enviados.length = 0; posts.length = 0;
  await bot.handleIncomingMessage({ phone: chat, messageId: "pf-" + (++seq), text: { message: texto }, fromMe: false });
  await new Promise(r => setTimeout(r, 30));
}
const paraCliente = (chat) => enviados.filter(e => e[0].replace(/\D/g, "").endsWith(chat.slice(-8))).map(e => e[1]).join("\n");
const REPETIU = /opções de foto impressa/;

(async () => {
  const A = "5521900007260";
  Object.keys(sessions).forEach(k => delete sessions[k]);
  sessions[A] = { step: "finalizado", menuInicialEnviado: true, orcamento: { nome: "Karla", servicosEnviados: [] }, servicosEnviados: [] };

  console.log("\n— 1. CLIENTE COMECA A CONTRATAR (orçamento 726) —");
  await cliente(A, "Quero contratar");
  checar("bot pergunta a foto impressa (Cabine x Totem Retrô)", REPETIU.test(paraCliente(A)) && /Foto Cabine/.test(paraCliente(A)) && /Totem Retrô/.test(paraCliente(A)), paraCliente(A));
  checar("sessão está na pergunta da foto", sessions[A].step === "contratar_foto", sessions[A].step);

  console.log("\n— 2. O FOLLOW-UP CAI NO MEIO DA CONVERSA —");
  rr.marcarFollowupEnviado(A, { nome: "Karla", perfil: "social" });
  encerrarFluxoLead(A);   // o que o envio do follow-up faz com a sessão
  console.log("   passo depois do follow-up:", sessions[A].step);

  console.log("\n— 3. CLIENTE DIGITA O NOME DO SERVIÇO —");
  await cliente(A, "Foto Cabine");
  const r = paraCliente(A);
  checar("NÃO repete a pergunta da foto impressa", !REPETIU.test(r), r);
  checar("aceitou a Foto Cabine e seguiu (próxima pergunta: pacote/duração/pagamento/outros)", /pacote|duração|pagar|outros|Som Completo|Quer contratar também/i.test(r), r);
  checar("a escolha ficou guardada: foto = foto-cabine", sessions[A]._contratar && sessions[A]._contratar.foto === "foto-cabine", JSON.stringify(sessions[A]._contratar && sessions[A]._contratar.foto));
  checar("o operador NÃO recebeu aviso de 'assuma o atendimento' (cliente está sendo atendido pelo bot)", !enviados.some(e => /assuma o atendimento/.test(e[1])), JSON.stringify(enviados.map(e => e[1].slice(0, 60))));

  console.log("\n— 4. OS BOTÕES DO FOLLOW-UP CONTINUAM VALENDO —");
  const B = "5521900007261";
  sessions[B] = { step: "finalizado", menuInicialEnviado: true, orcamento: { nome: "Bia", servicosEnviados: [] }, servicosEnviados: [] };
  await cliente(B, "Quero contratar");
  rr.marcarFollowupEnviado(B, { nome: "Bia", perfil: "social" });
  encerrarFluxoLead(B);
  await cliente(B, "1");   // "1 - Quero contratar" do follow-up
  checar("'1' logo após o follow-up segue como 'Quero contratar' do follow-up (pergunta a foto de novo, UMA vez)", REPETIU.test(paraCliente(B)), paraCliente(B));
  await cliente(B, "Totem Retrô");
  checar("e depois o nome do serviço é aceito", !REPETIU.test(paraCliente(B)) && sessions[B]._contratar && sessions[B]._contratar.foto === "totem-retro", paraCliente(B));

  console.log("\n— 5. QUEM NÃO ESTAVA CONTRATANDO NÃO MUDA —");
  const C = "5521900007262";
  sessions[C] = { step: "orcamento_nome", menuInicialEnviado: true, orcamento: { servicosEnviados: [] }, servicosEnviados: [] };
  encerrarFluxoLead(C);
  checar("fluxo comum continua encerrado pelo follow-up (comportamento antigo)", sessions[C].step === "pausado_followup", sessions[C].step);

  console.log("\n— 6. SEQUÊNCIA REAL DA KARLA: follow-up, toca 'Quero contratar' de novo, depois digita o serviço —");
  const D = "5521900007263";
  sessions[D] = { step: "finalizado", menuInicialEnviado: true, orcamento: { nome: "Karla", servicosEnviados: [] }, servicosEnviados: [] };
  await cliente(D, "Quero contratar");
  rr.marcarFollowupEnviado(D, { nome: "Karla", perfil: "social" });
  encerrarFluxoLead(D);
  await cliente(D, "Quero contratar");
  checar("toque no botão do follow-up refaz a pergunta da foto", REPETIU.test(paraCliente(D)), paraCliente(D));
  await cliente(D, "Foto Cabine");
  checar("digitar 'Foto Cabine' depois disso é aceito (não repete)", !REPETIU.test(paraCliente(D)) && sessions[D]._contratar && sessions[D]._contratar.foto === "foto-cabine", paraCliente(D));

  devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes);
  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ tudo certo");
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes); process.exit(2); });

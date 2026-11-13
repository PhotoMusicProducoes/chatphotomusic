// teste-quero-contratar.js - "quero contratar" ate o evento: a conversa com o cliente (13/11/2026, RJN)
//
// Dirige o handleIncomingMessage REAL com WhatsApp e PhotoMusic Pro trocados por gravadores. Nao toca em producao.
// O caso principal e o orcamento REAL nº 576 (anonimizado), com as opcoes calculadas pelo motor de verdade
// (Blog/Site/demo-conversao-576.json, gerado por Blog/Site/teste-orcamento-para-evento.php).
// Rodar:  node teste-quero-contratar.js   (conferir o CODIGO DE SAIDA). Grava Blog/Site/demo-link.json.

const fs = require("fs");
const path = require("path");
const SITE = "D:/PhotoMusic Produções/Blog/Site/";
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
let plugin = { ativo: true, orcamentos: [] };
const posts = [], gets = [];
axios.post = async (url, body) => { posts.push([url, body]); return { data: { v2: true, status: "negociando", id: 1, nome: "Cliente", ja_pausado: false } }; };
axios.get  = async (url, cfg) => { gets.push([url, cfg && cfg.params]); return { data: /orcamentos-do-cliente/.test(url) ? plugin : {} }; };

const rr  = require("./utils/followupRespostaRapida.js");
const { clienteQuerFechar, numeroDoOrcamento } = require("./utils/queroContratar.js");
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
const OPERADOR = "5521964428172@c.us";

let falhas = 0, seq = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + String(detalhe).slice(0, 500)}`);
  if (!ok) falhas++;
}
async function cliente(chat, texto) {
  enviados.length = 0; posts.length = 0; gets.length = 0;
  await bot.handleIncomingMessage({ phone: chat, messageId: "qc-" + (++seq), text: { message: texto }, fromMe: false });
  await new Promise(r => setTimeout(r, 30));
}
const paraCliente = (chat) => enviados.filter(e => e[0].replace(/\D/g, "").endsWith(chat.slice(-8))).map(e => e[1]).join("\n");
const paraOperador = () => enviados.filter(e => e[0] === OPERADOR).map(e => e[1]).join("\n");

const REAL = JSON.parse(fs.readFileSync(SITE + "demo-conversao-576.json", "utf8"));
const simples = { id: 701, criado: "01/11/2026", data_evento: "20/12/2026", celebracao: "Aniversário de 15 anos", empresa: "", total: 2297,
  itens: [{ servico: "Foto Cabine", pacote: "Pacote Premium", horas: 5, valor: 2297 }], pacote_definido: true, opcoes: [], pacotes: [], duracoes: [],
  horas_proposta: 5, pagamentos: { pix_avista: "PIX à vista", cartao: "Cartão de crédito (até 10x)" } };

(async () => {
  console.log("\n— 1. RECONHECE O PEDIDO —");
  const sim = ["Oi! Quero seguir com o orçamento nº 576 (Foto Cabine, 27/11/2026).", "Oi! Quero fechar os 2 serviços do orçamento nº 576 (Foto Cabine).",
    "quero contratar", "Gostaria de contratar a cabine", "Quero fechar esta proposta", "QUERO APROVAR ESTA PROPOSTA", "podemos fechar?", "quero garantir a data"];
  const nao = ["não quero contratar agora", "ainda não vou fechar", "qual o valor?", "obrigada", "vou pensar", "1"];
  checar("frases de contratar (botão do PDF, follow-up, escritas) reconhecidas", sim.every(clienteQuerFechar), sim.filter(s => !clienteQuerFechar(s)));
  checar("negação e conversa comum NÃO são pedido de contratar", !nao.some(clienteQuerFechar), nao.filter(clienteQuerFechar));
  checar("nº do orçamento sai da mensagem do PDF", numeroDoOrcamento(sim[0]) === 576 && numeroDoOrcamento("orçamento 612") === 612 && numeroDoOrcamento("quero contratar") === null);

  console.log("\n— 2. CASO REAL Nº 576 (anonimizado): do botão do PDF ao link do evento —");
  plugin = { ativo: true, orcamentos: [REAL], numero_encontrado: true };
  const A = "5521900005760";
  Object.keys(sessions).forEach(k => delete sessions[k]);
  sessions[A] = { step: "finalizado", menuInicialEnviado: true, orcamento: { nome: "Cliente Demonstração", servicosEnviados: [] }, servicosEnviados: [] };
  await cliente(A, "Oi! Quero seguir com o orçamento nº 576 (Foto Cabine, 27/11/2026).");
  const p1 = paraCliente(A);
  checar("conversa ENCERRADA: o bot responde na hora (antes ficava calado)", p1 !== "", p1);
  checar("pergunta o equipamento com os valores da proposta (Cabine x Totem)", /equipamento/.test(p1) && /Foto Cabine/.test(p1) && /Totem/.test(p1) && /2\.297,00/.test(p1) && /2\.197,00/.test(p1), p1);
  checar("procurou o orçamento pelo telefone e pelo nº citado", gets.some(g => /orcamentos-do-cliente/.test(g[0]) && g[1].numero === 576), JSON.stringify(gets));
  await cliente(A, "1");
  checar("pacote: Premium, Tirinha e Gold, como no PDF", /pacote/i.test(paraCliente(A)) && /Premium/.test(paraCliente(A)) && /Tirinha/.test(paraCliente(A)) && /Gold/.test(paraCliente(A)), paraCliente(A));
  await cliente(A, "Premium");
  checar("duração: 4 ou 5 horas, como no PDF", /duração/.test(paraCliente(A)) && /4 horas/.test(paraCliente(A)) && /5 horas/.test(paraCliente(A)), paraCliente(A));
  await cliente(A, "talvez");
  checar("resposta fora das opções: pede o número e repete a pergunta", /Responda com o número/.test(paraCliente(A)) && /5 horas/.test(paraCliente(A)), paraCliente(A));
  await cliente(A, "2");
  checar("pagamento: as formas da política (PIX à vista, cartão)", /pagar/.test(paraCliente(A)) && /PIX à vista/.test(paraCliente(A)) && /Cartão/.test(paraCliente(A)), paraCliente(A));
  await cliente(A, "1");
  const conf = paraCliente(A);
  checar("confirmação com as escolhas; Cabine não é a opção do total, então NÃO mostra valor recalculado",
    /Foto Cabine/.test(conf) && /Premium/.test(conf) && /5h/.test(conf) && /PIX à vista/.test(conf) && /conforme o seu orçamento/.test(conf) && !/Total da proposta/.test(conf), conf);
  await cliente(A, "1");
  const fim = paraCliente(A), op = paraOperador();
  checar("cliente: próximo passo é o formulário já preenchido", /formulário/.test(fim) && /já preenchido/.test(fim), fim);
  const link = (op.match(/https:\/\/\S+pm_evento_do_orcamento\S+/) || [""])[0];
  checar("operador recebe as escolhas e o link do evento com elas", /CONTRATAR/.test(op) && /orc=576/.test(link) && /opcao=foto-cabine/.test(link) && /pacote=Premium/.test(link) && /horas=5/.test(link) && /pagto=pix_avista/.test(link), op);
  checar("operador é avisado que a escolha difere da proposta (Cabine x Totem do total)", /diferente da proposta/.test(op), op);
  checar("lead vai para Negociando (UMA chamada ao plugin)", posts.filter(p => /lead-cliente-respondeu/.test(p[0]) && p[1].contratar === true).length === 1, JSON.stringify(posts));
  checar("sessão fica com a equipe (não volta a fazer perguntas)", sessions[A].step === "pausado_followup");
  fs.writeFileSync(SITE + "demo-link.json", JSON.stringify({ link, conversa_operador: op }, null, 2), "utf8");

  console.log("\n— 3. OUTROS ESTADOS E CASOS —");
  plugin = { ativo: true, orcamentos: [simples] };
  for (const [estado, sess] of [["sem conversa", null], ["menu pós-orçamento", { step: "orcamento_pos", menuInicialEnviado: true, _menuPos: [], orcamento: { servicosEnviados: [1] }, servicosEnviados: [1] }]]) {
    const B = "55219000071" + String(10 + (++seq % 80));
    Object.keys(sessions).forEach(k => delete sessions[k]);
    if (sess) sessions[B] = sess;
    await cliente(B, "Oi! Quero seguir com o orçamento nº 701 (Foto Cabine, 20/12/2026).");
    checar(`${estado}: entra na contratação (não abre o menu nem diz "não entendi")`, /Como você prefere pagar/.test(paraCliente(B)) && !/Seja bem-vindo|Não entendi/.test(paraCliente(B)), paraCliente(B));
  }

  const V = "5521900007300";
  Object.keys(sessions).forEach(k => delete sessions[k]);
  plugin = { ativo: true, orcamentos: [simples, Object.assign({}, simples, { id: 702, data_evento: "10/01/2027" })] };
  await cliente(V, "quero contratar");
  checar("vários orçamentos sem nº: pergunta QUAL", /mais de um orçamento/.test(paraCliente(V)) && /701/.test(paraCliente(V)) && /702/.test(paraCliente(V)), paraCliente(V));
  await cliente(V, "2");
  checar("escolheu o 2º: segue a conversa com o nº 702", sessions[V]._contratar && sessions[V]._contratar.orc.id === 702, JSON.stringify(sessions[V]._contratar));
  await cliente(V, "2");   // pacote e duração únicos: a próxima pergunta já é o pagamento (2 = cartão)
  checar("pacote e duração da proposta: confirmação mostra o total EXATO", /Total da proposta: \*R\$ 2\.297,00\*/.test(paraCliente(V)), paraCliente(V));
  await cliente(V, "2");
  checar("'Quero mudar algo': a equipe assume, operador avisado com o pedido de ajuste", /o que você quer mudar/.test(paraCliente(V)) && /pediu ajuste/.test(paraOperador()), paraOperador());

  const O = "5521900007400";
  Object.keys(sessions).forEach(k => delete sessions[k]);
  plugin = { ativo: true, orcamentos: [], numero_de_outro_telefone: true };
  await cliente(O, "Oi! Quero seguir com o orçamento nº 999 (Foto Cabine).");
  checar("nº de outro telefone: responde e avisa o operador para conferir", /Já avisei a nossa equipe/.test(paraCliente(O)) && /OUTRO telefone/.test(paraOperador()), paraOperador());

  const D = "5521900007500";
  Object.keys(sessions).forEach(k => delete sessions[k]);
  sessions[D] = { step: "finalizado", menuInicialEnviado: true, orcamento: { servicosEnviados: [] }, servicosEnviados: [] };
  plugin = { ativo: false };
  await cliente(D, "Oi! Quero fechar os 2 serviços do orçamento nº 701.");
  checar("chave DESLIGADA no site: nada de conversa nova, o lead é avisado como hoje", !/prefere pagar|equipamento/.test(paraCliente(D)) && posts.some(p => /lead-cliente-respondeu/.test(p[0]) && p[1].contratar === true), JSON.stringify(posts));

  const F = "5521900007600";
  Object.keys(sessions).forEach(k => delete sessions[k]);
  plugin = { ativo: true, orcamentos: [simples] };
  rr.marcarFollowupEnviado(F, { leadId: 3, perfil: "social", nome: "Fulana" });
  sessions[F] = { step: "pausado_followup", menuInicialEnviado: true, orcamento: { servicosEnviados: [] }, servicosEnviados: [] };
  await cliente(F, "1");
  checar("botão 'Quero contratar' do follow-up entra na conversa de contratação", /Como você prefere pagar/.test(paraCliente(F)), paraCliente(F));

  devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes);
  console.log(`\n${falhas === 0 ? "✅ TUDO CERTO" : "❌ " + falhas + " FALHA(S)"}`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error(e); devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes); process.exit(2); });

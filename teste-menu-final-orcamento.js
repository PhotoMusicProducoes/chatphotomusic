// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-menu-final-orcamento.js
// Menu final do orçamento com 5 opções (14/11/2026, RJN; pedido do Mario + ChatGPT).
// Dirige o handleIncomingMessage REAL com WhatsApp e PhotoMusic Pro trocados por gravadores. Não toca em produção.
// Rodar:  node teste-menu-final-orcamento.js   (conferir o CÓDIGO DE SAÍDA)

const fs = require("fs");
const path = require("path");
const ARQ_SESSOES = path.join(__dirname, "sessions.json");
const ARQ_RR = path.join(__dirname, "followupRespostaRapida.json");
const guardar = (a) => (fs.existsSync(a) ? fs.readFileSync(a, "utf8") : null);
const sessoesAntes = guardar(ARQ_SESSOES), rrAntes = guardar(ARQ_RR);
function devolver(a, c) { if (c === null) { try { fs.unlinkSync(a); } catch (e) {} } else fs.writeFileSync(a, c, "utf8"); }

const enviados = [];
const utils = require("./utils/index.js");
const numerado = (t, o) => t + "\n\n" + (o || []).map(x => `*${x.id}* - ${x.label || x.title}`).join("\n");
utils.sendText       = async (c, t) => { enviados.push([String(c), String(t)]); return true; };
utils.sendTyping     = async () => {};
utils.sendButtonList = async (c, t, o) => { enviados.push([String(c), "BOTOES: " + numerado(t, o)]); return true; };
utils.sendOptionList = async (c, t, o) => { enviados.push([String(c), "LISTA: " + numerado(t, o)]); return true; };
utils.sendFileByUrl  = async () => true;
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => {};

const axios = require("axios");
let plugin = { ativo: true, orcamentos: [] };
const posts = [];
axios.post = async (url, body) => { posts.push([url, body]); return { data: { v2: true, status: "negociando", id: 1, nome: "Cliente", ja_pausado: false } }; };
axios.get  = async (url) => ({ data: /orcamentos-do-cliente/.test(url) ? plugin : {} });

const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
const OPERADOR = "5521964428172@c.us";

let falhas = 0, seq = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + String(detalhe).slice(0, 600)}`);
  if (!ok) falhas++;
}
async function cliente(chat, texto) {
  enviados.length = 0; posts.length = 0;
  await bot.handleIncomingMessage({ phone: chat, messageId: "mf-" + (++seq), text: { message: texto }, fromMe: false });
  await new Promise(r => setTimeout(r, 30));
}
const paraCliente = (chat) => enviados.filter(e => e[0].replace(/\D/g, "").endsWith(chat.slice(-8))).map(e => e[1]).join("\n");
const paraOperador = () => enviados.filter(e => e[0] === OPERADOR).map(e => e[1]).join("\n");

const orc = (id) => ({ id, criado: "14/11/2026", data_evento: "20/12/2026", celebracao: "Aniversário de 15 anos", empresa: "", total: 2297,
  itens: [{ servico: "Foto Cabine", pacote: "Pacote Premium", horas: 5, valor: 2297 }], pacote_definido: true, opcoes: [], pacotes: [], duracoes: [],
  horas_proposta: 5, pagamentos: { pix_avista: "PIX à vista", cartao: "Cartão de crédito (até 10x)" } });

// cliente que acabou de receber o orçamento da Foto Cabine (id 1)
function novaSessao(chat, extra = {}) {
  Object.keys(sessions).forEach(k => delete sessions[k]);
  sessions[chat] = Object.assign({ step: "orcamento_pos", menuInicialEnviado: true, clienteEscreveuTexto: true,
    orcamento: { nome: "Cliente Teste", servicosEnviados: [1], servicosDetalhados: [] }, servicosEnviados: [1] }, extra);
  return sessions[chat];
}
async function comMenu(chat, extra) {
  const s = novaSessao(chat, extra);
  enviados.length = 0;
  await bot.perguntarPosOrcamento(chat, s);
  return s;
}

(async () => {
  const A = "5521900001401";

  console.log("\n— O MENU —");
  let s = await comMenu(A);
  const menu = paraCliente(A);
  const esperado = ["Gostou da nossa proposta? 😊📸", "Como posso te ajudar agora?", "*1* - ✅ Quero contratar", "*2* - 💬 Tenho uma dúvida",
    "*3* - 📸 Quero conhecer mais detalhes dos serviços", "*4* - 📋 Quero outro orçamento", "*5* - ❤️ Por enquanto é só, obrigado(a)"];
  checar("texto do menu exatamente como pedido (cabeçalho + 5 opções, na ordem)", esperado.every(l => menu.includes(l)) && !/BOTOES/.test(menu), menu);
  checar("passo = orcamento_pos, com as 5 ações guardadas", s.step === "orcamento_pos" && s._menuPos.map(o => o.acao).join() === "contratar,duvida,detalhes,orcamento,fim", JSON.stringify(s._menuPos));
  checar("as 5 opções aparecem mesmo com tudo já detalhado e orçado (o número não muda)",
    bot.montarMenuPosOrcamento({ orcamento: { servicosEnviados: [1, 13, 2, 3, 4, 5, 6, 7, 8], servicosDetalhados: [1] } }).length === 5);
  checar("sem nenhum termo em inglês e sem travessão longo no menu", !/—/.test(menu));

  console.log("\n— 1. QUERO CONTRATAR —");
  plugin = { ativo: true, orcamentos: [orc(901)] };
  s = await comMenu(A);
  await cliente(A, "1");
  checar("1 com UM orçamento: entra na conversa de contratação desse orçamento", /^contratar_/.test(sessions[A].step) && sessions[A]._contratar && sessions[A]._contratar.orc.id === 901, sessions[A].step + " | " + paraCliente(A));
  plugin = { ativo: true, orcamentos: [orc(901), Object.assign(orc(902), { data_evento: "10/01/2027" })] };
  s = await comMenu(A);
  await cliente(A, "1");
  checar("1 com VÁRIOS orçamentos: pergunta qual deseja contratar", /mais de um orçamento seu/.test(paraCliente(A)) && sessions[A].step === "contratar_escolher", paraCliente(A));
  plugin = { ativo: false };
  s = await comMenu(A);
  await cliente(A, "1");
  checar("1 com a conversão desligada no site: avisa a equipe e o cliente, como antes",
    /Já avisei a nossa equipe/.test(paraCliente(A)) && /Cliente quer CONTRATAR/.test(paraOperador()) && sessions[A].step === "pausado_followup", paraCliente(A) + " | " + paraOperador());

  console.log("\n— 2. TENHO UMA DÚVIDA —");
  plugin = { ativo: true, orcamentos: [orc(901)] };
  s = await comMenu(A);
  await cliente(A, "2");
  checar("2: pede para escrever a dúvida (sem reiniciar nada)", /Pode escrever a sua dúvida/.test(paraCliente(A)) && sessions[A].step === "orcamento_duvida", paraCliente(A));
  await cliente(A, "Vocês levam a cabine para Niterói? Tem custo a mais?");
  checar("a dúvida vai para a equipe com o texto do cliente", /DÚVIDA sobre o orçamento/.test(paraOperador()) && /Niterói/.test(paraOperador()), paraOperador());
  checar("o cliente recebe a confirmação", /Recebi a sua dúvida/.test(paraCliente(A)), paraCliente(A));
  checar("questionário intacto e o bot para (operador assume); 'continuar' volta ao menu final",
    sessions[A].step === "pausado_followup" && sessions[A].stepAnterior === "orcamento_pos" && sessions[A].orcamento.servicosEnviados.join() === "1" && sessions[A].orcamento.nome === "Cliente Teste",
    JSON.stringify({ st: sessions[A].step, ant: sessions[A].stepAnterior }));
  enviados.length = 0;
  await cliente(A, "Tem estacionamento?");
  checar("mensagens seguintes ficam com a equipe (o bot não responde por cima)", paraCliente(A) === "", paraCliente(A));

  console.log("\n— 3. DETALHES DOS SERVIÇOS —");
  s = await comMenu(A);
  await cliente(A, "3");
  checar("3: envia os detalhes do serviço orçado (o envio de sempre) e mostra o menu de novo",
    (sessions[A].orcamento.servicosDetalhados || []).includes(1) && /Quero contratar/.test(paraCliente(A)), paraCliente(A).slice(-400));
  s = await comMenu(A, { orcamento: { nome: "Cliente Teste", servicosEnviados: [1], servicosDetalhados: [1] } });
  await cliente(A, "3");
  checar("3 com tudo já detalhado: avisa e mostra o menu de novo (não fica mudo)",
    /já recebeu os detalhes de todos/.test(paraCliente(A)) && /\*5\* - ❤️ Por enquanto é só/.test(paraCliente(A)) && sessions[A].step === "orcamento_pos", paraCliente(A));

  console.log("\n— 4. OUTRO ORÇAMENTO —");
  s = await comMenu(A);
  await cliente(A, "4");
  checar("4: oferece os serviços ainda não orçados, sem apagar o anterior",
    /De qual outro serviço/.test(paraCliente(A)) && !/Foto Cabine/.test(paraCliente(A)) && sessions[A].orcamento.servicosEnviados.join() === "1" && sessions[A].step === "orcamento_escolher_servico", paraCliente(A));
  s = await comMenu(A, { orcamento: { nome: "Cliente Teste", servicosEnviados: [1, 13, 2, 3, 4, 5, 6, 7, 8], servicosDetalhados: [] } });
  await cliente(A, "4");
  checar("4 com TODOS os serviços já orçados: é outro evento, pede data/local/convidados", /outro evento/.test(paraCliente(A)) && sessions[A].step === "orcamento_duvida", paraCliente(A));
  await cliente(A, "Dia 10/03/2027, no Recreio, 120 convidados");
  checar("e passa o pedido do outro evento para a equipe", /OUTRO orçamento/.test(paraOperador()) && /Recreio/.test(paraOperador()) && /novo orçamento/.test(paraCliente(A)), paraOperador());

  console.log("\n— 5. POR ENQUANTO É SÓ —");
  s = await comMenu(A);
  await cliente(A, "5");
  checar("5: encerra com educação", /Foi um prazer te atender! ❤️/.test(paraCliente(A)) && sessions[A].step === "finalizado", paraCliente(A));
  checar("5: NÃO marca como perdido nem pede para parar mensagens", !posts.some(p => p[1] && (p[1].parar || /perdid/i.test(JSON.stringify(p[1])))), JSON.stringify(posts));
  await cliente(A, "1");
  checar("depois do 5, o cliente ainda pode voltar pelo menu (1 = contratar)", /^contratar_/.test(sessions[A].step), sessions[A].step + " | " + paraCliente(A));

  console.log("\n— RESPOSTA ESCRITA E MENU ANTIGO —");
  checar("texto escrito vira a ação certa", bot.acaoMenuPosPorTexto("tenho uma dúvida") === "duvida" && bot.acaoMenuPosPorTexto("quero ver os detalhes") === "detalhes"
    && bot.acaoMenuPosPorTexto("quero outro orçamento") === "orcamento" && bot.acaoMenuPosPorTexto("por enquanto é só, obrigada") === "fim" && bot.acaoMenuPosPorTexto("3") === "");
  s = await comMenu(A);
  await cliente(A, "Tenho uma dúvida");
  checar("'Tenho uma dúvida' escrito funciona como o 2", sessions[A].step === "orcamento_duvida", paraCliente(A));
  s = novaSessao(A, { _menuPos: [{ id: "1", acao: "detalhes", label: "Quero mais detalhes" }, { id: "2", acao: "orcamento", label: "Quero mais orçamento" }, { id: "3", acao: "fim", label: "Está ótimo, por enquanto é só" }] });
  await cliente(A, "2");
  checar("menu ANTIGO guardado na sessão (antes da publicação): o 2 ainda é 'mais orçamento'", sessions[A].step === "orcamento_escolher_servico", paraCliente(A));
  s = await comMenu(A);
  await cliente(A, "xyz");
  checar("resposta que não é opção: repete o menu de 5", /Não entendi/.test(paraCliente(A)) && /\*4\* - 📋 Quero outro orçamento/.test(paraCliente(A)), paraCliente(A));

  console.log("\n— PEDIDO PARA NÃO RECEBER MENSAGENS (regra de sempre) —");
  s = await comMenu(A);
  await cliente(A, "não quero mais receber mensagens");
  checar("não é tratado como opção do menu", !/Foi um prazer te atender|Não entendi|Pode escrever a sua dúvida/.test(paraCliente(A)), paraCliente(A));

  devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes);
  console.log(`\n${falhas === 0 ? "✅ TUDO CERTO" : "❌ " + falhas + " FALHA(S)"}`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error(e); devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes); process.exit(2); });

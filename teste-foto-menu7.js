// teste-foto-menu7.js
// Pedido da Adriana (18/11/2026), regras do ChatGPT: convidado que recebeu o link pelo MENU 7 e
// manda algo SEM intencao clara recebe a pergunta "deseja baixar sua foto da festa X?";
// Sim = MESMA mensagem; Nao = menu inicial; pedido claro segue o fluxo normal; sem orcamento
// generico por abandono. Mesmo padrao do teste-cenarios-conversa.js (WhatsApp trocado por um
// gravador). NAO toca em producao. Rodar: node teste-foto-menu7.js  (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t)); return true; };
utils.sendOptionList = async (_c, t) => { registro.push("LISTA: " + String(t)); return true; };
utils.enviarPdfComLink = async () => { registro.push("PDF"); };
utils.gerarOrcamento = async () => ({ id: "T1", url: "https://exemplo/teste.pdf", total: 1 });
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => { registro.push("AVALIACOES"); };
const axios = require("axios");
axios.post = async () => ({ data: {} });
axios.get  = async () => ({ data: {} });

// um evento ativo (o PhotoMusic Pro falso)
const EVENTO = { numero: "1", id: 264, nome: "Inauguração Smart Fit Freguesia", titulo: "Smart Fit 17/11",
  links: [{ nome: "Galeria", link: "https://photomusic.com.br/galeria/abc123" }], token_evento: "tk" };
let eventosNoAr = [EVENTO];
const EVENTO2 = { numero: "2", id: 265, nome: "IPM 2026", titulo: "IPM", links: [], token_evento: "tk2" };
async function fetchFalso(url) {
  if (String(url).includes("eventos-chatbot")) return { ok: true, status: 200, statusText: "OK", text: async () => JSON.stringify(eventosNoAr) };
  return { ok: true, status: 200, statusText: "OK", json: async () => ({}), text: async () => "{}" };
}
global.fetch = fetchFalso;
// 🚨 o servico de eventos usa node-fetch: troca no cache ANTES de carregar o bot (nada vai a rede)
const caminhoNF = require.resolve("node-fetch");
require.cache[caminhoNF] = { id: caminhoNF, filename: caminhoNF, loaded: true, exports: fetchFalso };

const fs = require("fs");
const ARQ_SESSOES = require("path").join(__dirname, "sessions.json");
const sessoesAntes = fs.existsSync(ARQ_SESSOES) ? fs.readFileSync(ARQ_SESSOES, "utf8") : null;
function devolverSessoes() {
  if (sessoesAntes === null) { try { fs.unlinkSync(ARQ_SESSOES); } catch (e) {} }
  else fs.writeFileSync(ARQ_SESSOES, sessoesAntes, "utf8");
}

const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
let seq = 0, falhas = 0;
const TEL = "5521999990001";
async function diz(texto, tel = TEL) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: tel, text: { message: texto }, messageId: "m" + (++seq), fromMe: false, isGroup: false, momment: Date.now() });
  return registro.join("\n");
}
async function clica(titulo, id, tel) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: tel, text: { message: id }, listResponseMessage: { title: titulo, selectedRowId: id },
    messageId: "m" + (++seq), fromMe: false, isGroup: false, momment: Date.now() });
  return registro.join(String.fromCharCode(10));
}
function confere(ok, nome, saida) {
  console.log((ok ? "ok    " : "FALHOU") + "  " + nome);
  if (!ok) { falhas++; console.log("      saida: " + String(saida).slice(0, 400).replace(/\n/g, " | ")); }
}

(async () => {
  try {
    // chega pelo menu: oi -> 7 -> confirma
    await diz("oi");
    await diz("7");
    let s = await diz("1");
    confere(/aceite-de-fotos-e-videos\/\?t=tk/.test(s), "menu 7 entrega a mensagem com o link", s);
    confere(!!(sessions[TEL] && sessions[TEL].fotoMenu7), "a entrega fica guardada", JSON.stringify(sessions[TEL] && sessions[TEL].fotoMenu7));
    const primeira = s;

    // emoji por engano -> pergunta, nao menu
    s = await diz("😍");
    confere(/baixar novamente a sua foto da festa \*Inauguração Smart Fit Freguesia\*/.test(s), "emoji depois do link = pergunta das fotos (com o nome da festa)", s);
    confere(!/Escolha uma opção|Digite 1|orçamento/i.test(s.replace(/baixar novamente[^\n]*/,'')), "emoji NAO reabre o menu de boas-vindas", s);

    // SIM -> a mesma mensagem
    s = await diz("Sim, quero minhas fotos");
    const entregue = sessions[TEL].fotoMenu7.mensagem;
    confere(entregue.includes("t=tk") && s.includes(entregue) && primeira.includes(entregue), "Sim = reenvia a MESMA mensagem com o mesmo link", s);
    confere(sessions[TEL].menuInicialEnviado === false && sessions[TEL].step === "aguardando_opcao", "depois do Sim: sem menu armado (sem lembrete de orcamento)", JSON.stringify({ step: sessions[TEL].step, m: sessions[TEL].menuInicialEnviado }));

    // de novo um "oi" -> pergunta de novo; NAO -> menu inicial
    s = await diz("oi");
    confere(/baixar novamente a sua foto/.test(s), "nova mensagem sem intencao = pergunta de novo", s);
    s = await diz("não");
    confere(!/baixar novamente/.test(s) && /Seja bem-vindo/.test(s) && !s.includes("t=tk"), "Nao = menu inicial (sem reenviar o link)", s);
    confere(!sessions[TEL].fotoMenu7, "depois do Nao a entrega e esquecida", "");

    // 18/11 (Mario): QUALQUER mensagem depois do link pergunta, ate pedido claro; o pedido claro
    // e respeitado NA PERGUNTA (ele repete o pedido e segue o fluxo normal)
    const TEL2 = "5521999990002";
    await diz("oi", TEL2); await diz("7", TEL2); await diz("1", TEL2);
    s = await diz("quanto custa a cabine?", TEL2);
    confere(/baixar novamente/.test(s), "qualquer mensagem depois do link (ate pedido de valor) = pergunta", s);
    s = await diz("quanto custa a cabine?", TEL2);
    confere(!/baixar novamente/.test(s) && !sessions[TEL2].fotoMenu7, "na pergunta, o pedido de valor segue o fluxo normal", s);

    // responder outra coisa na pergunta = outro assunto
    const TEL3 = "5521999990003";
    await diz("oi", TEL3); await diz("7", TEL3); await diz("1", TEL3);
    await diz("👋", TEL3);
    s = await diz("quero um orçamento", TEL3);
    confere(!/baixar novamente/.test(s) && !sessions[TEL3].fotoMenu7 && sessions[TEL3].step !== "foto_menu7_confirmar", "na pergunta, pedido de outro assunto e respeitado", s + " step=" + sessions[TEL3].step);

    // 🐞 caso do Mario (18/11, 21:16): VARIOS eventos, link entregue, toca DE NOVO no evento da lista
    eventosNoAr = [EVENTO, EVENTO2];
    const TEL6 = "5521999990006";
    await diz("oi", TEL6); await diz("7", TEL6); await diz("1", TEL6);
    s = await diz("1", TEL6);                                   // escolhe o evento 1 na lista
    confere(s.includes("t=tk&"), "varios eventos: escolher o evento entrega o link", s);
    s = await clica(EVENTO.nome, "1", TEL6);                     // toca de novo no MESMO evento
    confere(/baixar novamente/.test(s) && !/Solicitar um orçamento|Seja bem-vindo|Está certo/.test(s), "tocar de novo no evento da lista = PERGUNTA (nao vira 'Solicitar orcamento')", s);
    s = await clica(EVENTO.nome, "1", TEL6);                     // toca no evento durante a pergunta = sim
    confere(s.includes("t=tk&") && sessions[TEL6].step === "aguardando_opcao", "tocar no evento durante a pergunta = reenvia o link", s);
    await diz("🙂", TEL6);                                        // pergunta de novo
    s = await clica(EVENTO2.nome, "2", TEL6);                    // toca em OUTRO evento durante a pergunta
    confere(s.includes("t=tk2&") && !/Seja bem-vindo|Está certo/.test(s), "tocar em outro evento durante a pergunta manda o link DELE", s);
    s = await diz("1", TEL6);                                    // digitar 1 depois do link
    confere(/baixar novamente/.test(s) && !/Solicitar um orçamento|Está certo/.test(s), "digitar 1 depois do link = pergunta (nao 'Solicitar orcamento')", s);
    s = await diz("1", TEL6);                                    // 1 na pergunta = sim
    confere(s.includes("t=tk2&"), "1 na pergunta = reenvia o link", s);
    eventosNoAr = [EVENTO];

    // validade: entrega de 4 dias atras nao pergunta mais
    const TEL4 = "5521999990004";
    await diz("oi", TEL4); await diz("7", TEL4); await diz("1", TEL4);
    sessions[TEL4].fotoMenu7.em = Date.now() - 4 * 24 * 60 * 60 * 1000;
    s = await diz("oi", TEL4);
    confere(!/baixar novamente/.test(s), "entrega com mais de 3 dias: fluxo normal", s);

    // o lembrete de orcamento NAO pega quem esta na pergunta
    const job = require("./jobs/lembreteOrcamento.js");
    const TEL5 = "5521999990005";
    await diz("oi", TEL5); await diz("7", TEL5); await diz("1", TEL5); await diz("😅", TEL5);
    sessions[TEL5].ultimaInteracao = Date.now() - 5 * 60 * 60 * 1000;
    registro.length = 0;
    try { if (typeof job.verificarLembretes === "function") await job.verificarLembretes(); } catch (e) { /* job opcional */ }
    confere(!registro.some((l) => /orçamento/i.test(l) && /TEXTO/.test(l) && l.includes("5521999990005")) && !registro.some((l) => /Vamos montar o seu orçamento/i.test(l)), "sem orcamento generico por abandono na pergunta", registro.join(" | "));
  } catch (e) {
    falhas++; console.log("ERRO: " + (e && e.stack));
  } finally {
    devolverSessoes();
    console.log(falhas ? "FALHOU: " + falhas : "tudo certo");
    process.exit(falhas ? 1 : 0);
  }
})();

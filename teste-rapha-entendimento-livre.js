// teste-rapha-entendimento-livre.js - casos reais de 13/11/2026 (NAZ)
// 1) Adrielen: "fechou uma contratacao" -> suporte direto, sem menu.
// 2) Sheila: "preco da foto tirinha?" -> mostra Cabine, Totem e Retro; "59 pessoas" dito antes e confirmado depois.
// 3) Sheila: "15112026" na data -> aceita como 15/11/2026.
// Rodar:  node teste-rapha-entendimento-livre.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t)); return true; };
utils.sendOptionList = async (_c, t) => { registro.push("LISTA: " + String(t)); return true; };
const axios = require("axios");
axios.post = async () => ({ data: {} });
axios.get  = async (_u, cfg) => ({ data: { status: "nao_encontrado", bairro: String((cfg && cfg.params && cfg.params.bairro) || ""), cidade: "" } });

const fs = require("fs");
const ARQ = require("path").join(__dirname, "sessions.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
const { estaPausado, retomarCliente } = require("./utils/pauseControl.js");
const ARQ_PAUSA = require("path").join(__dirname, "pausados.json");
const pausaAntes = fs.existsSync(ARQ_PAUSA) ? fs.readFileSync(ARQ_PAUSA, "utf8") : null;
const L = require("./utils/entendimentoLivre.js");

let falhas = 0, seq = 0;
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 300)}`); if (!ok) falhas++; }
let CHAT = "5521900000081";
const sess = () => sessions[CHAT] || {};
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "el-" + (++seq), text: { message: texto }, fromMe: false });
  return registro.join("\n");
}
function novo() { Object.keys(sessions).forEach(k => delete sessions[k]); CHAT = "55219000008" + String(10 + (++seq)).slice(-2); }

(async () => {
  console.log("--- funcoes puras ---");
  checar("ja contratou: 'fechou uma contratacao para o dia 28/11'", L.jaContratou("Eu sou a Adrielen que fechou uma contratação para o dia 28/11."));
  checar("ja contratou: 'ja contratei a cabine'", L.jaContratou("Oi, já contratei a cabine com vocês"));
  checar("ja contratou: 'tenho um evento contratado'", L.jaContratou("tenho um evento contratado em dezembro"));
  checar("ja contratou: 'meu contrato'", L.jaContratou("queria tirar uma dúvida sobre meu contrato"));
  checar("NAO: 'quero contratar a cabine'", !L.jaContratou("quero contratar a cabine"));
  checar("NAO: 'nunca contratei'", !L.jaContratou("nunca contratei vocês, quanto custa?"));
  checar("NAO: 'estou em processo de contratacao' (e a opcao 3)", !L.jaContratou("estou em processo de contratação"));
  checar("NAO: 'contratacao de DJ'", !L.jaContratou("valor para contratação de DJ"));
  checar("NAO: 'quanto custa a cabine'", !L.jaContratou("quanto custa a cabine?"));
  checar("tirinha: 'foto tirinha'", L.mencionaTirinha("Bom dia qual o preço da foto tirinha?"));
  checar("tirinha: 'fotos em tira'", L.mencionaTirinha("vocês fazem fotos em tira?"));
  checar("NAO tirinha: 'cabine'", !L.mencionaTirinha("quanto é a cabine"));
  checar("escolha '1' = Cabine", JSON.stringify(L.escolhaTirinha("1")) === "[1]", JSON.stringify(L.escolhaTirinha("1")));
  checar("escolha '1 e 3' = Cabine + Retro", JSON.stringify(L.escolhaTirinha("1 e 3")) === "[1,13]", JSON.stringify(L.escolhaTirinha("1 e 3")));
  checar("escolha '23' = Totem + Retro", JSON.stringify(L.escolhaTirinha("23")) === "[2,13]");
  checar("escolha 'todos' = os 3", JSON.stringify(L.escolhaTirinha("todos")) === "[1,2,13]");
  checar("escolha 'os tres' = os 3", JSON.stringify(L.escolhaTirinha("os três")) === "[1,2,13]");
  checar("escolha 'totem retro' = Retro", JSON.stringify(L.escolhaTirinha("totem retrô")) === "[13]");
  checar("escolha 'o totem' = Totem Fotografico", JSON.stringify(L.escolhaTirinha("o totem")) === "[2]");
  checar("escolha '5' = nao entendeu", L.escolhaTirinha("5") === null);
  checar("escolha '4' = TODOS", JSON.stringify(L.escolhaTirinha("4")) === "[1,2,13]");
  checar("escolha '1,2' = Cabine + Totem", JSON.stringify(L.escolhaTirinha("1,2")) === "[1,2]");
  checar("escolha '123' = os 3", JSON.stringify(L.escolhaTirinha("123")) === "[1,2,13]");
  checar("escolha '13' = Cabine + Retro", JSON.stringify(L.escolhaTirinha("13")) === "[1,13]");
  checar("escolha '1,3' = Cabine + Retro", JSON.stringify(L.escolhaTirinha("1,3")) === "[1,13]");
  checar("escolha '0' = nao entendeu", L.escolhaTirinha("0") === null);
  console.log("--- Totem Retro junto (Mario, 13/11) ---");
  const RJ = (ids, clb) => JSON.stringify(L.comRetroSugerido(ids, clb));
  checar("pediu Totem Fotografico -> + Totem Retro logo depois", RJ([2], 1) === "[2,13]", RJ([2], 1));
  checar("Totem + 360 -> Retro entra depois do Totem", RJ([2, 3], 5) === "[2,13,3]", RJ([2, 3], 5));
  checar("Cabine num CASAMENTO -> + Totem Retro", RJ([1], 2) === "[1,13]", RJ([1], 2));
  checar("Cabine + 360 num casamento -> Retro depois da Cabine", RJ([1, 3], 2) === "[1,13,3]", RJ([1, 3], 2));
  checar("Cabine em 15 anos -> NAO inclui", RJ([1], 1) === "[1]", RJ([1], 1));
  checar("Cabine sem celebracao (preliminar) -> NAO inclui", RJ([1], null) === "[1]", RJ([1], null));
  checar("ja pediu o Retro -> nao duplica", RJ([2, 13], 2) === "[2,13]", RJ([2, 13], 2));
  checar("so 360 -> nada muda", RJ([3], 2) === "[3]", RJ([3], 2));
  checar("mensagem fala da novidade", /Totem Retrô/.test(L.MSG_RETRO_SUGERIDO) && /novidade/.test(L.MSG_RETRO_SUGERIDO));

  checar("data '15112026' -> 15/11/2026",L.dataSoNumeros("15112026") === "15/11/2026");
  checar("data '151126' -> 15/11/26", L.dataSoNumeros("151126") === "15/11/26");
  checar("data '15 11 2026' -> 15/11/2026", L.dataSoNumeros("15 11 2026") === "15/11/2026");
  checar("'80' nao vira data", L.dataSoNumeros("80") === null);
  const pd = bot.parsearDataFlex || null;
  if (pd) {
    checar("parsearDataFlex('15112026') = 15/11/2026", (pd("15112026") || {}).str === "15/11/2026", JSON.stringify(pd("15112026")));
    checar("parsearDataFlex('11152026') (ordem errada) = invalida", pd("11152026") === null, JSON.stringify(pd("11152026")));
    checar("parsearDataFlex('32112026') = invalida", pd("32112026") === null);
    checar("parsearDataFlex('15/11/2026') continua igual", (pd("15/11/2026") || {}).str === "15/11/2026");
  }

  console.log("--- caso Adrielen: ja contratou ---");
  novo();
  retomarCliente(CHAT); retomarCliente(CHAT.replace(/\D/g, ""));
  let r = await cliente("Bom dia.\nEu sou a Adrielen que fechou uma contratação para o dia 28/11.");
  checar("NAO manda o menu de boas-vindas", !/Solicitar um orçamento/.test(r), r);
  checar("responde como suporte de quem ja contratou", /já tem um serviço contratado/.test(r), r);
  checar("passa para o atendimento humano (pausa o bot)", estaPausado(CHAT) || estaPausado(CHAT.replace(/\D/g, "")), "nao pausou");

  console.log("--- caso Sheila: tirinha + 59 pessoas + data so numeros ---");
  novo();
  r = await cliente("Bom dia qual o preço da foto tirinha?");
  checar("pergunta qual dos 3 servicos da tirinha", sess().step === "escolher_tirinha" && /Foto Cabine/.test(r) && /Totem Fotográfico/.test(r) && /Totem Retrô/.test(r) && /\*4\* - \*TODOS\*/.test(r), sess().step + " | " + r);
  r = await cliente("qualquer coisa");
  checar("resposta que nao e opcao: repete as 3 opcoes", sess().step === "escolher_tirinha" && /Responda com o número/.test(r), r);
  r = await cliente("1 e 3");
  checar("escolheu 1 e 3: abre o questionario com Cabine + Retro", sess().step === "orcamento_nome" && JSON.stringify((sess().orcamento || {}).servicosPrevios) === "[1,13]", sess().step + " " + JSON.stringify(sess().orcamento));
  r = await cliente("Evento aproximadamente 59 pessoas");
  checar("convidados ditos fora de hora ficam guardados (59)", (sess().dadosLivres || {}).convidados === 59, JSON.stringify(sess().dadosLivres));
  console.log("   (passo depois do texto solto: " + sess().step + ")");

  // segue o questionario ate a pergunta dos convidados
  const roteiro = ["Sheila", "1", "9", "Aniversário igreja"];
  for (const t of roteiro) {
    if (sess().step === "orcamento_convidados_confirmar" || sess().step === "orcamento_convidados") break;
    r = await cliente(t);
    console.log(`   "${t}" -> ${sess().step}`);
  }
  checar("na pergunta dos convidados: CONFIRMA os 59 (nao pergunta de novo)", sess().step === "orcamento_convidados_confirmar" && /59 convidados/.test(r), sess().step + " | " + r);
  r = await cliente("1");
  checar("confirmou: 59 gravado e segue (Outros pergunta os dias)", (sess().orcamento || {}).convidados === 59 && sess().step === "orcamento_dias", sess().step + " " + JSON.stringify(sess().orcamento));
  r = await cliente("1");
  checar("1 dia: pergunta a data", sess().step === "orcamento_data", sess().step + " | " + r);
  r = await cliente("15112026");
  checar("'15112026' aceito como 15/11/2026", !/Data inválida/.test(r) && (sess().orcamento || {}).data === "15/11/2026", sess().step + " " + (sess().orcamento || {}).data + " | " + r);

  console.log("--- convidados: texto sem numero ---");
  novo();
  await cliente("Oi");
  await cliente("quanto custa a cabine?");
  for (const t of ["Joana", "1", "1"]) {
    if (sess().step === "orcamento_convidados") break;
    await cliente(t);
  }
  if (sess().step === "orcamento_convidados") {
    r = await cliente("ok");
    checar("texto sem numero: aviso diz o que fazer, com exemplo", /Não entendi a quantidade/.test(r) && /ex\.:/.test(r), r);
    r = await cliente("70");
    checar("depois digita 70: grava", (sess().orcamento || {}).convidados === 70, JSON.stringify(sess().orcamento));
  } else {
    checar("chegou na pergunta dos convidados", false, sess().step);
  }

  if (pausaAntes !== null) fs.writeFileSync(ARQ_PAUSA, pausaAntes);
  if (antes !== null) fs.writeFileSync(ARQ, antes); else if (fs.existsSync(ARQ)) fs.unlinkSync(ARQ);
  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ tudo certo");
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

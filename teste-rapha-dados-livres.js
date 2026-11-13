// teste-rapha-dados-livres.js - data e bairro ditos em texto livre ficam guardados e so sao CONFIRMADOS depois (13/11/2026)
// Caso real do Mario (13/11 02h19): "Voces tem vaga para o dia 27 de novembro? Esse mes! Ilha do governador".
// O plugin e simulado. Rodar:  node teste-rapha-dados-livres.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t)); return true; };
utils.sendOptionList = async (_c, t) => { registro.push("LISTA: " + String(t)); return true; };
const axios = require("axios");
axios.post = async () => ({ data: {} });
// /deslocamento-consultar: so a Ilha do Governador e conhecida (sugestao do Google, nome igual ao digitado)
axios.get = async (_u, cfg) => {
  const b = String((cfg && cfg.params && cfg.params.bairro) || "");
  if (/^ilha do governador$/i.test(b)) return { data: { status: "nao_encontrado", bairro: b, cidade: "", sugestao_cidade: { bairro: "Ilha do Governador", cidade: "Rio de Janeiro" } } };
  return { data: { status: "nao_encontrado", bairro: b, cidade: "" } };
};

const fs = require("fs");
const ARQ = require("path").join(__dirname, "sessions.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");

let falhas = 0, seq = 0;
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 260)}`); if (!ok) falhas++; }
let CHAT = "5521900000071";
const sess = () => sessions[CHAT] || {};
const todas = [];
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "dl-" + (++seq), text: { message: texto }, fromMe: false });
  const r = registro.join("\n"); todas.push(r); return r;
}
async function ate(roteiro) { for (const t of roteiro) await cliente(t); }
function novo() { Object.keys(sessions).forEach(k => delete sessions[k]); todas.length = 0; CHAT = "55219000007" + String(10 + (++seq)).slice(-2); }

(async () => {
  novo();
  await cliente("Boa noite");
  await cliente("Boa noite vocês estão com promoção na black Friday");
  checar("conversa sem data nem lugar: nada é guardado", !sess().dadosLivres || (!sess().dadosLivres.data && !sess().dadosLivres.bairro), JSON.stringify(sess().dadosLivres));
  await cliente("Vocês tem vaga para o dia 27 de novembro ? Esse mês! Ilha do governador");
  const dl = sess().dadosLivres || {};
  checar("guarda a DATA dita em texto livre (27/11)", /^27\/11\/\d{4}$/.test(dl.data || ""), JSON.stringify(dl));
  checar("guarda o BAIRRO e a cidade (Ilha do Governador, Rio de Janeiro)", dl.bairro === "Ilha do Governador" && dl.cidade === "Rio de Janeiro", JSON.stringify(dl));

  await cliente("Queria saber o valor da foto cabine");
  checar("abre o questionário com o serviço dito", sess().step === "orcamento_nome", sess().step);
  await ate(["Mario", "1", "1", "4", "100"]);
  checar("na pergunta da data: CONFIRMA a data que ele disse (não pergunta de novo)", sess().step === "orcamento_data_confirmar" && /27\/11/.test(todas[todas.length - 1]), sess().step + " | " + todas[todas.length - 1]);
  await cliente("1");
  checar("confirmou: a data fica gravada e segue para o horário", sess().step === "orcamento_hora_inicio" && /^27\/11\/\d{4}$/.test(sess().orcamento.data || ""), sess().step + " " + sess().orcamento.data);
  await cliente("19h as 23h");
  checar("na pergunta do bairro: CONFIRMA o que ele disse", sess().step === "orcamento_bairro_confirmar" && /Ilha do Governador/.test(todas[todas.length - 1]) && /Rio de Janeiro/.test(todas[todas.length - 1]), sess().step + " | " + todas[todas.length - 1]);
  await cliente("1");
  checar("confirmou: bairro e cidade gravados e vai ao salão", sess().step === "orcamento_salao" && sess().orcamento.bairro === "Ilha do Governador" && sess().orcamento.cidade === "Rio de Janeiro", JSON.stringify(sess().orcamento));

  // recusou: a pergunta normal segue
  novo();
  await ate(["oi", "Vocês tem vaga para o dia 27 de novembro ? Esse mês! Ilha do governador", "Queria saber o valor da foto cabine", "Mario", "1", "1", "4", "100"]);
  await cliente("2");
  checar("'Outra data': pergunta a data normalmente", sess().step === "orcamento_data" && /Qual a data/.test(todas[todas.length - 1]), sess().step);
  await ate(["30/11/2026", "19h as 23h"]);
  await cliente("2");
  checar("'Outro bairro': pergunta o bairro normalmente", sess().step === "orcamento_bairro" && /Qual o \*bairro\*/.test(todas[todas.length - 1]), sess().step);

  // a pessoa digita a data direto em vez de tocar no botao
  novo();
  await ate(["oi", "Vocês tem vaga para o dia 27 de novembro ? Esse mês! Ilha do governador", "Queria saber o valor da foto cabine", "Mario", "1", "1", "4", "100"]);
  await cliente("30/11/2026");
  checar("digitou outra data em vez de tocar: a data digitada vale", sess().step === "orcamento_hora_inicio" && sess().orcamento.data === "30/11/2026", sess().step + " " + sess().orcamento.data);

  if (antes === null) { try { fs.unlinkSync(ARQ); } catch (e) {} } else fs.writeFileSync(ARQ, antes, "utf8");
  console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error("💥", e); process.exit(1); });

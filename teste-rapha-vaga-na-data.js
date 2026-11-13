// teste-rapha-vaga-na-data.js - "tem vaga no dia X?" consulta a agenda do PhotoMusic Pro e responde (13/11/2026)
// Caso real do Mario (02h19): "Voces tem vaga para o dia 27 de novembro? Esse mes! Ilha do governador" dava "Opcao invalida".
// O plugin e simulado. Rodar:  node teste-rapha-vaga-na-data.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t)); return true; };
utils.sendOptionList = async (_c, t) => { registro.push("LISTA: " + String(t)); return true; };
const axios = require("axios");
axios.post = async () => ({ data: {} });
const chamadas = [];
let estado = "livre", falhar = false;
const TEXTOS = {
  livre:  { estado: "livre",  titulo: "Temos disponibilidade para essa data", texto: "Boa notícia: podemos atender o seu evento nesse dia. A data só fica reservada de verdade com o contrato assinado." },
  ultima: { estado: "ultima", titulo: "Temos disponibilidade, e é a última para essa data", texto: "Ainda podemos atender o seu evento nesse dia, e é a última disponibilidade que temos." },
  lotada: { estado: "lotada", titulo: "Não temos disponibilidade para essa data", texto: "Nesse dia já estamos comprometidos. Ainda assim, fale com a gente." },
};
axios.get = async (url, cfg) => {
  if (/data-livre/.test(url)) {
    chamadas.push(cfg.params);
    if (falhar) throw new Error("fora do ar");
    return { data: TEXTOS[typeof estado === "function" ? estado(cfg.params) : estado] };
  }
  return { data: { status: "nao_encontrado" } };   // bairro etc.
};

const fs = require("fs");
const ARQ = require("path").join(__dirname, "sessions.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");

let falhas = 0, seq = 0;
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 260)}`); if (!ok) falhas++; }
let CHAT = "5521900000081";
const sess = () => sessions[CHAT] || {};
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "vg-" + (++seq), text: { message: texto }, fromMe: false });
  return registro.join("\n");
}
async function novo() { Object.keys(sessions).forEach(k => delete sessions[k]); CHAT = "55219000008" + String(10 + (++seq)).slice(-2); chamadas.length = 0; await cliente("oi"); chamadas.length = 0; }

(async () => {
  await novo(); estado = "livre"; falhar = false;
  let r = await cliente("Vocês tem vaga para o dia 27 de novembro ? Esse mês! Ilha do governador");
  checar("responde a disponibilidade em vez de 'Opção inválida'", /Temos disponibilidade/.test(r) && !/Opção inválida/.test(r), r);
  checar("mostra a data e convida a pedir o orçamento", /27\/11\/\d{4}/.test(r) && /digitar \*1\*/.test(r), r);
  checar("consultou a agenda UMA vez, com a data certa e sem serviço", chamadas.length === 1 && /^27\/11\/\d{4}$/.test(chamadas[0].data) && chamadas[0].servico === "", JSON.stringify(chamadas));
  checar("continua no menu (o 1 começa o orçamento) e ainda guardou data e bairro", sess().step === "aguardando_opcao" && sess().dadosLivres && /27\/11/.test(sess().dadosLivres.data || ""), sess().step + " " + JSON.stringify(sess().dadosLivres));

  await novo(); estado = (p) => p.servico === "foto-cabine" ? "ultima" : "livre";
  r = await cliente("tem vaga pra foto cabine dia 27/11?");
  checar("com serviço citado: consulta POR SERVIÇO (foto-cabine)", chamadas.length === 1 && chamadas[0].servico === "foto-cabine", JSON.stringify(chamadas));
  checar("'última disponibilidade' é dita sem contar a agenda", /última/.test(r) && !/evento marcado|eventos marcados/i.test(r), r);

  await novo(); estado = "lotada";
  r = await cliente("vocês estão livres dia 27/11?");
  checar("data lotada: diz que não há disponibilidade e convida a falar com a equipe", /Não temos disponibilidade/.test(r) && /fale com a gente/i.test(r), r);

  await novo(); estado = (p) => p.servico === "foto-cabine" ? "livre" : "lotada";
  r = await cliente("tem vaga para foto cabine e plataforma 360 dia 27/11?");
  checar("2 serviços: consulta cada um e mostra o resultado por serviço", chamadas.length === 2 && /Foto Cabine/.test(r) && /Plataforma 360/.test(r), JSON.stringify(chamadas) + " | " + r);

  await novo(); falhar = true; estado = "livre";
  r = await cliente("tem vaga para o dia 27/11?");
  checar("plugin fora do ar: NÃO inventa disponibilidade (cai no fluxo de sempre)", !/Temos disponibilidade/.test(r) && /Opção inválida/.test(r), r);

  await novo(); falhar = false;
  r = await cliente("quero foto cabine para o dia 27/11");
  checar("sem palavra de disponibilidade: NÃO consulta a agenda", chamadas.length === 0 && !/Temos disponibilidade/.test(r), JSON.stringify(chamadas));

  await novo();
  r = await cliente("tem vaga para o dia 01/01/2020?");
  checar("data no passado: NÃO consulta", chamadas.length === 0, JSON.stringify(chamadas));

  if (antes === null) { try { fs.unlinkSync(ARQ); } catch (e) {} } else fs.writeFileSync(ARQ, antes, "utf8");
  console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error("💥", e); process.exit(1); });

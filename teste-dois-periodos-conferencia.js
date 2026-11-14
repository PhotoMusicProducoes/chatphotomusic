// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-dois-periodos-conferencia.js
// Dois horários no mesmo dia (corporativo): o 2º tem de começar DEPOIS do 1º (14/11/2026, RJN).
// Caso real (orçamento 705): 1º 14:00 às 20:00, cliente deu 2º 10:00 às 20:00 e o PDF cobrou 16 horas.
// Dirige o handleIncomingMessage REAL com o WhatsApp trocado por um gravador. Não toca em produção.
// Rodar:  node teste-dois-periodos-conferencia.js   (conferir o CÓDIGO DE SAÍDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push(String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendButtonList = async (_c, t) => { registro.push(String(t)); return true; };
utils.sendOptionList = async (_c, t) => { registro.push(String(t)); return true; };
utils.sendFileByUrl  = async () => true;
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
const axios = require("axios");
axios.post = async () => ({ data: {} });
axios.get  = async () => ({ data: {} });

const fs = require("fs");
const path = require("path");
const ARQ = path.join(__dirname, "sessions.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");

let falhas = 0, seq = 0;
const CHAT = "5521900007050";
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 400)}`); if (!ok) falhas++; }
const sess = () => sessions[CHAT] || {};
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "dp-" + (++seq), text: { message: texto }, fromMe: false });
  return registro.join("\n");
}
function noSegundoHorario(ini = "14:00", fim = "20:00") {
  Object.keys(sessions).forEach(k => delete sessions[k]);
  sessions[CHAT] = { step: "orcamento_periodo2_inicio", menuInicialEnviado: true, clienteEscreveuTexto: true, servicosEnviados: [],
    orcamento: { nome: "Cliente Teste", perfil: "empresa", celebracaoId: 8, celebracao: "Evento Corporativo", convidados: 53,
      data: "29/11/2026", horaInicio: ini, horaFim: fim, horas: 6, servicosEnviados: [] } };
}

(async () => {
  console.log("--- o caso do orçamento 705 ---");
  noSegundoHorario();
  let r = await cliente("10:00");
  checar("2º às 10:00 com o 1º das 14:00 às 20:00: RECUSA e explica", /precisa começar depois das 20:00/.test(r) && sess().step === "orcamento_periodo2_inicio" && !sess().orcamento.horaInicio2, sess().step + " | " + r);
  r = await cliente("20:00");
  checar("2º começando na mesma hora em que o 1º termina: recusa", sess().step === "orcamento_periodo2_inicio", r);
  r = await cliente("21:00");
  checar("2º às 21:00: aceita e pergunta o término", sess().step === "orcamento_periodo2_fim" && sess().orcamento.horaInicio2 === "21:00", r);
  r = await cliente("21:00");
  checar("término igual ao início do 2º: recusa", sess().step === "orcamento_periodo2_fim" && !sess().orcamento.periodos, r);
  r = await cliente("23:00");
  checar("2º 21:00 às 23:00: grava os dois horários e segue para o bairro",
    JSON.stringify(sess().orcamento.periodos) === JSON.stringify([{ inicio: "14:00", fim: "20:00" }, { inicio: "21:00", fim: "23:00" }]) && sess().step === "orcamento_bairro", JSON.stringify(sess().orcamento.periodos));
  checar("a tela de confirmação do cliente mostra os dois horários",
    bot.valorCampoResumo(sess().orcamento, "hora_ini") === "1º 14:00 às 20:00 | 2º 21:00 às 23:00" && bot.valorCampoResumo(sess().orcamento, "hora_fim") === "(dois horários, acima)", bot.valorCampoResumo(sess().orcamento, "hora_ini"));

  console.log("--- quem se confundiu: um horário só ---");
  noSegundoHorario();
  r = await cliente("um horário só");
  checar("'um horário só': desfaz o 2º e segue com 14:00 às 20:00", /um horário só/.test(r) && !sess().orcamento.periodos && sess().step === "orcamento_bairro", sess().step + " | " + r);
  noSegundoHorario();
  r = await cliente("não");
  checar("'não': também vira um horário só", !sess().orcamento.periodos && sess().step === "orcamento_bairro", sess().step);

  console.log("--- 1º horário que vira a noite ---");
  checar("1º 22:00 às 02:00: 2º às 10:00 serve, às 23:00 não",
    bot.segundoPeriodoDepoisDoPrimeiro({ horaInicio: "22:00", horaFim: "02:00" }, "10:00") === true &&
    bot.segundoPeriodoDepoisDoPrimeiro({ horaInicio: "22:00", horaFim: "02:00" }, "23:00") === false);
  checar("manhã e noite (08:30 às 11:00 + 20:30) continua aceito", bot.segundoPeriodoDepoisDoPrimeiro({ horaInicio: "08:30", horaFim: "11:00" }, "20:30") === true);

  console.log("--- correção do horário no resumo ---");
  const o = { horaInicio: "14:00", horaFim: "20:00", periodos: [{ inicio: "14:00", fim: "20:00" }, { inicio: "10:00", fim: "20:00" }], horaInicio2: "10:00", horaFim2: "20:00" };
  checar("sem dois horários: tela mostra o início normal", bot.valorCampoResumo({ horaInicio: "14:00", horaFim: "20:00" }, "hora_ini") === "14:00");
  const fonte = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  checar("corrigir início ou término no resumo desfaz o 2º horário antigo",
    /orc\.horaInicio = h; desfazerSegundoPeriodo\(orc\)/.test(fonte) && /orc\.horaFim = h; desfazerSegundoPeriodo\(orc\)/.test(fonte));
  checar("o resumo do operador mostra os dois horários", /Horários \(2 no mesmo dia\)/.test(fonte));
  void o;

  if (antes !== null) fs.writeFileSync(ARQ, antes); else if (fs.existsSync(ARQ)) fs.unlinkSync(ARQ);
  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ TUDO CERTO");
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-periodo-servico.js
// Evento de 7h ou mais: "evento todo ou um período menor?" (Mario, 14/11/2026, caso Roberta / orçamento 705).
// Menos de 7h: fica como hoje. Dirige o handleIncomingMessage REAL com o WhatsApp trocado por um gravador.
// Rodar:  node teste-periodo-servico.js   (conferir o CÓDIGO DE SAÍDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push(String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendButtonList = async (_c, t, o) => { registro.push(String(t) + " " + JSON.stringify((o || []).map(x => x.label))); return true; };
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
const CHAT = "5521900007051";
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 400)}`); if (!ok) falhas++; }
const sess = () => sessions[CHAT] || {};
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "ps-" + (++seq), text: { message: texto }, fromMe: false });
  return registro.join("\n");
}
// cliente na pergunta do horário de início (corporativo = 8, social = 5)
function noHorario(celebracaoId = 8) {
  Object.keys(sessions).forEach(k => delete sessions[k]);
  sessions[CHAT] = { step: "orcamento_hora_inicio", menuInicialEnviado: true, clienteEscreveuTexto: true, servicosEnviados: [],
    orcamento: { nome: "Cliente Teste", perfil: celebracaoId === 8 ? "empresa" : "social", celebracaoId, convidados: 53, data: "29/11/2026", servicosEnviados: [] } };
}
const PERG = /Você quer o serviço durante o \*evento todo\* ou em \*um período menor\*/;

(async () => {
  console.log("--- o caso da Roberta: evento 10h às 20h, serviço de 4h ---");
  noHorario(8);
  await cliente("10h");
  let r = await cliente("20h");
  checar("evento de 10 horas: pergunta evento todo x período menor (com botões)", PERG.test(r) && /O evento todo/.test(r) && /Um período menor/.test(r) && sess().step === "orcamento_periodo_servico", sess().step + " | " + r);
  r = await cliente("2");
  checar("período menor: pede o horário do serviço, lembrando o do evento", /De que horas a que horas você quer o serviço\? O evento vai das \*10:00\* às \*20:00\*/.test(r) && sess().step === "orcamento_periodo_servico_horario", r);
  r = await cliente("14h às 18h");
  const o = sess().orcamento;
  checar("serviço 14:00 às 18:00: o orçamento vai com 4 horas", o.horaInicio === "14:00" && o.horaFim === "18:00" && o.horas === 4, JSON.stringify(o));
  checar("o horário do evento fica guardado (10:00 às 20:00)", o.horarioEvento && o.horarioEvento.inicio === "10:00" && o.horarioEvento.fim === "20:00", JSON.stringify(o.horarioEvento));
  checar("confirma ao cliente e segue para o bairro (sem a pergunta dos 2 horários)", /o serviço será das \*14:00\* às \*18:00\* \(\*4 horas\*\)/.test(r) && sess().step === "orcamento_bairro" && !/dois horários/.test(r), sess().step + " | " + r);
  checar("a confirmação do cliente mostra serviço e evento", /14:00 \(serviço; evento das 10:00 às 20:00\)/.test(bot.valorCampoResumo(o, "hora_ini")), bot.valorCampoResumo(o, "hora_ini"));

  console.log("--- outras respostas ---");
  noHorario(8); await cliente("10h"); await cliente("20h");
  r = await cliente("1");
  checar("evento todo: mantém as 10 horas e segue (corporativo ainda pergunta os 2 horários)", sess().orcamento.horas === 10 && !sess().orcamento.horarioEvento && sess().step === "orcamento_2_periodos", sess().step);
  noHorario(5); await cliente("10h"); await cliente("20h");
  r = await cliente("1");
  checar("festa social, evento todo: segue direto para o bairro", sess().step === "orcamento_bairro" && sess().orcamento.horas === 10, sess().step);
  noHorario(8); await cliente("10h"); await cliente("20h"); await cliente("2");
  r = await cliente("8h às 12h");
  checar("serviço fora do evento (8h às 12h num evento das 10h às 20h): recusa e pergunta de novo", /precisa ficar dentro do horário do evento/.test(r) && sess().step === "orcamento_periodo_servico_horario" && sess().orcamento.horaInicio === "10:00", r);
  r = await cliente("15h");
  checar("só o início: pergunta o término", sess().step === "orcamento_periodo_servico_fim", r);
  r = await cliente("19h");
  checar("e grava 15:00 às 19:00", sess().orcamento.horaInicio === "15:00" && sess().orcamento.horaFim === "19:00" && sess().orcamento.horas === 4 && sess().step === "orcamento_bairro", JSON.stringify(sess().orcamento));
  noHorario(8); await cliente("10h"); await cliente("20h"); await cliente("2");
  r = await cliente("evento todo");
  checar("mudou de ideia no meio ('evento todo'): mantém o evento inteiro", sess().orcamento.horas === 10 && !sess().orcamento.horarioEvento && sess().step === "orcamento_2_periodos", sess().step);

  console.log("--- menos de 7 horas: como hoje ---");
  noHorario(8); await cliente("14h");
  r = await cliente("20h");
  checar("evento de 6 horas: NÃO pergunta o período do serviço", !PERG.test(r) && sess().step === "orcamento_2_periodos", sess().step + " | " + r);
  noHorario(5);
  r = await cliente("18h às 23h");
  checar("festa de 5 horas dita de uma vez: vai direto ao bairro", !PERG.test(r) && sess().step === "orcamento_bairro", sess().step);
  noHorario(5);
  r = await cliente("15h às 23h");
  checar("festa de 8 horas dita de uma vez: também pergunta", PERG.test(r) && sess().step === "orcamento_periodo_servico", sess().step);
  noHorario(5); await cliente("13h");
  r = await cliente("20h");
  checar("exatamente 7 horas: pergunta", PERG.test(r), r);

  console.log("--- regra de dentro do evento ---");
  const ev = { horaInicio: "10:00", horaFim: "20:00" };
  checar("14-18 dentro; 10-20 (igual ao evento) não; 18-22 não", bot.servicoDentroDoEvento(ev, "14:00", "18:00") && !bot.servicoDentroDoEvento(ev, "10:00", "20:00") && !bot.servicoDentroDoEvento(ev, "18:00", "22:00"));
  checar("evento que vira a madrugada (20h às 04h): 23h às 02h dentro", bot.servicoDentroDoEvento({ horaInicio: "20:00", horaFim: "04:00" }, "23:00", "02:00"));
  const lemb = fs.readFileSync(path.join(__dirname, "jobs/lembreteOrcamento.js"), "utf8");
  checar("o lembrete conhece os passos novos (lead não some)", ["orcamento_periodo_servico", "orcamento_periodo_servico_horario", "orcamento_periodo_servico_fim"].every(p => lemb.includes(`"${p}"`)));

  if (antes !== null) fs.writeFileSync(ARQ, antes); else if (fs.existsSync(ARQ)) fs.unlinkSync(ARQ);
  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ TUDO CERTO");
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

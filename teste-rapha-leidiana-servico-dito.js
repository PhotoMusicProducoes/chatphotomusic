// teste-rapha-leidiana-servico-dito.js - Quem JA DISSE o servico nao escolhe de novo, mas passa os dados do evento
// (caso Leidiana, 12/11/2026: ela escreveu "qual o valor da foto lembranca e da foto cabine"; o bot mandou o
// orcamento-base na hora e as respostas dela, "80 pessoas" e "4 horas", se perderam e viraram "Seu nome e 80 Pessoas?").
//
// Rodar:  node teste-rapha-leidiana-servico-dito.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t, o) => { registro.push("BOTOES: " + String(t) + " " + JSON.stringify(o || [])); return true; };
utils.sendOptionList = async (_c, t, o) => { registro.push("LISTA: " + String(t) + " " + JSON.stringify(o || [])); return true; };
utils.enviarPdfComLink = async () => { registro.push("PDF"); };
utils.gerarOrcamento = async () => ({ id: "T1", url: "https://exemplo/teste.pdf", total: 1 });
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => { registro.push("AVALIACOES"); };
const axios = require("axios");
axios.post = async () => ({ data: {} });
axios.get  = async () => ({ data: {} });

const fs = require("fs");
const ARQ_SESSOES = require("path").join(__dirname, "sessions.json");
const sessoesAntes = fs.existsSync(ARQ_SESSOES) ? fs.readFileSync(ARQ_SESSOES, "utf8") : null;
function devolverSessoes() {
  if (sessoesAntes === null) { try { fs.unlinkSync(ARQ_SESSOES); } catch (e) {} }
  else fs.writeFileSync(ARQ_SESSOES, sessoesAntes, "utf8");
}

const bot = require("./index.js");
const { sessions } = require("./utils/sessions");

let falhas = 0, seq = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + String(detalhe).slice(0, 300)}`);
  if (!ok) falhas++;
}
const CHAT = "5521900000051";
const sess = () => sessions[CHAT] || {};
const todas = [];
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "ld-" + (++seq), text: { message: texto }, fromMe: false });
  const r = registro.join("\n");
  todas.push(r);
  return r;
}

(async () => {
  Object.keys(sessions).forEach(k => delete sessions[k]);
  await cliente("oi");
  const r = await cliente("Boa noite, qual o valor da foto lembranca e da foto cabine");
  checar("NÃO manda o orçamento-base na hora (sem PDF, sem avaliações, sem fotos)", !/PDF|ARQUIVO|AVALIACOES|orçamento base/.test(r), r);
  checar("reconhece os 2 serviços e abre o questionário pedindo o nome", /Foto Cabine/.test(r) && /Foto Lembrança/.test(r) && sess().step === "orcamento_nome", sess().step + " | " + r.slice(0, 200));
  checar("os 2 serviços já estão anotados (não precisa escolher)", (sess().orcamento.servicosPrevios || []).length === 2, JSON.stringify(sess().orcamento.servicosPrevios));

  await cliente("80 pessoas");
  checar("'80 pessoas' NÃO vira nome", sess().step === "orcamento_nome" && !sess().orcamento.nome, JSON.stringify(sess().orcamento.nome));
  await cliente("4 horas");
  checar("'4 horas' também não", sess().step === "orcamento_nome" && !sess().orcamento.nome);

  await cliente("Leidiana");
  checar("com o nome certo, pergunta o perfil", sess().step === "orcamento_perfil" && sess().orcamento.nome === "Leidiana", sess().step);
  await cliente("1");
  const rConf = todas[todas.length - 1];
  checar("NÃO pergunta quais serviços: vai à confirmação dos 2 que ela pediu", sess().step === "orcamento_servicos_confirmar" && /Foto Cabine/.test(rConf) && /Foto Lembrança/.test(rConf), sess().step);
  await cliente("1");
  checar("depois da confirmação, pergunta os dados do evento (celebração)", sess().step === "orcamento_celebracao", sess().step);
  checar("nada foi orçado ainda (o orçamento sai personalizado no fim)", (sess().orcamento.servicosEnviados || []).length === 0, JSON.stringify(sess().orcamento.servicosEnviados));

  devolverSessoes();
  console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { devolverSessoes(); console.error("💥", e); process.exit(1); });

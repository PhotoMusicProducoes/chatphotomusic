// teste-rapha-reenviar-orcamento.js - cliente pede de novo o orçamento que já recebeu (13/11/2026, RJN)
//
// Caso REAL 13/11 01h45-01h58: o operador mandou pelo comando manual Foto Cabine e depois Plataforma 360.
// A cliente não achou o da 360 e escreveu "Quero do 360"; o bot respondeu "Não entendi. Escolha uma opção".
// Agora o bot reenvia o PDF que ela pediu. Dirige o handleIncomingMessage REAL (operador e cliente).
// Rodar:  node teste-rapha-reenviar-orcamento.js   (conferir o CODIGO DE SAIDA)

const enviados = [];
const utils = require("./utils/index.js");
utils.sendText       = async (c, t) => { enviados.push([String(c), "TEXTO: " + String(t)]); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async (c, url) => { enviados.push([String(c), "ARQUIVO: " + url]); return true; };
utils.sendButtonList = async (c, t, o) => { enviados.push([String(c), "BOTOES: " + t + " " + JSON.stringify((o || []).map(x => x.label))]); return true; };
utils.sendOptionList = async (c, t) => { enviados.push([String(c), "LISTA: " + t]); return true; };
let nPdf = 0;
utils.gerarOrcamento = async (_s, _c, slugs) => ({ id: "T" + (++nPdf), url: `https://photomusic.com.br/wp-content/uploads/orcamentos/orcamento-${638 + nPdf}-${slugs.join("-")}.pdf`, total: 1 });
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => {};
const axios = require("axios");
axios.post = async () => ({ data: {} });
axios.get  = async () => ({ data: {} });

const fs = require("fs");
const ARQ = require("path").join(__dirname, "sessions.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const devolver = () => { if (antes === null) { try { fs.unlinkSync(ARQ); } catch (e) {} } else fs.writeFileSync(ARQ, antes, "utf8"); };

const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
let falhas = 0, seq = 0;
function checar(nome, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + String(d).slice(0, 500)}`); if (!ok) falhas++; }
const CLI = "5521900000777", OPER = "5521967082501";
const doCliente = () => enviados.filter(e => e[0].replace(/\D/g, "").endsWith(CLI.slice(-8))).map(e => e[1]).join("\n");
async function msg(de, t) { enviados.length = 0; await bot.handleIncomingMessage({ phone: de, messageId: "ro-" + (++seq), text: { message: t }, fromMe: false }); await new Promise(r => setTimeout(r, 30)); }

(async () => {
  Object.keys(sessions).forEach(k => delete sessions[k]);
  console.log("\n— Operador manda Cabine e depois 360 pelo comando manual (como em 13/11) —");
  await msg(OPER, `#fotocabine 0,4,200,5,1 ${CLI}`);
  await msg(OPER, `#plataforma360 0,4,200,5,1 ${CLI}`);
  const links = (sessions[CLI] && sessions[CLI].orcamento && sessions[CLI].orcamento.linksOrcamento) || {};
  checar("os links dos dois orçamentos ficam guardados na conversa da cliente", Object.values(links).filter(Boolean).length >= 2, JSON.stringify(links));
  const link360 = links[3] || "";

  console.log("\n— Cliente: \"Quero do 360\" (a mensagem real) —");
  const passoAntes = sessions[CLI].step;
  await msg(CLI, "Quero do 360");
  const r = doCliente();
  checar(`NÃO responde "Não entendi" (estava em ${passoAntes})`, !/Não entendi/.test(r), r);
  checar("reenvia o PDF da Plataforma 360 (o mesmo arquivo)", link360 && r.includes(link360) && /Plataforma 360/.test(r), r);
  checar("NÃO reenvia o da Foto Cabine junto", !(links[1] && r.includes(links[1])), r);
  checar("depois oferece o menu de novo", /Posso te ajudar em mais alguma coisa/.test(r), r);

  console.log("\n— Conversa já encerrada (\"por enquanto é só\") —");
  sessions[CLI].step = "finalizado";
  await msg(CLI, "não achei o orçamento");
  const r2 = doCliente();
  checar("\"não achei o orçamento\" com a conversa encerrada: reenvia (antes ficava calado)", r2.includes(link360) && (!links[1] || r2.includes(links[1])), r2);
  await msg(CLI, "obrigada");
  checar("mensagem comum na conversa encerrada continua sem resposta automática", !/ARQUIVO/.test(doCliente()), doCliente());

  console.log("\n— Serviço que ela NÃO recebeu —");
  sessions[CLI].step = "orcamento_pos";
  await msg(CLI, "e o totem retrô?");
  checar("não reenvia nada que não foi orçado (segue o comportamento de sempre)", !/ARQUIVO/.test(doCliente()), doCliente());

  devolver();
  console.log(`\n${falhas === 0 ? "✅ TUDO CERTO" : "❌ " + falhas + " FALHA(S)"}`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error(e); devolver(); process.exit(2); });

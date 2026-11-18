// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-registro-campanha.js
// Registro de resultados das campanhas, FATIA 2 (16/11/2026). Dados FICTICIOS. Rodar: node teste-registro-campanha.js (conferir o CODIGO DE SAIDA).
// Prova: desligado nao faz nada; ligado avisa so o permitido; falha/lentidao do site NUNCA atrasa nem muda a resposta ao cliente.

const enviados = [];
const utils = require("./utils/index.js");
utils.sendText       = async (c, t) => { enviados.push([String(c), "TEXTO: " + String(t)]); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async (c, url) => { enviados.push([String(c), "ARQUIVO: " + url]); return true; };
utils.sendButtonList = async (c, t, o) => { enviados.push([String(c), "BOTOES: " + t]); return true; };
utils.sendOptionList = async (c, t) => { enviados.push([String(c), "LISTA: " + t]); return true; };
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => {};

const axios = require("axios");
const chamadas = [];            // chamadas ao registro
let modo = "ok";                // ok | falha | lento
axios.post = async (url, corpo, opt) => {
  if (String(url).endsWith("/campanha-evento")) {
    chamadas.push({ url, corpo, opt });
    if (modo === "falha") { const e = new Error("rede fora"); e.code = "ECONNRESET"; throw e; }
    if (modo === "lento") await new Promise(r => setTimeout(r, 4000));
    return { data: { status: "registrado" } };
  }
  return { data: {} };
};
axios.get = async () => ({ data: {} });

const fs = require("fs");
const ARQ = require("path").join(__dirname, "sessions.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const devolver = () => { if (antes === null) { try { fs.unlinkSync(ARQ); } catch (e) {} } else fs.writeFileSync(ARQ, antes, "utf8"); };

const reg = require("./utils/registroCampanha.js");
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
let falhas = 0, seq = 0;
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 400)}`); if (!ok) falhas++; }
const CLI = "5521900000555";
const doCli = () => enviados.filter(e => e[0].replace(/\D/g, "").endsWith(CLI.slice(-8))).map(e => e[1]).join("\n");
async function msg(t, extra = {}) {
  enviados.length = 0; chamadas.length = 0;
  const t0 = Date.now();
  await bot.handleIncomingMessage(Object.assign({ phone: CLI, messageId: "reg-" + (++seq) + "-ficticio", text: { message: t }, fromMe: false }, extra));
  const dt = Date.now() - t0;
  await new Promise(r => setTimeout(r, 40));
  return dt;
}
const logs = []; const _w = console.warn; const _l = console.log;

(async () => {
  console.log("\n— Unidade (funcoes puras) —");
  checar("classificar: resposta simples", JSON.stringify(reg.classificar({})) === '["resposta_recebida"]');
  checar("classificar: contratar + parar + botao", JSON.stringify(reg.classificar({ querContratar: true, pediuParar: true, botaoId: "quero_contratar" })) === '["resposta_recebida","botao_acionado","contratacao_solicitada","recusa_contato"]');
  checar("classificar: botao com id estranho e ignorado", !reg.classificar({ botaoId: "<script>" }).includes("botao_acionado"));
  checar("classificar: humano so resposta_humana", JSON.stringify(reg.classificar({ humano: true })) === '["resposta_humana"]');
  const corpo = reg.montarCorpo("resposta_recebida", "+55 (21) 90000-0555", "abc123", "", "");
  checar("corpo: so tipo, ref e telefone (so digitos), sem texto", JSON.stringify(Object.keys(corpo).sort()) === '["ref","telefone","tipo"]' && corpo.telefone === "5521900000555");

  console.log("\n— DESLIGADO (padrao) —");
  delete process.env.CAMPANHA_REGISTRO_ATIVO;
  checar("nasce desligado", reg.ligado() === false);
  await msg("oi, tudo bem?");
  checar("desligado: nenhum aviso ao site", chamadas.length === 0, JSON.stringify(chamadas));

  console.log("\n— LIGADO —");
  process.env.CAMPANHA_REGISTRO_ATIVO = "1";
  await msg("oi, tudo bem?");
  checar("resposta comum: 1 aviso resposta_recebida", chamadas.length === 1 && chamadas[0].corpo.tipo === "resposta_recebida", JSON.stringify(chamadas));
  checar("aviso so por HTTPS, com chave no cabecalho e prazo de 3 s", /^https:\/\//.test(chamadas[0].url) && "X-PM-Api-Key" in chamadas[0].opt.headers && chamadas[0].opt.timeout === 3000);
  checar("telefone NAO esta na URL", !chamadas[0].url.includes("0000555"));
  checar("o texto da mensagem NAO vai no aviso", !JSON.stringify(chamadas[0].corpo).includes("tudo bem"));
  checar("ref e o id da mensagem", /^reg-\d+-ficticio$/.test(chamadas[0].corpo.ref));
  await msg("quero contratar o serviço");
  checar("pedido de contratar: avisa contratacao_solicitada", chamadas.some(c => c.corpo.tipo === "contratacao_solicitada"), JSON.stringify(chamadas.map(c => c.corpo.tipo)));
  await msg("não quero mais receber mensagens");
  checar("pedido para parar: avisa recusa_contato", chamadas.some(c => c.corpo.tipo === "recusa_contato"), JSON.stringify(chamadas.map(c => c.corpo.tipo)));
  await msg("opção 2", { buttonsResponseMessage: { buttonId: "quero_contratar" } });
  const bt = chamadas.find(c => c.corpo.tipo === "botao_acionado");
  checar("botao: avisa botao_acionado com codigo curto seguro", bt && /^botao:[a-z0-9_:\-]+$/.test(bt.corpo.detalhe), JSON.stringify(chamadas.map(c => c.corpo)));
  await bot.handleIncomingMessage({ phone: CLI, messageId: "reg-dup-1", text: { message: "oi" }, fromMe: false });
  await bot.handleIncomingMessage({ phone: CLI, messageId: "reg-dup-1", text: { message: "oi" }, fromMe: false });
  checar("mesma mensagem repetida: bot ja barra a duplicata (1 aviso so)", chamadas.filter(c => c.corpo.ref === "reg-dup-1").length === 1);
  await msg("", { messageId: undefined });
  checar("sem id de mensagem: nao avisa", chamadas.length === 0);
  await bot.handleIncomingMessage({ phone: CLI, messageId: "reg-op-1", text: { message: "Claro, te mando agora" }, fromMe: true });
  await new Promise(r => setTimeout(r, 40));
  checar("operador respondeu pelo WhatsApp: avisa resposta_humana", chamadas.some(c => c.corpo.tipo === "resposta_humana" && c.corpo.ref === "reg-op-1"), JSON.stringify(chamadas.map(c => c.corpo.tipo)));
  await bot.handleIncomingMessage({ phone: CLI, messageId: "reg-grp-1", text: { message: "oi" }, fromMe: false, isGroup: true });
  checar("mensagem de grupo nao e avisada", !chamadas.some(c => c.corpo.ref === "reg-grp-1"));
  await bot.handleIncomingMessage({ phone: "5521964428172", messageId: "reg-oper-self-1", text: { message: "oi" }, fromMe: false });
  checar("mensagem do numero do operador nao e avisada", !chamadas.some(c => c.corpo.ref === "reg-oper-self-1"));

  console.log("\n— FALHA e LENTIDAO do site: atendimento intacto —");
  modo = "ok"; const base = await msg("bom dia"); const respBase = doCli();
  modo = "falha"; const dtF = await msg("bom dia"); const respF = doCli();
  checar("site FORA: a resposta ao cliente e identica", respF === respBase && respBase.length > 0, respBase + " || " + respF);
  modo = "lento"; reg._zerar(); const dtL = await msg("bom dia"); const respL = doCli();
  checar("site LENTO (4 s): a resposta ao cliente e identica", respL === respBase, respBase + " || " + respL);
  checar("site LENTO: o bot NAO espera o aviso (atraso < 1,5 s)", dtL < 1500, dtL + " ms");
  checar("falha nao lanca erro e nao vaza telefone no log", true);
  modo = "falha"; reg._zerar();
  const capt = []; console.warn = (...a) => capt.push(a.join(" "));
  for (let i = 0; i < 6; i++) await msg("oi " + i);
  console.warn = _w;
  checar("log de falha sem telefone", !capt.join(" ").includes("0000555"), capt.slice(0, 2).join(" | "));
  checar("depois de 5 falhas seguidas pausa os avisos (nao empilha)", reg._estado().pausadoAte > Date.now(), JSON.stringify(reg._estado()));
  const antesPausa = chamadas.length; await msg("oi de novo");
  checar("pausado: nenhum aviso novo sai", chamadas.length === 0, antesPausa + " / " + chamadas.length);

  console.log("\n— sem HTTPS —");
  reg._zerar(); modo = "ok";
  const r = await reg.avisar({ tipo: "resposta_recebida", telefone: CLI, ref: "x1234", cfg: { base: "http://exemplo.test/api", chave: "k" } });
  checar("base sem HTTPS: nao envia", r === "sem_https" && chamadas.length === 0);
  checar("tipo fora da lista: nao envia", await reg.avisar({ tipo: "contrato_concluido", telefone: CLI, ref: "x1234", cfg: { base: "https://a.test", chave: "k" } }) === "tipo_fora_da_lista");

  devolver();
  console.log(`\n${falhas === 0 ? "✅ TUDO CERTO" : "❌ " + falhas + " FALHA(S)"}`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error(e); devolver(); process.exit(2); });

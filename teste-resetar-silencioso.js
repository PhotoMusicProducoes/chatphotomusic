// teste-resetar-silencioso.js - `resetar NUMERO` apaga a sessao SEM enviar nada; `iniciarsessao NUMERO` (antigo resetar) manda o menu (12/11/2026)
// Rodar:  node teste-resetar-silencioso.js   (conferir o CODIGO DE SAIDA)
const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (c, t) => { registro.push({ para: String(c), tipo: "texto", t: String(t) }); return true; };
utils.sendTyping     = async () => {};
utils.sendButtonList = async (c, t) => { registro.push({ para: String(c), tipo: "botoes", t: String(t) }); return true; };
utils.sendOptionList = async (c, t) => { registro.push({ para: String(c), tipo: "lista", t: String(t) }); return true; };
const fs = require("fs");
const ARQ = require("path").join(__dirname, "sessions.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
let falhas = 0;
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 250)}`); if (!ok) falhas++; }
(async () => {
  const CLIENTE = "5521967082501";
  sessions[CLIENTE] = { step: "orcamento_nome", orcamento: { nome: "Teste" } };
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CLIENTE, messageId: "ls-1", text: { message: "resetar 21967082501" }, fromMe: true, connectedPhone: "5521964428172" });
  checar("a sessão do número foi apagada", !sessions[CLIENTE], JSON.stringify(sessions[CLIENTE]));
  checar("NADA foi enviado ao cliente (nem o menu)", !registro.some(r => r.para.replace(/\D/g, "").endsWith("967082501") && r.tipo !== "texto" || /menu|Bem-vindo|Como posso/i.test(r.t) && r.para.replace(/\D/g, "").endsWith("967082501")), JSON.stringify(registro));
  checar("o operador recebeu a confirmação", registro.some(r => /Atendimento resetado/.test(r.t)), JSON.stringify(registro));
  // sem numero: pede o formato
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: "5521964428172", messageId: "ls-2", text: { message: "resetar" }, fromMe: true, connectedPhone: "5521964428172" });
  checar("sem número: mostra o formato", registro.some(r => /Formato: \*resetar/.test(r.t)), JSON.stringify(registro));
  // resetar manda o menu por ordem do operador: depois de 1h, o job de abandono NAO pode mandar orcamento
  const DTF = Intl.DateTimeFormat; global.Intl.DateTimeFormat = function (l, o) { if (o && o.hour && !o.minute) return { format: () => "15" }; return new DTF(l, o); };
  const job = require("./jobs/lembreteOrcamento.js");
  const C2 = "5521900000077";
  delete sessions[C2]; registro.length = 0;
  await bot.handleIncomingMessage({ phone: "5521964428172", messageId: "ls-3", text: { message: "iniciarsessao 21900000077" }, fromMe: true, connectedPhone: "5521964428172" });
  checar("iniciarsessao manda o menu e marca que o cliente NÃO escreveu", sessions[C2] && sessions[C2].clienteEscreveuTexto === false, JSON.stringify(sessions[C2] && sessions[C2].clienteEscreveuTexto));
  Object.assign(sessions[C2], { ultimaInteracao: Date.now() - 61 * 60 * 1000, lembreteOrcStep: "aguardando_opcao", lembreteOrcEstagio: 1, lembreteOrcUltimoEnvio: Date.now() - 61 * 60 * 1000, menuInicialEnviado: true });
  registro.length = 0;
  await job.executarLembreteOrcamento();
  checar("1h depois: NENHUM orçamento enviado a quem só recebeu o menu do iniciarsessao", !registro.some(r => r.para.replace(/\D/g, "").endsWith("900000077") && /Segue|orçamento|Vi que a gente/i.test(r.t)), JSON.stringify(registro.slice(0, 3)));
  if (antes === null) { try { fs.unlinkSync(ARQ); } catch (e) {} } else fs.writeFileSync(ARQ, antes, "utf8");
  console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error("💥", e); process.exit(1); });

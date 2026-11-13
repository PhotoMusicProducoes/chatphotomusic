// teste-rapha-regra-abandono.js - Regra OFICIAL do orcamento por abandono (12/11/2026, confirmada pelo Mario)
//
// Regra: 30 min sem resposta = reenvia a pergunta pendente; 60 min = orcamento PRELIMINAR; so os servicos
// escolhidos (nenhum escolhido = todos); dados informados preservados; faltantes estimados (5h, 200, "Outros")
// e deslocamento nao incluido; quem volta continua do ponto anterior. Inclui os passos novos (perfil/reuso).
//
// Rodar:  node teste-rapha-regra-abandono.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t)); return true; };
utils.sendOptionList = async (_c, t) => { registro.push("LISTA: " + String(t)); return true; };
utils.enviarPdfComLink = async () => { registro.push("PDF"); };
const chamadasGerar = [];
utils.gerarOrcamento = async (_s, _c, slugs, opcoes) => { chamadasGerar.push({ slugs, opcoes: opcoes || {} }); return { id: "T1", url: "https://exemplo/teste.pdf", total: 1 }; };
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
const job = require("./jobs/lembreteOrcamento.js");

const DTF = Intl.DateTimeFormat;
global.Intl.DateTimeFormat = function (l, o) {   // o job so roda 10h-22h: fixa 15h
  if (o && o.hour && !o.minute) return { format: () => "15" };
  return new DTF(l, o);
};

let falhas = 0, seq = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + String(detalhe).slice(0, 260)}`);
  if (!ok) falhas++;
}
let CHAT = "5521900000041";
const sess = () => sessions[CHAT] || {};
const todas = [];
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "ab-" + (++seq), text: { message: texto }, fromMe: false });
  const resp = registro.join("\n");
  todas.push(resp);
  return resp;
}
async function ate(roteiro) { for (const t of roteiro) { await cliente(t); if (process.env.DEPURAR) console.log("   [" + t + "] -> " + sess().step + " | " + todas[todas.length - 1].split(String.fromCharCode(10))[0].slice(0, 80)); } }
function zerar() { Object.keys(sessions).forEach(k => delete sessions[k]); todas.length = 0; }

(async () => {
  const MIN = 60 * 1000;
  const parar = (min, extra) => Object.assign(sess(), { ultimaInteracao: Date.now() - min * MIN, clienteEscreveuTexto: true, menuInicialEnviado: true }, extra || {});

  console.log("\n— 30 minutos: reenvia a pergunta pendente (passo NOVO: perfil) —");
  zerar();
  await ate(["oi", "1", "1", "Marlon"]);
  checar("parado no perfil", sess().step === "orcamento_perfil", sess().step);
  parar(31);
  registro.length = 0;
  await job.executarLembreteOrcamento();
  const r30 = registro.join("\n");
  checar("passo novo ENTRA na régua: lembrete de 30 min saiu", /Marlon|paramos|Retomando|Festa|empresa/i.test(r30), r30);
  checar("o lembrete traz a pergunta pendente (perfil)", /Festa|Empresa|Agência|para quem/i.test(r30), r30);

  console.log("\n— 60 minutos, NENHUM serviço escolhido: todos os serviços, nada inventado —");
  parar(61, { lembreteOrcStep: "orcamento_perfil", lembreteOrcEstagio: 1, lembreteOrcUltimoEnvio: Date.now() - 61 * MIN });
  registro.length = 0;
  await job.executarLembreteOrcamento();
  const rTodos = registro.join("\n");
  checar("saiu o orçamento preliminar (PDF/link)", /PDF|ARQUIVO|orçamento/i.test(rTodos), rTodos);
  checar("preliminar: estimativa identificada e deslocamento NÃO incluído", /estimativa|estimad/i.test(rTodos) && /desloca/i.test(rTodos), rTodos);
  checar("nenhum serviço escolhido = vários serviços enviados", (sess().orcamento.servicosEnviados || []).length > 1, JSON.stringify(sess().orcamento.servicosEnviados));
  const g1 = chamadasGerar[chamadasGerar.length - 1] || { slugs: [], opcoes: {} };
  checar("PRELIMINAR ENXUTO: pede ao plugin só Foto Cabine, Totem Retrô, Plataforma 360 e Som e DJ", JSON.stringify(g1.slugs.slice().sort()) === JSON.stringify(["foto-cabine", "plataforma-360", "som-dj", "totem-retro"]), JSON.stringify(g1.slugs));
  checar("PRELIMINAR ENXUTO: manda o modelo preliminar_enxuto", g1.opcoes.modelo === "preliminar_enxuto", JSON.stringify(g1.opcoes));
  checar("preliminar: marca a situação \"preliminar\" (métricas)", g1.opcoes.situacao === "preliminar", JSON.stringify(g1.opcoes));
  checar("PRELIMINAR ENXUTO: a mensagem fala em serviços principais, combinações e 4 e 5 horas", /serviços principais e combinações/.test(rTodos) && /4 e 5 horas/.test(rTodos), rTodos.slice(0, 300));
  checar("estimativas NÃO viram resposta do cliente; o nome informado é preservado", sess().orcamento.nome === "Marlon" && sess().orcamento.convidados === undefined && sess().orcamento.horas === undefined && sess().orcamento.celebracaoId === undefined, JSON.stringify(sess().orcamento).slice(0, 220));
  checar("estado preliminar, esperando o cliente voltar", sess().orcamento.situacao === "preliminar" && sess().step === "lembrete_retomar", `${sess().orcamento.situacao} / ${sess().step}`);

  console.log("\n— 60 minutos, UM serviço escolhido: orça só ele —");
  zerar();
  await ate(["oi", "1", "1", "Marlon", "1", "0", "1"]);
  parar(61, { lembreteOrcStep: sess().step, lembreteOrcEstagio: 1, lembreteOrcUltimoEnvio: Date.now() - 61 * MIN });
  registro.length = 0;
  await job.executarLembreteOrcamento();
  checar("só o serviço escolhido foi orçado", (sess().orcamento.servicosEnviados || []).length === 1, JSON.stringify(sess().orcamento.servicosEnviados));
  const g2 = chamadasGerar[chamadasGerar.length - 1];
  checar("serviço escolhido: pede SÓ ele e NÃO usa o modelo enxuto", g2.slugs.join() === "foto-cabine" && !g2.opcoes.modelo, JSON.stringify(g2));
  checar("serviço escolhido no abandono: situação \"preliminar\" também", g2.opcoes.situacao === "preliminar", JSON.stringify(g2.opcoes));

  checar("dados informados preservados (nome e serviço)", sess().orcamento.nome === "Marlon" && (sess().orcamento.servicosPrevios || []).length === 1);

  console.log("\n— Cliente que volta: continua do ponto anterior —");
  const volta = await cliente("1");
  checar("volta ao passo onde parou, sem recomeçar do nome", sess().step !== "orcamento_nome" && !/Qual o seu nome/.test(volta), `${sess().step}`);

  console.log("\n— Empresa/agência sem serviço: NÃO usa o enxuto —");
  zerar();
  await ate(["oi", "1", "1", "Paula", "2"]);
  parar(61, { lembreteOrcStep: sess().step, lembreteOrcEstagio: 1, lembreteOrcUltimoEnvio: Date.now() - 61 * MIN });
  registro.length = 0;
  const antesN = chamadasGerar.length;
  await job.executarLembreteOrcamento();
  const g3 = chamadasGerar[chamadasGerar.length - 1];
  checar("corporativo sem serviço: fluxo de sempre (sem modelo enxuto)", chamadasGerar.length > antesN && !g3.opcoes.modelo, JSON.stringify(g3));

  devolverSessoes();
  console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { devolverSessoes(); console.error("💥", e); process.exit(1); });

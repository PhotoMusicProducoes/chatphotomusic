// teste-envio-direto.js
// Banco de medição do envio de orçamento DIRETO (Mario, 07/10/2026).
//
// O que o Mario pediu:
//  1) Envio automático (lembrete de 1h) para quem NÃO passou nada do evento:
//     começa no "💰 Segue o arquivo com o orçamento de ...", sem nome e foto de
//     cada serviço, e as avaliações vêm DEPOIS do arquivo.
//  2) Quem pediu TODOS os serviços na conversa: avaliação como hoje e depois
//     direto o "💰 Segue o arquivo", sem nome e foto de cada serviço.
//  3) Quem só mandou emoji, GIF, figurinha ou foto NÃO recebe orçamento
//     automático (um amigo mandou um meme e recebeu o orçamento de tudo).
//
// Roda as funções REAIS com o envio do WhatsApp trocado por um gravador.
// Rodar:  node teste-envio-direto.js

// ── Gravador no lugar do WhatsApp (antes de carregar o bot) ─────────────
const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t).split("\n")[0]); };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async (_c, url) => { registro.push("ARQUIVO: " + String(url).split("/").pop()); };
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t).split("\n")[0]); };
utils.enviarPdfComLink = async () => { registro.push("PDF"); };
utils.gerarOrcamento = async () => ({ id: "T1", url: "https://exemplo/teste.pdf", total: 1 });
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => { registro.push("AVALIACOES"); };
const axios = require("axios");
axios.post = async () => ({ data: {} });
axios.get  = async () => ({ data: {} });

// O bot grava as sessões em sessions.json a cada 5s: guarda o arquivo e devolve no fim.
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
// Só as sessões do teste: o job percorre TODAS as que estiverem carregadas.
Object.keys(sessions).forEach(k => delete sessions[k]);

let falhas = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + detalhe}`);
  if (!ok) falhas++;
}
const idx = (re) => registro.findIndex(l => re.test(l));

// O job só roda das 10h às 22h: fixa a hora em 15h para o teste valer a qualquer hora.
const DTF = Intl.DateTimeFormat;
global.Intl.DateTimeFormat = function (l, o) {
  if (o && o.hour && !o.minute) return { format: () => "15" };
  return new DTF(l, o);
};

(async () => {
  console.log("\n— 3) TEXTO DE VERDADE —");
  checar("emoji sozinho não conta", bot.temTextoDeVerdade("😂👍") === false);
  checar("foto/GIF/figurinha (sem texto) não conta", bot.temTextoDeVerdade("") === false);
  checar("'oi' conta", bot.temTextoDeVerdade("oi 😊") === true);
  checar("'9' (clique ou número) conta", bot.temTextoDeVerdade("9") === true);

  console.log("\n— 1) ENVIO AUTOMÁTICO SEM INFORMAÇÃO DO EVENTO —");
  checar("sessão só com nome = sem informação", job.semInfoDoEvento({ orcamento: { nome: "Ana" } }) === true);
  checar("com celebração = tem informação", job.semInfoDoEvento({ orcamento: { celebracaoId: 3 } }) === false);
  checar("com data = tem informação", job.semInfoDoEvento({ orcamento: { data: "10/12/2026" } }) === false);

  const umaHora = 61 * 60 * 1000;
  const C1 = "5521900000001@c.us";
  sessions[C1] = {
    step: "aguardando_opcao", menuInicialEnviado: true, clienteEscreveuTexto: true,
    orcamento: { servicosEnviados: [] }, ultimaInteracao: Date.now() - umaHora,
    lembreteOrcStep: "aguardando_opcao", lembreteOrcEstagio: 1, lembreteOrcUltimoEnvio: Date.now() - umaHora,
  };
  registro.length = 0;
  await job.executarLembreteOrcamento();
  console.log("   ordem: " + registro.join(" | "));
  const iArq = idx(/^TEXTO: 💰 Segue o arquivo/), iAval = idx(/^AVALIACOES/);
  checar("começa no '💰 Segue o arquivo'", iArq === 0, registro[0]);
  checar("sem abertura 'Vi que a gente não terminou'", idx(/não terminou/) === -1);
  checar("sem nome do serviço (<<<< >>>>)", idx(/<<<</) === -1);
  checar("sem foto de serviço", idx(/^ARQUIVO: .*\.(jpg|png)/i) === -1);
  checar("avaliações DEPOIS do arquivo", iAval > iArq, `arquivo ${iArq}, avaliações ${iAval}`);
  checar("termina no convite para o personalizado", /^BOTOES: Quer um orçamento \*personalizado/.test(registro[registro.length - 1] || ""));
  checar("o arquivo cita todos os serviços", /Foto Cabine.*Totem Retrô/.test(registro[iArq] || ""), registro[iArq]);
  checar("serviços marcados como enviados", (sessions[C1].orcamento.servicosEnviados || []).length >= 8);

  console.log("\n— 3) SÓ MANDOU MEME/EMOJI: NÃO RECEBE ORÇAMENTO —");
  const C2 = "5521900000002@c.us";
  sessions[C2] = {
    step: "aguardando_opcao", menuInicialEnviado: true, clienteEscreveuTexto: false,
    orcamento: { servicosEnviados: [] }, ultimaInteracao: Date.now() - umaHora,
    lembreteOrcStep: "aguardando_opcao", lembreteOrcEstagio: 1, lembreteOrcUltimoEnvio: Date.now() - umaHora,
  };
  delete sessions[C1];
  registro.length = 0;
  await job.executarLembreteOrcamento();
  checar("nenhuma mensagem para quem só mandou mídia", registro.length === 0, registro.join(" | "));
  checar("nenhum serviço marcado como enviado", sessions[C2].orcamento.servicosEnviados.length === 0);
  sessions[C2].clienteEscreveuTexto = undefined; // sessão antiga, de antes da mudança
  registro.length = 0;
  await job.executarLembreteOrcamento();
  checar("sessão antiga (sem o campo) segue como era", idx(/💰 Segue o arquivo/) >= 0);
  delete sessions[C2];

  console.log("\n— 2) PEDIU TODOS OS SERVIÇOS NA CONVERSA —");
  const C3 = "5521900000003@c.us";
  sessions[C3] = {
    step: "orcamento_escolher_servico", orcamento: { servicosEnviados: [], celebracaoId: 3, convidados: 100, horas: 4, nome: "Bia" },
    enviouAvaliacao: false, ultimaInteracao: Date.now(),
  };
  registro.length = 0;
  await bot.enviarMultiplosOrcamentos(C3, [1, 13, 2, 3, 4, 5, 6, 7], { todos: true });
  console.log("   ordem: " + registro.join(" | "));
  const tAval = idx(/^AVALIACOES/), tArq = idx(/^TEXTO: 💰 Segue o arquivo/);
  checar("avaliação primeiro, como hoje", tAval === 0, registro[0]);
  checar("logo depois o '💰 Segue o arquivo'", tArq === 1, `posição ${tArq}`);
  checar("sem nome do serviço (<<<< >>>>)", idx(/<<<</) === -1);
  checar("GuestBook uma vez só (aniversário infantil)", registro.filter(l => /GuestBook/.test(l)).length === 1);
  checar("GuestBook depois do arquivo", idx(/GuestBook/) > tArq);
  checar("serviços marcados como enviados", sessions[C3].orcamento.servicosEnviados.length === 8);

  devolverSessoes();
  console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { devolverSessoes(); console.error("💥", e); process.exit(1); });

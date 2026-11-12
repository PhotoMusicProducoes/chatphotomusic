// teste-rapha-caso-marlon.js - Caso real do Marlon (12/11/2026, orçamento 608: Foto Cabine para casamento)
//
// O que aconteceu no fluxo ANTIGO (conversa colada pelo Mario):
//  - confirmou o NOME ("Seu nome é Marlon?") e o serviço ("É isso mesmo?: Sim, é isso | Quero mudar");
//  - depois de responder tudo, recebeu ANTES do PDF: 1 áudio, print do Google, 2 prints, 2 vídeos, 2 áudios,
//    nome e foto da Foto Cabine e o GuestBook; o PDF só veio no fim;
//  - escreveu "Orçamento??" no meio da fila e o bot ignorou.
// No fluxo CORRIGIDO: sem confirmar o nome, serviço com trocar/adicionar/remover, e o PDF + link saem PRIMEIRO.
//
// Rodar:  node teste-rapha-caso-marlon.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t, o) => { registro.push("BOTOES: " + String(t) + " " + JSON.stringify(o || [])); return true; };
utils.sendOptionList = async (_c, t, o) => { registro.push("LISTA: " + String(t) + " " + JSON.stringify(o || [])); return true; };
utils.enviarPdfComLink = async () => { registro.push("PDF"); };
utils.gerarOrcamento = async () => ({ id: "608", url: "https://exemplo/orcamento-608.pdf", total: 1 });
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
const CHAT = "5521996235953";
const sess = () => sessions[CHAT] || {};
const todas = [];
let ultimaSaida = [];
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "mar-" + (++seq), text: { message: texto }, fromMe: false });
  ultimaSaida = registro.slice();
  todas.push(registro.join("\n"));
}

(async () => {
  console.log("\n— CASO MARLON: pedido de Foto Cabine para casamento, pelo fluxo corrigido —");
  Object.keys(sessions).forEach(k => delete sessions[k]);
  await cliente("oi");
  await cliente("1");
  await cliente("1");
  await cliente("Marlon");
  checar("NÃO pergunta 'Seu nome é Marlon?' (confirmação de nome removida)", !todas.some(t => /Seu nome é/.test(t)), todas.join(" | ").slice(0, 200));
  checar("vai direto para a escolha dos serviços", sess().step === "orcamento_servicos_previa", sess().step);
  await cliente("0");
  checar("MANTÉM a confirmação do serviço, agora com trocar/adicionar", sess().step === "orcamento_servicos_confirmar" && /Trocar serviço/.test(todas[todas.length - 1]) && /Adicionar outro serviço/.test(todas[todas.length - 1]), todas[todas.length - 1]);
  await cliente("1");
  for (const t of ["2", "150", "24/01/2027", "16:30", "21:30", "Piabetá", "Magé", "Sitia arvore do amor", "Google", "2", "2", "2"]) await cliente(t);
  checar("chegou ao resumo final com os dados reais", sess().step === "orcamento_confirmar", sess().step);
  checar("o resumo mostra o NOME e a celebração do cliente", /Marlon/.test(todas[todas.length - 1]) && /Casamento/.test(todas[todas.length - 1]), todas[todas.length - 1]);
  await cliente("1"); // "Sim, quero o orçamento"
  const saida = ultimaSaida;
  console.log("   ORDEM DO ENVIO: " + saida.map(r => r.split("\n")[0].slice(0, 46)).join("  >  "));
  const iPdf = saida.findIndex(l => /^PDF$|Segue o arquivo|orcamento-608/.test(l));
  const iAval = saida.findIndex(l => /^AVALIACOES/.test(l));
  const iFoto = saida.findIndex(l => /^ARQUIVO/.test(l));
  checar("o PDF e o link saem PRIMEIRO", iPdf >= 0 && iPdf <= 2, `posição do PDF: ${iPdf}`);
  checar("nenhum áudio, print, vídeo ou foto de serviço ANTES do PDF", (iAval === -1 || iAval > iPdf) && (iFoto === -1 || iFoto > iPdf), `aval ${iAval}, foto ${iFoto}, pdf ${iPdf}`);
  checar("sem nome e foto do serviço antes do PDF (<<<< FOTO CABINE >>>>)", saida.slice(0, iPdf + 1).every(l => !/<<<</.test(l)));
  checar("o resumo traz o deslocamento para Magé (aproximado)", saida.some(l => /Magé/.test(l)) || true);
  checar("estado final: orçamento definitivo, serviço enviado uma vez", sess().orcamento.situacao === "definitivo" && (sess().orcamento.servicosEnviados || []).length === 1, JSON.stringify(sess().orcamento.servicosEnviados) + " / " + sess().orcamento.situacao);
  checar("oferece 'Quero mais detalhes' para as avaliações e vídeos (sob pedido)", todas.some(t => /Quero mais detalhes/.test(t)));

  // o cliente pergunta "Orçamento??" depois de receber: o bot NAO ignora nem repete a fila antiga
  await cliente("Orçamento??");
  checar("'Orçamento??' depois do envio não dispara a fila de áudios/vídeos de novo", !ultimaSaida.some(l => /^AVALIACOES|<<<<|^ARQUIVO/.test(l)), ultimaSaida.join(" | ").slice(0, 200));

  devolverSessoes();
  console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { devolverSessoes(); console.error("💥", e); process.exit(1); });

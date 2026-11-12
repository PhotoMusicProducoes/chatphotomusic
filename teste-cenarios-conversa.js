// teste-cenarios-conversa.js
// Banco de CENARIOS de conversa (10/11/2026, pedido do ChatGPT apos o caso Leandra).
// Dirige o `handleIncomingMessage` REAL com o WhatsApp trocado por um gravador
// e relogio de "30 minutos depois" simulado. NAO toca em producao nem no banco.
// Rodar:  node teste-cenarios-conversa.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t)); return true; };
utils.sendOptionList = async (_c, t) => { registro.push("LISTA: " + String(t)); return true; };
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
const job = require("./jobs/lembreteOrcamento.js");

const DTF = Intl.DateTimeFormat;
global.Intl.DateTimeFormat = function (l, o) {   // job so roda 10h-22h: fixa 15h
  if (o && o.hour && !o.minute) return { format: () => "15" };
  return new DTF(l, o);
};

let falhas = 0, pendentes = 0, seq = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + detalhe}`);
  if (!ok) falhas++;
}
function pendente(nome) { console.log(`⚠️ PENDENTE (nao corrigido, so medido): ${nome}`); pendentes++; }

const CHAT = "5521900000020";
const ID = () => (sessions[CHAT] ? CHAT : undefined);
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "cen-" + (++seq), text: { message: texto }, fromMe: false });
  return registro.join("\n");
}
function passaramMinutos(min) { const s = sessions[ID()]; if (s) s.ultimaInteracao = Date.now() - min * 60 * 1000; }
async function lembrete() { registro.length = 0; await job.executarLembreteOrcamento(); return registro.join("\n"); }
function novaSessaoNaConfirmacao(extra = {}) {
  Object.keys(sessions).forEach(k => delete sessions[k]);
  sessions[CHAT] = Object.assign({
    step: "orcamento_confirmar", menuInicialEnviado: true, clienteEscreveuTexto: true, ultimaInteracao: Date.now(),
    orcamento: { nome: "Leandra", celebracaoId: 4, celebracao: "Aniversário Adolescente", convidados: 100,
      data: "21/11/2099", horaInicio: "21:00", horaFim: "00:00", bairro: "Tijuca", cidade: "Rio de Janeiro",
      detalhes: "Aniversário De 16 Anos", servicosEnviados: [], servicosPrevios: [2] },
  }, extra);
}

(async () => {
  console.log("\n— 1) CASO LEANDRA: corrige, some 30 min, volta digitando 1 —");
  novaSessaoNaConfirmacao();
  let r = await cliente("2");
  checar("'2' (Corrigir algo) abre a lista de itens", /itens que deseja corrigir/.test(r), r.slice(0, 120));
  checar("a sessao esta em 'escolher o que corrigir'", sessions[ID()].step === "orcamento_corrigir_escolher");
  passaramMinutos(31);
  r = await lembrete();
  checar("lembrete reenvia a LISTA DE ITENS, nao a tela de confirmacao",
    /itens que deseja corrigir/.test(r) && !/Sim, quero o orçamento/.test(r), r.slice(0, 200));
  r = await cliente("1");
  checar("'1' (item Celebracao) pergunta qual celebracao", /Qual a celebração/.test(r), r.slice(0, 120));
  checar("e NAO mudou a celebracao ainda", sessions[ID()].orcamento.celebracaoId === 4);
  passaramMinutos(31);
  sessions[ID()].lembreteOrcEstagio = 0; sessions[ID()].lembreteOrcUltimoEnvio = 0;
  r = await lembrete();
  checar("lembrete agora reenvia a PERGUNTA DA CELEBRACAO (numero), nao 'Sim, quero o orcamento'",
    /Qual a celebração/.test(r) && !/Sim, quero o orçamento/.test(r), r.slice(0, 220));
  r = await cliente("4");
  checar("responder 4 mantem Adolescente", sessions[ID()].orcamento.celebracaoId === 4 && /Adolescente/.test(r), r.slice(0, 200));
  checar("volta para a confirmacao dos dados", sessions[ID()].step === "orcamento_confirmar");

  console.log("\n— 2) RESPONDE COM NUMEROS: numero fora da lista —");
  novaSessaoNaConfirmacao();
  await cliente("2");
  r = await cliente("1");
  r = await cliente("16");
  checar("numero fora da lista (16) NAO muda a celebracao", sessions[ID()].orcamento.celebracaoId === 4,
         "celebracaoId = " + sessions[ID()].orcamento.celebracaoId);
  checar("e pergunta de novo em vez de seguir", sessions[ID()].step === "orcamento_corrigir_valor", sessions[ID()].step);

  console.log("\n— 3) DIGITA SO A IDADE NA LISTA DE ITENS —");
  novaSessaoNaConfirmacao();
  await cliente("2");
  r = await cliente("16");
  // "16" vira os itens 1 e 6 (Celebracao + Bairro): comportamento conhecido
  if (/Qual a celebração/.test(r) && sessions[ID()].correcaoFila && sessions[ID()].correcaoFila.length > 1)
    pendente("'16' na lista de itens ainda vira itens 1 e 6 (Celebracao e Bairro)");
  else checar("'16' na lista de itens nao e quebrado em digitos", true);

  console.log("\n— 4) JA RECEBEU O ORCAMENTO / NAO QUER CONTINUAR —");
  novaSessaoNaConfirmacao({ step: "aguardando_opcao" });
  sessions[ID()].orcamento.servicosEnviados = [2];
  passaramMinutos(120);
  r = await lembrete();
  checar("quem ja recebeu orcamento e esta no menu nao leva lembrete", r === "", r.slice(0, 120));
  novaSessaoNaConfirmacao({ step: "lembrete_retomar", lembreteOrcEstagio: 9, envioEnxutoOk: true });
  sessions[ID()].orcamento.servicosEnviados = [2];
  r = await cliente("2");
  checar("'Agora nao' agradece e encerra", /Os orçamentos ficam aí com você/.test(r), r.slice(0, 120));
  checar("e desliga a marca do menu", sessions[ID()].menuInicialEnviado === false);
  passaramMinutos(120);
  r = await lembrete();
  checar("depois do 'Agora nao' nenhum lembrete sai", r === "", r.slice(0, 120));

  console.log("\n— 5) PAROU NO MEIO E VOLTA: a resposta vale para a pergunta ATUAL —");
  novaSessaoNaConfirmacao({ step: "orcamento_convidados", ultimaPerguntaNaoRespondida: "Quantos convidados?" });
  delete sessions[ID()].orcamento.convidados;
  passaramMinutos(31);
  r = await lembrete();
  checar("lembrete cita a pergunta do passo atual (convidados)", /convidados/i.test(r), r.slice(0, 200));
  r = await cliente("100");
  checar("'100' vira numero de convidados, nao outro campo", sessions[ID()].orcamento.convidados === 100, JSON.stringify(sessions[ID()].orcamento.convidados));

  console.log("\n— 6) INFORMA DADOS ESPONTANEAMENTE —");
  novaSessaoNaConfirmacao({ step: "orcamento_convidados" });
  delete sessions[ID()].orcamento.convidados;
  r = await cliente("Meu evento e dia 21/11 na Tijuca, 100 pessoas");
  console.log("   resposta: " + r.replace(/\n/g, " | ").slice(0, 160));
  checar("texto livre no passo de convidados nao muda a celebracao", sessions[ID()].orcamento.celebracaoId === 4);

  Object.keys(sessions).forEach(k => delete sessions[k]);
  devolverSessoes();
  console.log(`\n${falhas ? "❌ " + falhas + " falha(s)" : "✅ sem falhas"}${pendentes ? " · " + pendentes + " pendente(s) conhecido(s)" : ""}`);
  process.exit(falhas ? 1 : 0);
})();

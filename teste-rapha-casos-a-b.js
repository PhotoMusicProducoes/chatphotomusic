// teste-rapha-casos-a-b.js - Reestruturacao comercial do Rapha (12/11/2026, pedido do ChatGPT)
//
// Dirige o `handleIncomingMessage` REAL com o WhatsApp trocado por um gravador. Nao toca em producao.
//
// CASO A: cliente escolhe um servico ERRADO e depois TROCA, ACRESCENTA e REMOVE, sem reiniciar o questionario.
// CASO B (Leidiana, orcamento 598): cliente recebe o orcamento PRELIMINAR, volta ao atendimento e conclui os
//         dados; a proposta final substitui a preliminar, sem duplicar servicos e sem recomecar do nome.
//         E as estimativas (5h, 200 convidados, "Outros") NAO viram resposta do cliente.
//
// Rodar:  node teste-rapha-casos-a-b.js   (conferir o CODIGO DE SAIDA)

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
global.Intl.DateTimeFormat = function (l, o) {   // o job so roda 10h-22h: fixa 15h
  if (o && o.hour && !o.minute) return { format: () => "15" };
  return new DTF(l, o);
};

let falhas = 0, seq = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + String(detalhe).slice(0, 260)}`);
  if (!ok) falhas++;
}
const CHAT = "5521900000031";
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
  console.log("\n— CASO A: serviço errado, depois trocar, acrescentar e remover (sem reiniciar) —");
  zerar();
  await ate(["oi", "1", "1", "Maria"]);
  const perguntasDeNomeAntes = todas.filter(t => /Qual o seu nome/.test(t)).length;
  await cliente("0"); // Foto Cabine (errado)
  checar("mostra a confirmação do serviço escolhido", sess().step === "orcamento_servicos_confirmar" && JSON.stringify(sess().orcamento.servicosPrevios) === "[1]", sess().step);
  const rTrocar = await cliente("2"); // Trocar serviço
  checar("trocar volta à escolha de serviços, sem reiniciar", sess().step === "orcamento_servicos_previa", sess().step);
  checar("o nome já informado foi preservado", sess().orcamento.nome === "Maria");
  checar("não pergunta o nome de novo", !/Qual o seu nome/.test(rTrocar));
  await cliente("2"); // Totem Fotográfico
  checar("novo serviço entra na confirmação", sess().step === "orcamento_servicos_confirmar" && JSON.stringify(sess().orcamento.servicosPrevios) === "[2]", JSON.stringify(sess().orcamento.servicosPrevios));
  await cliente("3"); // Adicionar outro serviço
  checar("adicionar abre a escolha do que acrescentar", sess().step === "orcamento_servicos_adicionar", sess().step);
  await cliente("1"); // + Totem Retrô
  checar("adicionar acrescenta, sem apagar o que já estava", sess().step === "orcamento_servicos_confirmar" && sess().orcamento.servicosPrevios.length === 2 && sess().orcamento.servicosPrevios.includes(13) && sess().orcamento.servicosPrevios.includes(2), JSON.stringify(sess().orcamento.servicosPrevios));
  await cliente("4"); // Remover
  checar("remover abre a escolha do que tirar", sess().step === "orcamento_servicos_remover", sess().step);
  await cliente("2"); // tira o Totem Fotográfico
  checar("remover tira só o escolhido", sess().orcamento.servicosPrevios.length === 1 && sess().orcamento.servicosPrevios[0] === 13, JSON.stringify(sess().orcamento.servicosPrevios));
  await cliente("1"); // confirma
  checar("confirmado, segue para a celebração (não recomeça)", sess().step === "orcamento_celebracao", sess().step);
  checar("o nome nunca foi perguntado de novo", todas.filter(t => /Qual o seu nome/.test(t)).length === perguntasDeNomeAntes);

  console.log("\n— CASO B (Leidiana, orç. 598): preliminar, volta ao atendimento e conclui —");
  zerar();
  await ate(["oi", "1", "1", "Leidiana", "0,5"]);
  const rConf = todas[todas.length - 1];
  checar("a confirmação lista Foto Cabine e Foto Lembrança", /Foto Cabine/.test(rConf) && /Foto Lembrança/.test(rConf), rConf);
  await cliente("1"); // confirma os serviços; agora pergunta a celebração
  checar("parou na pergunta da celebração", sess().step === "orcamento_celebracao", sess().step);

  // o cliente some por mais de 1h: lembrete automatico = orçamento PRELIMINAR
  const umaHora = 61 * 60 * 1000;
  Object.assign(sess(), { ultimaInteracao: Date.now() - umaHora, lembreteOrcStep: "orcamento_celebracao", lembreteOrcEstagio: 1, lembreteOrcUltimoEnvio: Date.now() - umaHora, clienteEscreveuTexto: true, menuInicialEnviado: true });
  registro.length = 0;
  await job.executarLembreteOrcamento();
  const prelim = registro.join("\n");
  console.log("   preliminar: " + registro.map(r => r.split("\n")[0].slice(0, 60)).join(" | "));
  checar("saiu o orçamento preliminar (PDF)", /PDF|ARQUIVO|Segue o seu orçamento|Já te mando/.test(prelim), prelim);
  checar("diz que 5 horas e 200 convidados são ESTIMATIVA", /estimativa|estimad/i.test(prelim) && /200/.test(prelim), prelim);
  checar("avisa que o deslocamento NÃO está incluído", /desloca/i.test(prelim), prelim);
  checar("avaliações não vão antes do PDF", !/^AVALIACOES/m.test(prelim), prelim);
  const o1 = sess().orcamento;
  checar("estimativas NÃO viraram resposta do cliente (sem celebração/horas/convidados gravados)", o1.celebracaoId === undefined && o1.horas === undefined && o1.convidados === undefined, JSON.stringify(o1).slice(0, 240));
  checar("nome e serviços informados foram aproveitados", o1.nome === "Leidiana" && (o1.servicosPrevios || []).length === 2);
  checar("estado = PRELIMINAR enviado, aguardando o cliente continuar", o1.situacao === "preliminar" && sess().step === "lembrete_retomar", `${o1.situacao} / ${sess().step}`);

  // o cliente volta: "sim, quero ajustar" continua de onde parou
  const rVolta = await cliente("1");
  checar("volta ao passo onde parou (celebração), sem reiniciar do nome", sess().step === "orcamento_celebracao" && !/Qual o seu nome/.test(rVolta), `${sess().step}`);
  await ate(["4", "100", "10/12/2026", "15:00", "20:00", "Tijuca", "Rio de Janeiro", "pular", "1", "2", "pular", "pular"]);
  checar("dados reais gravados (não 'Outros', 200 ou 5h)", sess().orcamento.celebracaoId === 4 && sess().orcamento.convidados === 100 && /5/.test(String(sess().orcamento.duracao || sess().orcamento.horas || "")), JSON.stringify(sess().orcamento).slice(0, 260));
  console.log("   passo antes do envio final: " + sess().step);
  await cliente("1"); // confirma o resumo
  const o2 = sess().orcamento;
  checar("a proposta final SUBSTITUIU a preliminar (situação definitiva)", o2.situacao === "definitivo", `${o2.situacao} / ${sess().step}`);
  checar("serviços sem duplicação (2 escolhidos, 2 enviados)", (o2.servicosEnviados || []).length === 2, JSON.stringify(o2.servicosEnviados));
  checar("o nome nunca foi perguntado de novo", todas.filter(t => /Qual o seu nome/.test(t)).length === 1);

  devolverSessoes();
  console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { devolverSessoes(); console.error("💥", e); process.exit(1); });

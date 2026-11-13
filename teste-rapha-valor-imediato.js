// teste-rapha-valor-imediato.js - "Só quero saber o valor" / "Não sei ainda" no meio do orçamento (13/11/2026, RJN)
//
// Caso REAL 13/11 01h31 (Aniversário Adolescente): o bot perguntou "Quantos convidados?", o cliente
// respondeu "Só quero saber o valor" (2x) e "Não sei ainda", recebeu "Digite apenas números válidos" 3x
// e foi embora. Agora: preliminar NA HORA, estimativa identificada, dados preservados, continua depois.
// Dirige o handleIncomingMessage REAL com o WhatsApp trocado por um gravador. Nao toca em producao.
// Rodar:  node teste-rapha-valor-imediato.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t)); return true; };
utils.sendOptionList = async (_c, t) => { registro.push("LISTA: " + String(t)); return true; };
utils.enviarPdfComLink = async () => { registro.push("PDF"); };
const chamadasGerar = [];
utils.gerarOrcamento = async (s, _c, slugs, opcoes) => {
  chamadasGerar.push({ slugs, opcoes: opcoes || {}, celebracaoId: s && s.orcamento ? s.orcamento.celebracaoId : null, convidados: s && s.orcamento ? s.orcamento.convidados : null });
  return { id: "T1", url: "https://exemplo/teste.pdf", total: 1 };
};
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
const { clientePedeValor, clienteNaoSabe } = require("./utils/pedidoDeValor.js");

let falhas = 0, seq = 0, CHAT = "5521900000131", n = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + String(detalhe).slice(0, 400)}`);
  if (!ok) falhas++;
}
const sess = () => sessions[CHAT] || {};
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "vi-" + (++seq), text: { message: texto }, fromMe: false });
  if (process.env.DEPURAR) console.log(`   [${texto}] -> ${sess().step} | ${registro.join(" / ").slice(0, 120)}`);
  return registro.join("\n");
}
async function ate(r) { for (const t of r) await cliente(t); }
function zerar() { Object.keys(sessions).forEach(k => delete sessions[k]); chamadasGerar.length = 0; CHAT = "55219000001" + String(40 + (++n)); }
// chega na pergunta "Quantos convidados?" de um Aniversário Adolescente, como no caso real
async function ateConvidados(servico) {
  await ate(["oi", "1", "1", "Bruno", "1", servico, "1"]);
  let r = "", guarda = 0;
  while (sess().step !== "orcamento_convidados" && guarda++ < 6) {
    if (sess().step === "orcamento_celebracao") r = await cliente("4");          // 4 = Aniversário Adolescente
    else r = await cliente("1");
  }
  return r;
}

(async () => {
  console.log("\n— RECONHECIMENTO —");
  const valor = ["Só quero saber o valor", "so quero saber o valor", "Quanto custa?", "qual o valor", "Me passa o valor", "quero saber o preço", "cadê o valor?", "Valor?"];
  const naoValor = ["150", "Aniversário", "não", "obrigado", "sim"];
  checar("pedidos de preço reconhecidos", valor.every(clientePedeValor), valor.filter(v => !clientePedeValor(v)));
  checar("respostas comuns NÃO são pedido de preço", !naoValor.some(clientePedeValor), naoValor.filter(clientePedeValor));
  const nsei = ["Não sei ainda", "não sei", "ainda não defini", "Não tenho essa informação", "não faço ideia", "sei lá"];
  checar("\"não sei\" e parecidos reconhecidos como dado desconhecido", nsei.every(clienteNaoSabe), nsei.filter(v => !clienteNaoSabe(v)));
  checar("número e \"não\" seco NÃO são \"não sei\"", !["150", "não", "nao quero"].some(clienteNaoSabe));

  console.log("\n— CASO REAL: \"Quantos convidados?\" → \"Só quero saber o valor\" (sem serviço escolhido) —");
  zerar();
  await ateConvidados("0");
  sess().orcamento.servicosPrevios = []; sess().orcamento.servicosEnviados = [];   // cliente que ainda não escolheu serviço
  checar("chegou à pergunta de convidados de um Aniversário Adolescente", sess().step === "orcamento_convidados" && Number(sess().orcamento.celebracaoId) === 4, sess().step + " " + sess().orcamento.celebracaoId);
  const r1 = await cliente("Só quero saber o valor");
  checar("NÃO responde \"Digite apenas números válidos\"", !/números válidos/.test(r1), r1);
  checar("responde com a mensagem aprovada (sem precisar de todos os detalhes, 4 e 5 horas)", /não precisa ter todos os detalhes/.test(r1) && /4 e 5 horas/.test(r1), r1);
  checar("estimativa identificada: até 200 convidados", /Estimativa: até 200 convidados/.test(r1), r1);
  checar("deslocamento a confirmar (local não informado)", /deslocamento não está incluído/.test(r1), r1);
  const g = chamadasGerar[chamadasGerar.length - 1] || {};
  checar("orçamento sai NA HORA, enxuto (nenhum serviço escolhido)", g.opcoes && g.opcoes.modelo === "preliminar_enxuto", JSON.stringify(g));
  checar("celebração Aniversário Adolescente preservada no orçamento (não vira \"Outros\")", Number(g.celebracaoId) === 4, JSON.stringify(g));
  checar("convidados entram como estimativa e são desfeitos depois (não ficam gravados)", g.convidados === 200 && !sess().orcamento.convidados, JSON.stringify(g) + " / " + sess().orcamento.convidados);
  checar("termina oferecendo continuar de onde parou", sess().step === "lembrete_retomar" && sess().lembreteRetomarStep === "orcamento_convidados", sess().step + " " + sess().lembreteRetomarStep);
  const volta = await cliente("1");
  checar("cliente volta: continua NA PERGUNTA de convidados, sem reiniciar", sess().step === "orcamento_convidados" && /convidados/i.test(volta) && !/Qual o seu nome/.test(volta), sess().step + " | " + volta);
  const segue = await cliente("150");
  checar("e o questionário segue normal com o número", sess().orcamento.convidados === 150 && sess().step !== "orcamento_convidados", sess().step);

  console.log("\n— CASO REAL: a 3ª mensagem \"Não sei ainda\" —");
  zerar();
  await ateConvidados("0");
  const r3 = await cliente("Não sei ainda");
  checar("\"Não sei ainda\" = dado desconhecido: sem erro, preliminar na hora", !/números válidos/.test(r3) && /4 e 5 horas/.test(r3) && chamadasGerar.length === 1, r3);

  console.log("\n— Com serviço JÁ escolhido: só ele —");
  zerar();
  await ateConvidados("1");
  const escolhidos = (sess().orcamento.servicosPrevios || []).slice();
  await cliente("Só quero saber o valor");
  const g4 = chamadasGerar[chamadasGerar.length - 1] || {};
  checar("orça SÓ o serviço escolhido (não o enxuto)", escolhidos.length === 1 && g4.slugs && g4.slugs.length === 1 && !g4.opcoes.modelo, JSON.stringify({ escolhidos, g4 }));

  console.log("\n— Outras perguntas —");
  zerar();
  await ateConvidados("0");
  await cliente("150");
  const passoData = sess().step;
  const r5 = await cliente("ainda não defini");
  checar(`"ainda não defini" em ${passoData}: preliminar, volta para a mesma pergunta depois`, /4 e 5 horas/.test(r5) && sess().lembreteRetomarStep === passoData, sess().lembreteRetomarStep);
  checar("convidados que o cliente JÁ disse (150) ficam e não aparecem como estimativa", !/Estimativa: até 200/.test(r5) && sess().orcamento.convidados === 150, r5);

  zerar();
  await ate(["oi", "1", "1"]);
  const passoNome = sess().step;
  const r6 = await cliente("Quanto custa?");
  checar(`"Quanto custa?" já na 1ª pergunta (${passoNome}) entrega o preliminar e NÃO vira o nome do cliente`,
    passoNome === "orcamento_nome" && /4 e 5 horas/.test(r6) && !/quanto custa/i.test(String(sess().orcamento.nome || "")), r6.slice(0, 200) + " | nome=" + sess().orcamento.nome);
  const r7 = await cliente("1");
  checar("depois do preliminar, volta para a pergunta do nome", sess().step === "orcamento_nome", sess().step + " | " + r7.slice(0, 120));

  devolverSessoes();
  console.log(`\n${falhas === 0 ? "✅ TUDO CERTO" : "❌ " + falhas + " FALHA(S)"}`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error(e); devolverSessoes(); process.exit(2); });

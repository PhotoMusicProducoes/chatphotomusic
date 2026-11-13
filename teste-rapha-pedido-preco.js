// teste-rapha-pedido-preco.js - reconhecimento AMPLIADO de pedido de preço, por intenção (13/11/2026, RJN)
//
// Pesquisa do ChatGPT com consumidores: quem pergunta preço quer saber se CABE NO BOLSO; pergunta
// demais antes do preço = abandono. Testa as variações novas e os casos em que "valor" NÃO é pedido de
// preço (nome, bairro, frase). Dirige o handleIncomingMessage REAL com o WhatsApp trocado por gravador.
// Rodar:  node teste-rapha-pedido-preco.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t)); return true; };
utils.sendOptionList = async (_c, t) => { registro.push("LISTA: " + String(t)); return true; };
utils.enviarPdfComLink = async () => { registro.push("PDF"); };
const gerados = [];
utils.gerarOrcamento = async (s) => { gerados.push({ convidados: s && s.orcamento ? s.orcamento.convidados : null }); return { id: "T1", url: "https://exemplo/teste.pdf", total: 1 }; };
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => {};
const axios = require("axios");
axios.post = async () => ({ data: {} });
axios.get  = async () => ({ data: {} });

const fs = require("fs");
const ARQ_SESSOES = require("path").join(__dirname, "sessions.json");
const sessoesAntes = fs.existsSync(ARQ_SESSOES) ? fs.readFileSync(ARQ_SESSOES, "utf8") : null;
function devolverSessoes() { if (sessoesAntes === null) { try { fs.unlinkSync(ARQ_SESSOES); } catch (e) {} } else fs.writeFileSync(ARQ_SESSOES, sessoesAntes, "utf8"); }

const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
const { clientePedeValor, intencoesDePreco } = require("./utils/pedidoDeValor.js");

let falhas = 0, seq = 0, n = 0, CHAT = "5521900000300";
function checar(nome, ok, detalhe = "") { console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + String(detalhe).slice(0, 400)}`); if (!ok) falhas++; }
const sess = () => sessions[CHAT] || {};
async function cliente(t) { registro.length = 0; await bot.handleIncomingMessage({ phone: CHAT, messageId: "pp-" + (++seq), text: { message: t }, fromMe: false }); return registro.join("\n"); }
function zerar() { Object.keys(sessions).forEach(k => delete sessions[k]); gerados.length = 0; CHAT = "55219000003" + String(10 + (++n)); }
async function ate(r) { for (const t of r) await cliente(t); }

(async () => {
  console.log("\n— AS 19 FRASES DA PESQUISA —");
  const lista = ["Quanto custa?", "Quanto é?", "Qual o valor?", "Preço?", "Valor?", "Me passa os valores", "Só quero saber o preço",
    "Tem uma base?", "Em média quanto fica?", "A partir de quanto?", "Quanto fica a cabine?", "Valor do 360?", "Quanto cobra?",
    "Qual o mais barato?", "Qto custa?", "Qt fica?", "Preço pfv", "Manda a tabela", "Não sei ainda, só quero o valor"];
  const falhou = lista.filter(f => !clientePedeValor(f));
  checar(`todas reconhecidas como pedido de preço (${lista.length - falhou.length} de ${lista.length})`, falhou.length === 0, falhou);

  console.log("\n— INTENÇÕES (uma mensagem pode ter várias) —");
  const tem = (f, ...k) => { const i = intencoesDePreco(f); return k.every(x => i.has(x)); };
  checar("preço imediato", tem("Quanto fica a cabine?", "preco_imediato"));
  checar("preço aproximado", tem("Tem uma base?", "preco_aproximado") && tem("Em média quanto fica?", "preco_aproximado") && tem("A partir de quanto?", "preco_aproximado"));
  checar("comparação de pacotes", tem("Qual o mais barato?", "comparacao_pacotes"));
  checar("condições de pagamento", tem("Parcela em quantas vezes?", "condicoes_pagamento") && tem("tem desconto no pix?", "condicoes_pagamento"));
  checar("dado não definido + preço juntos", tem("Não sei ainda, só quero o valor", "dado_nao_definido", "preco_imediato"));
  checar("número + preço juntos (\"150 pessoas, quanto fica?\")", tem("150 pessoas, quanto fica?", "preco_imediato"));

  console.log("\n— \"VALOR\" QUE NÃO É PEDIDO DE PREÇO —");
  const nao = ["Valéria", "Valença", "Vila Valqueire", "Valor Sentimental Buffet", "Essa festa tem muito valor pra mim", "Eu valorizo muito vocês",
    "150", "200 pessoas", "Aniversário de 15 anos", "Bruno", "Sim", "não", "20:00", "Barra da Tijuca", "obrigada", "ok, vou ver o valor com meu marido e te falo"];
  const fp = nao.filter(clientePedeValor);
  checar(`nenhuma destas vira pedido de preço (${nao.length - fp.length} de ${nao.length})`, fp.length === 0, fp);

  console.log("\n— NO FLUXO REAL —");
  zerar();
  await ate(["oi", "1", "1"]);
  await cliente("Valéria");
  checar("nome \"Valéria\" é NOME (não dispara preço)", sess().orcamento.nome === "Valéria" && gerados.length === 0, sess().orcamento.nome + " / " + gerados.length);

  zerar();
  await ate(["oi", "1", "1"]);
  const r1 = await cliente("Qto custa?");
  checar("\"Qto custa?\" no nome: preliminar na hora e não vira nome", /4 e 5 horas/.test(r1) && gerados.length >= 1 && !/qto/i.test(String(sess().orcamento.nome || "")), r1.slice(0, 160));

  zerar();
  await ate(["oi", "1", "1", "Bruno", "1", "0", "1"]);
  let g = 0; while (sess().step !== "orcamento_convidados" && g++ < 6) await cliente(sess().step === "orcamento_celebracao" ? "4" : "1");
  const r2 = await cliente("150 pessoas, quanto fica?");
  checar("\"150 pessoas, quanto fica?\": guarda os 150 E manda o preliminar com eles", /4 e 5 horas/.test(r2) && gerados[gerados.length - 1].convidados === 150 && sess().orcamento.convidados === 150 && !/Estimativa: até 200/.test(r2), r2.slice(0, 200));

  zerar();
  await ate(["oi", "1", "1", "Bruno", "1", "0", "1"]);
  g = 0; while (sess().step !== "orcamento_convidados" && g++ < 6) await cliente(sess().step === "orcamento_celebracao" ? "4" : "1");
  await cliente("150");
  const passo = sess().step; await cliente("20/12/2026"); const passo2 = sess().step;
  checar("número de convidados e data seguem o questionário normal (sem preliminar)", passo !== "orcamento_convidados" && passo2 !== passo && gerados.length === 0, `${passo} -> ${passo2} / ${gerados.length}`);

  devolverSessoes();
  console.log(`\n${falhas === 0 ? "✅ TUDO CERTO" : "❌ " + falhas + " FALHA(S)"}`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error(e); devolverSessoes(); process.exit(2); });

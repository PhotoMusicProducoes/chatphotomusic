// teste-rapha-perfil-retorno-ia.js - Rapha: atendimento por PERFIL, CLIENTE QUE VOLTA e IA que extrai (12/11/2026, NAZ)
//
// Dirige o `handleIncomingMessage` REAL com o WhatsApp trocado por um gravador. Nao toca em producao.
// A IA e simulada (nenhuma chamada paga): o modelo falso devolve JSON e o VALIDADOR REAL decide o que presta.
//
// 1. Perfil: festa (menu de celebracoes), empresa e agencia (direto ao corporativo, pergunta o nome da empresa/agencia).
// 2. Cliente que volta: confirma nome+perfil+empresa em UMA pergunta (ou corrige), sem recomecar.
// 3. IA (primeira funcao, so extrair): Marlon e Leidiana anonimizados, agencia, resposta invalida, erro e desligada.
//
// Rodar:  node teste-rapha-perfil-retorno-ia.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t, o) => { registro.push("BOTOES: " + String(t) + " " + JSON.stringify(o || [])); return true; };
utils.sendOptionList = async (_c, t, o) => { registro.push("LISTA: " + String(t) + " " + JSON.stringify(o || [])); return true; };
utils.enviarPdfComLink = async () => { registro.push("PDF"); };
utils.gerarOrcamento = async () => ({ id: "T1", url: "https://exemplo/teste.pdf", total: 1 });
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => { registro.push("AVALIACOES"); };
const axios = require("axios");
axios.post = async () => ({ data: {} });
axios.get  = async () => ({ data: {} });

// IA simulada: troca o MODELO, mantem o extrator e o validador de verdade.
const iaMod = require("./utils/iaExtrair.js");
const criarReal = iaMod.criarExtrator;
let respostaModelo = null;   // o que o "modelo" devolve na proxima chamada
let modeloFalha = false;
let catalogo = null;
let chamadasModelo = 0;
iaMod.criarExtrator = ({ servicos }) => {
  catalogo = servicos;
  const real = criarReal({ servicos });
  return { extrair: (texto) => real.extrair(texto, { chamarModelo: async () => {
    chamadasModelo++;
    if (modeloFalha) throw new Error("fora do ar");
    return respostaModelo;
  } }) };
};

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
let CHAT = "5521996235953"; let nCliente = 0;   // um numero por cenario (o anti-loop do menu limita "oi" repetido)
const sess = () => sessions[CHAT] || {};
const todas = [];
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "pf-" + (++seq), text: { message: texto }, fromMe: false });
  const r = registro.join("\n");
  todas.push(r);
  return r;
}
async function ate(roteiro) { for (const t of roteiro) await cliente(t); }
function zerar(depois) { Object.keys(sessions).forEach(k => delete sessions[k]); todas.length = 0; CHAT = "55219962359" + String(10 + (++nCliente)).slice(-2); if (depois) sessions[CHAT] = depois; }
const idDe = (re) => Number(Object.keys(catalogo || {}).find(id => re.test(catalogo[id])));

(async () => {
  console.log("\n— 1. PERFIL —");
  zerar();
  await ate(["oi", "1", "1", "Carlos"]);
  checar("depois do nome pergunta o PERFIL (festa, empresa ou agência)", sess().step === "orcamento_perfil" && /Agência de eventos/.test(todas[todas.length - 1]), sess().step);
  await cliente("talvez");
  checar("resposta fora do esperado repete as 3 opções", sess().step === "orcamento_perfil" && /Responda com o número/.test(todas[todas.length - 1]));
  await cliente("2");
  checar("empresa: segue para os serviços", sess().step === "orcamento_servicos_previa" && sess().orcamento.perfil === "empresa", sess().step);
  await ate(["0", "1"]);
  const rEmp = todas[todas.length - 1];
  checar("empresa NÃO vê o menu de celebrações: vai direto ao nome da empresa", sess().step === "orcamento_empresa" && !/celebrar/.test(rEmp) && /nome da empresa/.test(rEmp), sess().step + " | " + rEmp);
  checar("empresa fica como Evento Corporativo", sess().orcamento.celebracaoId === 8 && /Corporativo/.test(sess().orcamento.celebracao || ""), JSON.stringify(sess().orcamento.celebracao));
  await cliente("Acme Eventos");
  checar("depois da empresa pergunta os convidados", sess().step === "orcamento_convidados", sess().step);
  checar("guarda nome, perfil e empresa para a próxima vez", sess().clienteConhecido && sess().clienteConhecido.nome === "Carlos" && sess().clienteConhecido.perfil === "empresa" && sess().clienteConhecido.empresa === "Acme Eventos", JSON.stringify(sess().clienteConhecido));
  const conhecido = JSON.parse(JSON.stringify(sess().clienteConhecido));

  zerar();
  await ate(["oi", "1", "1", "Paula", "3", "0", "1"]);
  checar("agência: pergunta o nome da AGÊNCIA (e do cliente final)", sess().step === "orcamento_empresa" && /nome da agência/.test(todas[todas.length - 1]) && sess().orcamento.perfil === "agencia", todas[todas.length - 1]);

  zerar();
  await ate(["oi", "1", "1", "Maria", "1", "0", "1"]);
  checar("festa: continua com o menu de celebrações como sempre", sess().step === "orcamento_celebracao" && /celebrar/.test(todas[todas.length - 1]), sess().step);

  console.log("\n— 2. CLIENTE QUE VOLTA —");
  zerar({ clienteConhecido: conhecido });
  await ate(["oi", "1", "1"]);
  const rVolta = todas[todas.length - 1];
  checar("reconhece o cliente e mostra os dados guardados", sess().step === "orcamento_reuso" && /Carlos/.test(rVolta) && /Acme Eventos/.test(rVolta) && /Empresa/.test(rVolta), rVolta);
  checar("NÃO pergunta o nome nem o perfil de novo", !/Qual o seu nome/.test(rVolta) && !/orçamento é para quem/.test(rVolta));
  await cliente("1");
  checar("confirmou: aproveita nome, perfil e empresa e segue para os serviços", sess().step === "orcamento_servicos_previa" && sess().orcamento.nome === "Carlos" && sess().orcamento.perfil === "empresa" && sess().orcamento.empresa === "Acme Eventos", sess().step);
  await ate(["0", "1"]);
  checar("empresa já conhecida: NÃO pergunta de novo, vai aos convidados", sess().step === "orcamento_convidados", sess().step);

  zerar({ clienteConhecido: conhecido });
  await ate(["oi", "1", "1", "2"]);
  checar("corrigir: volta a perguntar o nome, sem usar os dados antigos", sess().step === "orcamento_nome" && !sess().orcamento.perfil, sess().step);
  await cliente("Carlos Souza");
  checar("depois do nome corrigido pergunta o perfil de novo", sess().step === "orcamento_perfil", sess().step);

  zerar({ clienteConhecido: conhecido });
  await ate(["oi", "1", "1", "talvez"]);
  checar("resposta confusa repete a pergunta de confirmar ou corrigir", sess().step === "orcamento_reuso", sess().step);

  console.log("\n— 3. IA: extrair da mensagem livre (simulada, nada pago) —");
  // 1a chamada so para o extrator nascer e mostrar o catalogo (o modelo falso nao responde nada)
  zerar(); respostaModelo = null;
  await ate(["oi", "1", "1"]);
  await cliente("Bom dia, gostaria de saber mais sobre os serviços de vocês para o final de ano aqui da empresa");
  const idCabine = idDe(/cabine/i), idLembranca = idDe(/lembran/i), id360 = idDe(/360/);
  checar("o catálogo real foi apresentado ao extrator", !!idCabine && !!idLembranca && !!id360, JSON.stringify(catalogo));

  // Marlon, anonimizado
  zerar(); chamadasModelo = 0; modeloFalha = false;
  respostaModelo = { perfil: "social", nome: "Marlon", servicos: [idCabine], celebracao: "casamento", convidados: 150, local: "Magé", data_texto: "24/01/2027", confianca: 0.93 };
  await ate(["oi", "1", "1"]);
  await cliente("Oi, boa tarde! Sou o Marlon, quero foto cabine para o meu casamento no dia 24/01/2027, em Magé, para uns 150 convidados");
  checar("Marlon: o texto livre já é aproveitado (nome, serviço, convidados, data) e o bot confirma o serviço entendido", sess().step === "orcamento_completar" && sess().orcamento.nome === "Marlon" && (sess().orcamento.servicosPrevios || []).join() === String(idCabine) && sess().orcamento.convidados === 150 && /^24\/01\/\d{4}$/.test(sess().orcamento.data || ""), `${sess().step} ${JSON.stringify(sess().orcamento)}`);
  checar("Marlon: casamento reconhecido sem perguntar a celebração", sess().orcamento.celebracaoId === 2 && sess().orcamento.perfil === "social", JSON.stringify(sess().orcamento));
  checar("Marlon: a confirmação do serviço aparece", /Foto Cabine/.test(todas[todas.length - 1]) && /Está certo/.test(todas[todas.length - 1]), todas[todas.length - 1]);

  // Leidiana, anonimizada (sem perfil claro: a pergunta de perfil continua)
  zerar(); respostaModelo = { perfil: "", nome: "Leidiana", servicos: [idCabine, idLembranca], celebracao: "aniversário", convidados: 0, local: "", data_texto: "", confianca: 0.85 };
  await ate(["oi", "1", "1"]);
  await cliente("Olá, meu nome é Leidiana e preciso de foto cabine e foto lembrança para um aniversário, pode me passar valores?");
  checar("Leidiana: nome e 2 serviços aproveitados; perfil não ficou claro, então PERGUNTA", sess().step === "orcamento_perfil" && sess().orcamento.nome === "Leidiana" && sess().orcamento.servicosPrevios.length === 2, `${sess().step} ${JSON.stringify(sess().orcamento.servicosPrevios)}`);
  await cliente("1");
  checar("Leidiana: depois do perfil vai direto à confirmação dos 2 serviços", sess().step === "orcamento_servicos_confirmar", sess().step);

  // Agencia
  zerar(); respostaModelo = { perfil: "agencia", nome: "Paula", servicos: [id360], celebracao: "evento de cliente", convidados: 300, local: "", data_texto: "", confianca: 0.9 };
  await ate(["oi", "1", "1"]);
  await cliente("Oi, aqui é a Paula, da Agência Alfa. Precisamos de plataforma 360 para um evento de um cliente nosso");
  checar("Agência: perfil reconhecido, sem perguntar de novo", sess().orcamento.perfil === "agencia" && sess().step === "orcamento_servicos_confirmar", sess().step);

  // O modelo "inventa": servico inexistente, preco, nome estranho -> descartado/limpo
  zerar(); respostaModelo = { perfil: "social", nome: "x@mail.com 99", servicos: [9999, idCabine], celebracao: "festa", convidados: 99999, local: "", data_texto: "", confianca: 0.9, preco: "R$ 1,00" };
  await ate(["oi", "1", "1"]);
  await cliente("Quero fotos e cabine para a minha festa de aniversario, tenho orcamento de mil reais para gastar com tudo isso");
  checar("serviço inventado é descartado e o nome estranho NÃO vira nome (o bot pergunta)", sess().step === "orcamento_nome" && !sess().orcamento.nome && (sess().orcamento.servicosPrevios || []).join() === String(idCabine), `${sess().step} ${JSON.stringify(sess().orcamento.servicosPrevios)}`);
  checar("nenhum valor da IA entra no orçamento", !JSON.stringify(sess().orcamento).includes("1,00") && sess().orcamento.preco === undefined && !sess().orcamento.convidados);

  // Confianca baixa
  zerar(); respostaModelo = { perfil: "empresa", nome: "Ana", servicos: [idCabine], celebracao: "", convidados: 0, local: "", data_texto: "", confianca: 0.3 };
  await ate(["oi", "1", "1"]);
  await cliente("Bom dia, gostaria de saber mais sobre os serviços de vocês para o final de ano aqui da empresa");
  checar("confiança baixa: IA descartada, fluxo tradicional pergunta o nome", sess().step === "orcamento_nome" && !sess().orcamento.nome && !sess().orcamento.perfil, sess().step);

  // IA fora do ar
  zerar(); modeloFalha = true;
  await ate(["oi", "1", "1"]);
  const rFalha = await cliente("Bom dia, gostaria de saber mais sobre os serviços de vocês para o final de ano aqui da empresa");
  checar("IA fora do ar: o bot NÃO fica mudo e segue pelo fluxo tradicional", sess().step === "orcamento_nome" && /seu nome/i.test(rFalha), rFalha);
  await cliente("Ana");
  checar("e o fluxo continua normal (perfil)", sess().step === "orcamento_perfil", sess().step);

  devolverSessoes();
  console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { devolverSessoes(); console.error("💥", e); process.exit(1); });

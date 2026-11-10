// teste-lembrete-pos-orcamento.js
// Caso real de 10/11/2026: o cliente recebeu TODOS os orcamentos, respondeu
// "Nao" ao convite de personalizar, e 1h depois levou o lembrete
// "Vamos montar o seu orcamento? ... nao deu pra escolher a opcao".
// Quem ja recebeu orcamento NUNCA recebe esse lembrete do menu inicial.
// Roda as funcoes REAIS com o envio do WhatsApp trocado por um gravador.
// Rodar:  node teste-lembrete-pos-orcamento.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); };
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t).split("\n")[0]); };
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

require("./index.js");
const { sessions } = require("./utils/sessions");
const job = require("./jobs/lembreteOrcamento.js");
Object.keys(sessions).forEach(k => delete sessions[k]);

let falhas = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + detalhe}`);
  if (!ok) falhas++;
}

const DTF = Intl.DateTimeFormat;
global.Intl.DateTimeFormat = function (l, o) {
  if (o && o.hour && !o.minute) return { format: () => "15" };
  return new DTF(l, o);
};

const umaHora = 61 * 60 * 1000;
function sessao(extra) {
  return Object.assign({
    step: "aguardando_opcao", menuInicialEnviado: true, clienteEscreveuTexto: true,
    orcamento: { servicosEnviados: [] }, ultimaInteracao: Date.now() - umaHora,
    lembreteOrcStep: "aguardando_opcao", lembreteOrcEstagio: 0, lembreteOrcUltimoEnvio: 0,
  }, extra);
}

(async () => {
  console.log("\n— JA RECEBEU ORCAMENTO E VOLTOU AO MENU: SILENCIO —");
  const casos = {
    "servicos enviados em orcamento": sessao({ orcamento: { servicosEnviados: [1, 2, 3] } }),
    "servicos enviados na raiz da sessao": sessao({ servicosEnviados: [2] }),
    "envio automatico concluido (estagio 9)": sessao({ lembreteOrcEstagio: 9, envioEnxutoOk: true, lembreteOrcStep: "aguardando_opcao" }),
  };
  for (const [nome, s] of Object.entries(casos)) {
    Object.keys(sessions).forEach(k => delete sessions[k]);
    sessions["5521900000010@c.us"] = s;
    registro.length = 0;
    await job.executarLembreteOrcamento();
    checar(`nada enviado: ${nome}`, registro.length === 0, registro.join(" | "));
  }

  console.log("\n— QUEM NUNCA RECEBEU NADA SEGUE COMO ANTES —");
  Object.keys(sessions).forEach(k => delete sessions[k]);
  sessions["5521900000011@c.us"] = sessao({ ultimaInteracao: Date.now() - 31 * 60 * 1000 });
  registro.length = 0;
  await job.executarLembreteOrcamento();
  checar("lembrete do menu ainda sai para quem so sumiu", /Vamos montar o seu or/.test(registro[0] || ""), registro.join(" | "));

  console.log("\n— 'AGORA NAO' DESLIGA A MARCA DO MENU —");
  const fonte = fs.readFileSync(require("path").join(__dirname, "index.js"), "utf8");
  const ini = fonte.indexOf('if (session.step === "lembrete_retomar") {');
  const trecho = fonte.slice(ini, fonte.indexOf('if (session.step === "orcamento_nome_confirmar")', ini));
  checar("ramo 'Agora nao' zera menuInicialEnviado",
    /startsWith\("agora"\)[\s\S]*menuInicialEnviado = false[\s\S]*Os orçamentos ficam aí/.test(trecho));

  console.log("\n— CASO LEANDRA: LEMBRETE NA CORRECAO REENVIA A PERGUNTA CERTA —");
  const iPed = fonte.indexOf("async function pedirProximaCorrecao");
  const trechoPed = fonte.slice(iPed, fonte.indexOf("async function consultarDeslocamento", iPed));
  checar("pedirProximaCorrecao guarda a pergunta pendente",
    /ultimaPerguntaNaoRespondida = textoPergunta/.test(trechoPed));
  const iEsc = fonte.indexOf('session.step = "orcamento_corrigir_escolher";\n    await sendTyping');
  checar("tela 'digite os numeros' guarda a pergunta pendente",
    iEsc > 0 && /ultimaPerguntaNaoRespondida = textoEscolherCorrecao/.test(fonte.slice(iEsc, iEsc + 700)));

  Object.keys(sessions).forEach(k => delete sessions[k]);
  Object.keys(sessions).forEach(k => delete sessions[k]);
  sessions["5521900000012@c.us"] = sessao({
    step: "orcamento_corrigir_valor", lembreteOrcStep: "orcamento_corrigir_valor",
    ultimaInteracao: Date.now() - 31 * 60 * 1000,
    ultimaPerguntaNaoRespondida: "Qual a celebração? (*Digite o número*)",
    orcamento: { nome: "Leandra", celebracao: "Aniversário Adolescente", servicosEnviados: [] }
  });
  registro.length = 0;
  await job.executarLembreteOrcamento();
  checar("lembrete na correcao cita a pergunta da celebracao, nao a tela de confirmacao",
    registro.length === 1 && !/Confira/.test(registro[0]), registro.join(" | "));

  Object.keys(sessions).forEach(k => delete sessions[k]);
  devolverSessoes();
  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ tudo certo");
  process.exit(falhas ? 1 : 0);
})();

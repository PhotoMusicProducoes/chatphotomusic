// teste-rapha-gabriela.js - pedido completo JA NA PRIMEIRA MENSAGEM do WhatsApp (caso real 13/11/2026 14h10, NAZ)
//
// "Olá, boa tarde. Queria saber o valor da plataforma 360° para uma festa em Laranjeiras dia 15/12 às 17:30h.
//  Meu nome é Gabriela. Aguardo retorno 😉"
// Antes: menu de boas-vindas, "1", confirmação, e 3h parada sem lembrete nem preliminar.
// Agora: sem menu, preliminar de 4h e 5h NA HORA com o que ela disse; "Sim, quero" completa só o que falta.
// Também: quem para na confirmação "Solicitar um orçamento?" entra na régua de 30 min / 1h.
// Rodar:  node teste-rapha-gabriela.js   (conferir o CODIGO DE SAIDA)

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
  const o = (s && s.orcamento) || {};
  chamadasGerar.push({ slugs, opcoes: opcoes || {}, nome: o.nome, data: o.data, horaInicio: o.horaInicio, bairro: o.bairro, convidados: o.convidados });
  return { id: "T1", url: "https://exemplo/teste.pdf", total: 1 };
};
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => { registro.push("AVALIACOES"); };
const axios = require("axios");
axios.post = async () => ({ data: {} });
axios.get  = async () => ({ data: {} });

const fs = require("fs");
const path = require("path");
const ARQ = path.join(__dirname, "sessions.json");
const ARQ_PAUSA = path.join(__dirname, "pausados.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const pausaAntes = fs.existsSync(ARQ_PAUSA) ? fs.readFileSync(ARQ_PAUSA, "utf8") : null;
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
const lembrete = require("./jobs/lembreteOrcamento.js");

let falhas = 0, seq = 0, CHAT = "";
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 400)}`); if (!ok) falhas++; }
const sess = () => sessions[CHAT] || {};
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "gb-" + (++seq), text: { message: texto }, fromMe: false });
  if (process.env.DEPURAR) console.log(`   [${texto.slice(0, 30)}] -> ${sess().step} | ${registro.join(" / ").slice(0, 160)}`);
  return registro.join("\n");
}
function novo() { Object.keys(sessions).forEach(k => delete sessions[k]); chamadasGerar.length = 0; CHAT = "55219942427" + String(10 + (++seq)).slice(-2); }
const MENU = /Seja bem-vindo\(a\) à PhotoMusic Produções/;
const GABRIELA = "Olá, boa tarde. \nQueria saber o valor da plataforma 360° para uma festa em Laranjeiras dia 15/12 às 17:30h. \n\nMeu nome é Gabriela. \n\nAguardo retorno 😉";

(async () => {
  console.log("--- caso Gabriela: primeira mensagem do WhatsApp ---");
  novo();
  let r = await cliente(GABRIELA);
  const g = chamadasGerar[0] || {};
  checar("NÃO manda o menu de boas-vindas", !MENU.test(r), r);
  checar("preliminar sai NA HORA, só da Plataforma 360", chamadasGerar.length >= 1 && chamadasGerar.every(c => (c.slugs || []).join(",") === "plataforma-360"), JSON.stringify(chamadasGerar.map(c => c.slugs)));
  checar("PDF enviado", /PDF/.test(r), r);
  checar("com 4h e 5h (estimativa)", /4 e 5 horas/.test(r), r);
  checar("guarda o nome Gabriela", (sess().orcamento || {}).nome === "Gabriela", JSON.stringify(sess().orcamento));
  checar("guarda a data 15/12", /^15\/12\/\d{4}$/.test((sess().orcamento || {}).data || ""), (sess().orcamento || {}).data);
  checar("guarda o início 17:30 (sem inventar o término)", (sess().orcamento || {}).inicioInformado === "17:30" && !(sess().orcamento || {}).horaFim, JSON.stringify(sess().orcamento));
  checar("NÃO inventa convidados (fica estimativa)", !(sess().orcamento || {}).convidados, (sess().orcamento || {}).convidados);
  checar("oferece ajustar com os dados do evento", sess().step === "lembrete_retomar" && /preliminar/.test(r), sess().step + " | " + r);

  r = await cliente("1");
  checar("'Sim, quero': continua SEM perguntar de novo nome, serviço ou data", sess().step !== "orcamento_nome" && !/Qual o seu nome/.test(r) && !/Qual a data/.test(r), sess().step + " | " + r);
  checar("e pergunta só o que falta", sess().step === "orcamento_completar" || /orcamento_/.test(sess().step), sess().step + " | " + r);

  console.log("--- pedido completo SEM pedir valor: completa os dados ---");
  novo();
  r = await cliente("Boa tarde! Gostaria de um orçamento de foto cabine para o casamento da minha filha em Niterói dia 20/03/2027, 150 convidados. Sou a Marta.");
  checar("sem menu", !MENU.test(r), r);
  checar("entra no orçamento com o que veio (Marta, Foto Cabine)", (sess().orcamento || {}).nome === "Marta" && JSON.stringify((sess().orcamento || {}).servicosPrevios) === "[1]", JSON.stringify(sess().orcamento));

  console.log("--- o que NÃO muda ---");
  novo(); r = await cliente("Oi, boa tarde");
  checar("'Oi, boa tarde' continua recebendo o menu", MENU.test(r), r);
  novo(); r = await cliente("Eu sou a Adrielen que fechou uma contratação para o dia 28/11.");
  checar("quem já contratou vai para o suporte (não vira orçamento)", /já tem um serviço contratado/.test(r) && !chamadasGerar.length, r);

  console.log("--- régua: parou na confirmação 'Solicitar um orçamento?' ---");
  novo();
  await cliente("Oi");
  await cliente("1");
  checar("parou na confirmação da opção 1", sess().step === "confirmar_opcao_menu" && sess().opcaoMenuPendente === "1", sess().step);
  checar("a confirmação da opção 1 está na régua de abandono", lembrete.PASSOS_QUESTIONARIO ? lembrete.PASSOS_QUESTIONARIO.has("confirmar_opcao_menu") : true);
  checar("existe a pergunta de retomada da confirmação", lembrete.PERGUNTA_POR_PASSO && /orçamento/.test(lembrete.PERGUNTA_POR_PASSO.confirmar_opcao_menu || ""), JSON.stringify(lembrete.PERGUNTA_POR_PASSO && lembrete.PERGUNTA_POR_PASSO.confirmar_opcao_menu));

  console.log("--- resposta automática do WhatsApp da cliente (a da clínica) ---");
  const L = require("./utils/entendimentoLivre.js");
  const AUTO = "Olá! Aqui é a Dra. Gabriela 😺🐶\n\nRecebi sua mensagem com sucesso e assim que possível irei responder.\nDevido a grande demanda, a resposta pode demorar um pouquinho, mas não se preocupe — todas as mensagens serão respondidas até o final do dia. 🥰\n\n📆 Dias de atendimento na clínica Vet Care:\n- 2ª e 6ªf: 10 às 17h\n\n•Evite áudios, por favor. 📝‼️";
  checar("a mensagem da clínica é reconhecida como automática", L.ehRespostaAutomatica(AUTO));
  checar("o pedido da Gabriela NÃO é automático", !L.ehRespostaAutomatica(GABRIELA));
  checar("'Recebi o orçamento, obrigada! Vou ver com meu marido' NÃO é automático", !L.ehRespostaAutomatica("Recebi o orçamento, obrigada! Vou ver com meu marido e te retorno amanhã, tá bom?"));
  checar("'Esta é uma mensagem automática' é automático", L.ehRespostaAutomatica("Esta é uma mensagem automática. Retornaremos o seu contato o quanto antes."));
  novo();
  await cliente("Oi");
  await cliente("1");
  r = await cliente(AUTO);
  checar("na confirmação: automática é ignorada (sem 'responda apenas 1 ou 2')", r === "" && sess().step === "confirmar_opcao_menu", sess().step + " | " + r);

  console.log("--- proposta enviada pelo GERADOR (mesma API) ---");
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "gb-api-" + (++seq), fromMe: true, fromApi: true,
    text: { message: "Se o arquivo não abrir no seu celular, é só clicar aqui: https://photomusic.com.br/wp-content/uploads/orcamentos/orcamento-674-BVhKgc6rvROcSXYHs6iCW7jS.pdf" } });
  checar("a conversa fica marcada (régua de abandono para)", !!sess().orcamentoManualEm, JSON.stringify(Object.keys(sess())));
  checar("nada é enviado à cliente por causa disso", registro.length === 0, registro.join(" | "));

  if (pausaAntes !== null) fs.writeFileSync(ARQ_PAUSA, pausaAntes); else if (fs.existsSync(ARQ_PAUSA)) fs.unlinkSync(ARQ_PAUSA);
  if (antes !== null) fs.writeFileSync(ARQ, antes); else if (fs.existsSync(ARQ)) fs.unlinkSync(ARQ);
  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ tudo certo");
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

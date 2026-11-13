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
const MENU = /Como posso te ajudar hoje/;   // 13/11: o 1o menu abre com a apresentacao do Rapha
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

  console.log("--- convidados em partes e celebração dita antes (caso real 18h36) ---");
  const LV = require("./utils/entendimentoLivre.js");
  const CV = (x) => LV.convidadosDaResposta(x);
  checar("'20 crianças e 50 adultos' = 70 (não 2050)", CV("20 crianças e 50 adultos") === 70, CV("20 crianças e 50 adultos"));
  checar("'70' = 70", CV("70") === 70);
  checar("'entre 80 e 100' = 100 (faixa = o maior)", CV("entre 80 e 100") === 100, CV("entre 80 e 100"));
  checar("'80 a 100 pessoas' = 100", CV("80 a 100 pessoas") === 100, CV("80 a 100 pessoas"));
  checar("'uns 80, no máximo 100' = 100", CV("uns 80, no máximo 100") === 100, CV("uns 80, no máximo 100"));
  checar("'30 adultos, 15 crianças e 5 bebês' = 50", CV("30 adultos, 15 crianças e 5 bebês") === 50, CV("30 adultos, 15 crianças e 5 bebês"));
  checar("'100 pessoas, festa de 15 anos' = 100 (idade não conta)", CV("100 pessoas, festa de 15 anos") === 100, CV("100 pessoas, festa de 15 anos"));
  checar("'não sei' = nada", CV("não sei") === null);
  const CB = (x) => (LV.celebracaoDoTexto(x) || {}).id || 0;
  checar("'Aniversário da minha filha de 11 anos' = Adolescente", CB("Aniversário da minha filha de 11 anos") === 4);
  checar("'aniversário de 5 anos' = Infantil", CB("aniversário de 5 anos do meu filho") === 3);
  checar("'festa de 15 anos' = 15 anos", CB("festa de 15 anos da Ana") === 1);
  checar("'aniversário de 40 anos' = Adulto", CB("meu aniversário de 40 anos") === 5);
  checar("'casamento' = Casamento", CB("orçamento para casamento") === 2);
  checar("'bodas de prata' = Bodas", CB("bodas de prata dos meus pais") === 6);
  checar("'aniversário' sem idade = não adivinha", CB("é um aniversário") === 0);
  novo();
  await cliente("Olá PhotoMusic Produções! 😊 Encontrei vocês pelo site e fiquei impressionado(a) com as avaliações! Quero saber sobre valores e disponibilidade para o meu evento.");
  await cliente("Aniversário da minha filha de 11 anos");
  checar("a celebração dita fica guardada (Adolescente, 11 anos)", (sess().dadosLivres || {}).celebracaoId === 4 && (sess().dadosLivres || {}).celebracaoIdade === 11, JSON.stringify(sess().dadosLivres));
  let rr = "";
  for (const t of ["1", "1", "Ana", "1", "0,2,5,7,8", "1"]) { rr = await cliente(t); if (sess().step === "orcamento_convidados" || sess().step === "orcamento_convidados_confirmar") break; }
  checar("NÃO pergunta a celebração: anota 'Aniversário Adolescente (11 anos)' e vai aos convidados", /Anotei: \*Aniversário Adolescente\* \(11 anos\)/.test(rr) && sess().step === "orcamento_convidados" && !/o que vai celebrar/.test(rr), sess().step + " | " + rr);
  rr = await cliente("20 crianças e 50 adultos");
  checar("'20 crianças e 50 adultos' grava 70 convidados", (sess().orcamento || {}).convidados === 70, JSON.stringify((sess().orcamento || {}).convidados));

  console.log("--- 'aniversário da minha filha' SEM idade: pergunta a idade ---");
  checar("'aniversário da minha filha' pede a idade", (LV.celebracaoDoTexto("Aniversário da minha filha") || {}).perguntarIdade === "filha");
  checar("idade 11 = Adolescente, 7 = Infantil, 15 = 15 anos, 30 = Adulto", [11, 7, 15, 30].map(LV.celebracaoDaIdade).join(",") === "4,3,1,5", [11, 7, 15, 30].map(LV.celebracaoDaIdade).join(","));
  novo();
  await cliente("Oi");
  await cliente("Aniversário da minha filha");
  for (const t of ["1", "1", "Ana", "1", "0", "1"]) { rr = await cliente(t); if (sess().step === "orcamento_celebracao_idade") break; }
  checar("pergunta 'Quantos anos sua filha vai completar?' (sem a lista)", sess().step === "orcamento_celebracao_idade" && /Quantos anos sua filha vai completar/.test(rr) && !/o que vai celebrar/.test(rr), sess().step + " | " + rr);
  rr = await cliente("11");
  checar("respondeu 11: Aniversário Adolescente e vai aos convidados", (sess().orcamento || {}).celebracaoId === 4 && /Anotei: \*Aniversário Adolescente\* \(11 anos\)/.test(rr) && /orcamento_convidados/.test(sess().step), sess().step + " | " + rr);
  novo();
  await cliente("Oi");
  await cliente("Aniversário do meu filho");
  for (const t of ["1", "1", "Ana", "1", "0", "1"]) { rr = await cliente(t); if (sess().step === "orcamento_celebracao_idade") break; }
  rr = await cliente("ainda não sei");
  checar("sem número na resposta: mostra a lista de celebrações (não trava)", sess().step === "orcamento_celebracao" && /o que vai celebrar/.test(rr), sess().step + " | " + rr);

  console.log("--- identidade do Rapha (uma vez por atendimento) ---");
  const RAPHA = /Eu sou o \*Rapha\* 🤖📸, assistente virtual da PhotoMusic Produções/g;
  novo();
  r = await cliente("Oi, boa tarde");
  checar("1o menu: o Rapha se apresenta como assistente virtual", (r.match(RAPHA) || []).length === 1 && MENU.test(r), r);
  await cliente("1");
  r = await cliente("2");   // "Quero outra opção": o menu volta
  checar("menu de novo na mesma conversa: NÃO repete a apresentação", MENU.test(r) && !(r.match(RAPHA) || []).length, r);
  novo();
  const todas = [];
  todas.push(await cliente(GABRIELA));
  checar("pedido com preço na 1a mensagem: apresentação curta + valor, sem menu", (todas[0].match(RAPHA) || []).length === 1 && !MENU.test(todas[0]) && /PDF/.test(todas[0]), todas[0]);
  todas.push(await cliente("1"));
  checar("na mesma conversa a apresentação não se repete", (todas.join("\n").match(RAPHA) || []).length === 1);
  novo(); r = await cliente("Eu sou a Adrielen que fechou uma contratação para o dia 28/11.");
  checar("quem já contratou: apresentação curta e o suporte na mesma mensagem", (r.match(RAPHA) || []).length === 1 && /já tem um serviço contratado/.test(r), r);
  const ID = require("./utils/identidadeRapha.js");
  checar("identidade em fonte única (nome e função)", ID.NOME === "Rapha" && /assistente virtual/.test(ID.FUNCAO) && /encaminhar seu atendimento para nossa equipe/.test(ID.APRESENTACAO));

  if (pausaAntes !== null) fs.writeFileSync(ARQ_PAUSA, pausaAntes); else if (fs.existsSync(ARQ_PAUSA)) fs.unlinkSync(ARQ_PAUSA);
  if (antes !== null) fs.writeFileSync(ARQ, antes); else if (fs.existsSync(ARQ)) fs.unlinkSync(ARQ);
  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ tudo certo");
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

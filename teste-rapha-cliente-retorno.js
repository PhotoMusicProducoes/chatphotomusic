// teste-rapha-cliente-retorno.js - cliente que VOLTA com orcamento em aberto (13/11/2026, NAZ, caso Luciana / orc. 415)
// Ela recebeu o orcamento em 13/10, ficou sem follow-up e voltou pelo site em 13/11: o bot mandou o menu de cliente novo.
// O PhotoMusic Pro e simulado (rotas /cliente-retorno e /data-livre). Rodar:  node teste-rapha-cliente-retorno.js
// (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (c, t) => { registro.push(`TEXTO[${c}]: ` + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t)); return true; };
utils.sendOptionList = async (_c, t) => { registro.push("LISTA: " + String(t)); return true; };

const LUCIANA = {
  id: 415, criado: "13/10/2026", nome: "Luciana", empresa: "", corporativo: false,
  celebracao: "Aniversário de 15 anos", celebracao_id: 1, convidados: 80, data_evento: "03/04/2027",
  local: "Espaço Múltiplo Zouk", bairro: "Itaipu - Niterói", cidade: "Niterói", servicos: ["Foto Cabine"],
  pdf: "https://photomusic.com.br/wp-content/uploads/orcamentos/orcamento-415-ZDS9qmKVqPPcoNk6gJH0EMsi.pdf",
};
let resposta = null;          // o que a rota /cliente-retorno devolve no teste da vez
let falharRetorno = false;
const posts = [];
const axios = require("axios");
axios.post = async (u, body) => { posts.push({ u, body }); return { data: {} }; };
axios.get = async (u, cfg) => {
  if (/cliente-retorno/.test(u)) { if (falharRetorno) throw new Error("timeout"); return { data: resposta }; }
  if (/data-livre/.test(u)) return { data: { estado: "livre", titulo: "Data disponível", texto: "Temos equipe para essa data." } };
  return { data: { status: "nao_encontrado", bairro: String((cfg && cfg.params && cfg.params.bairro) || ""), cidade: "" } };
};

const fs = require("fs");
const path = require("path");
const ARQ = path.join(__dirname, "sessions.json");
const ARQ_PAUSA = path.join(__dirname, "pausados.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const pausaAntes = fs.existsSync(ARQ_PAUSA) ? fs.readFileSync(ARQ_PAUSA, "utf8") : null;
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
const { estaPausado, retomarCliente } = require("./utils/pauseControl.js");

let falhas = 0, seq = 0;
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 400)}`); if (!ok) falhas++; }
let CHAT = "";
const sess = () => sessions[CHAT] || {};
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "cr-" + (++seq), text: { message: texto }, fromMe: false });
  return registro.join("\n");
}
function novo(resp) {
  Object.keys(sessions).forEach(k => delete sessions[k]);
  CHAT = "55219889262" + String(10 + (++seq)).slice(-2);
  retomarCliente(CHAT);
  resposta = resp; falharRetorno = false; posts.length = 0;
}
const SITE = "Olá PhotoMusic Produções! 😊 Encontrei vocês pelo site e fiquei impressionado(a) com as avaliações! Quero saber sobre valores e disponibilidade para o meu evento.";
const MENU = /Seja bem-vindo\(a\) à PhotoMusic Produções/;

(async () => {
  console.log("--- caso Luciana: volta pelo site ---");
  novo({ ativo: true, bloqueado: false, contratou: false, orcamentos: [LUCIANA] });
  let r = await cliente(SITE);
  checar("NAO manda o menu de cliente novo", !MENU.test(r), r);
  checar("trata pelo nome", /Olá, \*Luciana\*/.test(r), r);
  checar("reconhece serviço, celebração, data e local", /Foto Cabine/.test(r) && /15 anos/.test(r) && /03\/04\/2027/.test(r) && /Zouk/.test(r) && /Itaipu/.test(r), r);
  checar("oferece as 5 continuações + outro assunto", /1\* - Ver meu orçamento anterior/.test(r) && /2\* - Atualizar/.test(r) && /3\* - Verificar a disponibilidade/.test(r) && /4\* - Quero contratar/.test(r) && /5\* - Falar com a equipe/.test(r) && /6\*/.test(r), r);
  checar("NAO mostra preço antigo", !/R\$/.test(r), r);
  checar("passo = retorno_opcao", sess().step === "retorno_opcao", sess().step);

  r = await cliente("1");
  checar("1: manda o PDF do orçamento 415", /orcamento-415/.test(r) && /nº \*415\*/.test(r), r);
  checar("1: avisa que o valor é da data do orçamento", /valores são os da data do orçamento/.test(r), r);

  r = await cliente("3");
  checar("3: consulta a AGENDA e responde a data 03/04/2027", /03\/04\/2027/.test(r) && /Data disponível/.test(r), r);
  checar("3: não promete reserva (equipe confirma)", /equipe confirma/.test(r), r);

  console.log("--- atualizar o orçamento (dados só para confirmar) ---");
  novo({ ativo: true, orcamentos: [LUCIANA] });
  await cliente(SITE);
  r = await cliente("2");
  checar("2: pede só a confirmação de nome e tipo (reuso)", sess().step === "orcamento_reuso" && /Luciana/.test(r), sess().step + " | " + r);
  checar("2: serviço do orçamento anterior já anotado (Foto Cabine)", JSON.stringify((sess().orcamento || {}).servicosPrevios) === "[1]", JSON.stringify(sess().orcamento));
  r = await cliente("1");
  console.log("   depois do reuso: " + sess().step);
  r = await cliente("1");   // celebracao: 15 anos
  checar("convidados do orçamento anterior só são CONFIRMADOS (80)", sess().step === "orcamento_convidados_confirmar" && /80 convidados/.test(r), sess().step + " | " + r);
  r = await cliente("1");
  checar("confirmou 80 e a DATA anterior também só é confirmada", (sess().orcamento || {}).convidados === 80 && sess().step === "orcamento_data_confirmar" && /03\/04\/2027/.test(r), sess().step + " | " + r);

  console.log("--- quero contratar ---");
  novo({ ativo: true, orcamentos: [LUCIANA] });
  await cliente(SITE);
  r = await cliente("4");
  checar("4: responde e chama a equipe", /finalizar a contratação/.test(r) && /QUER CONTRATAR/.test(r), r);
  checar("4: bot para (equipe assume)", estaPausado(CHAT), "nao pausou");
  await new Promise(res => setTimeout(res, 50));
  checar("4: avisa o plugin (lead vai para Negociando)", posts.some(p => /lead-cliente-respondeu/.test(p.u) && p.body && p.body.contratar === true), JSON.stringify(posts.map(p => p.u)));

  console.log("--- outro assunto ---");
  novo({ ativo: true, orcamentos: [LUCIANA] });
  await cliente(SITE);
  r = await cliente("6");
  checar("6: vai para o menu normal", MENU.test(r) && sess().step === "aguardando_opcao", sess().step + " | " + r);

  console.log("--- dois orçamentos em aberto ---");
  const OUTRO = Object.assign({}, LUCIANA, { id: 520, celebracao: "Casamento", data_evento: "10/10/2027", servicos: ["Plataforma 360º"] });
  novo({ ativo: true, orcamentos: [OUTRO, LUCIANA] });
  r = await cliente("Oi, boa tarde");
  checar("pergunta o ASSUNTO: os 2 orçamentos + novo evento + outro assunto", sess().step === "retorno_escolher_assunto" && /Casamento/.test(r) && /15 anos/.test(r) && /novo evento/.test(r) && /Outro assunto/.test(r), sess().step + " | " + r);
  r = await cliente("2");
  checar("escolheu o 2: mostra o da Luciana (15 anos), sem repetir a saudação", sess().step === "retorno_opcao" && /15 anos/.test(r) && /03\/04\/2027/.test(r) && !/Que bom receber/.test(r), r);

  console.log("--- AGÊNCIA: pode ser outro evento ---");
  const AGENCIA = Object.assign({}, LUCIANA, { id: 601, nome: "Carla Eventos", perfil: "agencia", corporativo: true, empresa: "Carla Eventos",
    celebracao: "Evento Corporativo", data_evento: "20/12/2026", servicos: ["Plataforma 360º"] });
  novo({ ativo: true, orcamentos: [AGENCIA], eventos: [] });
  r = await cliente("Bom dia, preciso de um orçamento");
  checar("agência com 1 orçamento: PERGUNTA se é o mesmo evento ou outro", sess().step === "retorno_escolher_assunto" && /Orçamento de/.test(r) && /outro cliente, outra data ou outro serviço/.test(r), sess().step + " | " + r);
  r = await cliente("2");
  checar("novo evento: começa limpo e só confirma nome e tipo (agência)", sess().step === "orcamento_reuso" && /Carla/.test(r) && /Agência/.test(r), sess().step + " | " + r);
  checar("novo evento: NÃO traz data, local, convidados nem serviço do pedido antigo", !(sess().orcamento || {}).servicosPrevios && !((sess().dadosLivres || {}).data) && !((sess().dadosLivres || {}).convidados), JSON.stringify({ o: sess().orcamento, dl: sess().dadosLivres }));

  console.log("--- EVENTO CONTRATADO ---");
  const EVENTO = { id: 288, data_evento: "28/11/2026", motivo: "Aniversário da Adrielen", corporativo: false, nome: "Adrielen" };
  novo({ ativo: true, contratou: true, eventos: [EVENTO], orcamentos: [] });
  r = await cliente("Olá, bom dia");
  checar("tem evento contratado: pergunta se é sobre ele ou um novo orçamento", sess().step === "retorno_escolher_assunto" && /Meu evento contratado/.test(r) && /28\/11\/2026/.test(r) && /novo evento/.test(r) && !MENU.test(r), sess().step + " | " + r);
  r = await cliente("1");
  checar("escolheu o evento: chama a equipe e o bot para", /ajudar com o seu evento/.test(r) && /Cliente com evento contratado/.test(r) && estaPausado(CHAT), r);
  novo({ ativo: true, contratou: true, eventos: [EVENTO], orcamentos: [] });
  await cliente("Olá, bom dia");
  r = await cliente("2");
  checar("contratado que quer NOVO orçamento: começa o orçamento (confirma nome e tipo)", sess().step === "orcamento_reuso" && /Adrielen/.test(r), sess().step + " | " + r);

  console.log("--- quando NAO retoma (fluxo de sempre) ---");
  novo({ ativo: true, bloqueado: true, orcamentos: [LUCIANA] });
  r = await cliente(SITE);
  checar("contato bloqueado: menu normal", MENU.test(r), r);
  novo({ ativo: true, contratou: true, orcamentos: [LUCIANA] });
  r = await cliente(SITE);
  checar("plugin antigo (contratou sem a lista de eventos): menu normal", MENU.test(r), r);
  novo({ ativo: true, orcamentos: [] });
  r = await cliente(SITE);
  checar("sem orçamento: menu normal", MENU.test(r), r);
  novo({ ativo: false });
  r = await cliente(SITE);
  checar("rota desligada no plugin: menu normal", MENU.test(r), r);
  novo(null); falharRetorno = true;
  r = await cliente(SITE);
  checar("plugin fora do ar: menu normal (bot nunca fica mudo)", MENU.test(r), r);

  if (pausaAntes !== null) fs.writeFileSync(ARQ_PAUSA, pausaAntes); else if (fs.existsSync(ARQ_PAUSA)) fs.unlinkSync(ARQ_PAUSA);
  if (antes !== null) fs.writeFileSync(ARQ, antes); else if (fs.existsSync(ARQ)) fs.unlinkSync(ARQ);
  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ tudo certo");
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

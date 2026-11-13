// teste-rapha-retorno-mario.js - cliente que volta e pede um NOVO orçamento: nome guardado, pergunta direto o tipo (13/11/2026, RJN)
//
// Conversa REAL do Mario (13/11 19h13, v363): o Rapha listou 3 eventos e 3 orçamentos; ele escolheu
// "7 - Um novo evento ou novo orçamento"; o bot mandou "Você deseja Solicitar um Orçamento", o aviso de
// parcelamento e "Posso usar esses dados? 1 Sim / 2 Corrigir dados"; o "2" pediu o NOME de novo, quando
// ele só queria trocar o tipo. Agora: nome guardado + "O novo orçamento será para quem? 1/2/3 + 4 Corrigir meu nome".
// O PhotoMusic Pro é simulado. Rodar:  node teste-rapha-retorno-mario.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
const numerado = (t, o) => t + "\n" + (o || []).map(x => `*${x.id}* - ${x.label}`).join("\n");
utils.sendText       = async (_c, t) => { registro.push("TEXTO: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t, o) => { registro.push("BOTOES: " + numerado(t, o)); return true; };
utils.sendOptionList = async (_c, t, o) => { registro.push("LISTA: " + numerado(t, o)); return true; };

const EVENTOS = [
  { id: 901, data_evento: "29/11/2026", motivo: "Evento Teste 29NOV2026", corporativo: false, nome: "Mario Nazeanze" },
  { id: 902, data_evento: "20/12/2026", motivo: "Confraternização de Natal da Equipe 10 2026", corporativo: false, nome: "Mario Nazeanze" },
  { id: 903, data_evento: "10/04/2027", motivo: "Bodas de Prata de Adriana e Mario", corporativo: false, nome: "Mario Nazeanze" },
];
const orc = (id, servicos, celebracao, data, criado) => ({ id, criado, nome: "Mario Nazeanze", empresa: "", corporativo: false, celebracao, celebracao_id: 4,
  convidados: 120, data_evento: data, local: "Salão Antigo", bairro: "Pavuna", cidade: "Rio de Janeiro", servicos, pdf: `https://exemplo/orcamento-${id}.pdf` });
const ORCAMENTOS = [
  orc(640, ["Plataforma 360°"], "Aniversário Adolescente", "", "13/11/2026"),
  orc(600, ["Foto Cabine", "Totem Retrô"], "Outros", "", "09/11/2026"),
  orc(415, ["Foto Cabine", "Plataforma 360°", "Som Completo com DJ"], "Aniversário de 15 anos", "15/11/2026", "13/10/2026"),
];
const axios = require("axios");
axios.post = async () => ({ data: {} });
axios.get  = async (u) => /cliente-retorno/.test(u)
  ? { data: { ativo: true, contratou: true, eventos: EVENTOS, orcamentos: ORCAMENTOS } }
  : { data: {} };

const fs = require("fs");
const ARQ = require("path").join(__dirname, "sessions.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const devolver = () => { if (antes === null) { try { fs.unlinkSync(ARQ); } catch (e) {} } else fs.writeFileSync(ARQ, antes, "utf8"); };

const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
const { retomarCliente } = require("./utils/pauseControl.js");
let falhas = 0, seq = 0, CHAT = "";
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 500)}`); if (!ok) falhas++; }
const sess = () => sessions[CHAT] || {};
async function cliente(t) { registro.length = 0; await bot.handleIncomingMessage({ phone: CHAT, messageId: "rm-" + (++seq), text: { message: t }, fromMe: false }); return registro.join("\n"); }
function novo() { Object.keys(sessions).forEach(k => delete sessions[k]); CHAT = "55219000088" + String(10 + (++seq)).slice(-2); retomarCliente(CHAT); }

(async () => {
  console.log("\n— A conversa real do Mario —");
  novo();
  let r = await cliente("oi");
  const nNovo = (r.match(/\*(\d)\* - [^\n]*novo (evento|orçamento)/i) || [])[1];
  checar("lista os eventos e os orçamentos e oferece um novo orçamento", /Evento Teste 29NOV2026/.test(r) && /Bodas de Prata/.test(r) && !!nNovo, r);
  r = await cliente(nNovo || "7");
  checar("escolheu NOVO orçamento: NÃO repete \"Você deseja Solicitar um Orçamento\"", !/Você deseja \*Solicitar/.test(r), r);
  checar("NÃO manda o aviso de parcelamento antes de saber o que ele quer", !/Parcelamento no Cartão/.test(r), r);
  checar("mostra o nome guardado e pergunta DIRETO para quem é o novo orçamento", sess().step === "orcamento_reuso" && /Mario Nazeanze/.test(r) && /O novo orçamento será para quem/.test(r), sess().step + " | " + r);
  checar("opções: 1 Festa, 2 Empresa, 3 Agência, 4 Corrigir meu nome", /\*1\* - Festa ou evento pessoal/.test(r) && /\*2\* - Empresa/.test(r) && /\*3\* - Agência de eventos/.test(r) && /\*4\* - Corrigir meu nome/.test(r), r);
  r = await cliente("1");
  checar("1 (festa): NÃO pede o nome; segue para os serviços com o nome guardado", sess().step === "orcamento_servicos_previa" && sess().orcamento.nome === "Mario Nazeanze" && sess().orcamento.perfil === "social" && !/Qual o seu nome/.test(r), sess().step + " | " + r);
  checar("NÃO reaproveita data, horário, local, convidados nem serviço de eventos/orçamentos antigos",
    !sess().orcamento.data && !sess().orcamento.horaInicio && !sess().orcamento.bairro && !sess().orcamento.convidados && !(sess().orcamento.servicosPrevios || []).length, JSON.stringify(sess().orcamento));

  console.log("\n— Quer trocar só o tipo (empresa) —");
  novo();
  r = await cliente("oi"); await cliente((r.match(/\*(\d)\* - [^\n]*novo (evento|orçamento)/i) || [])[1] || "7");
  r = await cliente("2");
  checar("2 (empresa): mantém o nome, troca o tipo e pergunta os serviços (sem pedir o nome)", sess().orcamento.perfil === "empresa" && sess().orcamento.nome === "Mario Nazeanze" && !/Qual o seu nome/.test(r), JSON.stringify(sess().orcamento));

  console.log("\n— Quer corrigir o nome —");
  novo();
  r = await cliente("oi"); await cliente((r.match(/\*(\d)\* - [^\n]*novo (evento|orçamento)/i) || [])[1] || "7");
  r = await cliente("4");
  checar("4: só agora pergunta o nome", sess().step === "orcamento_nome" && /Qual o seu nome/.test(r), sess().step + " | " + r);
  r = await cliente("Mário Nazeanze Silva");
  checar("depois do nome corrigido, pergunta o tipo (fluxo normal)", sess().step === "orcamento_perfil" && sess().orcamento.nome === "Mário Nazeanze Silva", sess().step);

  console.log("\n— Cliente NOVO: nada muda —");
  Object.keys(sessions).forEach(k => delete sessions[k]); CHAT = "5521900008899"; retomarCliente(CHAT);
  axios.get = async () => ({ data: { ativo: true, orcamentos: [], eventos: [] } });
  await cliente("oi"); await cliente("1");
  r = await cliente("1");
  checar("cliente novo continua com o eco, o parcelamento e a pergunta do nome", /Você deseja \*Solicitar/.test(r) && /Parcelamento no Cartão/.test(r) && /Qual o seu nome/.test(r) && sess().step === "orcamento_nome", sess().step + " | " + r);

  devolver();
  console.log(`\n${falhas === 0 ? "✅ TUDO CERTO" : "❌ " + falhas + " FALHA(S)"}`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error(e); devolver(); process.exit(2); });

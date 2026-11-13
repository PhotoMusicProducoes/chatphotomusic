// teste-contratar-varios-servicos.js - contratar PARTE dos serviços do orçamento, pacote de cada um e GuestBook (13/11/2026, RJN)
//
// Teste do Mario no ar (orçamento 688, Totem Retrô + Som e DJ): o bot perguntou UM pacote (Premium/Tirinha/Gold)
// como se valesse para tudo e deu como certo que ele queria os dois serviços. Regras do Mario:
// foto impressa (Cabine, Totem Retrô, Totem, Lembrança) = UMA só; os outros = todos, alguns ou um;
// pacote é de cada serviço; casamento e 15 anos = perguntar o GuestBook.
// Rodar:  node teste-contratar-varios-servicos.js   (conferir o CODIGO DE SAIDA)

const fs = require("fs");
const path = require("path");
const ARQ = path.join(__dirname, "sessions.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const devolver = () => { if (antes === null) { try { fs.unlinkSync(ARQ); } catch (e) {} } else fs.writeFileSync(ARQ, antes, "utf8"); };

const enviados = [];
const utils = require("./utils/index.js");
const numerado = (t, o) => t + "\n\n" + (o || []).map(x => `*${x.id}* - ${x.label}`).join("\n");
utils.sendText       = async (c, t) => { enviados.push([String(c), String(t)]); return true; };
utils.sendTyping     = async () => {};
utils.sendButtonList = async (c, t, o) => { enviados.push([String(c), "BOTOES: " + numerado(t, o)]); return true; };
utils.sendOptionList = async (c, t, o) => { enviados.push([String(c), "LISTA: " + numerado(t, o)]); return true; };
utils.sendFileByUrl  = async () => true;
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
const axios = require("axios");
let plugin = {};
axios.post = async () => ({ data: { v2: true, status: "negociando", id: 1, nome: "Cliente", ja_pausado: false } });
axios.get  = async (u) => ({ data: /orcamentos-do-cliente/.test(u) ? plugin : {} });

const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
const OPER = "5521964428172@c.us";
let falhas = 0, seq = 0, CHAT = "";
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 600)}`); if (!ok) falhas++; }
async function cliente(t) { enviados.length = 0; await bot.handleIncomingMessage({ phone: CHAT, messageId: "vs-" + (++seq), text: { message: t }, fromMe: false }); await new Promise(r => setTimeout(r, 20)); }
const doCli = () => enviados.filter(e => e[0].replace(/\D/g, "").endsWith(CHAT.slice(-8))).map(e => e[1]).join("\n");
const doOp = () => enviados.filter(e => e[0] === OPER).map(e => e[1]).join("\n");
function novo(orc) { Object.keys(sessions).forEach(k => delete sessions[k]); CHAT = "55219000077" + String(10 + (++seq % 80)); plugin = { ativo: true, orcamentos: [orc] };
  sessions[CHAT] = { step: "finalizado", menuInicialEnviado: true, orcamento: { nome: "Mario Nazeanze", servicosEnviados: [] }, servicosEnviados: [] }; }

const PAG = { pix_avista: "PIX à vista", pix_parcelado: "PIX parcelado até o evento", cartao: "Cartão de crédito (até 10x)" };
// orçamento REAL do teste do Mario (nº 688)
const O688 = { id: 688, criado: "13/11/2026", data_evento: "20/05/2027", celebracao: "Aniversário Adulto", empresa: "", total: 3394,
  itens: [{ slug: "totem-retro", servico: "Totem Retrô", pacote: "Pacote Premium", horas: 4, valor: 1997 },
          { slug: "som-dj", servico: "Som Completo com DJ", pacote: "2 Caixas Ativas + 2 Subgrave", horas: 4, valor: 1597 }],
  opcoes: [], pacotes: ["Premium", "Tirinha", "Gold"], duracoes: [3, 4], horas_proposta: 4, pagamentos: PAG, pacote_definido: true,
  pacotes_servico: { "totem-retro": ["Premium", "Tirinha", "Gold"], "som-dj": ["2 Caixas Ativas + 2 Subgrave", "2 Caixas Ativas"] }, guestbook_sugerir: false };
// casamento com 4 fotos impressas (opções), 360 e DJ
const CASA = { id: 700, criado: "20/11/2026", data_evento: "10/10/2027", celebracao: "Casamento", empresa: "", total: 5000,
  itens: [{ slug: "plataforma-360", servico: "Plataforma 360°", pacote: "Plataforma 360°", horas: 5, valor: 1297 },
          { slug: "som-dj", servico: "Som Completo com DJ", pacote: "2 Caixas Ativas + 2 Subgrave", horas: 5, valor: 1497 }],
  opcoes: [{ slug: "foto-cabine", servico: "Foto Cabine", pacote: "Pacote Premium", horas: 5, valor: 2297 },
           { slug: "totem-retro", servico: "Totem Retrô", pacote: "Pacote Premium", horas: 5, valor: 2297 },
           { slug: "totem", servico: "Totem Fotográfico", pacote: "Pacote Premium", horas: 5, valor: 2197 },
           { slug: "foto-lembranca", servico: "Foto Lembrança", pacote: "Tradicional", horas: 5, valor: 1397 }],
  pacotes: ["Premium", "Tirinha", "Gold"], duracoes: [], horas_proposta: 5, pagamentos: PAG, pacote_definido: true,
  pacotes_servico: { "foto-cabine": ["Premium", "Tirinha", "Gold"], "som-dj": ["2 Caixas Ativas + 2 Subgrave", "2 Caixas Ativas"] }, guestbook_sugerir: true };

(async () => {
  console.log("\n— Orçamento REAL 688 (Totem Retrô + Som e DJ): quer SÓ o Totem Retrô —");
  novo(O688);
  await cliente("quero contratar");
  let r = doCli();
  checar("pergunta QUAIS serviços (Totem Retrô, Som e DJ, Todos), não um pacote para tudo", /Quais serviços você quer contratar/.test(r) && /\*1\* - Totem Retrô/.test(r) && /\*2\* - Som Completo com DJ/.test(r) && /\*3\* - Todos/.test(r), r);
  await cliente("1");
  r = doCli();
  checar("pacote é DO Totem Retrô (Premium/Tirinha/Gold)", /pacote\* de \*Totem Retrô\*/.test(r) && /Premium/.test(r) && /Gold/.test(r), r);
  await cliente("Premium");
  checar("não pergunta pacote do Som (ele não quer o Som)", !/Som Completo com DJ/.test(doCli()) && /duração/.test(doCli()), doCli());
  await cliente("2"); await cliente("1");
  r = doCli();
  checar("resumo: só o Totem Retrô com o pacote; valor 'conforme o orçamento' (combinação diferente)", /• Totem Retrô · Pacote \*Premium\*/.test(r) && !/Som Completo/.test(r) && /Valor conforme o seu orçamento/.test(r) && !/Total da proposta/.test(r), r);
  await cliente("1");
  const op = doOp(); const link = (op.match(/https:\/\/\S+pm_evento_do_orcamento\S+/) || [""])[0];
  checar("operador: serviços diferentes da proposta + link só com o Totem e o pacote", /serviços ou pacotes diferentes da proposta/.test(op) && /servicos=totem-retro(&|$)/.test(link) && /pacotes=totem-retro%3APremium/.test(link), op);

  console.log("\n— 688: quer os DOIS, com o pacote de cada um igual à proposta —");
  novo(O688);
  await cliente("quero contratar"); await cliente("Todos");
  r = doCli();
  checar("\"Todos\": segue para o pacote do Totem Retrô", /pacote\* de \*Totem Retrô\*/.test(r), r);
  await cliente("1");
  r = doCli();
  checar("depois pergunta o pacote do SOM, com os pacotes do Som", /pacote\* de \*Som Completo com DJ\*/.test(r) && /2 Caixas Ativas \+ 2 Subgrave/.test(r) && !/Tirinha/.test(r), r);
  await cliente("1"); await cliente("2"); await cliente("1");
  r = doCli();
  checar("tudo igual à proposta: mostra o total EXATO", /Total da proposta: \*R\$ 3\.394,00\*/.test(r), r);

  console.log("\n— 688: os dois, mas o Som com o pacote menor —");
  novo(O688);
  await cliente("quero contratar"); await cliente("1 e 2"); await cliente("Premium"); await cliente("2 Caixas Ativas");
  await cliente("2"); await cliente("1");
  r = doCli();
  checar("\"2 Caixas Ativas\" NÃO é \"2 Caixas Ativas + 2 Subgrave\": sem total, a equipe confirma", /Pacote \*2 Caixas Ativas\*/.test(r) && /Valor conforme o seu orçamento/.test(r), r);

  console.log("\n— Casamento: 4 fotos impressas (só uma), 360 e DJ, GuestBook —");
  novo(CASA);
  await cliente("quero contratar");
  r = doCli();
  checar("foto impressa: pergunta qual (UMA), com as 4 e \"Nenhuma\"", /4 opções de foto impressa/.test(r) && /\*uma\* delas/.test(r) && /Foto Lembrança/.test(r) && /Nenhuma, só os outros serviços/.test(r), r);
  await cliente("1");
  r = doCli();
  checar("depois: QUAIS outros serviços (360, DJ, Todos)", /Quais outros serviços/.test(r) && /Plataforma 360°/.test(r) && /Som Completo com DJ/.test(r) && /Todos/.test(r), r);
  await cliente("1");
  r = doCli();
  checar("só a 360 junto: pergunta o pacote da Foto Cabine (a 360 tem um pacote só)", /pacote\* de \*Foto Cabine\*/.test(r), r);
  await cliente("1");
  r = doCli();
  checar("casamento com foto impressa: pergunta o GuestBook", /GuestBook/.test(r) && /Casamento/.test(r), r);
  await cliente("Sim");
  await cliente("1");
  r = doCli();
  checar("resumo com Foto Cabine + 360 e o GuestBook", /• Foto Cabine · Pacote \*Premium\*/.test(r) && /• Plataforma 360°/.test(r) && !/Som Completo/.test(r) && /GuestBook: \*sim\*/.test(r), r);
  await cliente("1");
  checar("operador sabe do GuestBook", /GuestBook/.test(doOp()) && /guestbook=1/.test(doOp()), doOp());

  console.log("\n— Casamento sem foto impressa —");
  novo(CASA);
  await cliente("quero contratar"); await cliente("5");
  await cliente("Todos");
  r = doCli();
  checar("\"Nenhuma\": segue com os outros e NÃO pergunta GuestBook (é das fotos)", /pacote\* de \*Som Completo com DJ\*/.test(r), r);
  await cliente("1");
  checar("sem GuestBook sem foto impressa", !/GuestBook/.test(doCli()), doCli());

  devolver();
  console.log(`\n${falhas === 0 ? "✅ TUDO CERTO" : "❌ " + falhas + " FALHA(S)"}`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error(e); devolver(); process.exit(2); });

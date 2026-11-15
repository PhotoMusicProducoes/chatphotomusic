// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-followup-v3.js
// Follow-up V3 (14/11/2026, RJN): textos por perfil, confirmação de envio/erro, "Agora não" com lembrete e
// aviso de que o operador respondeu. Job e handleIncomingMessage REAIS com WhatsApp e site trocados por gravadores.
// Rodar:  node teste-followup-v3.js   (conferir o CÓDIGO DE SAÍDA)

const fs = require("fs");
const path = require("path");
const ARQ_SESSOES = path.join(__dirname, "sessions.json");
const ARQ_RR = path.join(__dirname, "followupRespostaRapida.json");
const ARQ_PAUSA = path.join(__dirname, "pausados.json");
const guardar = (a) => (fs.existsSync(a) ? fs.readFileSync(a, "utf8") : null);
const sessoesAntes = guardar(ARQ_SESSOES), rrAntes = guardar(ARQ_RR), pausaAntes = guardar(ARQ_PAUSA);
function devolver(a, c) { if (c === null) { try { fs.unlinkSync(a); } catch (e) {} } else fs.writeFileSync(a, c, "utf8"); }
try { fs.unlinkSync(ARQ_RR); } catch (e) {}

const enviados = [];
let falharEnvio = false;
const utils = require("./utils/index.js");
utils.sendText       = async (c, t) => { enviados.push([String(c), String(t)]); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => true;
utils.sendButtonList = async (c, t, o) => { if (falharEnvio) throw new Error("WhatsApp fora do ar"); enviados.push([String(c), "BOTOES: " + t + "\n\n" + (o || []).map(x => `*${x.id}* - ${x.label}`).join("\n")]); return true; };
utils.sendOptionList = async (c, t) => { enviados.push([String(c), "LISTA: " + t]); return true; };
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => {};

const axios = require("axios");
let respostaPlugin = {};
let leadsPlugin = { leads: [] };
const posts = [];
axios.post = async (url, body) => { posts.push([url, body]); return { data: /lead-cliente-respondeu/.test(url) ? respostaPlugin : {} }; };
axios.get  = async (url) => ({ data: /leads-followup/.test(url) ? leadsPlugin : {} });

const rr  = require("./utils/followupRespostaRapida.js");
const job = require("./jobs/followupLeads.js");
const T = require("./jobs/followupTextosV3.js");
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
const OPERADOR = "5521964428172@c.us";

let falhas = 0, seq = 0;
function checar(nome, ok, detalhe = "") { console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + String(detalhe).slice(0, 500)}`); if (!ok) falhas++; }
const precos = { colunas: [{ titulo: "Premium", total: 2297 }, { titulo: "Tirinha", total: 1997 }, { titulo: "Gold", total: 1797 }], cartao_parcelas: 10 };
const desc = { Premium: "Até 4 fotos 10x15 ou 6 tirinhas 5x15", Tirinha: "Até 4 tirinhas 5x15", Gold: "1 foto 10x15 ou 2 tirinhas 5x15" };
function lead(extra) {
  return Object.assign({ id: 88, telefone: "5521990008888", nome: "Ana Souza", tipo: "d1", celebracao: "Aniversário de 15 anos", dataEvento: "14/03/2027",
    dias: 1, servicos: "Foto Cabine", precos, pacotes_descricao: desc, agenda: "livre", perfil: "social" }, extra);
}
async function cliente(chat, texto, fromMe = false) {
  enviados.length = 0; posts.length = 0;
  await bot.handleIncomingMessage({ phone: chat, messageId: "fv3-" + (++seq), text: { message: texto }, fromMe });
  await new Promise(r => setTimeout(r, 40));
}
const paraCliente = (chat) => enviados.filter(e => e[0].replace(/\D/g, "").endsWith(chat.slice(-8))).map(e => e[1]).join("\n");

(async () => {
  console.log("--- textos (3 perfis x 7 etapas) ---");
  const etapas = ["d1", "d3", "d7", "e30", "e15", "proximo", "lembrete"];
  const todos = {};
  for (const perfil of ["social", "empresa", "agencia"]) {
    todos[perfil] = etapas.map(tipo => T.corpoV3(lead({ perfil, tipo, empresa: perfil === "social" ? "" : "Empresa Exemplo", celebracao: perfil === "social" ? "Aniversário de 15 anos" : "Evento Corporativo" })));
  }
  const tudo = Object.values(todos).flat();
  checar("todas curtas (até 520 caracteres, sem tabela de preços)", tudo.every(t => t.length <= 520), tudo.map(t => t.length).join(","));
  checar("cada etapa com título próprio (a 1a linha muda)", ["social", "empresa", "agencia"].every(p => new Set(todos[p].map(t => t.split("\n")[0])).size === etapas.length));
  checar("sem desconto inexistente, sem 'condição especial', sem 'última chance', sem 'agenda concorrida'",
    !tudo.some(t => /desconto|condição especial|última chance|concorrida|reta final|caber no seu bolso/i.test(t)), "");
  checar("nenhuma afirma conformidade com a LGPD", !tudo.some(t => /LGPD/.test(t)));
  checar("empresa e agência: sem linguagem religiosa ou familiar", ![...todos.empresa, ...todos.agencia].some(t => /Deus|família|❤️|carinho/.test(t)));
  checar("sem travessão longo e coração só vermelho", !tudo.some(t => /—|[💙💚💛🧡💜🖤🤍💗💖]/u.test(t)));
  checar("preço em UMA linha só na D+1", (todos.social[0].match(/💰/g) || []).length === 1 && !todos.social.slice(2).some(t => /💰/.test(t)));
  const d3 = todos.social[1];
  checar("D+3: opção mais econômica COM a diferença real do pacote (valores do motor)",
    /pacote \*Gold\* fica em \*R\$ 1\.797,00\*/.test(d3) && /\*Gold\*, 1 foto 10x15 ou 2 tirinhas 5x15/.test(d3) && /\*Premium\*, até 4 fotos 10x15 ou 6 tirinhas 5x15/.test(d3), d3);
  const d3som = T.corpoV3(lead({ tipo: "d3", servicos: "Som Completo com DJ", pacotes_descricao: {} }));
  checar("D+3 sem descrição do pacote (ex.: Som): NÃO inventa diferença, oferece tirar dúvidas", !/econômica|diferença/.test(d3som) && /dúvida/.test(d3som), d3som);
  checar("E-15 avisa que é a última mensagem", /última mensagem/.test(todos.social[4]) && /última mensagem/.test(todos.empresa[4]));
  checar("agenda REAL: livre diz que há disponibilidade", /Ainda temos disponibilidade/.test(T.corpoV3(lead({ tipo: "d7", agenda: "livre" }))));
  checar("agenda REAL: última vaga só quando é verdade", /só mais uma disponibilidade/.test(T.corpoV3(lead({ tipo: "d7", agenda: "ultima" }))));
  const semAgenda = T.corpoV3(lead({ tipo: "d7", agenda: "" }));
  checar("sem informação da agenda: não afirma disponibilidade", !/disponibilidade/.test(semAgenda) && /reservada assim que o contrato/.test(semAgenda), semAgenda);
  checar("agenda lotada: não promete a data", !/temos disponibilidade/i.test(T.corpoV3(lead({ tipo: "d7", agenda: "lotada" }))));

  console.log("--- português e concordância (ajustes do ChatGPT) ---");
  checar("sem 'resumo d proposta', 'aprovação de a proposta' nem 'cliente para ... para'",
    !tudo.some(t => /resumo d proposta|de a proposta|para o seu cliente para/.test(t)), tudo.find(t => /resumo d proposta|de a proposta|para o seu cliente para/.test(t)));
  const bodas = T.corpoV3(lead({ tipo: "e15", celebracao: "Bodas" })), form = T.corpoV3(lead({ tipo: "proximo", celebracao: "Formatura" }));
  checar("concordância: 'das *Bodas*' e 'A *Formatura* ... está'", /15 dias das \*Bodas\*/.test(bodas) && /A \*Formatura\*.* está bem perto/.test(form), bodas + " || " + form);
  checar("concordância: 'As *Bodas* ... estão bem perto'", /As \*Bodas\*.* estão bem perto/.test(T.corpoV3(lead({ tipo: "proximo", celebracao: "Bodas" }))));
  checar("D+1 mostra a FAIXA da proposta (nenhum pacote apresentado como escolhido)", /os pacotes vão de \*R\$ 1\.797,00\* a \*R\$ 2\.297,00\*/.test(todos.social[0]) && !/Pacote \*Premium\*/.test(todos.social[0]), todos.social[0]);
  checar("D+3: a opção econômica é SUGESTÃO (sem repetir 'proposta')", /uma sugestão: a proposta com o pacote/.test(d3) && !/sugestão da sua proposta/.test(d3), d3);

  console.log("--- envio com confirmação (sem duplicidade) ---");
  leadsPlugin = { v2: true, v3: true, leads: [lead({ tipo: "d1" })] };
  enviados.length = 0; posts.length = 0;
  await job.executarFollowupLeads();
  const reg = posts.find(p => /leads-followup-registrar/.test(p[0]));
  checar("envia com botões e CONFIRMA o envio (ok)", /BOTOES: \*📸 Sua proposta da PhotoMusic\*/.test(paraCliente("5521990008888")) && reg && reg[1].ok === true && reg[1].tipo === "d1", JSON.stringify(posts));
  falharEnvio = true; posts.length = 0;
  await job.executarFollowupLeads();
  const regErro = posts.find(p => /leads-followup-registrar/.test(p[0]));
  checar("envio que FALHA avisa o erro (a reserva é solta, nada marcado como enviado)", regErro && regErro[1].ok === false && /WhatsApp fora/.test(regErro[1].erro), JSON.stringify(posts));
  falharEnvio = false;

  console.log("--- um ciclo por vez (proteção do número) ---");
  leadsPlugin = { v2: true, v3: true, leads: [lead({ id: 501, telefone: "5521990005010" }), lead({ id: 502, telefone: "5521990005020" })] };
  enviados.length = 0;
  await Promise.all([job.executarFollowupLeads(), job.executarFollowupLeads()]);
  const nEnv = enviados.filter(e => /BOTOES:/.test(e[1])).length;
  checar("dois ciclos ao mesmo tempo: o segundo espera (2 envios, não 4; o intervalo entre mensagens não cai)", nEnv === 2, nEnv);
  const fonte = fs.readFileSync(path.join(__dirname, "jobs/followupLeads.js"), "utf8");
  checar("depois de um erro, a próxima também espera o intervalo sorteado", /erros\+\+;\s*\/\/ depois de um erro[\s\S]{0,200}esperaEntreEnvios/.test(fonte));

  console.log("--- \"Agora não\" ---");
  const A = "5521990007777";
  Object.keys(sessions).forEach(k => delete sessions[k]);
  rr.marcarFollowupEnviado(A, { leadId: 9, perfil: "social", nome: "Bia" });
  respostaPlugin = { v2: true, v3: true, status: "agora_nao", id: 9, nome: "Bia", pode_lembrete: true };
  await cliente(A, "3");
  checar("\"Agora não\": pergunta UMA vez se pode lembrar perto da data", /Posso te enviar um lembrete perto da data do evento\?/.test(paraCliente(A)), paraCliente(A));
  await cliente(A, "1");
  const lem = posts.find(p => /lead-lembrete-resposta/.test(p[0]));
  checar("\"Sim\": avisa o site (só um lembrete perto da data) e confirma ao cliente", lem && lem[1].quer === true && /Combinado/.test(paraCliente(A)), JSON.stringify(posts) + " | " + paraCliente(A));
  Object.keys(sessions).forEach(k => delete sessions[k]);
  rr.marcarFollowupEnviado(A, { leadId: 9, perfil: "social", nome: "Bia" });
  await cliente(A, "3");
  await cliente(A, "2");
  const lem2 = posts.find(p => /lead-lembrete-resposta/.test(p[0]));
  checar("\"Não\": avisa o site e encerra sem mais mensagens da proposta", lem2 && lem2[1].quer === false && /Não vou mais enviar/.test(paraCliente(A)), JSON.stringify(posts));
  Object.keys(sessions).forEach(k => delete sessions[k]);
  rr.marcarFollowupEnviado(A, { leadId: 9, perfil: "social", nome: "Bia" });
  respostaPlugin = { v2: true, v3: true, status: "agora_nao", id: 9, nome: "Bia" };   // já perguntado antes / sem data
  await cliente(A, "3");
  checar("sem permissão para perguntar (já perguntado ou sem data): resposta de sempre", !/lembrete perto da data/.test(paraCliente(A)) && /Vou parar os lembretes/.test(paraCliente(A)), paraCliente(A));

  console.log("--- operador respondeu pelo WhatsApp ---");
  await cliente("5521990006666", "Oi! Montamos 1h antes do início, tudo bem?", true);
  const op = posts.find(p => /lead-operador-respondeu/.test(p[0]));
  checar("mensagem do operador ao cliente (pelo celular) avisa o site", op && String(op[1].telefone).endsWith("990006666"), JSON.stringify(posts));
  await cliente("5521990006666", "listarpausas", true);   // comando só de leitura
  checar("comando do operador NÃO conta como resposta ao cliente", !posts.some(p => /lead-operador-respondeu/.test(p[0])), JSON.stringify(posts));

  devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes); devolver(ARQ_PAUSA, pausaAntes);
  console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ TUDO CERTO");
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes); process.exit(2); });

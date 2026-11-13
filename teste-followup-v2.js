// teste-followup-v2.js - follow-up v2: parar a regua, texto por perfil e respostas rapidas 1/2/3 (13/11/2026, RJN)
//
// Dirige o job e o `handleIncomingMessage` REAIS com o WhatsApp e o PhotoMusic Pro trocados por gravadores.
// Nao toca em producao. Rodar:  node teste-followup-v2.js   (conferir o CODIGO DE SAIDA)

const fs = require("fs");
const path = require("path");
const ARQ_SESSOES = path.join(__dirname, "sessions.json");
const ARQ_RR = path.join(__dirname, "followupRespostaRapida.json");
const guardar = (a) => (fs.existsSync(a) ? fs.readFileSync(a, "utf8") : null);
const sessoesAntes = guardar(ARQ_SESSOES), rrAntes = guardar(ARQ_RR);
function devolver(a, c) { if (c === null) { try { fs.unlinkSync(a); } catch (e) {} } else fs.writeFileSync(a, c, "utf8"); }
try { fs.unlinkSync(ARQ_RR); } catch (e) {}

const enviados = [];   // [destino, texto]
const utils = require("./utils/index.js");
utils.sendText       = async (c, t) => { enviados.push([String(c), String(t)]); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => true;
// igual ao sendButtonList de verdade: o corpo leva as opcoes numeradas (quem nao ve botao responde o numero)
utils.sendButtonList = async (c, t, o) => { enviados.push([String(c), "BOTOES: " + t + "\n\n" + (o || []).map(x => `*${x.id}* - ${x.label}`).join("\n")]); return true; };
utils.sendOptionList = async (c, t) => { enviados.push([String(c), "LISTA: " + t]); return true; };
utils.enviarPdfComLink = async () => {};
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => {};

const axios = require("axios");
let respostaPlugin = {};          // o que /lead-cliente-respondeu devolve
let leadsPlugin = { leads: [] };  // o que /leads-followup devolve
const posts = [];
axios.post = async (url, body) => { posts.push([url, body]); return { data: /lead-cliente-respondeu/.test(url) ? respostaPlugin : {} }; };
axios.get  = async (url) => ({ data: /leads-followup/.test(url) ? leadsPlugin : {} });

const rr  = require("./utils/followupRespostaRapida.js");
const job = require("./jobs/followupLeads.js");
const { TROCAS_SOCIAL } = require("./jobs/followupTextosV2.js");
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");
const OPERADOR = "5521964428172@c.us";

let falhas = 0, seq = 0;
function checar(nome, ok, detalhe = "") {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + String(detalhe).slice(0, 400)}`);
  if (!ok) falhas++;
}
const precos = { colunas: [{ titulo: "Premium", total: 2400 }, { titulo: "Gold", total: 1900 }], cartao_parcelas: 10, npix: 0, horas: 5, horas_menos: 4,
  tiers: ["Premium", "Tirinha", "Gold"].map((titulo, i) => ({ titulo, linhas: [{ tipo: "servico", nome: "Foto Cabine", pacote: titulo, valor: 2400 - i * 250, valor_menos: 2100 - i * 250 }] })) };
function lead(extra) {
  return Object.assign({ id: 77, telefone: "5521990001111", nome: "Ana Souza", tipo: "24h", estagio: 1, celebracao: "Aniversário de 15 anos",
    dataEvento: "20/12/2026", dias: 1, servicos: "Foto Cabine", multiServicos: false, precos }, extra);
}
async function cliente(chat, texto) {
  enviados.length = 0; posts.length = 0;
  await bot.handleIncomingMessage({ phone: chat, messageId: "fv2-" + (++seq), text: { message: texto }, fromMe: false });
  await new Promise(r => setTimeout(r, 30));   // deixa o fire-and-forget terminar
}
const paraCliente = (chat) => enviados.filter(e => e[0].replace(/\D/g, "").endsWith(chat.slice(-8))).map(e => e[1]).join("\n");
const paraOperador = () => enviados.filter(e => e[0] === OPERADOR).map(e => e[1]).join("\n");

(async () => {
  console.log("\n— 1. CLASSIFICADORES —");
  checar("'1', '2', '3' e os títulos viram resposta rápida",
    rr.qualRespostaRapida("1") === "contratar" && rr.qualRespostaRapida("2 - Tenho uma dúvida") === "duvida" && rr.qualRespostaRapida("Agora não") === "agora_nao" && rr.qualRespostaRapida("quero contratar") === "contratar");
  checar("frase comprida com número não é resposta rápida", rr.qualRespostaRapida("1 pergunta: a cabine imprime na hora?") === "");
  const pedidos = ["Pare de me mandar mensagem", "não quero mais receber mensagens", "Não me mandem mais nada", "me tira da lista", "STOP", "isso é spam", "parem de enviar por favor"];
  const naoPedidos = ["Agora não", "não tenho interesse", "já fechei com outra empresa", "para quando é o evento?", "nao", "obrigada", "quero contratar"];
  checar("pedido explícito para parar é reconhecido", pedidos.every(rr.clientePediuParar), pedidos.filter(p => !rr.clientePediuParar(p)));
  checar("recusa comercial e 'agora não' NÃO são pedido para parar", !naoPedidos.some(rr.clientePediuParar), naoPedidos.filter(rr.clientePediuParar));

  console.log("\n— 2. TEXTOS —");
  const legado = ["24h", "48h", "72h", "7dias", "promo_mensal", "promo_30dias", "promo_15dias"].map(t => job.montarMensagemFollowup(lead({ tipo: t, precos: null }))).join("\n");
  const legadoPreco = ["72h", "7dias"].map(t => job.montarMensagemFollowup(lead({ tipo: t }))).join("\n");
  const vivas = TROCAS_SOCIAL.filter(([velho]) => !(legado + legadoPreco).includes(velho)).map(x => x[0]);
  checar("toda frase de 'condição especial' a trocar ainda existe no texto antigo (troca viva)", vivas.length === 0, vivas);

  // Job SEM v2: texto antigo, sem marca
  leadsPlugin = { leads: [lead({ tipo: "72h" })] }; enviados.length = 0;
  await job.executarFollowupLeads();
  const v1 = enviados.map(e => e[1]).join("\n");
  checar("plugin sem v2: sai o texto de SEMPRE (nada muda até ligar)", v1 === job.montarMensagemFollowup(lead({ tipo: "72h" })), v1.slice(0, 200));
  checar("plugin sem v2: sem respostas rápidas e sem marca", !/Quero contratar/.test(v1) && !rr.marcaAtiva("5521990001111"));

  // Job COM v2, social
  leadsPlugin = { v2: true, leads: [lead({ tipo: "72h", perfil: "social" })] }; enviados.length = 0;
  await job.executarFollowupLeads();
  const soc = enviados.map(e => e[1]).join("\n");
  checar("v2 social: sem 'condição especial' inventada", !/condição especial|melhor condição/i.test(soc), soc);
  checar("v2 social: serviço, celebração, data e valor reais", /Foto Cabine|Aniversário de 15 anos/.test(soc) && /20\/12\/2026/.test(soc) && /R\$/.test(soc), soc);
  checar("v2 social: termina com 1 - Quero contratar / 2 - Tenho uma dúvida / 3 - Agora não", /\*1\* - Quero contratar\n\*2\* - Tenho uma dúvida\n\*3\* - Agora não$/.test(soc), soc.slice(-120));
  checar("v2: telefone marcado para ler o 1/2/3", !!rr.marcaAtiva("5521990001111"));
  checar("v2: follow-up sai com BOTÕES e o primeiro é 'Quero contratar' (pedido do Mario)", /^BOTOES: /.test(soc) && /\n\*1\* - Quero contratar\n/.test(soc), soc.slice(0, 40));

  // Empresa e agencia
  for (const [perfil, emp, re] of [["empresa", "Acme S.A.", /aprovação interna/], ["agencia", "Agência Lua", /seu cliente/]]) {
    for (const tipo of ["24h", "48h", "72h", "7dias", "promo_mensal", "promo_30dias", "promo_15dias"]) {
      leadsPlugin = { v2: true, leads: [lead({ tipo, perfil, empresa: emp, celebracao: "Evento Corporativo", nome: "Carlos Lima", telefone: "5521990002222" })] };
      enviados.length = 0;
      await job.executarFollowupLeads();
      const t = enviados.map(e => e[1]).join("\n");
      const ok = /Proposta/.test(t) && /Evento Corporativo/.test(t) && /R\$/.test(t) && !/festa|família|condição especial|memórias/i.test(t) && /Agora não$/.test(t)
        && (tipo !== "24h" || (re.test(t) && t.includes(emp)));
      checar(`v2 ${perfil} ${tipo}: objetivo, com proposta e valores reais, sem tom de festa`, ok, t);
    }
  }

  // v2 nao manda por cima de quem recusou no bot
  sessions["5521990003333"] = { step: "aguardando_opcao", optOutLembretes: true, orcamento: {} };
  leadsPlugin = { v2: true, leads: [lead({ telefone: "5521990003333", perfil: "social" })] }; enviados.length = 0; posts.length = 0;
  await job.executarFollowupLeads();
  checar("v2: quem disse 'não' ao bot não recebe follow-up (nem registra)", enviados.length === 0 && posts.length === 0, JSON.stringify(enviados));

  console.log("\n— 3. RESPOSTAS RÁPIDAS —");
  const A = "5521990004444";
  rr.marcarFollowupEnviado(A, { leadId: 9, perfil: "social", nome: "Bia Reis" });
  respostaPlugin = { v2: true, status: "duvida", id: 9, nome: "Bia Reis", ja_pausado: false };
  await cliente(A, "2");
  checar("'2' com marca: registra no lead como dúvida", posts.length === 1 && posts[0][1].resposta_rapida === "duvida", JSON.stringify(posts));
  checar("'2': cliente recebe 'pode mandar a sua dúvida', NÃO o menu", /mandar a sua dúvida/.test(paraCliente(A)) && !/orçamento\?|Escolha|1️⃣/.test(paraCliente(A)), paraCliente(A));
  checar("'2': operador avisado", /DÚVIDA/.test(paraOperador()), paraOperador());
  checar("'2': sessão espera o operador (próxima mensagem não abre fluxo)", sessions[A] && sessions[A].step === "pausado_followup");
  await cliente(A, "a cabine imprime na hora?");
  checar("a dúvida em seguida fica com o operador, bot quieto", paraCliente(A) === "" && /respondeu após follow-up/i.test(paraOperador()) === false, paraCliente(A) + " | " + paraOperador());

  const B = "5521990005555";
  rr.marcarFollowupEnviado(B, { leadId: 10, perfil: "empresa", nome: "Carlos Lima" });
  respostaPlugin = { v2: true, status: "negociando", id: 10, nome: "Carlos Lima", ja_pausado: false };
  await cliente(B, "1 - Quero contratar");
  checar("'1 - Quero contratar': registra contratar, UMA chamada ao plugin", posts.length === 1 && posts[0][1].resposta_rapida === "contratar", JSON.stringify(posts));
  checar("'1' empresa: resposta objetiva, operador avisado UMA vez", /formalizar a contratação/.test(paraCliente(B)) && (paraOperador().match(/CONTRATAR/g) || []).length === 1, paraCliente(B) + " | " + paraOperador());

  const C = "5521990006666";
  rr.marcarFollowupEnviado(C, { leadId: 11, perfil: "social", nome: "Duda" });
  respostaPlugin = { v2: true, status: "agora_nao", id: 11, nome: "Duda", ja_pausado: false };
  await cliente(C, "3");
  checar("'3': registra agora_nao e para os lembretes", posts[0] && posts[0][1].resposta_rapida === "agora_nao" && /parar os lembretes/.test(paraCliente(C)), paraCliente(C));
  checar("marca usada é apagada", !rr.marcaAtiva(C));

  const D = "5521990007777";   // sem marca: "1" continua sendo o menu de sempre
  respostaPlugin = { v2: true, status: "sem_lead" };
  await cliente(D, "oi");
  await cliente(D, "1");
  checar("sem marca de follow-up, '1' NÃO é resposta rápida (menu de sempre)", !posts.some(p => p[1].resposta_rapida) && sessions[D] && sessions[D].step !== "pausado_followup", JSON.stringify(posts) + " " + (sessions[D] || {}).step);

  console.log("\n— 4. PEDIDO PARA PARAR —");
  const E = "5521990008888";
  respostaPlugin = { v2: true, status: "bloqueado", id: 12, nome: "Eva", ja_pausado: false, ja_bloqueado: false };
  await cliente(E, "Pare de me mandar mensagem");
  checar("plugin v2: manda parar=true e bloqueia", posts.length === 1 && posts[0][1].parar === true, JSON.stringify(posts));
  checar("cliente recebe a confirmação, operador sabe que NÃO é perda comercial", /Não vamos mais enviar/.test(paraCliente(E)) && /não conta como perda/.test(paraOperador()), paraCliente(E) + " | " + paraOperador());
  checar("sessão marcada sem lembretes", sessions[E] && sessions[E].optOutLembretes === true);
  respostaPlugin = { v2: true, status: "bloqueado", id: 12, nome: "Eva", ja_pausado: true, ja_bloqueado: true };
  await cliente(E, "pare de me mandar mensagem!!");
  checar("segunda vez: não repete a confirmação", paraCliente(E) === "", paraCliente(E));

  const F = "5521990009999";   // plugin SEM v2: o pedido segue o fluxo de hoje
  respostaPlugin = { status: "pausado", id: 13, nome: "Fabi" };
  await cliente(F, "pare de me mandar mensagem");
  checar("plugin sem v2: nada de bloqueio, segue o fluxo de sempre", !/Não vamos mais enviar/.test(paraCliente(F)) && !(sessions[F] || {}).optOutLembretes, paraCliente(F));

  console.log("\n— 5. RESPOSTA COMUM —");
  const G = "5521990010000";
  // bot parado (orcamento encerrado): e o caso do "cadê o valor?" que ficou sem resposta
  sessions[G] = { step: "finalizado", menuInicialEnviado: true, orcamento: { servicosEnviados: [] }, servicosEnviados: [] };
  respostaPlugin = { v2: true, status: "pausado", id: 14, nome: "Gabi", ja_pausado: false };
  await cliente(G, "cadê o valor?");
  checar("bot parado: a mensagem do cliente vai ao plugin (pausa)", posts.some(p => /lead-cliente-respondeu/.test(p[0])), JSON.stringify(posts));
  checar("v2: resposta comum que pausou o lead avisa o operador", /Cliente respondeu ao follow-up/.test(paraOperador()), paraOperador());
  respostaPlugin = { status: "pausado", id: 14, nome: "Gabi" };
  sessions[G].step = "finalizado";
  await cliente(G, "Oi de novo");
  checar("sem v2: nenhum aviso novo (comportamento de hoje)", !/Cliente respondeu ao follow-up/.test(paraOperador()), paraOperador());

  // clique no MENU DO PROPRIO BOT logo depois do orcamento: nao pausa (24 dos 46 desativados foram isso)
  const H = "5521990011000";
  sessions[H] = { step: "orcamento_pos", menuInicialEnviado: true, _menuPos: [{ id: "1", acao: "fim", label: "Está ótimo, por enquanto é só" }],
    orcamento: { nome: "Helo", servicosEnviados: [] }, servicosEnviados: [] };
  respostaPlugin = { v2: true, status: "pausado", id: 15, nome: "Helo", ja_pausado: false };
  await cliente(H, "1");
  checar("clique no menu do bot ('por enquanto é só') NÃO pausa o follow-up", !posts.some(p => /lead-cliente-respondeu/.test(p[0])), JSON.stringify(posts));
  sessions[H] = { step: "orcamento_pos", menuInicialEnviado: true, orcamento: { nome: "Helo", servicosEnviados: [] }, servicosEnviados: [] };
  await cliente(H, "quero contratar a cabine");
  checar("no meio do fluxo, 'quero contratar' continua indo ao plugin", posts.some(p => /lead-cliente-respondeu/.test(p[0]) && p[1].contratar === true), JSON.stringify(posts));

  devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes);
  console.log(`\n${falhas === 0 ? "✅ TUDO CERTO" : "❌ " + falhas + " FALHA(S)"}`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error(e); devolver(ARQ_SESSOES, sessoesAntes); devolver(ARQ_RR, rrAntes); process.exit(2); });

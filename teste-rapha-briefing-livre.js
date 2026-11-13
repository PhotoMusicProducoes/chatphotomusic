// teste-rapha-briefing-livre.js - texto longo do cliente: o bot USA o que veio e pergunta so o que falta (13/11/2026)
// Casos reais da Raquel (Petrobras, 06 e 12/11): "Meu nome e Raquel Coelho..." / "evento corporativo, 17/12, das 17h30 as 20h,
// 300 pessoas" / "dois eventos, 300 e 90 pessoas". O plugin e simulado.
// Rodar:  node teste-rapha-briefing-livre.js   (conferir o CODIGO DE SAIDA)

const registro = [];
const utils = require("./utils/index.js");
utils.sendText       = async (c, t) => { registro.push("TEXTO[" + String(c).replace(/\D/g, "").slice(-4) + "]: " + String(t)); return true; };
utils.sendTyping     = async () => {};
utils.sendFileByUrl  = async () => { registro.push("ARQUIVO"); return true; };
utils.sendButtonList = async (_c, t) => { registro.push("BOTOES: " + String(t)); return true; };
utils.sendOptionList = async (_c, t) => { registro.push("LISTA: " + String(t)); return true; };
utils.enviarPdfComLink = async () => { registro.push("PDF"); };
const pedidos = [];
utils.gerarOrcamento = async (sessao, _c, slugs, opcoes) => { pedidos.push({ slugs, orc: JSON.parse(JSON.stringify(sessao.orcamento || {})) }); return { id: "T9", url: "https://exemplo/t9.pdf", total: 1 }; };
require("./utils/intervaloEnvio.js").esperaEntreEnvios = () => 0;
require("./services/avaliacaoEmpresa.js").enviarAvaliacaoEmpresa = async () => { registro.push("AVALIACOES"); };
const axios = require("axios");
axios.post = async () => ({ data: {} });
axios.get = async (_u, cfg) => {
  const b = String((cfg && cfg.params && cfg.params.bairro) || "");
  if (/^flamengo$/i.test(b)) return { data: { status: "encontrado", bairro: "Flamengo", cidade: "Rio de Janeiro", valor: 100, cidades_do_bairro: ["Rio de Janeiro"] } };
  return { data: { status: "nao_encontrado", bairro: b, cidade: "" } };
};

const fs = require("fs");
const ARQ = require("path").join(__dirname, "sessions.json");
const antes = fs.existsSync(ARQ) ? fs.readFileSync(ARQ, "utf8") : null;
const bot = require("./index.js");
const { sessions } = require("./utils/sessions");

let falhas = 0, seq = 0;
function checar(n, ok, d = "") { console.log(`${ok ? "✅" : "❌"} ${n}${ok ? "" : "  → " + String(d).slice(0, 280)}`); if (!ok) falhas++; }
let CHAT = "5521900000061";
const sess = () => sessions[CHAT] || {};
async function cliente(texto) {
  registro.length = 0;
  await bot.handleIncomingMessage({ phone: CHAT, messageId: "bl-" + (++seq), text: { message: texto }, fromMe: false });
  return registro.join("\n");
}
function novo() { Object.keys(sessions).forEach(k => delete sessions[k]); CHAT = "55219000006" + String(10 + (++seq)).slice(-2); pedidos.length = 0; }

const T_NOME = "Meu nome é Raquel Coelho e estou entrando em contato em nome da Gerência Executiva da Petrobras.";
const T_EVENTO = "Olá, tudo bem? Obrigada pelo retorno! Temos interesse na contratação da cabine de fotos para um evento corporativo, que será realizado no dia 17/12, das 17h30 às 20h, para aproximadamente 300 pessoas. Você poderia, por gentileza, encaminhar um orçamento para esse serviço, considerando a data, o horário e a quantidade de participantes informados?";
const T_DOIS = "Estou retomando o contato para solicitar um orçamento da cabine de fotos para dois possíveis eventos corporativos, ambos no Rio de Janeiro, provavelmente no bairro Jardim Botânico e Flamengo.\n\n- Evento 1: aproximadamente 300 pessoas.\n- Evento 2: aproximadamente 90 pessoas.\n\nOs dois eventos terão duração prevista de 4 horas.";

(async () => {
  console.log("— CASO 1: no passo do nome, 'Meu nome é Raquel Coelho e ... Petrobras' —");
  novo();
  await cliente("oi"); await cliente("1"); await cliente("1");
  let r = await cliente(T_NOME);
  checar("reconhece o NOME (não pede de novo)", sess().orcamento.nome === "Raquel Coelho" && !/só o nome|Só me diga o \*seu nome/i.test(r), JSON.stringify(sess().orcamento.nome) + " | " + r);
  checar("entende que é EMPRESA (Petrobras) e já segue para os serviços", sess().orcamento.perfil === "empresa" && /Petrobras/.test(sess().orcamento.empresa || "") && sess().step === "orcamento_servicos_previa", `${sess().orcamento.perfil} | ${sess().orcamento.empresa} | ${sess().step}`);

  console.log("\n— CASO 2: ao receber o convite do preliminar, ela manda o evento completo —");
  novo();
  sessions[CHAT] = { step: "lembrete_retomar", lembreteRetomarStep: "orcamento_nome", menuInicialEnviado: true, clienteEscreveuTexto: true,
    orcamento: { nome: "Raquel Coelho", perfil: "empresa", empresa: "Gerência Executiva da Petrobras", servicosEnviados: [], situacao: "preliminar" } };
  r = await cliente(T_EVENTO);
  const o = sess().orcamento;
  checar("guardou serviço, convidados, data e horário que ela disse", (o.servicosPrevios || []).join() === "1" && o.convidados === 300 && /^17\/12\/\d{4}$/.test(o.data || "") && o.horaInicio === "17:30" && o.horaFim === "20:00", JSON.stringify(o));
  checar("evento corporativo reconhecido (celebração 'Evento Corporativo')", o.celebracaoId === 8, String(o.celebracaoId));
  checar("pergunta SÓ o que falta: o local (não repete nome, data, horário, convidados)", sess().step === "orcamento_completar" && /bairro e a cidade/i.test(r) && !/nome|Quantos convidados|Qual a data/i.test(r), sess().step + " | " + r);
  r = await cliente("Flamengo");
  checar("com o bairro, completa a cidade pela tabela e mostra o RESUMO com os dados dela", sess().step === "orcamento_confirmar" && /Flamengo/.test(r) && /17\/12/.test(r) && /300/.test(r), sess().step + " | " + r);
  await cliente("1");
  const p = pedidos[pedidos.length - 1] || {};
  checar("o orçamento sai com os dados reais (cabine, 300, 17/12, 17:30-20:00, Flamengo), não o genérico", (p.slugs || []).join() === "foto-cabine" && p.orc && p.orc.convidados === 300 && p.orc.horaInicio === "17:30" && p.orc.bairro === "Flamengo" && p.orc.celebracaoId === 8, JSON.stringify(p));

  console.log("\n— CASO 3: dois eventos no mesmo texto (300 e 90 pessoas) —");
  novo();
  sessions[CHAT] = { step: "lembrete_retomar", lembreteRetomarStep: "orcamento_nome", menuInicialEnviado: true, clienteEscreveuTexto: true,
    orcamento: { nome: "Raquel Coelho", servicosEnviados: [], situacao: "preliminar" } };
  r = await cliente(T_DOIS);
  checar("reconhece 2 eventos: avisa o cliente e passa para a equipe (não pergunta o nome nem monta um orçamento errado)", /dois eventos/i.test(r) && sess().step === "aguardando_retorno" && pedidos.length === 0, sess().step + " | " + r);
  checar("o operador recebe o texto do briefing", /Briefing com 2 eventos/.test(registro.join("\n")), registro.join("\n"));

  console.log("\n— CASO 4: ela NÃO responde o local: em 1h o orçamento sai com o que ela já disse (não o genérico) —");
  const DTF = Intl.DateTimeFormat; global.Intl.DateTimeFormat = function (l, o) { if (o && o.hour && !o.minute) return { format: () => "15" }; return new DTF(l, o); };
  const job = require("./jobs/lembreteOrcamento.js");
  novo();
  sessions[CHAT] = { step: "lembrete_retomar", lembreteRetomarStep: "orcamento_nome", menuInicialEnviado: true, clienteEscreveuTexto: true,
    orcamento: { nome: "Raquel Coelho", perfil: "empresa", empresa: "Gerência Executiva da Petrobras", servicosEnviados: [], situacao: "preliminar" } };
  await cliente(T_EVENTO);
  const umaHora = 61 * 60 * 1000;
  Object.assign(sess(), { ultimaInteracao: Date.now() - umaHora, lembreteOrcStep: "orcamento_completar", lembreteOrcEstagio: 1, lembreteOrcUltimoEnvio: Date.now() - umaHora });
  pedidos.length = 0; registro.length = 0;
  await job.executarLembreteOrcamento();
  const pj = pedidos[pedidos.length - 1] || {};
  checar("o orçamento automático usa SÓ a cabine e os dados dela (300, 17/12, 17:30-20:00, corporativo)", (pj.slugs || []).join() === "foto-cabine" && pj.orc && pj.orc.convidados === 300 && /^17\/12/.test(pj.orc.data || "") && pj.orc.horaInicio === "17:30" && pj.orc.celebracaoId === 8, JSON.stringify(pj));

  if (antes === null) { try { fs.unlinkSync(ARQ); } catch (e) {} } else fs.writeFileSync(ARQ, antes, "utf8");
  console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error("💥", e); process.exit(1); });

// services/oficinaNarciso.js
// 🔧 BANCADA DE TESTE — Oficina do Narciso (demo Rapha Lumen Pro).
//
// Roda DENTRO do ChatPhotoMusic só para dar ao Narciso uma ideia da experiência
// no WhatsApp — mesma jogada usada com a paróquia antes de virar app próprio
// (ver services/paroquiaSaoJose.js, hoje aposentado): escolhe a ÁREA, descreve
// o problema, o bot confirma e avisa que vai entrar em contato para agendar.
// Gatilho OCULTO "#oficina" — não divulgar a cliente real do Narciso: é só
// para o Mario mostrar a experiência a ele. Se aprovar, migra para um
// número/app próprio (mesmo caminho que a paróquia percorreu).
//
// Isolamento proposital:
//  - módulo autocontido, ZERO acoplamento com o fluxo de orçamento do evento;
//  - estado num namespace próprio: sessions[chatId].ofc (nunca .orcamento);
//  - todo step começa com "ofc_"; o index.js delega tudo por 1 gancho.

const fs = require("fs");
const path = require("path");
const { sendText, sendTyping, sendOptionList } = require("../utils/index.js");

const DIR = fs.existsSync("/data") ? "/data" : __dirname;
const ARQUIVO = path.join(DIR, "oficina-narciso-atendimentos.json");

const AREAS = [
  { id: "1", title: "Suspensão" },
  { id: "2", title: "Freios" },
  { id: "3", title: "Troca de óleo" },
  { id: "4", title: "Elétrica/Eletrônica" },
  { id: "5", title: "Ar-condicionado" },
  { id: "6", title: "Motor" },
  { id: "7", title: "Outros" }
];

function estado(sessions, chatId) {
  if (!sessions[chatId]) sessions[chatId] = {};
  if (!sessions[chatId].ofc) sessions[chatId].ofc = {};
  return sessions[chatId].ofc;
}

function lerAtendimentos() {
  try { return JSON.parse(fs.readFileSync(ARQUIVO, "utf8")); }
  catch { return []; }
}

// Grava o atendimento assim que a gente tem o essencial (área+descrição+nome).
// Fictício/demo por enquanto — na migração pro sistema real do Narciso vira
// registro definitivo (histórico de manutenção por veículo).
function salvarAtendimento(registro) {
  const lista = lerAtendimentos();
  lista.push(registro);
  try { fs.writeFileSync(ARQUIVO, JSON.stringify(lista, null, 2)); }
  catch (e) { console.error("🚨 [oficinaNarciso] Erro ao salvar atendimento:", e.message); }
}

const SAUDACAO =
  "Olá! Aqui é a *Oficina do Narciso* 🔧\n" +
  "_(bancada de teste Rapha Lumen)_\n\n" +
  "Antes de tudo, me diga: qual área você precisa de manutenção?";

async function mostrarAreas(chatId, sessions, cabecalho) {
  sessions[chatId].step = "ofc_area";
  await sendTyping(chatId);
  if (!cabecalho) await sendText(chatId, SAUDACAO);
  await sendOptionList(
    chatId,
    cabecalho || "Escolha a área:",
    AREAS,
    { title: "Oficina do Narciso", buttonLabel: "Ver opções" }
  );
}

async function tratarArea(chatId, sessions, corpo) {
  const opt = AREAS.find(a => a.id === corpo.trim());
  if (!opt) {
    await sendText(chatId, "Não entendi. Escolha um número da lista acima, ou digite *sair*.");
    return;
  }
  estado(sessions, chatId).area = opt.title;
  sessions[chatId].step = "ofc_descricao";
  await sendTyping(chatId);
  await sendText(
    chatId,
    `Beleza, *${opt.title}*. Agora me conta o que está acontecendo com o carro ` +
    "(o problema, barulho, luz acesa, o que você percebeu etc.):"
  );
}

async function tratarDescricao(chatId, sessions, corpo) {
  const texto = corpo.trim();
  if (!texto) {
    await sendText(chatId, "Pode descrever em texto o que está acontecendo?");
    return;
  }
  estado(sessions, chatId).descricao = texto;
  sessions[chatId].step = "ofc_nome";
  await sendTyping(chatId);
  await sendText(chatId, "Anotado! E qual é o seu nome?");
}

async function tratarNome(chatId, sessions, corpo) {
  const nome = corpo.trim();
  if (!nome) {
    await sendText(chatId, "Qual é o seu nome?");
    return;
  }
  const ofc = estado(sessions, chatId);
  ofc.nome = nome;

  salvarAtendimento({
    data: new Date().toISOString(),
    telefone: chatId,
    nome: ofc.nome,
    area: ofc.area,
    descricao: ofc.descricao
  });

  sessions[chatId].step = "ofc_fim";
  await sendTyping(chatId);
  await sendText(
    chatId,
    `✅ Anotado, *${ofc.nome}*!\n\n` +
    `*Área:* ${ofc.area}\n*Problema:* ${ofc.descricao}\n\n` +
    "Já registramos e vamos entrar em contato para agendar o serviço. 🔧\n\n" +
    "_(Para testar de novo, digite *#oficina*. Para sair, digite *sair*.)_"
  );
}

// ---------------------------------------------------------------------------
// Ponto de entrada. index.js chama quando corpo == "#oficina" OU step começa
// com "ofc_". Retorna true se tratou.
// ---------------------------------------------------------------------------
async function handleOficina(chatId, sessions, corpoMensagem) {
  const corpo = String(corpoMensagem || "").trim();
  const low = corpo.toLowerCase();

  if (low === "#oficina") {
    delete sessions[chatId]?.ofc;
    await mostrarAreas(chatId, sessions);
    return true;
  }

  if (low === "sair") {
    delete sessions[chatId];
    await sendText(chatId, "Você saiu da bancada de teste da Oficina. Para voltar, digite *#oficina*. 🔧");
    return true;
  }

  const step = sessions[chatId]?.step || "";
  if (!step.startsWith("ofc_")) return false;

  if (step === "ofc_area")      { await tratarArea(chatId, sessions, corpo);      return true; }
  if (step === "ofc_descricao") { await tratarDescricao(chatId, sessions, corpo); return true; }
  if (step === "ofc_nome")      { await tratarNome(chatId, sessions, corpo);      return true; }
  if (step === "ofc_fim") {
    // Conversa já encerrada; qualquer mensagem nova reabre o fluxo do zero.
    delete sessions[chatId]?.ofc;
    await mostrarAreas(chatId, sessions);
    return true;
  }

  await mostrarAreas(chatId, sessions);
  return true;
}

module.exports = { handleOficina, lerAtendimentos };

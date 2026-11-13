// utils/followupRespostaRapida.js - follow-up v2: respostas rapidas (1/2/3) e pedido para parar (13/11/2026, RJN)
//
// O follow-up v2 termina com:
//   1 - Quero contratar
//   2 - Tenho uma dúvida
//   3 - Agora não
// Quando ele sai, este modulo MARCA o telefone (ultimos 8 digitos) por 7 dias.
// So com a marca o "1", "2" ou "3" do cliente e lido como resposta ao
// follow-up; sem ela, "1" continua sendo a opcao 1 do menu, como sempre.
//
// A marca fica num arquivo proprio (followupRespostaRapida.json no /data),
// FORA do sessions.json: os jobs percorrem as sessoes esperando `.step`.
//
// A marca so e gravada quando o PhotoMusic Pro esta com o follow-up v2
// ligado (pm_followup_v2_ativo = 1). Desligado, nada aqui e usado.

const fs   = require("fs");
const path = require("path");

const DATA_DIR = fs.existsSync("/data") ? "/data" : path.join(__dirname, "..");
const ARQ      = path.join(DATA_DIR, "followupRespostaRapida.json");
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

let marcas = {};
try {
  if (fs.existsSync(ARQ)) marcas = JSON.parse(fs.readFileSync(ARQ, "utf8")) || {};
} catch (e) {
  console.warn(`⚠️ followupRespostaRapida: arquivo ilegivel, comecando vazio (${e.message})`);
  marcas = {};
}

function salvar() {
  try {
    fs.writeFileSync(ARQ + ".tmp", JSON.stringify(marcas), "utf8");
    fs.renameSync(ARQ + ".tmp", ARQ);
  } catch (e) {
    console.warn(`⚠️ followupRespostaRapida: nao salvou (${e.message})`);
  }
}

function chave(telefone) {
  const d = String(telefone || "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : "";
}

function marcarFollowupEnviado(telefone, dados = {}) {
  const k = chave(telefone);
  if (!k) return;
  marcas[k] = { ts: Date.now(), leadId: dados.leadId || null, perfil: dados.perfil || "social", nome: dados.nome || "" };
  salvar();
}

// Devolve a marca valida (ou null). Limpa a vencida.
function marcaAtiva(telefone) {
  const k = chave(telefone);
  const m = k ? marcas[k] : null;
  if (!m) return null;
  if (Date.now() - Number(m.ts || 0) > VALIDADE_MS) { delete marcas[k]; salvar(); return null; }
  return m;
}

function limparMarca(telefone) {
  const k = chave(telefone);
  if (k && marcas[k]) { delete marcas[k]; salvar(); }
}

function normalizar(texto) {
  return String(texto || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/* Qual resposta rapida o cliente deu: "contratar" | "duvida" | "agora_nao" | "".
   Aceita o numero sozinho, o numero com o titulo e o titulo sozinho
   (o cliente copia o texto, ver opcaoPorTitulo no index.js). */
function qualRespostaRapida(texto) {
  const t = normalizar(texto);
  if (!t || t.length > 40) return "";
  if (/^1( quero contratar)?$/.test(t) || t === "quero contratar") return "contratar";
  if (/^2( tenho uma duvida)?$/.test(t) || t === "tenho uma duvida") return "duvida";
  if (/^3( agora nao)?$/.test(t) || t === "agora nao") return "agora_nao";
  return "";
}

/* Pedido EXPLICITO para nao receber mais mensagens. E diferente de recusa
   comercial ("nao tenho interesse", "ja fechei com outro"), que so pausa e
   fica para o operador marcar como perdido com o motivo certo. */
function clientePediuParar(texto) {
  const t = normalizar(texto);
  if (!t) return false;
  if (/^(stop|pare|parar|chega|sair)$/.test(t)) return true;   // "para"/"cancelar" sozinhos sao ambiguos
  return /\b(pare|para|parem|parar) de (me )?(mandar|enviar|chamar|incomodar|mandarem|enviarem)\b/.test(t)
      || /\bnao (me )?(mande|mandem|envie|enviem|chame|chamem|incomode|incomodem) mais\b/.test(t)
      || /\bnao quero (mais )?(receber|mensage|mensagens|contato|que me (mandem|enviem|chamem))\b/.test(t)
      || /\b(descadastr|me tire da lista|me tira da lista|sair da lista|remover meu (numero|contato)|tirar meu (numero|contato)|tira meu numero)/.test(t)
      || /\b(spam|vou denunciar|vou bloquear)\b/.test(t);
}

module.exports = {
  marcarFollowupEnviado, marcaAtiva, limparMarca,
  qualRespostaRapida, clientePediuParar,
  _marcas: () => marcas, _arquivo: ARQ,
};

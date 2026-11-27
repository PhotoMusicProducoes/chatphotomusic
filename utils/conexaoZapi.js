// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\utils\conexaoZapi.js
// VIGIA DO WHATSAPP DA PHOTOMUSIC (27/11/2026, Mario; mesmo comportamento da Paroquia Pro de 25/11).
//
// O caso: quando o celular desconecta da Z-API, ela continua ACEITANDO as mensagens (HTTP 200)
// e guarda numa fila. O ChatBot registrava "enviado" e ninguem percebia. Ao reconectar, a fila
// sai toda de uma vez, inclusive lembretes vencidos. Caiu de novo em 27/11.
//
// Agora:
//   - a cada 3 min pergunta a Z-API se esta conectada (/status);
//   - so vale "desconectado" o connected:false EXPLICITO; se estava conectado, exige 2 seguidas
//     (nao alarmar por um soluco); sem estado anterior, 1 basta. Erro de rede = "nao sei" = deixa enviar;
//   - desconectado = os envios FALHAM de proposito (garantirConectado antes do fetch) e as rotinas
//     automaticas PAUSAM sem marcar como enviado (pausarSeDesconectado);
//   - quando o estado muda, AVISA o PhotoMusic Pro (faixa vermelha, tela com QR, e-mail).

const fs = require("fs");
const path = require("path");
const { API_URL, INSTANCE_ID, TOKEN, PM_API_BASE, PM_API_KEY } = require("./config.js");

const CLIENT_TOKEN = "Fa05a9aeb57414a1db749a469ca145c02S";
const DIR = fs.existsSync("/data") ? "/data" : path.join(__dirname, "..");
const ARQ = path.join(DIR, "whatsapp-conexao.json");
const INTERVALO_MS = 3 * 60 * 1000;
const HORA_LIMITE_REPESCAGEM = 21;   // rotina do dia pausada so roda ao reconectar ate as 21h

function ler() { try { return JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch { return {}; } }
function gravar(e) {
  try { fs.writeFileSync(ARQ + ".tmp", JSON.stringify(e, null, 2)); fs.renameSync(ARQ + ".tmp", ARQ); }
  catch (err) { console.error("🚨 [whatsapp-conexao] falha ao gravar:", err.message); }
}

// estado = { conectado: true|false|null, verificado_em, desde, falhas_seguidas }
let estado = { conectado: null, falhas_seguidas: 0, ...ler() };

/** Regra pura (testavel): novo estado a partir da resposta da Z-API. */
function proximoEstado(atual, resposta, agora) {
  const j = (resposta && typeof resposta === "object") ? resposta : {};
  const antes = atual.conectado;
  if (j.connected === true) {
    return { ...atual, conectado: true, verificado_em: agora, desde: antes === true ? atual.desde : agora, falhas_seguidas: 0 };
  }
  if (j.connected === false) {
    const falhas = (atual.falhas_seguidas || 0) + 1;
    const confirmado = falhas >= 2 || antes !== true;
    return {
      ...atual, verificado_em: agora, falhas_seguidas: falhas,
      conectado: confirmado ? false : antes,
      desde: confirmado && antes !== false ? agora : atual.desde
    };
  }
  return atual;   // resposta estranha: "nao sei", nao muda nada
}

async function chamar(rota, deps = {}) {
  const f = deps.fetch || fetch;
  if (!INSTANCE_ID || !TOKEN) throw new Error("Z-API nao configurada");
  const r = await f(`${API_URL}${rota}`, { headers: { "client-token": CLIENT_TOKEN } });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return null; }
}

/** Avisa o PhotoMusic Pro (faixa, tela, e-mail). Falha so registra no log. */
async function avisarPhotoMusicPro(e, deps = {}) {
  const f = deps.fetch || fetch;
  if (!PM_API_BASE || !PM_API_KEY) return false;
  try {
    const r = await f(`${PM_API_BASE}/whatsapp-conexao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PM-Api-Key": PM_API_KEY },
      body: JSON.stringify({ conectado: e.conectado, desde: e.desde || null, verificado_em: e.verificado_em || null })
    });
    return r.ok;
  } catch (err) {
    console.error("🚨 [whatsapp-conexao] nao consegui avisar o PhotoMusic Pro:", err.message);
    return false;
  }
}

const aoReconectarLista = new Map();   // nome -> funcao (rotina do dia que ficou pausada)

async function verificar(deps = {}) {
  let resp;
  try { resp = await chamar("/status", deps); }
  catch (e) { console.error("🚨 [whatsapp-conexao] nao consegui consultar:", e.message); return estado; }
  const antes = estado.conectado;
  estado = proximoEstado(estado, resp, new Date().toISOString());
  const mudou = estado.conectado !== antes;
  if (mudou) {
    if (estado.conectado === false) console.error("📵 [whatsapp-conexao] DESCONECTADO:", (resp && resp.error) || "");
    if (estado.conectado === true && antes === false) console.log("✅ [whatsapp-conexao] RECONECTADO");
  }
  // avisa o PhotoMusic Pro quando muda; se o aviso falhar, tenta de novo na proxima consulta (3 min)
  if ((mudou || estado.aviso_pendente) && estado.conectado !== null) {
    const ok = await avisarPhotoMusicPro(estado, deps);
    estado = { ...estado, aviso_pendente: !ok };
  }
  if (mudou && estado.conectado === true && antes === false) await rodarRepescagem(deps);
  gravar(estado);
  return estado;
}

function horaSP(d = new Date()) {
  return Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(d));
}
function diaSP(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

async function rodarRepescagem(deps = {}) {
  const hoje = diaSP(deps.agora), hora = horaSP(deps.agora);
  for (const [nome, item] of aoReconectarLista) {
    aoReconectarLista.delete(nome);
    if (item.dia !== hoje || hora >= HORA_LIMITE_REPESCAGEM) { console.log(`⏭️ [whatsapp-conexao] ${nome}: fora do dia/horario, fica para o proximo ciclo`); continue; }
    console.log(`🔁 [whatsapp-conexao] reconectou: rodando ${nome} que ficou pausada`);
    try { await item.fn(); } catch (e) { console.error(`🚨 [whatsapp-conexao] ${nome}:`, e.message); }
  }
}

function estaDesconectado() { return estado.conectado === false; }
function situacao() { return { ...estado }; }

/** Trava dos envios: chamada antes de CADA fetch de envio pela Z-API. */
function garantirConectado() {
  if (estaDesconectado()) throw new Error("WhatsApp DESCONECTADO (reconecte em PhotoMusic Pro > 📶 WhatsApp). A mensagem NAO saiu.");
}

/**
 * Para as ROTINAS: desconectado = nao roda agora e nao marca nada como enviado.
 * `repescar` (opcional): rotina do DIA (parabens, dia da festa...) roda sozinha ao reconectar, se for no mesmo dia.
 * Devolve true quando pausou (a rotina deve sair).
 */
function pausarSeDesconectado(nome, repescar) {
  if (!estaDesconectado()) return false;
  console.log(`⏸️ [whatsapp-conexao] ${nome} PAUSADA: WhatsApp desconectado (nada foi marcado como enviado)`);
  if (typeof repescar === "function") aoReconectarLista.set(nome, { fn: repescar, dia: diaSP() });
  return true;
}

let timer = null;
function iniciar() {
  if (timer || !INSTANCE_ID || !TOKEN) return;
  verificar().catch(() => {});
  timer = setInterval(() => { verificar().catch(() => {}); }, INTERVALO_MS);
  console.log("📶 Vigia do WhatsApp ligado (consulta a cada 3 min).");
}

// so para os testes
function _definirEstado(e) { estado = { conectado: null, falhas_seguidas: 0, ...e }; }

module.exports = {
  iniciar, verificar, estaDesconectado, situacao, garantirConectado, pausarSeDesconectado,
  proximoEstado, rodarRepescagem, avisarPhotoMusicPro, _definirEstado, _repescagem: aoReconectarLista
};

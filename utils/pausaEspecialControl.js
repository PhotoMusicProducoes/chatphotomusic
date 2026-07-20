// utils/pausaEspecialControl.js — Com SESSÕES por número + integração DB WordPress

const fs   = require("fs");
const path = require("path");
const axios = require("axios");

const { PM_API_BASE, PM_API_KEY } = require("./config");

const URL_PAUSA_ESPECIAL = "https://photomusic.com.br/wp-content/dados/pausaEspecial.json";

// Persiste sessoesRetomadas no volume do Fly.io (sobrevive a restarts e deploys)
const DATA_DIR = fs.existsSync("/data") ? "/data" : path.join(__dirname, "..");
const RETOMADAS_FILE = path.join(DATA_DIR, "sessoesRetomadas.json");

let pausadosEspeciais = [];     // Números do JSON
let pausadosEspeciaisDB = [];   // Números do banco de dados WordPress
let sessoesRetomadas = {};

// Carrega sessoesRetomadas do disco ao iniciar
try {
  if (fs.existsSync(RETOMADAS_FILE)) {
    const data = JSON.parse(fs.readFileSync(RETOMADAS_FILE, "utf8"));
    if (data && typeof data === "object") {
      sessoesRetomadas = data;
      const qtd = Object.keys(sessoesRetomadas).length;
      if (qtd > 0) console.log(`✅ ${qtd} sessões retomadas carregadas do arquivo`);
    }
  }
} catch (e) {
  console.error("⚠️ Erro ao carregar sessoesRetomadas.json:", e.message);
  sessoesRetomadas = {};
}

function salvarSessoesRetomadas() {
  try {
    fs.writeFileSync(RETOMADAS_FILE, JSON.stringify(sessoesRetomadas), "utf8");
  } catch (e) {
    console.error("⚠️ Erro ao salvar sessoesRetomadas.json:", e.message);
  }
}

// ======================================================
// NORMALIZAÇÃO DE NÚMEROS (MESMA DO index.js)
// ======================================================
// DDD assumido quando vem SÓ o número local (sem DDD). Só afeta 8/9 dígitos.
const DDD_PADRAO = "21";

// De quanto em quanto tempo o bot relê a lista de pausados (JSON + DB).
const RECARGA_PAUSAS_MS = 3 * 60 * 1000; // 3 minutos

// Formatos brasileiros aceitos pelo WhatsApp (fixo vale para TODOS os estados):
//   Celular completo : 55 + DDD(2) + 9 + 8 dígitos = 13
//   FIXO completo    : 55 + DDD(2) +     8 dígitos = 12
//   Celular sem DDI  :      DDD(2) + 9 + 8 dígitos = 11  (3º dígito = '9')
//   FIXO sem DDI     :      DDD(2) +     8 dígitos = 10  (qualquer DDD)
//   Celular local    :               9 + 8 dígitos = 9
//   FIXO local       :                   8 dígitos = 8   (NÃO leva o 9)
function normalizarNumero(numero) {
  if (!numero) return null;

  numero = String(numero);
  numero = numero.replace("@c.us", "");
  numero = numero.replace(/\D+/g, "");
  numero = numero.replace(/^0+/, "");
  if (!numero) return null;

  // Já vem com DDI 55: 13 = celular, 12 = FIXO. Ambos válidos como estão.
  if (numero.startsWith("55") && (numero.length === 12 || numero.length === 13))
    return numero;

  if (numero.length === 13 && !numero.startsWith("55"))
    return "55" + numero;

  // 11 dígitos: celular brasileiro tem o 3º dígito (índice 2) = '9'
  // (DDD 2 dígitos + dígito 9 + 8 dígitos do número)
  // Se o 3º dígito NÃO for '9', é número internacional sem prefixo +
  // Exemplo EUA: +1 (561) 710-1530 → 15617101530 → [2]='6' → não adiciona 55
  if (numero.length === 11) {
    if (numero[2] === '9') return "55" + numero; // celular BR confirmado
    return numero; // internacional — retorna como veio, sem adicionar 55
  }

  // 10 dígitos = DDD + FIXO de 8 dígitos, de QUALQUER estado (11 SP, 21 RJ, 31 MG...)
  if (numero.length === 10)
    return "55" + numero;

  // Só o número local, sem DDD → assume o DDD padrão.
  if (numero.length === 9 && numero.startsWith("9"))
    return "55" + DDD_PADRAO + numero;   // celular local

  // FIXO local: 8 dígitos. NÃO acrescentar o "9" (isso criava um celular
  // inexistente, ex.: 4851-8562 virava 5521948518562 e a pausa nunca batia).
  if (numero.length === 8) {
    console.log(`ℹ️ Número com 8 dígitos (fixo local) sem DDD — assumindo DDD ${DDD_PADRAO}: ${numero}. Prefira informar com DDD.`);
    return "55" + DDD_PADRAO + numero;
  }

  return numero;
}

// ================= CARREGAR JSON =================
async function carregarPausadosEspeciais() {
  try {
    const resposta = await axios.get(URL_PAUSA_ESPECIAL, { timeout: 5000 });
    pausadosEspeciais = Array.isArray(resposta.data) ? resposta.data : [];
    console.log(`✅ ${pausadosEspeciais.length} pausados carregados do JSON`);
    return pausadosEspeciais;
  } catch (erro) {
    // NÃO zera a lista: uma falha momentânea de rede despausaria TODO MUNDO
    // até a próxima recarga. Mantém o que já estava em memória.
    console.error(`⚠️ Erro ao carregar pausaEspecial.json (mantendo ${pausadosEspeciais.length} em memória): ${erro.message}`);
    return pausadosEspeciais;
  }
}

// ================= CARREGAR DB =================
async function carregarPausadosDB() {
  if (!PM_API_BASE || !PM_API_KEY) {
    console.log("⚠️ PM_API_KEY não configurada — DB de pausa especial desabilitado");
    return pausadosEspeciaisDB;
  }
  try {
    const resposta = await axios.get(`${PM_API_BASE}/pausa-especial/lista`, {
      headers: { "X-PM-API-Key": PM_API_KEY },
      timeout: 5000,
    });
    const lista = Array.isArray(resposta.data) ? resposta.data : [];
    pausadosEspeciaisDB = lista.map(item => ({
      telefone:     item.telefone,
      telefoneNorm: normalizarTelefone(item.telefone),
      nome:         item.nome || "",
      pausado:      parseInt(item.pausado, 10) === 1,
    }));
    console.log(`✅ ${pausadosEspeciaisDB.length} pausados do DB carregados`);
    return pausadosEspeciaisDB;
  } catch (erro) {
    console.error(`⚠️ Erro ao carregar pausa especial do DB: ${erro.message}`);
    return pausadosEspeciaisDB;
  }
}

// ================= HELPER: buscar no cache DB =================
function buscarNoCacheDB(telefonNorm) {
  return pausadosEspeciaisDB.find(p => p.telefoneNorm === telefonNorm) || null;
}

// ================= HELPER: gravar/atualizar no DB =================
async function upsertNoDB(telefone, nome, pausado) {
  if (!PM_API_BASE || !PM_API_KEY) {
    console.log("⚠️ PM_API_KEY não configurada — upsert no DB ignorado");
    return false;
  }
  try {
    await axios.post(
      `${PM_API_BASE}/pausa-especial`,
      { telefone, nome, pausado },
      {
        headers: {
          "X-PM-API-Key": PM_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );
    return true;
  } catch (erro) {
    console.error(`⚠️ Erro ao gravar pausa especial no DB: ${erro.message}`);
    return false;
  }
}

// ================= NORMALIZAR TELEFONE =================
function normalizarTelefone(telefone) {
  return normalizarNumero(telefone);
}

// Últimos 8 dígitos — mesma técnica usada em jobs/followupLeads.js
// (acharSessaoPorTelefone) para tolerar variação de DDI/9º dígito entre o
// que foi cadastrado (JSON/DB) e o número que chega de fato pelo WhatsApp.
function ultimos8(numero) {
  return String(numero || "").replace(/\D/g, "").slice(-8);
}

// Acha o registro do JSON cujo telefone bate com o telefonNorm, primeiro
// por igualdade EXATA e, se não achar, pelos últimos 8 dígitos (fuzzy).
// Retorna { registro, fuzzy } ou null.
function encontrarNoJSON(telefonNorm) {
  const exato = pausadosEspeciais.find(p => normalizarTelefone(p.telefone) === telefonNorm);
  if (exato) return { registro: exato, fuzzy: false };

  const alvo8 = ultimos8(telefonNorm);
  if (alvo8.length < 8) return null;
  const porUltimos8 = pausadosEspeciais.find(p => ultimos8(p.telefone) === alvo8);
  return porUltimos8 ? { registro: porUltimos8, fuzzy: true } : null;
}

// Mesma lógica para o cache do DB.
function encontrarNoDB(telefonNorm) {
  const exato = buscarNoCacheDB(telefonNorm);
  if (exato) return { registro: exato, fuzzy: false };

  const alvo8 = ultimos8(telefonNorm);
  if (alvo8.length < 8) return null;
  const porUltimos8 = pausadosEspeciaisDB.find(p => ultimos8(p.telefone) === alvo8);
  return porUltimos8 ? { registro: porUltimos8, fuzzy: true } : null;
}

// ================= VERIFICAR SE ESTÁ PAUSADO =================
// ✅ ORDEM CORRETA:
// 1. Está no JSON?
//    ├─ SIM → Tem sessão retomada? → SIM = passa ✅ / NÃO = bloqueia 🔒
//    └─ NÃO → Está no DB com pausado=1?
//       ├─ SIM → Tem sessão retomada? → SIM = passa ✅ / NÃO = bloqueia 🔒
//       └─ NÃO → deixa passar ✅
// Cada etapa casa primeiro por número EXATO e, se não achar, pelos últimos
// 8 dígitos (fuzzy) — protege contra variação de formatação/DDI entre o
// que foi cadastrado e o número real que o WhatsApp entrega na mensagem.

function estaPausadoEspecial(chatId) {
  const telefonNorm = normalizarTelefone(chatId);

  // --- 1. Verificar JSON ---
  const achadoJSON = encontrarNoJSON(telefonNorm);
  if (achadoJSON) {
    // A sessão retomada é chaveada pelo número NORMALIZADO do próprio
    // registro achado (não pelo chatId recebido) — assim um match fuzzy
    // usa a mesma chave que retomarEspecial() gravou.
    const chaveSessao = normalizarTelefone(achadoJSON.registro.telefone);
    if (sessoesRetomadas[chaveSessao] === true) {
      return false; // Retomado temporariamente
    }
    console.log(`🔒 PAUSADO (JSON${achadoJSON.fuzzy ? ", match por últimos 8 dígitos" : ""}): ${telefonNorm}`);
    return true;
  }

  // --- 2. Verificar DB (cache em memória) ---
  const achadoDB = encontrarNoDB(telefonNorm);
  if (achadoDB && achadoDB.registro.pausado) {
    const chaveSessao = achadoDB.registro.telefoneNorm || normalizarTelefone(achadoDB.registro.telefone);
    if (sessoesRetomadas[chaveSessao] === true) {
      return false; // Retomado temporariamente
    }
    console.log(`🔒 PAUSADO (DB${achadoDB.fuzzy ? ", match por últimos 8 dígitos" : ""}): ${telefonNorm}`);
    return true;
  }

  return false;
}

// ================= RETOMAR ESPECIAL =================
// Comando: retomarespecial 21 99999-8888
async function retomarEspecial(telefone) {
  if (pausadosEspeciais.length === 0) {
    await carregarPausadosEspeciais();
  }
  const telefonNorm = normalizarTelefone(telefone);

  console.log(`\n✅ RETOMANDO: ${telefone} (normalizado: ${telefonNorm})`);

  // --- 1. Verificar JSON (exato ou por últimos 8 dígitos) ---
  const achadoJSON = encontrarNoJSON(telefonNorm);

  if (achadoJSON) {
    const { registro: registroJSON, fuzzy } = achadoJSON;
    const chaveSessao = normalizarTelefone(registroJSON.telefone);
    sessoesRetomadas[chaveSessao] = true;
    salvarSessoesRetomadas();
    console.log(`✅ ${registroJSON.nome} (${registroJSON.telefone}) RETOMADO (JSON${fuzzy ? ", match por últimos 8 dígitos" : ""})`);
    console.log(`   Sessão criada: sessoesRetomadas[${chaveSessao}] = true\n`);
    exibirEstadoPausas();
    return true;
  }

  // --- 2. Verificar DB (exato ou por últimos 8 dígitos) ---
  let achadoDB = encontrarNoDB(telefonNorm);

  // Se o cache está vazio (ex: primeiro start), tenta recarregar do DB
  if (!achadoDB && pausadosEspeciaisDB.length === 0) {
    await carregarPausadosDB();
    achadoDB = encontrarNoDB(telefonNorm);
  }

  if (achadoDB) {
    const { registro: registroDB, fuzzy } = achadoDB;
    // Marca como retomado no DB (pausado=0)
    const ok = await upsertNoDB(registroDB.telefone, registroDB.nome, 0);
    if (ok) {
      registroDB.pausado = false;
      // Remove sessão retomada se existir (não necessária, mas limpa)
      const chaveSessao = registroDB.telefoneNorm || normalizarTelefone(registroDB.telefone);
      if (sessoesRetomadas[chaveSessao]) {
        delete sessoesRetomadas[chaveSessao];
        salvarSessoesRetomadas();
      }
      console.log(`✅ ${telefone} RETOMADO (DB${fuzzy ? ", match por últimos 8 dígitos" : ""})\n`);
      return true;
    }
  }

  console.log(`⚠️ Número NÃO encontrado no JSON nem no DB (normalizado: ${telefonNorm}, últimos 8: ${ultimos8(telefonNorm)})`);
  return false;
}

// ================= PAUSAR ESPECIAL =================
// Comando: pausarespecial 21 99999-8888
async function pausarEspecial(telefone) {
  if (pausadosEspeciais.length === 0) {
    await carregarPausadosEspeciais();
  }
  const telefonNorm = normalizarTelefone(telefone);

  console.log(`\n🔒 PAUSANDO: ${telefone} (normalizado: ${telefonNorm})`);

  // --- 1. Verificar JSON (exato ou por últimos 8 dígitos) ---
  const achadoJSON = encontrarNoJSON(telefonNorm);

  if (achadoJSON) {
    const { registro: registroJSON, fuzzy } = achadoJSON;
    const chaveSessao = normalizarTelefone(registroJSON.telefone);
    if (sessoesRetomadas[chaveSessao]) {
      delete sessoesRetomadas[chaveSessao];
      salvarSessoesRetomadas();
      console.log(`✅ ${registroJSON.nome} (${registroJSON.telefone}) PAUSADO (JSON${fuzzy ? ", match por últimos 8 dígitos" : ""})`);
      console.log(`   Sessão removida: sessoesRetomadas[${chaveSessao}] deletado\n`);
    } else {
      console.log(`ℹ️ ${registroJSON.nome} (${registroJSON.telefone}) já estava pausado (JSON)\n`);
    }
    exibirEstadoPausas();
    return true;
  }

  // --- 2. Número não está no JSON → salvar no DB ---
  console.log(`📦 Número não está no JSON — salvando no DB...`);
  const ok = await upsertNoDB(telefone, "", 1);
  if (ok) {
    // Atualiza cache local
    const cacheItem = buscarNoCacheDB(telefonNorm);
    if (cacheItem) {
      cacheItem.pausado = true;
    } else {
      pausadosEspeciaisDB.push({
        telefone:     telefone,
        telefoneNorm: telefonNorm,
        nome:         "",
        pausado:      true,
      });
    }
    // Remove sessão retomada se existia
    if (sessoesRetomadas[telefonNorm]) {
      delete sessoesRetomadas[telefonNorm];
      salvarSessoesRetomadas();
    }
    console.log(`✅ ${telefone} PAUSADO (DB)\n`);
    return true;
  }

  // Falha ao gravar no DB
  console.log(`⚠️ Falha ao pausar ${telefone} no DB`);
  return false;
}

// ================= LISTAR PAUSADOS =================
function listarPausadosEspeciais() {
  console.log(`\n📋 ========== ESTADO DE PAUSAS ==========\n`);

  // JSON
  console.log(`📄 JSON (${pausadosEspeciais.length}):`);
  pausadosEspeciais.forEach((item, i) => {
    const telefonNorm = normalizarTelefone(item.telefone);
    const temSessao   = sessoesRetomadas[telefonNorm] ? "✓" : "✗";
    const resultado   = sessoesRetomadas[telefonNorm] ? "✅ ATIVO (retomado)" : "🔒 PAUSADO";
    console.log(`${i + 1}. ${item.nome} (${item.telefone})`);
    console.log(`   Tem sessão retomada: ${temSessao} — Estado: ${resultado}\n`);
  });

  // DB
  const dbPausados  = pausadosEspeciaisDB.filter(p => p.pausado);
  const dbRetomados = pausadosEspeciaisDB.filter(p => !p.pausado);
  console.log(`🗄️ DB (${pausadosEspeciaisDB.length} total):`);
  dbPausados.forEach((item, i) => {
    const temSessao = sessoesRetomadas[item.telefoneNorm] ? "✓" : "✗";
    const resultado = sessoesRetomadas[item.telefoneNorm] ? "✅ ATIVO (sessão)" : "🔒 PAUSADO";
    console.log(`${i + 1}. ${item.nome || "(sem nome)"} (${item.telefone})`);
    console.log(`   Sessão retomada: ${temSessao} — Estado: ${resultado}\n`);
  });
  if (dbRetomados.length > 0) {
    console.log(`   (${dbRetomados.length} retomados no DB: pausado=0)`);
  }

  console.log(`=========================================\n`);
  return pausadosEspeciais;
}

// ================= EXIBIR ESTADO =================
function exibirEstadoPausas() {
  const jsonPausados  = pausadosEspeciais.filter(p => !sessoesRetomadas[normalizarTelefone(p.telefone)]);
  const jsonRetomados = pausadosEspeciais.filter(p =>  sessoesRetomadas[normalizarTelefone(p.telefone)]);
  const dbPausados    = pausadosEspeciaisDB.filter(p => p.pausado && !sessoesRetomadas[p.telefoneNorm]);

  console.log(`📊 RESUMO GERAL`);
  console.log(`├─ 🔒 Pausados JSON: ${jsonPausados.length} | Retomados JSON: ${jsonRetomados.length}`);
  console.log(`├─ 🔒 Pausados DB: ${dbPausados.length} | Total DB: ${pausadosEspeciaisDB.length}`);
  console.log(`└─ 📋 Total JSON: ${pausadosEspeciais.length}\n`);
}

// ================= INICIALIZAR =================
async function inicializarPausaEspecial() {
  console.log(`\n🔒 Sistema de Pausa Especial inicializado`);
  console.log(`📁 URL JSON: ${URL_PAUSA_ESPECIAL}`);
  console.log(`🗄️ DB: ${PM_API_BASE}/pausa-especial/lista\n`);

  await carregarPausadosEspeciais();
  await carregarPausadosDB();

  // Recarga periódica: número pausado pelo PAINEL DO WORDPRESS (tabela
  // pm_pausa_especial) ou editado no pausaEspecial.json passa a valer sozinho,
  // sem precisar reiniciar/redeployar o bot. Antes disso, a lista só era lida
  // no start — o número ficava cadastrado e o bot continuava respondendo.
  setInterval(async () => {
    try {
      await carregarPausadosEspeciais();
      await carregarPausadosDB();
    } catch (e) {
      console.error(`⚠️ Erro na recarga periódica da pausa especial: ${e.message}`);
    }
  }, RECARGA_PAUSAS_MS);
  console.log(`🔁 Recarga automática da pausa especial a cada ${RECARGA_PAUSAS_MS / 60000} min\n`);
}

module.exports = {
  inicializarPausaEspecial,
  estaPausadoEspecial,           // ← Verificação no bot
  pausarEspecial,                // ← Comando pausarespecial
  retomarEspecial,               // ← Comando retomarespecial
  listarPausadosEspeciais,
  carregarPausadosEspeciais,
  carregarPausadosDB,
  normalizarTelefone,
};

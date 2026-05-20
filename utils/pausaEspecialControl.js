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
function normalizarNumero(numero) {
  if (!numero) return null;

  numero = String(numero);
  numero = numero.replace("@c.us", "");
  numero = numero.replace(/\D+/g, "");
  numero = numero.replace(/^0+/, "");

  if (numero.startsWith("55") && numero.length === 13) return numero;
  if (numero.startsWith("55") && numero.length === 12) return numero;

  if (numero.startsWith("21") && (numero.length === 10 || numero.length === 11))
    return "55" + numero;

  if (numero.length === 9 && numero.startsWith("9"))
    return "5521" + numero;

  if (numero.length === 8)
    return "55219" + numero;

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

  if (numero.length === 10)
    return "55" + numero;

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
    console.error(`⚠️ Erro ao carregar pausaEspecial.json: ${erro.message}`);
    pausadosEspeciais = [];
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

// ================= VERIFICAR SE ESTÁ PAUSADO =================
// ✅ ORDEM CORRETA:
// 1. Está no JSON?
//    ├─ SIM → Tem sessão retomada? → SIM = passa ✅ / NÃO = bloqueia 🔒
//    └─ NÃO → Está no DB com pausado=1?
//       ├─ SIM → Tem sessão retomada? → SIM = passa ✅ / NÃO = bloqueia 🔒
//       └─ NÃO → deixa passar ✅

function estaPausadoEspecial(chatId) {
  const telefonNorm = normalizarTelefone(chatId);

  // --- 1. Verificar JSON ---
  const registroJSON = pausadosEspeciais.find(p =>
    normalizarTelefone(p.telefone) === telefonNorm
  );

  if (registroJSON) {
    if (sessoesRetomadas[telefonNorm] === true) {
      return false; // Retomado temporariamente
    }
    console.log(`🔒 PAUSADO (JSON): ${telefonNorm}`);
    return true;
  }

  // --- 2. Verificar DB (cache em memória) ---
  const registroDB = buscarNoCacheDB(telefonNorm);
  if (registroDB && registroDB.pausado) {
    if (sessoesRetomadas[telefonNorm] === true) {
      return false; // Retomado temporariamente
    }
    console.log(`🔒 PAUSADO (DB): ${telefonNorm}`);
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

  console.log(`\n✅ RETOMANDO: ${telefone}`);

  // --- 1. Verificar JSON (comportamento original) ---
  const registroJSON = pausadosEspeciais.find(p =>
    normalizarTelefone(p.telefone) === telefonNorm
  );

  if (registroJSON) {
    sessoesRetomadas[telefonNorm] = true;
    salvarSessoesRetomadas();
    console.log(`✅ ${registroJSON.nome} (${registroJSON.telefone}) RETOMADO (JSON)`);
    console.log(`   Sessão criada: sessoesRetomadas[${telefonNorm}] = true\n`);
    exibirEstadoPausas();
    return true;
  }

  // --- 2. Verificar DB ---
  let registroDB = buscarNoCacheDB(telefonNorm);

  // Se o cache está vazio (ex: primeiro start), tenta recarregar do DB
  if (!registroDB && pausadosEspeciaisDB.length === 0) {
    await carregarPausadosDB();
    registroDB = buscarNoCacheDB(telefonNorm);
  }

  if (registroDB) {
    // Marca como retomado no DB (pausado=0)
    const ok = await upsertNoDB(registroDB.telefone, registroDB.nome, 0);
    if (ok) {
      registroDB.pausado = false;
      // Remove sessão retomada se existir (não necessária, mas limpa)
      if (sessoesRetomadas[telefonNorm]) {
        delete sessoesRetomadas[telefonNorm];
        salvarSessoesRetomadas();
      }
      console.log(`✅ ${telefone} RETOMADO (DB)\n`);
      return true;
    }
  }

  console.log(`⚠️ Número NÃO encontrado no JSON nem no DB`);
  return false;
}

// ================= PAUSAR ESPECIAL =================
// Comando: pausarespecial 21 99999-8888
async function pausarEspecial(telefone) {
  if (pausadosEspeciais.length === 0) {
    await carregarPausadosEspeciais();
  }
  const telefonNorm = normalizarTelefone(telefone);

  console.log(`\n🔒 PAUSANDO: ${telefone}`);

  // --- 1. Verificar JSON (comportamento original) ---
  const registroJSON = pausadosEspeciais.find(p =>
    normalizarTelefone(p.telefone) === telefonNorm
  );

  if (registroJSON) {
    if (sessoesRetomadas[telefonNorm]) {
      delete sessoesRetomadas[telefonNorm];
      salvarSessoesRetomadas();
      console.log(`✅ ${registroJSON.nome} (${registroJSON.telefone}) PAUSADO (JSON)`);
      console.log(`   Sessão removida: sessoesRetomadas[${telefonNorm}] deletado\n`);
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

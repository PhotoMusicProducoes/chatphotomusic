// utils/pausaEspecialControl.js — Com SESSÕES por número

const axios = require("axios");

const URL_PAUSA_ESPECIAL = "https://photomusic.com.br/wp-content/dados/pausaEspecial.json";
let pausadosEspeciais = [];
let sessoesRetomadas = {};  // ✅ NOVO: Controlar ativoLocal por número em sessão

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

  if (numero.length === 11)
    return "55" + numero;

  if (numero.length === 10)
    return "55" + numero;

  return numero;
}

// ================= CARREGAR JSON =================
async function carregarPausadosEspeciais() {
  try {
    const resposta = await axios.get(URL_PAUSA_ESPECIAL);
    pausadosEspeciais = resposta.data || [];
    
    console.log(`✅ ${pausadosEspeciais.length} pausados carregados do JSON`);
    return pausadosEspeciais;
  } catch (erro) {
    console.error(`⚠️ Erro ao carregar: ${erro.message}`);
    pausadosEspeciais = [];
    return pausadosEspeciais;
  }
}

// ================= NORMALIZAR TELEFONE =================
// Agora usa a MESMA lógica do index.js (E164: 55 + DDD + número)
function normalizarTelefone(telefone) {
  return normalizarNumero(telefone);
}

// ================= VERIFICAR SE ESTÁ PAUSADO =================
// ✅ ORDEM CORRETA:
// 1. Está no JSON?
//    ├─ NÃO → deixa passar ✅
//    └─ SIM → Tem sessão retomada?
//       ├─ SIM → deixa passar ✅
//       └─ NÃO → bloqueia 🔒

function estaPausadoEspecial(chatId) {
  const telefonNorm = normalizarTelefone(chatId);
  
  console.log(`\n🔍 DEBUG estaPausadoEspecial:`);
  console.log(`   Input chatId: ${chatId}`);
  console.log(`   Normalizado: ${telefonNorm}`);
  console.log(`   pausadosEspeciais: ${JSON.stringify(pausadosEspeciais.map(p => ({ tel: p.telefone, norm: normalizarTelefone(p.telefone) })))}`);
  console.log(`   sessoesRetomadas: ${JSON.stringify(sessoesRetomadas)}`);
  
  const registro = pausadosEspeciais.find(p => 
    normalizarTelefone(p.telefone) === telefonNorm
  );
  
  console.log(`   Encontrou no JSON? ${registro ? 'SIM' : 'NÃO'}`);
  
  if (!registro) {
    console.log(`ℹ️ NÃO REGISTRADO - deixa passar ✅\n`);
    return false;
  }
  
  const temSessaoRetomada = sessoesRetomadas[telefonNorm] === true;
  console.log(`   Tem sessão retomada? ${temSessaoRetomada}`);
  
  if (temSessaoRetomada) {
    console.log(`✅ RETOMADO - deixa passar ✅\n`);
    return false;
  }
  
  console.log(`🔒 PAUSADO - bloqueia 🔒\n`);
  return true;
}
// ================= RETOMAR ESPECIAL =================
// Comando: retomarespecial 21 99999-8888
// Cria SESSÃO para este número com ativoLocal = false
async function retomarEspecial(telefone) {
  const telefonNorm = normalizarTelefone(telefone);
  
  console.log(`\n✅ RETOMANDO: ${telefone}`);
  
  // 1️⃣ Verificar se está no JSON
  const registro = pausadosEspeciais.find(p => 
    normalizarTelefone(p.telefone) === telefonNorm
  );
  
  if (!registro) {
    console.log(`⚠️ Número NÃO encontrado no JSON - não está em pausa especial`);
    return false;
  }
  
  // 2️⃣ Criar SESSÃO para este número
  sessoesRetomadas[telefonNorm] = true;  // ✅ ativoLocal = false (implícito)
  
  console.log(`✅ ${registro.nome} (${registro.telefone}) RETOMADO`);
  console.log(`   Sessão criada: sessoesRetomadas[${telefonNorm}] = true\n`);
  
  exibirEstadoPausas();
  return true;
}

// ================= PAUSAR ESPECIAL =================
// Comando: pausarespecial 21 99999-8888
// Deleta SESSÃO para este número (volta ao padrão: pausado)
async function pausarEspecial(telefone) {
  const telefonNorm = normalizarTelefone(telefone);
  
  console.log(`\n🔒 PAUSANDO: ${telefone}`);
  
  // 1️⃣ Verificar se está no JSON
  const registro = pausadosEspeciais.find(p => 
    normalizarTelefone(p.telefone) === telefonNorm
  );
  
  if (!registro) {
    console.log(`⚠️ Número NÃO encontrado no JSON`);
    return false;
  }
  
  // 2️⃣ Deletar SESSÃO (volta ao padrão: pausado)
  if (sessoesRetomadas[telefonNorm]) {
    delete sessoesRetomadas[telefonNorm];
    console.log(`✅ ${registro.nome} (${registro.telefone}) PAUSADO`);
    console.log(`   Sessão deletada: sessoesRetomadas[${telefonNorm}] removido\n`);
  } else {
    console.log(`ℹ️ ${registro.nome} (${registro.telefone}) já estava pausado\n`);
  }
  
  exibirEstadoPausas();
  return true;
}

// ================= LISTAR PAUSADOS =================
function listarPausadosEspeciais() {
  console.log(`\n📋 ========== ESTADO DE PAUSAS ==========\n`);
  
  pausadosEspeciais.forEach((item, i) => {
    const telefonNorm = normalizarTelefone(item.telefone);
    const temSessao = sessoesRetomadas[telefonNorm] ? "✓" : "✗";
    const resultado = sessoesRetomadas[telefonNorm] ? "✅ ATIVO (retomado)" : "🔒 PAUSADO";
    
    console.log(`${i+1}. ${item.nome} (${item.telefone})`);
    console.log(`   Tem sessão retomada: ${temSessao}`);
    console.log(`   Estado: ${resultado}\n`);
  });
  
  console.log(`=========================================\n`);
  
  return pausadosEspeciais;
}

// ================= EXIBIR ESTADO =================
function exibirEstadoPausas() {
  const pausados = pausadosEspeciais.filter(p => 
    !sessoesRetomadas[normalizarTelefone(p.telefone)]
  );
  const retomados = pausadosEspeciais.filter(p => 
    sessoesRetomadas[normalizarTelefone(p.telefone)]
  );
  
  console.log(`📊 RESUMO GERAL`);
  console.log(`├─ 🔒 Pausados: ${pausados.length}`);
  console.log(`├─ ✅ Retomados: ${retomados.length}`);
  console.log(`└─ 📋 Total: ${pausadosEspeciais.length}\n`);
}

// ================= INICIALIZAR =================
async function inicializarPausaEspecial() {
  console.log(`\n🔒 Sistema de Pausa Especial inicializado`);
  console.log(`📁 JSON: pausaEspecial.json (lista de pausados)`);
  console.log(`💾 Sessões: sessoesRetomadas{} (ativoLocal por número)\n`);
  
  await carregarPausadosEspeciais();
}

module.exports = {
  inicializarPausaEspecial,
  estaPausadoEspecial,           // ← Verificação no bot
  pausarEspecial,                // ← Comando pausarespecial
  retomarEspecial,               // ← Comando retomarespecial
  listarPausadosEspeciais,
  carregarPausadosEspeciais,
  normalizarTelefone
};

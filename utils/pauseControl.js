// utils/pauseControl.js — Controle centralizado de pausa
// Compartilha o estado de clientes pausados entre index.js e services/
// Estado é persistido em pausados.json para sobreviver a reinicializações

const fs   = require('fs');
const path = require('path');

const DATA_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, '..');
const PAUSADOS_FILE = path.join(DATA_DIR, 'pausados.json');

const clientesPausados = new Set();

// ======================================================
// CARREGAR ESTADO SALVO AO INICIAR
// ======================================================
try {
  if (fs.existsSync(PAUSADOS_FILE)) {
    const data = JSON.parse(fs.readFileSync(PAUSADOS_FILE, 'utf8'));
    if (Array.isArray(data)) {
      data.forEach(id => clientesPausados.add(id));
      console.log(`⏸ ${clientesPausados.size} cliente(s) pausado(s) carregado(s) do pausados.json`);
    }
  }
} catch (e) {
  console.error('⚠️ Erro ao carregar pausados.json:', e.message);
}

// ======================================================
// SALVAR ESTADO EM DISCO
// ======================================================
function salvarPausados() {
  try {
    fs.writeFileSync(PAUSADOS_FILE, JSON.stringify([...clientesPausados]), 'utf8');
  } catch (e) {
    console.error('⚠️ Erro ao salvar pausados.json:', e.message);
  }
}

// ======================================================
// API PÚBLICA
// ======================================================
function pausarCliente(chatId) {
  clientesPausados.add(chatId);
  salvarPausados();
  console.log(`⏸ Cliente pausado: ${chatId}`);
}

function retomarCliente(chatId) {
  clientesPausados.delete(chatId);
  salvarPausados();
  console.log(`▶ Cliente retomado: ${chatId}`);
}

function estaPausado(chatId) {
  return clientesPausados.has(chatId);
}

function obterPausados() {
  return clientesPausados;
}

module.exports = {
  clientesPausados,
  pausarCliente,
  retomarCliente,
  estaPausado,
  obterPausados
};

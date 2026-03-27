// utils/pauseControl.js — Controle centralizado de pausa
// Compartilha o estado de clientes pausados entre index.js e services/

const clientesPausados = new Set();

function pausarCliente(chatId) {
  clientesPausados.add(chatId);
  console.log(`⏸ Cliente pausado: ${chatId}`);
}

function retomarCliente(chatId) {
  clientesPausados.delete(chatId);
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

// services/fluxoOrcamento.js
// Arquivo contendo apenas funções auxiliares utilizadas pelo fluxo de orçamento controlado pelo index.js

// Função para capitalizar nomes e textos
function capitalizarPalavras(texto) {
  return texto
    .split(" ")
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase())
    .join(" ");
}

// Função para normalizar horários enviados pelo cliente
function normalizarHorario(input) {
  if (!input) return null;

  const numeros = input.replace(/\D/g, "");

  if (numeros.length === 2) {
    return `${numeros}:00`;
  }

  if (numeros.length === 3) {
    return `${numeros[0]}:${numeros.slice(1)}`;
  }

  if (numeros.length === 4) {
    return `${numeros.slice(0, 2)}:${numeros.slice(2)}`;
  }

  return null;
}

// Função para calcular a duração do evento
function calcularDuracaoEvento(inicio, fim) {
  const [hIni, mIni] = inicio.split(":").map(Number);
  const [hFim, mFim] = fim.split(":").map(Number);

  const minutosInicio = hIni * 60 + mIni;
  const minutosFim = hFim * 60 + mFim;

  let duracao = minutosFim - minutosInicio;

  if (duracao < 0) {
    duracao += 24 * 60; // caso passe da meia-noite
  }

  const horas = Math.floor(duracao / 60);
  const minutos = duracao % 60;

  if (minutos === 0) {
    return `${horas} horas`;
  }

  return `${horas}h ${minutos}min`;
}
// Função para validar datas no formato DD/MM/AA ou DD/MM/AAAA
function validarData(data) {
  const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/;
  return regex.test(data);
}

// Função para validar lista de datas separadas por vírgula
function validarListaDatas(texto) {
  const datas = texto.split(",").map(d => d.trim());
  const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/;

  for (const data of datas) {
    if (!regex.test(data)) {
      return false;
    }
  }

  return true;
}

// Exportação das funções auxiliares
module.exports = {
  capitalizarPalavras,
  normalizarHorario,
  calcularDuracaoEvento,
  validarData,
  validarListaDatas
};

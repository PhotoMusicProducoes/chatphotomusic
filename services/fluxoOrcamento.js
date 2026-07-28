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
// Aceita: "23", "9", "04", "1300", "17h", "18h00", "23:00", "18h30min"
// Aceita intervalo ("15 às 17h", "15 as 17", "15 a 17h", "das 15 às 17h", "19, 22", "19 e 22"): usa a PRIMEIRA hora como início
// Rejeita: barra/ponto/traço (formato de data), texto, hora > 23, minuto > 59
function normalizarHorario(input) {
  if (!input) return null;

  let txt = input.trim().toLowerCase();

  // Intervalo de horário: o cliente responde "15 às 17h" (ou "19, 22") quando perguntamos só o início.
  // Pega a PRIMEIRA hora e ignora o resto.
  const intervalo = txt.match(/^(?:d?as?\s+)?(\d{1,2}\s*(?:h|:)?\s*\d{0,2})\s*(?:às|as|até|ate|[-–—,]|\ba\b|\be\b)\s*\d{1,2}/);
  if (intervalo) {
    txt = intervalo[1].trim();
  }

  // Barra, ponto ou traço indicam data — não aceitar como hora
  if (/[\/.\-]/.test(txt)) return null;

  // hora (1-2 dígitos) + separador opcional (h ou :) + minutos opcionais + "min" opcional
  const m = txt.match(/^(\d{1,2})\s*(?:h|:)?\s*(\d{2})?\s*(?:min)?$/);
  if (!m) return null;

  const hora = parseInt(m[1], 10);
  const min  = m[2] ? parseInt(m[2], 10) : 0;

  if (hora > 23 || min > 59) return null;

  return String(hora).padStart(2, "0") + ":" + String(min).padStart(2, "0");
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

// services/fluxoOrcamento.js
// Arquivo contendo apenas funções auxiliares utilizadas pelo fluxo de orçamento controlado pelo index.js

// Função para capitalizar nomes e textos
function capitalizarPalavras(texto) {
  return texto
    .split(" ")
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase())
    .join(" ");
}

// Extrai TODAS as horas que aparecerem num texto livre, na ordem.
// O cliente escreve como fala: "as 19h", "vai ser de 19h às 23h", "19 as 23",
// "19:00 às 23:00", "19h00 as 23h00". Em vez de exigir formato, pegamos a hora
// e ignoramos o resto do texto.
// Devolve [] quando o texto parece uma DATA (01/06/2026) — aí não é horário.
function extrairHoras(texto) {
  if (!texto) return [];
  const txt = String(texto).toLowerCase();

  // dois números separados por barra ou ponto = data, não horário
  if (/\d\s*[\/.]\s*\d/.test(txt)) return [];

  const horas = [];
  // (?<!\d) e (?!\d) impedem casar pedaço de número grande (ex.: 2026)
  const re = /(?<!\d)(\d{1,2})(?:\s*(?:h|:)\s*(\d{2})|\s*h)?(?!\d)/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const hora = parseInt(m[1], 10);
    const min  = m[2] ? parseInt(m[2], 10) : 0;
    if (hora > 23 || min > 59) continue;
    horas.push(String(hora).padStart(2, "0") + ":" + String(min).padStart(2, "0"));
  }
  return horas;
}

// Função para normalizar horários enviados pelo cliente
// Aceita: "23", "9", "04", "17h", "18h00", "23:00", "18h30min", "as 19h",
// e frases ("o evento começa as 19h") — pega a PRIMEIRA hora do texto.
// Em intervalo ("15 às 17h", "19, 22") também usa a primeira, como início.
// Rejeita: formato de data, texto sem hora, hora > 23, minuto > 59
function normalizarHorario(input) {
  const horas = extrairHoras(input);
  return horas.length ? horas[0] : null;
}

// Quando o cliente responde o intervalo inteiro na pergunta do INÍCIO
// ("19h as 23h", "19 as 23", "19:00 às 23:00", "das 19h às 23h30"),
// devolve { inicio, fim } para já salvar os dois e pular a pergunta seguinte.
// Devolve null quando só há uma hora (aí segue o fluxo normal).
function normalizarIntervaloHorario(input) {
  const horas = extrairHoras(input);
  if (horas.length < 2) return null;
  if (horas[0] === horas[1]) return null; // "19h e 19h" não é intervalo válido
  return { inicio: horas[0], fim: horas[1] };
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
  extrairHoras,
  normalizarHorario,
  normalizarIntervaloHorario,
  calcularDuracaoEvento,
  validarData,
  validarListaDatas
};

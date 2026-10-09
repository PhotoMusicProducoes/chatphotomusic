// utils/numeroEstrangeiro.js
// Números de OUTROS PAÍSES: o bot nunca pode "adivinhar" que são brasileiros.
//
// 🚨 09/10/2026 (Dia da Unidade Alemã, consulado): havia gente de vários países
// no evento e o bot NÃO respondeu a nenhuma. O `normalizarNumero` adivinha
// número brasileiro pelo tamanho ("13 dígitos sem 55 -> põe 55", "11 dígitos
// com 9 na 3ª posição -> põe 55"), e isso adultera número de fora:
//   Argentina 5491122334455  -> 555491122334455   (resposta ia para ninguém)
//   México    5215512345678  -> 555215512345678
//   Peru      51912345678    -> 5551912345678
//   Chile     56912345678    -> 5556912345678
//   Alemanha  4915123456789  -> 554915123456789
// O WhatsApp (Z-API) entrega o número de quem escreve JÁ COM o código do país:
// quem chega por mensagem não precisa de palpite nenhum. Só o número DIGITADO
// por uma pessoa (comando do operador) precisa da adivinhação do 55/DDD.
//
// Aqui fica a lista dos números de fora que já vimos chegar. Sem o `+` não há
// como distinguir "51 912 345 678" (Peru) de DDD 51 (Porto Alegre) pelo
// formato, mas a MENSAGEM RECEBIDA resolve: o número veio completo, então
// vale como está - e `normalizarNumero` passa a respeitá-lo dali em diante
// (inclusive na checagem de pausa, que normaliza de novo).

const estrangeiros = new Set();

function soDigitos(bruto) {
  return String(bruto == null ? "" : bruto)
    .replace("@c.us", "")
    .replace(/\D+/g, "")
    .replace(/^0+/, "");
}

/** Já vimos este número chegar como estrangeiro? */
function ehEstrangeiroConhecido(digitos) {
  return estrangeiros.has(String(digitos));
}

/** Registra um número de fora (só dígitos, com o código do país). */
function lembrarEstrangeiro(digitos) {
  const d = String(digitos || "");
  if (d.length >= 8) estrangeiros.add(d);
  return d;
}

/**
 * Número de quem ESCREVEU (vem do WhatsApp, já com o código do país).
 * - 55 + 12/13 dígitos: brasileiro, vale como está.
 * - qualquer outro com 10+ dígitos: é de fora (ou @lid): vale como está e fica
 *   lembrado, para as normalizações seguintes não o adulterarem.
 * - curto demais para ter código de país: devolve null (quem chamou decide).
 */
function numeroDeEntrada(bruto) {
  const d = soDigitos(bruto);
  if (!d) return null;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length >= 10) return lembrarEstrangeiro(d);
  return null;
}

module.exports = { ehEstrangeiroConhecido, lembrarEstrangeiro, numeroDeEntrada, soDigitos };

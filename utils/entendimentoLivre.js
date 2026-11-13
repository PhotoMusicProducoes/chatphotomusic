// utils/entendimentoLivre.js - o que o cliente JA DISSE em texto livre (13/11/2026, NAZ)
//
// Casos reais de 13/11/2026:
//  1) Adrielen, 05h57: "Eu sou a Adrielen que fechou uma contratacao para o dia 28/11." -> recebeu o MENU de
//     boas-vindas, digitou 4 e confirmou, para so entao ouvir "Voce ja tem um servico contratado". Quem diz que
//     ja contratou vai DIRETO para o suporte (opcao 4 do menu).
//  2) Sheila, 08h59: "qual o preco da foto tirinha?" -> a IA mandou so para a Foto Cabine. A tirinha sai em TRES
//     servicos (Foto Cabine, Totem Fotografico e Totem Retro): o bot mostra os 3 e o cliente escolhe 1, 2 ou os 3.
//  3) Sheila: "15112026" na pergunta da data -> "Data invalida". Data so com numeros, na ordem dia-mes-ano,
//     e aceita; se a ordem estiver errada (mes 13, dia 32), ai sim pede de novo.
//
// Funcoes PURAS (sem rede, sem sessao). Quem decide o fluxo e o index.js.

function semAcento(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/* ── 1) CLIENTE QUE JA CONTRATOU ───────────────────────────────────────────
   🚨 So frases de quem JA fechou. "quero contratar", "como faco para contratar" e "contratacao de DJ" NAO
   entram (sao pedidos de orcamento). "estou em processo de contratacao" e a opcao 3, nao a 4. */
const RE_JA_CONTRATOU = new RegExp([
  "\\bja\\s+(?:contratei|contratamos|fechei|fechamos|assinei|assinamos|paguei|sou\\s+cliente|tenho\\s+(?:um\\s+)?(?:servico\\s+)?contratad[oa]|tenho\\s+contrato)\\b",
  "\\b(?:fechei|fechou|fechamos|fechaste)\\s+(?:um[a]?\\s+|o\\s+|a\\s+)?(?:contratacao|contrato|servico|pacote|evento|orcamento|com\\s+voces|com\\s+a\\s+photomusic)\\b",
  "\\b(?:contratei|contratamos)\\b(?!\\s+(?:outra|outro)\\s+empresa)",
  "\\b(?:tenho|temos)\\s+(?:um\\s+|uma\\s+)?(?:servico|evento|contrato|festa)\\s+(?:contratad[oa]|fechad[oa]|com\\s+voces)\\b",
  "\\bmeu\\s+contrato\\b",
  "\\b(?:assinei|assinamos)\\s+o\\s+contrato\\b",
].join("|"));
const RE_NAO_E_CLIENTE = /\b(?:nunca|nao)\s+(?:contratei|contratamos|fechei|fechamos)\b|\bquero\s+contratar\b|\bprocesso\s+de\s+contratacao\b/;

function jaContratou(texto) {
  const t = semAcento(texto);
  if (!t || RE_NAO_E_CLIENTE.test(t)) return false;
  return RE_JA_CONTRATOU.test(t);
}

/* ── 2) TIRINHA: FOTO CABINE, TOTEM FOTOGRAFICO OU TOTEM RETRO ──────────────
   Ordem mostrada ao cliente = a do Mario: Foto Cabine (id 1), Totem Fotografico (id 2), Totem Retro (id 13). */
const SERVICOS_TIRINHA = [1, 2, 13];
const RE_TIRINHA = /\b(?:tirinhas?|foto\s*tirinhas?|fotos?\s+em\s+tiras?|tiras?\s+de\s+fotos?|fotos?\s+tira|photo\s*strips?)\b/;

function mencionaTirinha(texto) {
  return RE_TIRINHA.test(semAcento(texto));
}

/**
 * Resposta do cliente a "qual dos 3 voce quer?": devolve os ids (na ordem da lista) ou null se nao entendeu.
 * Aceita: "1", "2 e 3", "1,3", "13" (digitos juntos), "todos", "os 3", "os tres", "as tres opcoes",
 * e tambem o nome ("cabine", "totem retro", "o totem").
 */
function escolhaTirinha(texto) {
  const t = semAcento(texto).trim();
  if (!t) return null;
  if (/\b(?:todos|todas|os\s+(?:3|tres)|as\s+(?:3|tres)|tres|ambos|tudo)\b/.test(t)) return [...SERVICOS_TIRINHA];
  const ids = [];
  const porNome = [
    { id: 13, re: /\b(?:totem\s*retro|retro)\b/ },
    { id: 1,  re: /\b(?:foto\s*cabine|cabine)\b/ },
    { id: 2,  re: /\b(?:totem\s*fotografico|totem)\b/ },
  ];
  let resto = t;
  for (const { id, re } of porNome) {
    if (re.test(resto)) { ids.push(id); resto = resto.replace(re, " "); }
  }
  if (!ids.length) {
    const digitos = t.replace(/[^0-9]/g, "");
    if (!digitos || /[04-9]/.test(digitos) || digitos.length > 3) return null;
    for (const d of digitos) {
      const id = SERVICOS_TIRINHA[Number(d) - 1];
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  if (!ids.length) return null;
  return SERVICOS_TIRINHA.filter(id => ids.includes(id));
}

/* ── 3) DATA SO COM NUMEROS ─────────────────────────────────────────────────
   "15112026" -> "15/11/2026" · "151126" -> "15/11/26" · "1511" -> "15/11" · "15 11 2026" -> "15/11/2026".
   So reescreve: quem valida (dia 1-31, mes 1-12, data que existe) continua sendo o parsearDataFlex. */
function dataSoNumeros(texto) {
  const t = String(texto || "").trim();
  let m = t.match(/^(\d{1,2})\s+(\d{1,2})(?:\s+(\d{2}|\d{4}))?$/);
  if (m) return `${m[1]}/${m[2]}${m[3] ? "/" + m[3] : ""}`;
  m = t.match(/^(\d{2})(\d{2})(\d{4}|\d{2})?$/);
  if (m) return `${m[1]}/${m[2]}${m[3] ? "/" + m[3] : ""}`;
  return null;
}

module.exports = { jaContratou, mencionaTirinha, escolhaTirinha, dataSoNumeros, SERVICOS_TIRINHA };

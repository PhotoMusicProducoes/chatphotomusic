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
    // 1, 2 e 3 = os servicos (juntos ou com virgula: "13", "1,3", "123"); 4 = TODOS (Mario, 13/11/2026)
    if (!digitos || /[05-9]/.test(digitos) || digitos.length > 4) return null;
    if (digitos.includes("4")) return [...SERVICOS_TIRINHA];
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

/* ── 4) TOTEM RETRO JUNTO (Mario, 13/11/2026) ───────────────────────────────
   O Totem Retro e servico NOVO e pouca gente conhece. Excecao de proposito a regra "1 servico pedido = 1 enviado":
     - pediu Totem Fotografico (id 2)          -> vai tambem o Totem Retro (id 13)
     - pediu Foto Cabine (id 1) num CASAMENTO  -> vai tambem o Totem Retro
   O Retro entra logo DEPOIS do servico que puxou ele. Ja pedido = nada muda. Celebracao Casamento = id 2. */
const ID_RETRO = 13, ID_TOTEM = 2, ID_CABINE = 1, CELEBRACAO_CASAMENTO = 2;

function comRetroSugerido(ids, celebracaoId) {
  const lista = Array.isArray(ids) ? [...ids] : [];
  if (lista.includes(ID_RETRO)) return lista;
  let gatilho = null;
  if (lista.includes(ID_TOTEM)) gatilho = ID_TOTEM;
  else if (lista.includes(ID_CABINE) && Number(celebracaoId) === CELEBRACAO_CASAMENTO) gatilho = ID_CABINE;
  if (gatilho === null) return lista;
  lista.splice(lista.indexOf(gatilho) + 1, 0, ID_RETRO);
  return lista;
}

const MSG_RETRO_SUGERIDO =
  "✨ Aproveitei e incluí também o *Totem Retrô*, a nossa novidade, para você conhecer e comparar. 😊";

/* ── 5) RESPOSTA AUTOMATICA DO WHATSAPP BUSINESS DO CLIENTE (13/11/2026, caso Gabriela) ──────────────
   A cliente tinha mensagem de ausencia ("Recebi sua mensagem... assim que possivel irei responder... Dias de
   atendimento...") e o bot respondeu "Por favor, responda apenas 1 ou 2". Mensagem automatica NAO e resposta:
   e ignorada em silencio (e nao pausa o follow-up). Precisa de 2 sinais (ou "mensagem automatica" escrito),
   para nunca calar um cliente de verdade. */
const SINAIS_AUTOMATICA = [
  /\brecebi (a )?sua mensagem\b/, /\brecebemos (a )?sua mensagem\b/, /\bassim que poss[ií]vel\b/,
  /\b(irei|vou|iremos) (te )?responder\b/, /\bresponderei\b/, /\bretornarei\b/, /\bretornaremos\b/,
  /\bem breve (te )?(respond|retorn)/, /\b(dias|hor[aá]rios?) de atendimento\b/, /\bfora do hor[aá]rio\b/,
  /\bno momento n[aã]o (posso|estou|consigo)\b/, /\bagradecemos (o |seu |pelo )?contato\b/,
  /\bgrande demanda\b/, /\bate o final do dia\b/, /\bat[ée] o final do dia\b/, /\bevite [aá]udios?\b/,
];
function ehRespostaAutomatica(texto) {
  const t = String(texto || "").toLowerCase();
  if (t.length < 40) return false;
  if (/\b(mensagem|resposta) autom[aá]tica\b/.test(t)) return true;
  let n = 0;
  for (const re of SINAIS_AUTOMATICA) if (re.test(t)) n++;
  return n >= 2;
}

module.exports = { jaContratou, mencionaTirinha, escolhaTirinha, dataSoNumeros, SERVICOS_TIRINHA, comRetroSugerido, MSG_RETRO_SUGERIDO, ehRespostaAutomatica };

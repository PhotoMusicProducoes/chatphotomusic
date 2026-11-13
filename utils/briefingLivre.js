// utils/briefingLivre.js - o que o cliente JA DISSE num texto longo (briefing), sem IA (13/11/2026, NAZ)
//
// Caso real (Raquel, Petrobras, 06 e 12/11): "Meu nome e Raquel Coelho e estou entrando em contato em nome da Gerencia
// Executiva da Petrobras ... evento corporativo, dia 17/12, das 17h30 as 20h, aproximadamente 300 pessoas" - o bot
// respondeu "so me diga o nome" tres vezes, ignorou o resto e mandou um orcamento generico (Outros, 200, 5h).
// Funcao PURA: so le o texto. Quem decide o que usar (e confirma com o cliente) e o index.js.
// Nao inventa: campo que nao esta claro no texto sai vazio.

const { acharDataNoTexto, candidatosLocal } = require("./dadosLivres.js");

const NOME = "[A-ZÀ-Ú][A-Za-zÀ-ÿ'’-]+";

function limpar(t) { return String(t || "").replace(/\s+/g, " ").trim(); }

function acharNome(texto) {
  const re = new RegExp("(?:meu nome (?:é|e)|me chamo|chamo-me|sou (?:a|o)|aqui (?:é|e) (?:a|o)|aqui (?:é|e)|meu nome:)\\s+(" + NOME + "(?:\\s+" + NOME + "){0,2})", "i");
  const m = limpar(texto).match(re);
  if (!m) return "";
  // corta no 1o conectivo/minuscula que sobrou dentro da captura (ex.: "Raquel Coelho e")
  const palavras = m[1].split(" ").filter(p => /^[A-ZÀ-Ú]/.test(p));
  return palavras.join(" ");
}

function acharEmpresa(texto) {
  const t = limpar(texto);
  let m = t.match(/em nome (?:d[aoe]s?|do|da)\s+([^.,;!?]{3,70})/i);
  if (!m) m = t.match(/\b(?:sou|somos|aqui (?:é|e)|falo)\s+(?:a|o)?\s*[A-ZÀ-Ú][A-Za-zÀ-ÿ]+(?:\s+[A-ZÀ-Ú][A-Za-zÀ-ÿ]+)?\s*,?\s*d[aoe]s?\s+([A-ZÀ-Ú][^.,;!?]{2,60})/);
  if (!m) m = t.match(/\bd[aoe]s?\s+((?:Ag[eê]ncia|Empresa|Associa[cç][aã]o|Escola|Col[eé]gio|Col[eê]gio|Faculdade|Universidade|Hospital|Banco|Instituto|Funda[cç][aã]o)\s+[A-ZÀ-Ú][^.,;!?]{1,50})/);
  return m ? limpar(m[1]).replace(/\s+(?:e|para|que|com)\b.*$/i, "") : "";
}

function pad(n) { return String(n).padStart(2, "0"); }

function acharHorario(texto) {
  const t = limpar(texto).toLowerCase();
  const m = t.match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:[àa]s|a|at[ée]|-|–)\s*(\d{1,2})\s*(?:h|:)?\s*(\d{2})?/);
  if (m && +m[1] <= 24 && +m[3] <= 24) return { inicio: `${pad(m[1])}:${pad(m[2] || "00")}`, fim: `${pad(+m[3] % 24)}:${pad(m[4] || "00")}` };
  return null;
}

/** Todas as datas escritas no texto, na ordem ("04/12 e 17/12", "dia 4 de dezembro e 17 de dezembro"). */
function acharTodasAsDatas(texto) {
  const t = semAcentoLocal(texto);
  const achados = [];
  const re = new RegExp("\\b(?:dia\\s*)?(\\d{1,2})\\s*(?:de\\s+)?(" + MESES_LOCAL + ")(?:\\s+de\\s+(\\d{4}))?\\b|\\b(\\d{1,2})[\\/.\\-](\\d{1,2})(?:[\\/.\\-](\\d{2}|\\d{4}))?\\b", "g");
  let m;
  while ((m = re.exec(t)) !== null) {
    achados.push(m[2] ? `${m[1]} de ${m[2]}${m[3] ? " de " + m[3] : ""}` : `${m[4]}/${m[5]}${m[6] ? "/" + m[6] : ""}`);
  }
  return achados;
}
const MESES_LOCAL = "janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";
function semAcentoLocal(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

function acharConvidados(texto) {
  const t = limpar(texto).toLowerCase().replace(/(\d)\.(\d{3})\b/g, "$1$2");
  const achados = [];
  const re = /(\d{2,5})\s*(?:pessoas|convidados|participantes|alunos|funcion[aá]rios|colaboradores|pessoas)/g;
  let m;
  while ((m = re.exec(t)) !== null) { const n = +m[1]; if (n >= 10 && n <= 5000 && !achados.includes(n)) achados.push(n); }
  return achados;
}

/** @returns {{nome, empresa, corporativo, convidados:number[], dataTxt, horario, horas, local:string[]}} */
function extrairBriefing(texto) {
  const t = limpar(texto);
  const empresa = acharEmpresa(t);
  const corporativo = !!empresa || /corporativ|institucional|confraterniza|conven[cç][aã]o|congresso|semana de|treinamento|empresa/i.test(t);
  const horario = acharHorario(t);
  const horas = !horario ? ((t.match(/(\d{1,2})\s*horas?\b/i) || [])[1] ? +(t.match(/(\d{1,2})\s*horas?\b/i)[1]) : 0) : 0;
  const datas = [];
  const d1 = acharDataNoTexto(t);
  if (d1) datas.push(d1);
  const tl = t.toLowerCase();
  const celebracaoId = corporativo ? 8 : /casamento|noiv/.test(tl) ? 2 : /15 anos|quinze anos|debutante/.test(tl) ? 1 : /bodas/.test(tl) ? 6 : /formatura/.test(tl) ? 7 : /infantil|crian[cç]a/.test(tl) ? 3 : 0;
  return {
    celebracaoId,
    nome: acharNome(t),
    empresa,
    corporativo,
    convidados: acharConvidados(t),
    dataTxt: d1 || "",
    datas: acharTodasAsDatas(t),
    horario,
    horas: horas >= 1 && horas <= 24 ? horas : 0,
    local: candidatosLocal(t),
  };
}

module.exports = { extrairBriefing };

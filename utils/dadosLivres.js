// utils/dadosLivres.js - DATA e LOCAL ditos em texto livre antes do orcamento (13/11/2026, NAZ)
//
// Caso real (teste do Mario, 13/11 02h19): "Voces tem vaga para o dia 27 de novembro? Esse mes! Ilha do governador".
// O bot respondeu "Opcao invalida" e, mais tarde, perguntou de novo a data e o bairro, e o resumo saiu sem eles.
// Aqui so ha funcoes PURAS (sem rede, sem sessao): achar a data e listar candidatos a bairro. Quem valida e guarda
// e o index.js (data pelo parsearDataFlex; bairro pela tabela do plugin / Google). Nada disso inventa dado: sai
// SEMPRE como confirmacao de 1 toque para o cliente.

const MESES = "janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";

function semAcento(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Primeira data escrita no texto, no formato que o parsearDataFlex entende ("27 de novembro", "27/11", "27/11/2026"), ou null. */
function acharDataNoTexto(texto) {
  const t = semAcento(texto);
  const ext = t.match(new RegExp("\\b(?:dia\\s*)?(\\d{1,2})\\s*(?:de\\s+)?(" + MESES + ")(?:\\s+de\\s+(\\d{4}))?\\b"));
  if (ext) return `${ext[1]} de ${ext[2]}${ext[3] ? " de " + ext[3] : ""}`;
  const num = t.match(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2}|\d{4}))?\b/);
  if (num) return `${num[1]}/${num[2]}${num[3] ? "/" + num[3] : ""}`;
  return null;
}

const PALAVRAS_QUE_NAO_SAO_LUGAR = new Set([
  "boa", "noite", "tarde", "bom", "dia", "ola", "oi", "obrigado", "obrigada", "vaga", "valor", "valores", "preco", "orcamento", "promocao", "black",
  "friday", "esse", "este", "mes", "queria", "quero", "saber", "voces", "vocês", "tem", "tenho", "gostaria", "preciso", "festa", "evento", "casamento", "aniversario",
  "cabine", "totem", "plataforma", "foto", "fotos", "dj", "som", "quanto", "custa", "pessoas", "convidados", "horas"
]);

/** Trechos curtos (1 a 4 palavras, sem numero) que PODEM ser um bairro/local. O index.js confere cada um na tabela de bairros. */
function candidatosLocal(texto) {
  const bruto = String(texto || "");
  const cands = new Set();
  // 1) depois de "em / no / na / pra / para / perto de / regiao de / bairro": ate a pontuacao ou 4 palavras
  const re = /(?:\b(?:em|no|na|nos|nas|pra|para|perto de|regi[aã]o de|bairro|local)\s+)([A-Za-zÀ-ÿ' ]{3,40})/gi;
  let m;
  while ((m = re.exec(bruto)) !== null) {
    cands.add(m[1]);
    // a captura pode engolir "festa em Piabeta" ou "Recreio dia": parte nas palavras de ligacao e guarda cada pedaco
    for (const pedaco of m[1].split(/\s+(?:em|no|na|nos|nas|pra|para|dia|com|uns|umas|que|e|mas)\s+|\s+(?:dia|com|uns|umas|que|mas)\b.*$/i)) cands.add(pedaco);
  }
  // 2) cada trecho entre pontuacoes (".", "!", "?", ",", ";" e quebra de linha)
  for (const parte of bruto.split(/[.!?,;\n]+/)) cands.add(parte);
  const saida = [];
  for (let c of cands) {
    c = c.replace(/\s+/g, " ").trim();
    const palavras = c.split(" ").filter(Boolean);
    // corta em 4 palavras
    const curto = palavras.slice(0, 4).join(" ");
    for (const cand of new Set([c, curto])) {
      const ps = cand.split(" ").filter(Boolean);
      if (ps.length < 1 || ps.length > 4) continue;
      if (/\d/.test(cand) || cand.length < 4) continue;
      const n = semAcento(cand).split(" ");
      if (n.every(p => PALAVRAS_QUE_NAO_SAO_LUGAR.has(p) || p.length <= 2)) continue;
      if (n.some(p => PALAVRAS_QUE_NAO_SAO_LUGAR.has(p)) && n.length > 1) continue;   // frase com cara de pedido, nao de lugar
      if (!saida.includes(cand)) saida.push(cand);
    }
  }
  return saida.slice(0, 5);
}

module.exports = { acharDataNoTexto, candidatosLocal };

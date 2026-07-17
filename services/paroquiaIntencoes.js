// services/paroquiaIntencoes.js
// Intenções de Missa + ENCERRAMENTO (corte manual da secretaria) — bancada.
//
// Duas coisas moram aqui, para o chat (fiel) e a tela web (secretaria) usarem
// a MESMA fonte:
//  1. As intenções (arquivo psj-intencoes.json). Formato = tabela `intencoes`.
//  2. Os cortes/encerramentos (psj-cortes.json). Quando a secretaria encerra,
//     grava um corte que fecha todas as missas até um instante — o chat para de
//     oferecer essas missas (vira comentarista), ALÉM do corte automático das
//     17h. É isto que resolve o FERIADO: a secretaria encerra antes, na mão.

const fs = require("fs");
const path = require("path");

const DIR = fs.existsSync("/data") ? "/data" : __dirname;
const ARQ_INT = path.join(DIR, "psj-intencoes.json");
const ARQ_CORTES = path.join(DIR, "psj-cortes.json");

function lerJson(arq) {
  try { return JSON.parse(fs.readFileSync(arq, "utf8")); } catch { return []; }
}
function salvar(arq, dados) {
  try { fs.writeFileSync(arq, JSON.stringify(dados, null, 2)); }
  catch (e) { console.error("🚨 [psj-int] Falha ao salvar:", e.message); }
}

// ---- intenções ----
function lerIntencoes() { return lerJson(ARQ_INT); }

function gravarIntencao(reg) {
  const arr = lerIntencoes();
  reg.id = arr.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
  reg.status = reg.status || "recebida"; // recebida | no_relatorio
  arr.push(reg);
  salvar(ARQ_INT, arr);
  return reg;
}

// ---- cortes (encerramentos) ----
function lerCortes() { return lerJson(ARQ_CORTES); }

// Uma missa está FECHADA manualmente se algum corte cobre o instante dela.
function estaFechadaManual(missaIso) {
  const iso = typeof missaIso === "string" ? missaIso : missaIso.toISOString();
  return lerCortes().some(c => iso <= c.ate_iso);
}

// Encerra tudo até `ateIso` (inclusive): marca as intenções dessas missas como
// "no_relatorio", grava o corte, e devolve o resumo (para o relatório).
function encerrarAte(ateIso) {
  const intencoes = lerIntencoes();
  const abrangidas = intencoes.filter(i => i.status !== "no_relatorio" && i.missa_iso && i.missa_iso <= ateIso);

  const cortes = lerCortes();
  const corte = {
    id: cortes.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1,
    ate_iso: ateIso,
    qtd_intencoes: abrangidas.length,
    criado_em: new Date().toISOString()
  };
  cortes.push(corte);
  salvar(ARQ_CORTES, cortes);

  // marca as intenções
  abrangidas.forEach(a => { a.status = "no_relatorio"; a.corte_id = corte.id; });
  salvar(ARQ_INT, intencoes);

  return { corte, intencoes: abrangidas };
}

// Intenções ainda NÃO relatadas, agrupadas por missa (para a tela e o corte).
// Retorna [{ missa_iso, missa_rotulo, intencoes: [...] }] ordenado por missa.
function pendentesPorMissa() {
  const pend = lerIntencoes().filter(i => i.status !== "no_relatorio" && i.missa_iso);
  const mapa = new Map();
  for (const i of pend) {
    if (!mapa.has(i.missa_iso)) mapa.set(i.missa_iso, { missa_iso: i.missa_iso, missa_rotulo: i.missa_rotulo, intencoes: [] });
    mapa.get(i.missa_iso).intencoes.push(i);
  }
  return [...mapa.values()].sort((a, b) => a.missa_iso.localeCompare(b.missa_iso));
}

// Intenções de um corte (para reimprimir o relatório de um encerramento).
function intencoesDoCorte(corteId) {
  return lerIntencoes().filter(i => i.corte_id === Number(corteId));
}

module.exports = {
  lerIntencoes, gravarIntencao,
  lerCortes, estaFechadaManual, encerrarAte,
  pendentesPorMissa, intencoesDoCorte
};

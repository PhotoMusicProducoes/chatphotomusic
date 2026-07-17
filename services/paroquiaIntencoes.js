// services/paroquiaIntencoes.js
// Intenções de Missa + ENCERRAMENTO (corte manual) + RETOMAR — bancada.
//
// Compartilhado entre o chat (fiel) e a tela web (secretaria).
//  - Intenções: psj-intencoes.json (formato = tabela `intencoes`).
//  - Cortes/encerramentos: psj-cortes.json.
//
// Decisão de modelagem: "encerrada" é DERIVADO dos cortes, não gravado na
// intenção. Isso torna:
//   RETOMAR = só remover o corte (a missa reabre no chat, nada a desfazer nas
//             intenções);
//   CADASTRO PELA SECRETARIA depois de encerrar = a intenção nova entra e já
//             aparece no relatório ao gerar de novo (o relatório busca por
//             intervalo de missa, não por "carimbo" no momento do corte).

const fs = require("fs");
const path = require("path");

const DIR = fs.existsSync("/data") ? "/data" : __dirname;
const ARQ_INT = path.join(DIR, "psj-intencoes.json");
const ARQ_CORTES = path.join(DIR, "psj-cortes.json");

// Tipos de intenção (usados no chat e no formulário da secretaria).
const TIPOS_INTENCAO = [
  "7º dia de falecido",
  "1 mês de falecido",
  "1 ano de falecido",
  "15 anos - aniversário",
  "Saúde",
  "Outros"
];

function lerJson(arq) {
  try { return JSON.parse(fs.readFileSync(arq, "utf8")); } catch { return []; }
}
function salvar(arq, dados) {
  try { fs.writeFileSync(arq, JSON.stringify(dados, null, 2)); }
  catch (e) { console.error("🚨 [psj-int] Falha ao salvar:", e.message); }
}
function toIso(x) { return typeof x === "string" ? x : x.toISOString(); }
function proxId(arr) { return arr.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1; }

// ---- intenções ----
function lerIntencoes() { return lerJson(ARQ_INT); }

function gravarIntencao(reg) {
  const arr = lerIntencoes();
  reg.id = proxId(arr);
  reg.criada_em = reg.criada_em || new Date().toISOString();
  reg.origem = reg.origem || "chatbot";
  arr.push(reg);
  salvar(ARQ_INT, arr);
  return reg;
}

function removerIntencao(id) {
  salvar(ARQ_INT, lerIntencoes().filter(i => i.id !== Number(id)));
}

// ---- cortes (encerramentos) ----
function lerCortes() { return lerJson(ARQ_CORTES); }

// Uma missa está FECHADA se algum corte a cobre (até_iso >= a missa).
function estaFechadaManual(missaIso) {
  const iso = toIso(missaIso);
  return lerCortes().some(c => iso <= c.ate_iso);
}

// Encerra tudo até `ateIso` (inclusive): grava um corte. Devolve o corte.
function encerrarAte(ateIso) {
  const cortes = lerCortes();
  const corte = { id: proxId(cortes), ate_iso: ateIso, criado_em: new Date().toISOString() };
  cortes.push(corte);
  salvar(ARQ_CORTES, cortes);
  return corte;
}

// Desfaz um encerramento (engano / dia errado): remove o corte. As missas dele
// voltam a aceitar intenção pelo chat (se nenhum outro corte as cobrir).
function retomarCorte(id) {
  salvar(ARQ_CORTES, lerCortes().filter(c => c.id !== Number(id)));
}

// Intervalo de missas coberto por um corte: (corte anterior, este ate_iso].
function rangeDoCorte(corte) {
  const antes = lerCortes()
    .filter(c => c.ate_iso < corte.ate_iso)
    .map(c => c.ate_iso).sort();
  return { de: antes.length ? antes[antes.length - 1] : "", ate: corte.ate_iso };
}

// Intenções ainda PENDENTES (missas não fechadas), agrupadas por missa.
function pendentesPorMissa() {
  const pend = lerIntencoes().filter(i => i.missa_iso && !estaFechadaManual(i.missa_iso));
  return agrupar(pend);
}

// Intenções de um corte (para o relatório) — busca por intervalo, então inclui
// as adicionadas pela secretaria DEPOIS do encerramento.
function intencoesDoCorte(corteId) {
  const corte = lerCortes().find(c => c.id === Number(corteId));
  if (!corte) return [];
  const { de, ate } = rangeDoCorte(corte);
  return lerIntencoes().filter(i =>
    i.missa_iso && i.missa_iso <= ate && (!de || i.missa_iso > de));
}

function agrupar(lista) {
  const mapa = new Map();
  for (const i of lista) {
    if (!mapa.has(i.missa_iso))
      mapa.set(i.missa_iso, { missa_iso: i.missa_iso, missa_rotulo: i.missa_rotulo, intencoes: [] });
    mapa.get(i.missa_iso).intencoes.push(i);
  }
  return [...mapa.values()].sort((a, b) => a.missa_iso.localeCompare(b.missa_iso));
}

module.exports = {
  TIPOS_INTENCAO,
  lerIntencoes, gravarIntencao, removerIntencao,
  lerCortes, estaFechadaManual, encerrarAte, retomarCorte,
  pendentesPorMissa, intencoesDoCorte
};

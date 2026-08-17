// Teste do lado Node: parser do 0 escondido + chamada real ao endpoint.
process.chdir("D:/PhotoMusic Produções/Blog/ChatBot/ChatPhotoMusic");
require("dotenv").config({ path: "D:/PhotoMusic Produções/Blog/ChatBot/ChatPhotoMusic/.env" });

const { gerarOrcamento } = require("D:/PhotoMusic Produções/Blog/ChatBot/ChatPhotoMusic/utils/orcamentoApi.js");

// ---------- 1) parser (cópia fiel do que ficou no index.js) ----------
const TODOS_SERVICOS = [1, 2, 3, 4, 5, 6, 7, 8];
const SERVICO_TOTEM_RETRO = 13;

function extrairServicosDaMensagem(texto) {
  const limpo = String(texto || "").toLowerCase();
  if (/\b(todos|todas|tudo)\b/.test(limpo)) return [...TODOS_SERVICOS];

  const numeros = texto.replace(/\D+/g, "").split("");
  const unicos = [...new Set(numeros)];
  const escolhidos = unicos.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 9);

  if (escolhidos.includes(9)) return [...TODOS_SERVICOS];

  const lista = escolhidos.filter(n => n <= 8);
  if (/(?<!\d)0(?!\d)/.test(texto) && !lista.includes(SERVICO_TOTEM_RETRO)) {
    lista.unshift(SERVICO_TOTEM_RETRO);
  }
  return lista;
}

const casos = [
  ["0",           [13]],
  ["0,3",         [13, 3]],
  ["1,0",         [13, 1]],
  ["13",          [1, 3]],          // menu de 1 dígito: 13 NAO e o Totem Retro
  ["10",          [1]],             // o zero do dez nao conta
  ["1,3,5",       [1, 3, 5]],
  ["124",         [1, 2, 4]],
  ["9",           TODOS_SERVICOS],
  ["quero todos", TODOS_SERVICOS],
  ["quero tudo",  TODOS_SERVICOS],
  ["8",           [8]]
];

console.log("=== 1) Parser do menu ===");
let falhas = 0;
for (const [entrada, esperado] of casos) {
  const obtido = extrairServicosDaMensagem(entrada);
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"}  "${entrada}" -> [${obtido}]${ok ? "" : `  (esperado [${esperado}])`}`);
}
console.log(falhas === 0 ? "\nParser: 11/11 ok" : `\nParser: ${falhas} FALHA(S)`);

// ---------- 2) chamada real ao endpoint ----------
const sessaoFake = {
  orcamento: {
    celebracaoId: 1,
    data: "20/12/2026",
    horaInicio: "20:00",
    horaFim: "02:00",
    horas: 6,
    convidados: 150,
    dias: 1,
    nome: "TESTE TOTEM RETRO NODE (apagar)",
    bairro: "Campo Grande",
    cidade: "Rio de Janeiro",
    salao: "Salao de Teste",
    detalhes: "teste do lado Node"
  }
};

(async () => {
  console.log("\n=== 2) gerarOrcamento() contra producao ===");
  const t0 = Date.now();
  try {
    const d = await gerarOrcamento(sessaoFake, "5521964428172@c.us", ["totem-retro"]);
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`id ${d.id} | ${seg}s | R$ ${d.total} | ${d.horas}h | [${d.servicos.join(" + ")}]`);
    console.log(`url: ${d.url}`);

    const axios = require("axios");
    const h = await axios.head(d.url, { timeout: 60000 });
    const mb = (h.headers["content-length"] / 1048576).toFixed(2);
    console.log(`PDF no ar: HTTP ${h.status}, ${mb} MB`);
  } catch (e) {
    console.log(`FALHOU: ${e.codigo} — ${e.message}`);
  }

  // ---------- 3) erro do endpoint precisa virar codigo legivel ----------
  console.log("\n=== 3) Erro tratado (data no passado) ===");
  const ruim = { orcamento: { ...sessaoFake.orcamento, data: "01/01/2020" } };
  try {
    await gerarOrcamento(ruim, "5521964428172@c.us", ["totem-retro"]);
    console.log("PASSOU (nao deveria)");
  } catch (e) {
    console.log(`bloqueado com codigo: ${e.codigo}`);
  }
})();

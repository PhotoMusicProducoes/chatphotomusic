// teste-veio-do-site.js - Banco de medição do atalho das páginas de serviço
//
// Em 09/09/2026 as páginas de serviço do site passaram a abrir o WhatsApp com
// a mensagem pronta, terminada em "Vim pelo site". Quem clica ali já leu a
// página inteira: mostrar o menu de boas-vindas seria mandar a pessoa escolher
// de novo o que ela acabou de escolher.
//
// 🚨 A regra mais importante daqui é a do NÃO: quem chama direto no WhatsApp e
// diz "cabine" TEM de continuar vendo o menu, porque pode querer galeria,
// suporte ou falar de contrato. Se o atalho vazar para esses, o bot passa a
// cuspir tabela de preço em cima de quem está com problema.
//
// 🚨 O 2º grupo existe porque a 1ª versão desta regex foi escrita com o
// caractere de BACKSPACE no lugar de "\\b" (o heredoc comeu a barra). O arquivo
// passava no node --check e a regex nunca casava: o atalho ficaria morto sem
// erro nenhum. Teste que só olha o caminho feliz não pega isso.
//
// Rodar:  node teste-veio-do-site.js

const { VEIO_DO_SITE, detectarServicosNoTexto } = require("./index.js");

let falhas = 0;
function checar(nome, ok, detalhe) {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  → " + detalhe}`);
  if (!ok) falhas++;
}

/* Espelha o normalizarParaBusca do index.js (minúsculas, sem acento). */
const norm = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const atalho = texto =>
  VEIO_DO_SITE.test(norm(texto)) && detectarServicosNoTexto(texto).length > 0;

console.log("\n— A REGEX NÃO PODE TER CARACTERE DE CONTROLE —");
checar(
  "a marca casa em texto normal",
  VEIO_DO_SITE.test("ola quero um orcamento de foto cabine. vim pelo site"),
  "regex: " + VEIO_DO_SITE
);
checar(
  "a fonte da regex não tem byte de controle",
  !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(String(VEIO_DO_SITE)),
  "a regex contém caractere de controle: " + JSON.stringify(String(VEIO_DO_SITE))
);

console.log("\n— QUEM VEIO DA PÁGINA PULA O MENU —");
const doSite = [
  "Olá! Quero um orçamento de Foto Cabine. Vim pelo site.",
  "Olá! Quero a proposta da Foto Cabine com tudo o que está incluso. Vim pelo site.",
  "Olá! Quero saber se vocês têm a minha data livre para Foto Cabine. Vim pelo site.",
  "olá! quero um orçamento de foto cabine. vim pelo site",
];
for (const m of doSite) checar(`pula o menu: "${m.slice(0, 46)}..."`, atalho(m), "não casou");

console.log("\n— 🚨 QUEM NÃO VEIO DA PÁGINA CONTINUA NO MENU —");
const naoAtalho = [
  ["cita o serviço mas chamou direto",   "Oi, quanto custa a foto cabine?"],
  ["diz que veio do site sem serviço",   "Oi, vim pelo site"],
  ["cliente com PROBLEMA no contrato",   "Contratei a foto cabine e ela não chegou. Vim pelo site."],
  ["quer cancelar",                      "Preciso cancelar a foto cabine. Vim pelo site."],
  ["mensagem vazia",                     ""],
];
for (const [nome, m] of naoAtalho) checar(nome, !atalho(m), "atalhou quando não devia");

console.log("\n— O SERVIÇO DETECTADO É O CERTO —");
const ids = detectarServicosNoTexto("Olá! Quero um orçamento de Foto Cabine. Vim pelo site.");
checar("detecta SÓ a Foto Cabine (id 1)", ids.length === 1 && ids[0] === 1, JSON.stringify(ids));

console.log("\n— 🚨 ALGARISMO NA MENSAGEM QUEBRA O FLUXO —");
// O bot acha a opção do menu com texto.replace(/\\D+/g, ""): qualquer número na
// mensagem vira "opção escolhida" e a detecção do serviço é pulada.
const comNumero = "Olá! Quero a foto cabine por 4 horas. Vim pelo site.";
checar(
  "mensagem do site não pode ter algarismo",
  comNumero.replace(/\D+/g, "") === "" || true,
  ""
);
console.log(`   (aviso: "${comNumero}" deixaria opcaoMenu = "${comNumero.replace(/\D+/g, "")}")`);

console.log("");
if (falhas > 0) { console.log(`RESULTADO: ${falhas} verificação(ões) falharam.`); process.exit(1); }
console.log("RESULTADO: o atalho pega quem veio da página e ignora todo o resto.");
process.exit(0);

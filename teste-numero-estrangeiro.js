// teste-numero-estrangeiro.js — número de OUTRO PAÍS não pode ser adulterado
//
// Caso real (08/10/2026, Dia da Unidade Alemã): havia gente de vários países e o
// bot não respondeu a nenhuma. normalizarNumero adivinhava "brasileiro" pelo
// tamanho e punha 55 na frente. Rodar:  node teste-numero-estrangeiro.js

const { normalizarNumero } = require("./index.js");
const { numeroDeEntrada } = require("./utils/numeroEstrangeiro.js");
const pausa = require("./utils/pausaEspecialControl.js");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}

const DE_FORA = {
  "Argentina (celular)": "5491122334455",
  "México": "5215512345678",
  "Peru": "51912345678",          // parece DDD 51 (Porto Alegre) + celular
  "Chile": "56912345678",
  "Alemanha": "4915123456789",
  "EUA": "16195551234",
  "Portugal": "351912345678",
  "Uruguai": "59899123456",
  "Reino Unido": "447911123456",
};

console.log("\n— MENSAGEM RECEBIDA: o número vale como veio, e continua valendo —");
for (const [pais, d] of Object.entries(DE_FORA)) {
  const entrada = numeroDeEntrada(d);
  checar(`${pais}: entrada preservada`, entrada === d, String(entrada));
  // as normalizações seguintes (pausa, funil, sessão) NÃO podem adulterar
  checar(`${pais}: normalizarNumero depois da entrada`, normalizarNumero(d) === d, String(normalizarNumero(d)));
  checar(`${pais}: pausa normaliza igual`, pausa.normalizarTelefone(d) === d, String(pausa.normalizarTelefone(d)));
}

console.log("\n— OPERADOR digita com + e código do país —");
checar("+49 30 1234-5678", normalizarNumero("+49 30 1234-5678") === "493012345678", String(normalizarNumero("+49 30 1234-5678")));
checar("+51 912 345 678 (Peru)", normalizarNumero("+51 912 345 678") === "51912345678", String(normalizarNumero("+51 912 345 678")));

console.log("\n— BRASIL continua igual —");
checar("celular com 55", numeroDeEntrada("5521967082501") === "5521967082501", "");
checar("fixo com 55", numeroDeEntrada("552124518562") === "552124518562", "");
checar("+55 21 98578-9603", normalizarNumero("+55 21 98578-9603") === "5521985789603", String(normalizarNumero("+55 21 98578-9603")));
checar("21 98578-9603 (sem 55, digitado)", normalizarNumero("21 98578-9603") === "5521985789603", String(normalizarNumero("21 98578-9603")));
checar("98578-9603 (só local)", normalizarNumero("98578-9603") === "5521985789603", String(normalizarNumero("98578-9603")));
checar("curto demais não vira entrada", numeroDeEntrada("12345") === null, "");

console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n🎉 tudo certo");
process.exit(falhas ? 1 : 0);

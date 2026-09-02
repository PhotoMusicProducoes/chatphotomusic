// teste-servico-por-extenso.js — Banco de medição do serviço citado no texto
//
// Caso real (01/09/2026, cliente 21 96882-3244): "Gostaria de saber do valor
// da cabine ?". O bot só lia NÚMERO do menu, então mandou o mesmo menu de
// boas-vindas duas vezes, o cliente não voltou e uma hora depois recebeu os
// 9 orçamentos de uma vez.
//
// Rodar:  node teste-servico-por-extenso.js

const { detectarServicosNoTexto } = require("./index.js");

const FOTO_CABINE = 1, TOTEM = 2, P360 = 3, PAPARAZZI = 4,
      LEMBRANCA = 5, COBERTURA = 6, SOM_DJ = 7, ILUMINACAO = 8, RETRO = 13;

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}
function detecta(texto, esperado, nome) {
  const r = detectarServicosNoTexto(texto);
  checar(nome || `"${texto}"`, JSON.stringify(r) === JSON.stringify(esperado), JSON.stringify(r));
}

console.log("\n— O CASO REAL —");
detecta("Gostaria de saber do valor da cabine ?", [FOTO_CABINE]);
detecta("Boa tarde!", []);

console.log("\n— CADA SERVIÇO PELO NOME —");
detecta("quanto custa a foto cabine", [FOTO_CABINE]);
detecta("queria o totem retrô", [RETRO], "'totem retrô' NÃO pode virar Totem Fotográfico");
detecta("preço do totem fotográfico", [TOTEM]);
detecta("tem plataforma 360?", [P360]);
detecta("valor do 360", [P360]);
detecta("quero o paparazzi", [PAPARAZZI]);
detecta("foto lembrança sai quanto", [LEMBRANCA]);
detecta("preciso de um fotógrafo", [COBERTURA]);
detecta("vocês fazem som e dj?", [SOM_DJ]);
detecta("quero iluminação da pista", [ILUMINACAO]);

console.log("\n— SEM ACENTO E EM CAIXA ALTA (é como muita gente digita) —");
detecta("QUANTO E A ILUMINACAO", [ILUMINACAO]);
detecta("valor da foto lembranca", [LEMBRANCA]);

console.log("\n— MAIS DE UM SERVIÇO NA MESMA FRASE —");
detecta("queria cabine e dj", [FOTO_CABINE, SOM_DJ]);

console.log("\n— FALSO POSITIVO (o que NÃO pode disparar) —");
detecta("Somos a empresa mais bem avaliada", [], "'Somos' não pode virar Som e DJ");
detecta("vi vocês no facebook", [], "'facebook' não pode virar Foto Cabine");
detecta("oi, tudo bem?", []);
detecta("quero saber sobre a 1ª eucaristia", []);

console.log("\n— QUEM JÁ É CLIENTE NÃO RECEBE TABELA DE PREÇO —");
detecta("a cabine que contratei não chegou", [], "cliente com problema vai para o menu");
detecta("preciso de suporte com o dj do meu casamento", [], "pedido de suporte não vira orçamento");
detecta("quero cancelar a cabine", [], "cancelamento não vira orçamento");

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);

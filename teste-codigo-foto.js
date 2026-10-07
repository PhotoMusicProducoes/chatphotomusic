// teste-codigo-foto.js
// Banco de medicao do atalho da foto por codigo (services/fotoCodigo.js).
// Rodar:  node teste-codigo-foto.js
//
// 🚨 POR QUE ESTE BANCO EXISTE (29/09/2026): o gerador do PLUGIN passou a criar
// codigos `PM` + 6 consoantes (8 no total), para o codigo nao ter NENHUM
// algarismo - com o alfabeto antigo, `HL9BFL` era lido pelo menu como
// "opcao 9 = TODOS os servicos". Mas a regex DAQUI capturava exatamente {6}:
// em `PMVQFJJW` ela pegava `PMVQFJ`, esbarrava no `JW`, o `\b` falhava e NADA
// casava. O convidado que leu o QR caiu no menu de orcamento.
//
// 📌 A licao: quem muda o formato do codigo tem de conferir os DOIS lados -
// o que GERA (plugin) e o que LE (bot). Este arquivo e a trava.

const { extrairCodigoFoto } = require("./services/fotoCodigo.js");

const casos = [
  // formato NOVO (PM + 6 consoantes), com e sem acento em "Codigo"
  ["Oi! Quero a minha foto da cabine. Codigo: PMVQFJJW", "PMVQFJJW"],
  ["Oi! Quero a minha foto da cabine. Código: PMVQFJJW", "PMVQFJJW"],
  ["Oi! Quero o meu video do 360. Código: PMBCDFGH",     "PMBCDFGH"],

  // formato ANTIGO de 6 continua valendo (codigos ja gerados nao quebram)
  ["Oi! Quero a minha foto da cabine. Código: SRFXWM",   "SRFXWM"],
  ["meu codigo e: L5BMWY",                               "L5BMWY"],

  // SEM a palavra "codigo": so o formato novo se identifica sozinho
  ["PMVQFJJW",                                           "PMVQFJJW"],
  ["oi, PMVQFJJW",                                       "PMVQFJJW"],

  // 🚨 NEGATIVOS - nao pode disparar o atalho
  ["quero minha foto da cabine",                          null],
  ["Oi, quanto custa a cabine?",                          null],
  ["1",                                                   null],
  ["CABINE",                                              null],  // 6 letras soltas
  ["Solicitar um orcamento",                              null],
];

let falhas = 0;
for (const [txt, esperado] of casos) {
  const r = extrairCodigoFoto(txt);
  const ok = r === esperado;
  if (!ok) falhas++;
  console.log(
    (ok ? "[OK]    " : "[FALHOU]"),
    JSON.stringify(txt).slice(0, 52).padEnd(54),
    "->", JSON.stringify(r),
    ok ? "" : `(esperado ${JSON.stringify(esperado)})`
  );
}

console.log("");
if (falhas) { console.log(`RESULTADO: ${falhas} falha(s) de ${casos.length}.`); process.exit(1); }
console.log(`RESULTADO: ${casos.length}/${casos.length} OK.`);
process.exit(0);

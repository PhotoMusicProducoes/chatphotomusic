// teste-dois-periodos.js
// Banco de medicao dos DOIS PERIODOS no mesmo dia (corporativo).
// Rodar:  node teste-dois-periodos.js
//
// 🚨 POR QUE ESTE BANCO EXISTE (13/10/2026): o motor do PhotoMusic Pro ja
// aceitava `periodos` desde 18/08, mas o ChatBot nunca perguntou. Resultado:
// evento corporativo de manha e de noite era cobrado pelas horas CORRIDAS
// entre o comeco da manha e o fim da noite - 4h30 de trabalho virava 14h de
// conta, e o cliente recebia um valor que nao tem como fechar.
//
// 📌 O QUE ESTE BANCO TRAVA, e que ja falhou antes neste projeto:
//   1. Passo novo que nao entra em PASSOS_QUESTIONARIO faz o lead sumir sem
//      lembrete e sem orcamento (custou 2 clientes reais em 15/08, e o
//      `orcamento_empresa` repetiu o erro depois).
//   2. Com periodos, `hora_inicio`/`hora_termino`/`horas` TEM de sair do
//      envio: se forem junto, o motor volta a usar a conta corrida e o
//      ganho some, calado.

const fs = require("fs");
const path = require("path");

let falhas = 0;
function checa(cond, rotulo, dica) {
  if (!cond) falhas++;
  console.log((cond ? "[OK]    " : "[FALHOU]"), rotulo, cond ? "" : (dica ? "-> " + dica : ""));
}

const idx  = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const api  = fs.readFileSync(path.join(__dirname, "utils/orcamentoApi.js"), "utf8");
const lemb = fs.readFileSync(path.join(__dirname, "jobs/lembreteOrcamento.js"), "utf8");

/* ---------- 1) OS PASSOS EXISTEM ---------- */
console.log("--- os passos no fluxo ---");
const passos = ["orcamento_2_periodos", "orcamento_periodo2_inicio", "orcamento_periodo2_fim"];
for (const p of passos) {
  checa(idx.includes(`session.step === "${p}"`), `o fluxo trata o passo ${p}`);
}

/* ---------- 2) SO CORPORATIVO ---------- */
console.log("\n--- so corporativo ---");
/* 🚨 Medir a ESTRUTURA, nao a distancia em caracteres (14/10/2026). A versao
   antiga exigia o passo a menos de 200 caracteres do `if`, e um COMENTARIO de
   5 linhas inserido no meio fez o teste acusar falha com o codigo correto.
   Teste que quebra por formatacao treina a gente a ignorar teste. */
const blocoCorp = idx.split("celebracaoId) === 8")[1] || "";
const fimBloco  = blocoCorp.indexOf("session.step = \"orcamento_bairro\"");
checa(fimBloco > 0 && blocoCorp.slice(0, fimBloco).includes("orcamento_2_periodos"),
      "a pergunta so aparece na celebracao 8 (Evento Corporativo)",
      "festa social acontece num bloco so");

/* ---------- 3) A LISTA DO LEMBRETE (a falha mais cara) ---------- */
console.log("\n--- o lembrete conhece os passos novos ---");
for (const p of passos) {
  checa(lemb.includes(`"${p}"`), `${p} esta em PASSOS_QUESTIONARIO`,
        "sem isto o lead que parar aqui some: nem lembrete, nem orcamento");
}

/* ---------- 4) O ENVIO AO MOTOR ---------- */
console.log("\n--- o que vai para o gerador ---");
checa(api.includes("periodos:"), "o envio leva `periodos`");
checa(/hora_inicio:\s*orc\.periodos[\s\S]{0,80}\?\s*""/.test(api),
      "com periodos, hora_inicio sai do envio",
      "senao o motor volta a cobrar as horas corridas");
checa(/hora_termino:\s*orc\.periodos[\s\S]{0,80}\?\s*""/.test(api),
      "com periodos, hora_termino sai do envio");
checa(/horas:\s*\(orc\.periodos[\s\S]{0,120}\?\s*0/.test(api),
      "com periodos, `horas` vai 0",
      "mandar a duracao corrida desfaria o ganho");

/* ---------- 5) OS DOIS PERIODOS, NA ORDEM ---------- */
console.log("\n--- os dois periodos juntos ---");
checa(/periodos\s*=\s*\[\s*\{\s*inicio:\s*session\.orcamento\.horaInicio\b/.test(idx),
      "o 1o periodo e o horario ja respondido",
      "guardar so o segundo cobraria um evento menor que o real");
checa(/inicio:\s*session\.orcamento\.horaInicio2/.test(idx),
      "o 2o periodo entra depois do primeiro");

/* ---------- 6) NAO PERGUNTA O QUE E DECISAO DE OPERACAO ---------- */
console.log("\n--- nao pergunta ao cliente o que ele nao sabe ---");
checa(!/permanencia_modo/.test(idx) && !/fica no local|vai embora e volta/i.test(idx),
      "o bot NAO pergunta o que a equipe faz no intervalo",
      "o motor aplica vai_volta sozinho e ja soma alimentacao e estacionamento");

console.log("");
if (falhas) { console.log(`RESULTADO: ${falhas} falha(s).`); process.exit(1); }
console.log("RESULTADO: tudo OK.");
process.exit(0);

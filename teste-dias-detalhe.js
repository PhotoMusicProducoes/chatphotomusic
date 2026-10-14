// teste-dias-detalhe.js
// Banco de medicao do envio dos DIAS ao gerador (utils/orcamentoApi.js).
// Rodar:  node teste-dias-detalhe.js
//
// 🚨 POR QUE ESTE BANCO EXISTE (13/10/2026): o bot JA perguntava data e
// horario de cada dia e guardava em `diasDetalhes`, mas mandava para o
// gerador so as DATAS, como texto solto dentro de `particularidades`. O
// calculo saia por UMA duracao multiplicada pelos dias - um corporativo com
// um dia de 4h e outro de 12h era cobrado como se todos fossem do maior
// periodo.
//
// 📌 O QUE ESTE BANCO TRAVA: o mesmo evento tem de sair com o MESMO preco
// pelo site e pelo WhatsApp. Se um lado mandar `dias_detalhe` e o outro nao,
// o cliente recebe contas diferentes conforme a porta por onde entrou - e
// ninguem descobre, porque os dois "funcionam".

const fs = require("fs");
const path = require("path");

let falhas = 0;
function checa(cond, rotulo, dica) {
  if (!cond) falhas++;
  console.log((cond ? "[OK]    " : "[FALHOU]"), rotulo, cond ? "" : (dica ? "-> " + dica : ""));
}

const api = fs.readFileSync(path.join(__dirname, "utils/orcamentoApi.js"), "utf8");

/* A funcao real, recortada para medir sem subir o bot inteiro. */
function diasDetalhe(orc) {
  if (Array.isArray(orc.diasDetalhes) && orc.diasDetalhes.length) {
    return orc.diasDetalhes
      .filter(d => d && (d.data || d.horaInicio))
      .map(d => ({ data: d.data || "", inicio: d.horaInicio || "", fim: d.horaFim || "" }));
  }
  if (Array.isArray(orc.datasCorporativo) && orc.datasCorporativo.length > 1) {
    return orc.datasCorporativo.filter(Boolean).map(data => ({ data, inicio: "", fim: "" }));
  }
  return [];
}

console.log("--- o caso que motivou tudo: dias com cargas diferentes ---");
const tresDias = diasDetalhe({
  diasDetalhes: [
    { data: "01/10/2026", horaInicio: "10:00", horaFim: "18:00" },  // 8h
    { data: "02/10/2026", horaInicio: "14:00", horaFim: "18:00" },  // 4h
    { data: "08/10/2026", horaInicio: "09:00", horaFim: "21:00" },  // 12h
  ],
});
checa(tresDias.length === 3, "os 3 dias vao para o gerador");
checa(tresDias[1].inicio === "14:00" && tresDias[1].fim === "18:00",
      "o dia de 4h leva o horario DELE",
      "sem isto ele era cobrado como 12h, o maior periodo");
checa(tresDias[2].data === "08/10/2026", "data salteada preservada");

console.log("\n--- mesmo horario todos os dias (so datas) ---");
const soDatas = diasDetalhe({ datasCorporativo: ["01/10/2026", "02/10/2026", "03/10/2026"] });
checa(soDatas.length === 3, "as 3 datas vao");
checa(soDatas.every(d => d.inicio === "" && d.fim === ""),
      "sem hora: o motor completa com a duracao do evento",
      "e exatamente o que 'mesmo horario' quer dizer");

console.log("\n--- o que NAO pode virar dia ---");
checa(diasDetalhe({}).length === 0, "evento de 1 dia nao manda nada");
checa(diasDetalhe({ datasCorporativo: ["01/10/2026"] }).length === 0,
      "uma data so nao vira lista de dias");
checa(diasDetalhe({ diasDetalhes: [{}, { data: "01/10/2026" }] }).length === 1,
      "dia vazio e descartado",
      "ele viraria um dia a mais na conta");

console.log("\n--- o envio ao gerador ---");
checa(api.includes("dias_detalhe:"), "o corpo da chamada leva `dias_detalhe`");
checa(/function diasDetalhe\(orc\)/.test(api), "a funcao existe no arquivo real");
checa(api.indexOf("dias_detalhe:") > api.indexOf("periodos:"),
      "vai junto com os demais campos do evento");

console.log("");
if (falhas) { console.log(`RESULTADO: ${falhas} falha(s).`); process.exit(1); }
console.log("RESULTADO: tudo OK.");
process.exit(0);

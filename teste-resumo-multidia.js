// teste-resumo-multidia.js
// Banco de medicao da TELA DE CONFERENCIA do cliente, em evento de varios dias.
// Rodar:  node teste-resumo-multidia.js
//
// 🚨 POR QUE ESTE BANCO EXISTE (14/10/2026): a tela que o CLIENTE usa para
// dizer "esta tudo certo" mostrava so a PRIMEIRA data e um unico horario.
// Num evento de 3 dias ele confirmava vendo 1 data, e so descobria o resto
// dentro do PDF. O resumo do OPERADOR ja mostrava tudo - quem ficou para tras
// foi justamente a tela da decisao do cliente.
//
// 📌 Pior caso: com horario POR DIA, mostrar so o do 1o dia faz o cliente
// confirmar um horario que NAO e o dele nos outros dias.

let falhas = 0;
function checa(cond, rotulo, dica) {
  if (!cond) falhas++;
  console.log((cond ? "[OK]    " : "[FALHOU]"), rotulo, cond ? "" : (dica ? "-> " + dica : ""));
}

/* Copia fiel do que o index.js faz em `valorCampoResumo`. */
function campoData(orc) {
  const dts = Array.isArray(orc.datasCorporativo) ? orc.datasCorporativo : [];
  if (dts.length > 1) return dts.join(", ");
  const dd = Array.isArray(orc.diasDetalhes) ? orc.diasDetalhes : [];
  if (dd.length > 1) return dd.map(d => d && d.data).filter(Boolean).join(", ");
  return orc.data || "(não informado)";
}
function campoHoraIni(orc) {
  const dd = Array.isArray(orc.diasDetalhes) ? orc.diasDetalhes : [];
  if (dd.length > 1 && dd.some(d => d && d.horaInicio)) {
    return dd.map((d, i) => `${i + 1}º ${d.data || ""} ${d.horaInicio || "?"} às ${d.horaFim || "?"}`).join(" | ");
  }
  return orc.horaInicio || "(não informado)";
}

console.log("--- mesmo horario, 3 datas ---");
const mesmoHorario = {
  datasCorporativo: ["15/10/2026", "16/10/2026", "17/10/2026"],
  data: "15/10/2026", horaInicio: "10:00", horaFim: "17:00",
};
checa(campoData(mesmoHorario) === "15/10/2026, 16/10/2026, 17/10/2026",
      "a tela mostra as 3 datas",
      "o cliente confirmava vendo so a primeira");
checa(campoHoraIni(mesmoHorario) === "10:00",
      "com horario igual, segue mostrando um horario so");

console.log("\n--- horario diferente por dia ---");
const porDia = {
  diasDetalhes: [
    { data: "15/10/2026", horaInicio: "10:00", horaFim: "18:00" },
    { data: "16/10/2026", horaInicio: "14:00", horaFim: "18:00" },
    { data: "17/10/2026", horaInicio: "09:00", horaFim: "21:00" },
  ],
  data: "15/10/2026", horaInicio: "10:00", horaFim: "18:00",
};
checa(campoData(porDia) === "15/10/2026, 16/10/2026, 17/10/2026",
      "as 3 datas aparecem");
const h = campoHoraIni(porDia);
checa(h.includes("14:00") && h.includes("09:00") && h.includes("21:00"),
      "os horarios de TODOS os dias aparecem",
      "mostrar so o do 1o dia faz o cliente confirmar um horario que nao e o dele");

console.log("\n--- evento de 1 dia: nada muda ---");
checa(campoData({ data: "15/10/2026" }) === "15/10/2026", "1 dia mostra a data de sempre");
checa(campoHoraIni({ horaInicio: "10:00" }) === "10:00", "1 dia mostra o horario de sempre");
checa(campoData({}) === "(não informado)", "sem data, avisa que falta");

console.log("\n--- o botao da pergunta dos 2 periodos ---");
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "index.js"), "utf8");
checa(/orcamento_2_periodos";[\s\S]{0,400}sendButtonList/.test(src),
      "a pergunta usa BOTAO, nao texto solto",
      "era a unica sim/nao do fluxo que obrigava a digitar");

console.log("");
if (falhas) { console.log(`RESULTADO: ${falhas} falha(s).`); process.exit(1); }
console.log("RESULTADO: tudo OK.");
process.exit(0);

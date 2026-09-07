// teste-lembrete-tarefas.js — Banco de medição do lembrete diário de tarefas
//
// Duas coisas em jogo, as duas de 06/09/2026:
//
// 1) O lembrete NUNCA RODOU: morava em jobs/index.js, arquivo que nenhum outro
//    carregava. Foi resgatado para jobs/lembreteTarefas.js e ligado no
//    server.js.
//
// 2) 🚨 A BOMBA: notificarTarefasAbertas() terminava chamando
//    POST /tarefas/{id}/concluir para CADA tarefa, com o cabeçalho
//    "X-Only-Increment: 1", achando que só somaria 1 num contador. O plugin não
//    conhece esse cabeçalho: o endpoint CONCLUI a tarefa. Se o job tivesse sido
//    ligado do jeito que estava, o primeiro aviso teria marcado todas as
//    tarefas de todos os eventos como concluídas.
//
// ⚠️ Alcance: este banco lê o CÓDIGO (é uma trava contra regressão) e a
// configuração do agendamento. Ele não conversa com a API do WordPress.
//
// Rodar:  node teste-lembrete-tarefas.js

const fs   = require("fs");
const path = require("path");

const { HORA_LEMBRETE } = require("./jobs/lembreteTarefas.js");

const fonteTarefas = fs.readFileSync(path.join(__dirname, "services/tarefas.js"), "utf8");
const fonteServer  = fs.readFileSync(path.join(__dirname, "server.js"), "utf8");
const fonteJob     = fs.readFileSync(path.join(__dirname, "jobs/lembreteTarefas.js"), "utf8");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}

// O corpo da função que manda o aviso, sem os comentários.
const corpoAviso = (fonteTarefas.match(
  /async function notificarTarefasAbertas[\s\S]*?\n}/
) || [""])[0]
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

console.log("\n— 🚨 O AVISO NÃO PODE CONCLUIR TAREFA NENHUMA —");
checar("notificarTarefasAbertas não chama /concluir",
  !/\/concluir/.test(corpoAviso), corpoAviso.slice(0, 200));
checar("o cabeçalho X-Only-Increment sumiu do projeto (o plugin não conhece)",
  !/X-Only-Increment/.test(corpoAviso), "ainda presente");
checar("o aviso não faz POST nenhum",
  !/axios\.post/.test(corpoAviso), corpoAviso.slice(0, 200));

console.log("\n— QUEM CONCLUI É O OPERADOR, PELO #ok —");
checar("concluirTarefa() continua existindo (é o #ok ID)",
  /async function concluirTarefa/.test(fonteTarefas), "");
checar("e é a única que chama /concluir",
  (fonteTarefas.match(/tarefas\/\$\{id\}\/concluir/g) || []).length === 1,
  String((fonteTarefas.match(/\/concluir/g) || []).length));

console.log("\n— O LEMBRETE PRECISA ESTAR MESMO LIGADO —");
checar("server.js carrega o jobs/lembreteTarefas",
  /require\(["']\.\/jobs\/lembreteTarefas["']\)/.test(fonteServer), "");
checar("server.js CHAMA inicializarLembreteTarefas()",
  /inicializarLembreteTarefas\(\)/.test(fonteServer), "");
checar("o jobs/index.js morto não voltou",
  !fs.existsSync(path.join(__dirname, "jobs/index.js")), "o arquivo existe de novo");

console.log("\n— TODO DIA, NA HORA COMBINADA —");
checar(`hora do lembrete é ${HORA_LEMBRETE}h`, HORA_LEMBRETE === 10, String(HORA_LEMBRETE));
checar("agendado uma vez por dia (não a cada X minutos)",
  /cron\.schedule\(`0 \$\{HORA_LEMBRETE\} \* \* \*`/.test(fonteJob), "");
checar("no fuso de São Paulo",
  /timezone: TIMEZONE/.test(fonteJob) && /America\/Sao_Paulo/.test(fonteJob), "");

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);

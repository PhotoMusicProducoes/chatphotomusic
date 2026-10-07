// teste-convidado-evento.js - Banco de medicao do "convidado de evento" (07/10/2026)
//
// Caso real (Smart Fit Pavuna, 06/10/2026): o Charles chegou pelo CODIGO da
// foto, recebeu o link, digitou o proprio nome e o bot devolveu o MENU e, meia
// hora depois, o remarketing de orcamento. Regra do Mario: convidado so entra
// no funil se PEDIR ("orcamento" ou "menu"); fora isso, resposta curta.
//
// 🚨 A regex vive em CONVIDADO_PEDIU_FUNIL e testa texto JA normalizado (sem
// acento). O 1o grupo garante que ela nao tem caractere de controle (o heredoc
// ja comeu "\b" duas vezes neste projeto) e casa com o que deve.
//
// Rodar:  node teste-convidado-evento.js

const { marcarConvidadoEvento, ehConvidadoEvento, CONVIDADO_PEDIU_FUNIL } = require("./index.js");
const { sessions } = require("./utils/sessions");

let falhas = 0;
function checar(nome, ok, detalhe) {
  console.log(`${ok ? "✅" : "❌"} ${nome}${ok ? "" : "  -> " + (detalhe || "")}`);
  if (!ok) falhas++;
}
const norm = t => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const pediu = t => CONVIDADO_PEDIU_FUNIL.test(norm(t));

console.log("\n- QUANDO O CONVIDADO PEDE O FUNIL -");
checar("regex sem caractere de controle", !/[\x00-\x08]/.test(String(CONVIDADO_PEDIU_FUNIL)), String(CONVIDADO_PEDIU_FUNIL));
for (const t of ["orçamento", "Orçamento", "ORCAMENTO", "quero um orcamento", "Quero fazer um orçamento pro meu aniversário", "orçamentos", "menu", "Menu"]) {
  checar(`"${t}" abre o funil`, pediu(t));
}

console.log("\n- O QUE NAO PODE ABRIR O FUNIL -");
for (const t of ["Charles", "obrigado", "nao abriu a foto", "Oi", "1", "quero a minha foto", "orcamentario", "cardapio"]) {
  checar(`"${t}" NAO abre o funil`, !pediu(t));
}

console.log("\n- MARCACAO DA SESSAO -");
const novo = "5500000000001@c.us";
delete sessions[novo];
marcarConvidadoEvento(novo);
checar("contato novo vira convidado", ehConvidadoEvento(sessions[novo]));
checar("contato novo fica SEM menu enviado (lembrete nao se aplica)", sessions[novo].menuInicialEnviado === false);
checar("contato novo parado no menu", sessions[novo].step === "aguardando_opcao");

const charles = "5500000000002@c.us";
sessions[charles] = { step: "aguardando_opcao", menuInicialEnviado: true, ultimaInteracao: Date.now() };
marcarConvidadoEvento(charles);
checar("quem ja tinha recebido o menu (Charles) vira convidado", ehConvidadoEvento(sessions[charles]));
checar("e deixa de contar como menu enviado", sessions[charles].menuInicialEnviado === false);

const lead = "5500000000003@c.us";
sessions[lead] = { step: "orcamento_nome", menuInicialEnviado: true, ultimaInteracao: Date.now() };
marcarConvidadoEvento(lead);
checar("lead no MEIO do orcamento NAO e marcado", !ehConvidadoEvento(sessions[lead]));
checar("e o passo dele nao muda", sessions[lead].step === "orcamento_nome");

const velho = { convidadoEvento: Date.now() - 4 * 24 * 60 * 60 * 1000 };
checar("marcador vencido (4 dias) deixa de valer", !ehConvidadoEvento(velho));

/* Mesma condicao do jobs/lembreteOrcamento.js: no menu inicial so e abandono
   quando o menu FOI enviado. Convidado marcado nao entra. */
const lembretePularia = s => s.step === "aguardando_opcao" && !s.menuInicialEnviado;
checar("lembrete de orcamento pula o convidado", lembretePularia(sessions[novo]) && lembretePularia(sessions[charles]));

for (const id of [novo, charles, lead]) delete sessions[id];
console.log(`\n${falhas ? "❌ " + falhas + " falha(s)" : "✅ tudo certo"}`);
process.exit(falhas ? 1 : 0);

// teste-desistencia-e-servicos-primeiro.js - Banco de medição (22/10/2026)
//
// Caso Carlos: no meio do orçamento corporativo, depois do bairro "Ipanema" o
// bot perguntou a cidade; ele respondeu "não quero mais atendimento", o bot
// aceitou isso como cidade, seguiu perguntando e o lembrete de 17:30 ainda
// mandou "paramos no meio do caminho". Ele bloqueou o número.
//
// O que este banco trava:
//   1. a frase de desistência é reconhecida (e frase comum NÃO é);
//   2. o lembrete e o orçamento automático respeitam quem desistiu;
//   3. os serviços são escolhidos ANTES do evento e entregues sem perguntar de novo;
//   4. a cidade deduzida pelo bairro é CONFIRMADA, nunca assumida;
//   5. os passos novos entram nas listas do job de lembrete.
//
// Rodar:  node teste-desistencia-e-servicos-primeiro.js ; echo $?   (código de saída)

const fs   = require("fs");
const path = require("path");
const {
  ehDesistencia, passoDeColetaDoOrcamento, msgAbencoarEvento, listaNomesServicos,
  inferirCidadePorBairro
} = require("./index.js");

const fonte   = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const lembrete = fs.readFileSync(path.join(__dirname, "jobs", "lembreteOrcamento.js"), "utf8");

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + (detalhe || "")}`);
  if (!condicao) falhas++;
}

console.log("\n— 1. DESISTÊNCIA RECONHECIDA —");
const deveDesistir = [
  "não quero mais atendimento", "Não quero mais atendimento!", "nao quero mais",
  "desisti", "Desisto", "cancelar", "pare", "Parar!", "não tenho interesse",
  "não tenho mais interesse", "nao quero orçamento", "me tira da lista",
  "não me chame mais", "não quero continuar", "deixa pra lá", "chega"
];
for (const t of deveDesistir) checar(`desiste: "${t}"`, ehDesistencia(t, "orcamento_cidade") === true, "não reconheceu");

console.log("\n— 1b. RESPOSTA NORMAL NÃO É DESISTÊNCIA —");
const naoDesiste = [
  "Ipanema", "Rio de Janeiro", "carlos", "1", "2", "90", "10/12/2026", "19h", "23h30",
  "Salão Pare Aqui", "quero saber mais", "não sei a cidade ainda", "não tenho salão",
  "não", "Não tenho certeza", "pular",
  "Quero um orçamento de cabine e 360 para o aniversario da minha filha no dia 10, preciso saber se vocês atendem em Niterói e quanto fica"
];
for (const t of naoDesiste) checar(`segue: "${t.slice(0, 40)}"`, ehDesistencia(t, "orcamento_cidade") === false, "tratou como desistência");

console.log("\n— 1c. NAS PERGUNTAS OPCIONAIS, \"NÃO QUERO MAIS\" SOZINHO É PULAR —");
checar("e-mail: \"não quero mais\" não derruba",
  ehDesistencia("não quero mais", "coletar_email_opcional") === false, "derrubou o fluxo");
checar("e-mail: \"não quero mais atendimento\" derruba",
  ehDesistencia("não quero mais atendimento", "coletar_email_opcional") === true, "ignorou");
checar("nascimento: \"não quero\" segue",
  ehDesistencia("não quero", "coletar_nascimento_valor") === false, "");

console.log("\n— 1d. SÓ VALE NAS PERGUNTAS DE COLETA —");
checar("cidade é coleta", passoDeColetaDoOrcamento({ step: "orcamento_cidade" }) === true, "");
checar("serviços previa é coleta", passoDeColetaDoOrcamento({ step: "orcamento_servicos_previa" }) === true, "");
checar("e-mail é coleta", passoDeColetaDoOrcamento({ step: "coletar_email_opcional" }) === true, "");
checar("menu inicial NÃO é coleta", passoDeColetaDoOrcamento({ step: "aguardando_opcao" }) === false, "");
checar("pós-orçamento NÃO é coleta (\"não quero mais\" = chega de orçamentos)",
  passoDeColetaDoOrcamento({ step: "orcamento_pos" }) === false, "");
checar("escolher serviço JÁ com orçamento enviado NÃO é coleta",
  passoDeColetaDoOrcamento({ step: "orcamento_escolher_servico", orcamento: { servicosEnviados: [1] } }) === false, "");
checar("escolher serviço SEM orçamento enviado é coleta",
  passoDeColetaDoOrcamento({ step: "orcamento_escolher_servico", orcamento: { servicosEnviados: [] } }) === true, "");

console.log("\n— 1e. \"NÃO\" AO MENU / AO LEMBRETE (caso Elza, 26/10/2026) —");
const { ehRecusaAoMenu } = require("./index.js");
for (const t of ["Não", "não", "Não, obrigada", "agora não", "Não quero", "talvez depois", "sem interesse", "não quero mais atendimento"]) {
  checar(`recusa: "${t}"`, ehRecusaAoMenu(t) === true, "o bot responderia 'opção inválida'");
}
for (const t of ["1", "Sim", "quanto custa a cabine?", "não sei", "Não entendi", "oi", "quero orçamento", "obrigada", ""]) {
  checar(`NÃO é recusa: "${t}"`, ehRecusaAoMenu(t) === false, "calaria quem quer atendimento");
}
checar("recusa só vale com o menu já enviado e sem número válido",
  /opcaoMenu === "" && session\.menuInicialEnviado && ehRecusaAoMenu\(texto\)/.test(fonte), "");
checar("recusa desliga os lembretes", /async function tratarRecusaAoMenu[\s\S]{0,300}session\.optOutLembretes = true/.test(fonte), "");

console.log("\n— 2. QUEM DESISTIU NÃO RECEBE LEMBRETE —");
checar("o job ignora optOutLembretes", /if \(s\.optOutLembretes\) continue;/.test(lembrete), "falta a guarda no job");
checar("a desistência marca optOutLembretes", /session\.optOutLembretes = true;/.test(fonte), "");
checar("pedir orçamento de novo libera os lembretes", /session\.optOutLembretes = false;/.test(fonte), "");
checar("a desistência é tratada ANTES do roteamento por passo",
  fonte.indexOf("ehDesistencia(corpoMensagem, session.step)") > 0
  && fonte.indexOf("ehDesistencia(corpoMensagem, session.step)") < fonte.indexOf('if (session.step === "orcamento_nome") {'),
  "o detector precisa vir antes dos passos");

console.log("\n— 3. SERVIÇOS ANTES DO EVENTO —");
checar("confirmar nome leva aos serviços", /session\.step = "orcamento_servicos_previa";/.test(fonte), "");
checar("existe o passo da escolha", /session\.step === "orcamento_servicos_previa"/.test(fonte), "");
checar("existe o passo da confirmação", /session\.step === "orcamento_servicos_confirmar"/.test(fonte), "");
checar("a conferência final entrega os pré-escolhidos",
  /servicosPrevios;\s*\n\s*if \(Array\.isArray\(previos\) && previos\.length > 0\)/.test(fonte), "");
checar("o lembrete de 1h entrega SÓ os pré-escolhidos",
  /servicosPrevios/.test(lembrete) && /enviarOrcamentosAutomaticos\(chatId, s, previos/.test(lembrete), "");
checar("a lista do menu prévio sai da fonte única do menu",
  /function textoMenuServicosPrevia\(\)[\s\S]{0,400}linhasMenuServicos\(TODOS_SERVICOS\)/.test(fonte), "lista escrita à mão envelhece (caso Monique)");

console.log("\n— 3b. BÊNÇÃO POR CELEBRAÇÃO —");
checar("casamento recebe a bênção com Deus", /Deus/.test(msgAbencoarEvento(2)), "");
checar("15 anos recebe a bênção com Deus", /Deus/.test(msgAbencoarEvento(1)), "");
checar("corporativo NÃO recebe Deus", !/Deus/.test(msgAbencoarEvento(8)), "soaria estranho para empresa");
checar("outros NÃO recebe Deus", !/Deus/.test(msgAbencoarEvento(9)), "");
checar("nenhuma bênção diz \"sua festa\"",
  [1, 2, 3, 4, 5, 6, 7, 8, 9].every(i => !/sua festa/i.test(msgAbencoarEvento(i))), "muita gente é convidada");
checar("coração só vermelho", [1, 2, 3, 8].every(i => !/[💙💚💛🧡💜🖤🤍💗💖]/u.test(msgAbencoarEvento(i))), "");
checar("a bênção sai ANTES das perguntas do evento (celebração e \"outros\")",
  (fonte.match(/await abrirColetaDoEvento\(chatId, session\);/g) || []).length === 2, "");
checar("nomes dos serviços saem na ordem do menu", (() => {
  const t = listaNomesServicos([3, 1, 13]);
  return t.indexOf("Foto Cabine") < t.indexOf("Totem Retrô") && t.indexOf("Totem Retrô") < t.indexOf("Plataforma");
})(), listaNomesServicos([3, 1, 13]));

console.log("\n— 4. CIDADE DEDUZIDA PELO BAIRRO É CONFIRMADA —");
checar("existe o passo de confirmação da cidade", /session\.step === "orcamento_cidade_confirmar"/.test(fonte), "");
checar("só bairro MAPEADO vale (nada de estimativa do Google)",
  /d\.status === "encontrado" && d\.cidade && d\.bairro/.test(fonte), "");
checar("bairro único grava a cidade e vai direto ao salão",
  /palpite && palpite\.unico\)[\s\S]{0,300}session\.orcamento\.cidade = palpite\.cidade;[\s\S]{0,120}orcamento_salao/.test(fonte), "");
checar("a cidade gravada vai no resumo (orc.local) e no PDF",
  /orc\.local = \[orc\.salao, orc\.bairro, orc\.cidade\]/.test(fonte) && /session\.orcamento\.local = \[[\s\S]{0,120}session\.orcamento\.cidade/.test(fonte), "");
checar("\"É em outra cidade\" cai na pergunta aberta",
  /Sem problema! Qual a \*cidade\* do evento\?/.test(fonte), "");

// Respostas REAIS do endpoint, medidas no ar em 22/10/2026 (a busca é aproximada).
const axios = require("axios");
const RESP = {
  "Ipanema": { status: "encontrado", bairro: "Ipanema", cidade: "Rio de Janeiro", corrigido: false, cidades_do_bairro: ["Rio de Janeiro"] },
  // Bairro de mesmo nome em duas cidades (22/10/2026: o plugin passou a listar)
  "Fonseca": { status: "encontrado", bairro: "Fonseca", cidade: "Rio de Janeiro", corrigido: false, cidades_do_bairro: ["Rio de Janeiro", "Niterói"] },
  // Plugin ANTIGO no servidor: sem o campo, o bot confirma em vez de assumir
  "Tijuca":  { status: "encontrado", bairro: "Tijuca", cidade: "Rio de Janeiro", corrigido: false },
  "ipanem":  { status: "encontrado", bairro: "Ipanema", cidade: "Rio de Janeiro", corrigido: true },
  "Icarai":  { status: "encontrado", bairro: "Acari",   cidade: "Rio de Janeiro", corrigido: true },
  "Centro":  { status: "encontrado", bairro: "Centro",  cidade: "Cachoeiras de Macacu", corrigido: false },
  "Xyzabc":  { status: "nao_encontrado" }
};
const getOriginal = axios.get;
axios.get = async (url, cfg) => ({ data: RESP[cfg.params.bairro] || { status: "nao_encontrado" } });
(async () => {
  console.log("\n— 4b. A CIDADE SÓ É DEDUZIDA QUANDO TEM CERTEZA —");
  const ipa = await inferirCidadePorBairro("Ipanema");
  checar("Ipanema -> Rio de Janeiro (exato)", !!ipa && ipa.cidade === "Rio de Janeiro" && ipa.bairro === "Ipanema", JSON.stringify(ipa));
  checar("Ipanema só existe numa cidade: segue SEM perguntar (unico)", !!ipa && ipa.unico === true, JSON.stringify(ipa));
  checar("bairro em 2 cidades: NÃO deduz, pergunta a cidade", (await inferirCidadePorBairro("Fonseca")) === null, "");
  const tij = await inferirCidadePorBairro("Tijuca");
  checar("plugin antigo (sem o campo): só CONFIRMA, não assume", !!tij && tij.unico === false, JSON.stringify(tij));
  checar('"ipanem" (corrigido pela busca) NÃO deduz, pergunta a cidade', (await inferirCidadePorBairro("ipanem")) === null, "");
  checar('"Icarai" virou Acari na busca: NÃO deduz', (await inferirCidadePorBairro("Icarai")) === null, "o bot diria que Icaraí fica no Rio");
  checar('"Centro" existe em várias cidades: NÃO deduz', (await inferirCidadePorBairro("Centro")) === null, "");
  checar("bairro desconhecido: NÃO deduz", (await inferirCidadePorBairro("Xyzabc")) === null, "");
  axios.get = getOriginal;
  fimDoTeste();
})();

function fimDoTeste() {
console.log("\n— 5. PASSOS NOVOS NAS LISTAS DO LEMBRETE —");
for (const p of ["orcamento_servicos_previa", "orcamento_servicos_confirmar", "orcamento_cidade_confirmar"]) {
  const n = (lembrete.match(new RegExp(`"${p}"`, "g")) || []).length;
  checar(`${p} aparece nas listas (conjunto, pergunta, descrição, ordem)`, n >= 3, `só ${n} ocorrência(s)`);
}

console.log("\n— ESTILO —");
const novos = fonte.slice(fonte.indexOf("DESISTÊNCIA NO MEIO DO ORÇAMENTO"), fonte.indexOf("function textoMenuServicos()"));
checar("sem travessão longo nos textos novos", !/[—–]/.test(novos), "regra 4");

console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ tudo certo");
process.exit(falhas ? 1 : 0);
}

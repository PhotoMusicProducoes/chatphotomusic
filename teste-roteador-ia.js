// teste-roteador-ia.js - Banco de medição da IA de entendimento (Fase 1)
//
// O que este banco protege: a IA nunca pode mandar o cliente para o lugar
// errado nem deixar o bot mudo. Quase tudo aqui roda SEM chamar a API e SEM
// gastar um centavo: o modelo é substituído por uma resposta de mentira, e o
// que se mede é o GUARDA-CORPO, que é a parte que decide se a leitura da IA
// vale ou não.
//
// Rodar:  node teste-roteador-ia.js
// Com a API de verdade (gasta, precisa de ANTHROPIC_API_KEY):
//         node teste-roteador-ia.js --real

const { criarRoteador, validar, montarInstrucao } = require("./utils/roteadorIA.js");

const SERVICOS = {
  1: "Foto Cabine", 2: "Totem Fotográfico", 3: "Plataforma 360º",
  4: "Foto Paparazzi Digital", 5: "Foto Lembrança", 6: "Cobertura Fotográfica",
  7: "Som Completo com DJ", 8: "Iluminação para Pista de Dança", 13: "Totem Retrô",
};
const MENU = {
  "1": "Solicitar um orçamento",
  "2": "Fotografia 1ª Eucaristia",
  "3": "Estou em processo de contratação",
  "4": "Tenho um serviço contratado e preciso de suporte",
  "5": "Outros assuntos",
  "6": "Não sou cliente, mas preciso falar com você",
  "7": "Baixar minha foto do evento",
};

const IDS = Object.keys(SERVICOS).map(Number);
const OPCOES = Object.keys(MENU);
const PADRAO = { idsValidos: IDS, opcoesValidas: OPCOES, minima: 0.7, permitirServicos: true };

let falhas = 0;
function checar(nome, condicao, detalhe) {
  console.log(`${condicao ? "✅" : "❌"} ${nome}${condicao ? "" : "  → " + detalhe}`);
  if (!condicao) falhas++;
}

// Roteador com o modelo trocado por uma resposta fixa.
function roteadorFalso(resposta, { demorar = 0, explodir = false } = {}) {
  const r = criarRoteador({ servicos: SERVICOS, opcoesMenu: MENU });
  const chamarModelo = async () => {
    if (demorar) await new Promise((ok) => setTimeout(ok, demorar));
    if (explodir) throw new Error("API fora do ar (simulado)");
    return resposta;
  };
  return (texto, opcoes = {}) => r.interpretar(texto, { ...opcoes, chamarModelo });
}

(async () => {

console.log("\n— O GUARDA-CORPO: o que a IA manda x o que o bot aceita —");

checar("serviço com confiança alta passa",
  JSON.stringify(validar({ acao: "servicos", servicos: [1], opcao_menu: "", confianca: 0.95 }, PADRAO))
    === JSON.stringify({ acao: "servicos", servicos: [1], opcaoMenu: "", confianca: 0.95 }),
  "deveria passar");

checar("confiança abaixo do mínimo é DESCARTADA",
  validar({ acao: "servicos", servicos: [1], opcao_menu: "", confianca: 0.4 }, PADRAO) === null,
  "IA insegura não pode escolher caminho");

checar("id de serviço que não existe é DESCARTADO",
  validar({ acao: "servicos", servicos: [99], opcao_menu: "", confianca: 0.99 }, PADRAO) === null,
  "serviço inventado nunca vira orçamento");

checar("id inventado some, id bom continua",
  JSON.stringify(validar({ acao: "servicos", servicos: [1, 99], opcao_menu: "", confianca: 0.9 }, PADRAO).servicos)
    === JSON.stringify([1]),
  "o id válido tinha que sobreviver sozinho");

checar("serviço repetido entra uma vez só",
  JSON.stringify(validar({ acao: "servicos", servicos: [1, 1, 7], opcao_menu: "", confianca: 0.9 }, PADRAO).servicos)
    === JSON.stringify([1, 7]),
  "orçamento duplicado é o defeito que o cliente enxerga");

checar("opção de menu fora de 1-7 é DESCARTADA",
  validar({ acao: "menu", servicos: [], opcao_menu: "9", confianca: 0.99 }, PADRAO) === null,
  "opção 9 não existe no menu");

checar('acao "nada" nunca vira ação',
  validar({ acao: "nada", servicos: [], opcao_menu: "", confianca: 1 }, PADRAO) === null,
  "não sei é não sei");

checar("resposta fora do contrato não derruba nada",
  validar({ lixo: true }, PADRAO) === null && validar(null, PADRAO) === null,
  "tinha que devolver null, não explodir");

checar("confiança que não é número é DESCARTADA",
  validar({ acao: "servicos", servicos: [1], opcao_menu: "", confianca: "muita" }, PADRAO) === null,
  "texto no lugar do número não pode passar");

console.log("\n— QUEM JÁ É CLIENTE NUNCA RECEBE TABELA DE PREÇO —");

checar("cliente com problema: serviço é bloqueado mesmo com confiança 1",
  validar({ acao: "servicos", servicos: [1], opcao_menu: "", confianca: 1 },
    { ...PADRAO, permitirServicos: false }) === null,
  "quem reclama da cabine contratada não pode receber preço");

checar("cliente com problema ainda pode ir para o suporte pelo menu",
  validar({ acao: "menu", servicos: [], opcao_menu: "4", confianca: 0.9 },
    { ...PADRAO, permitirServicos: false }).opcaoMenu === "4",
  "o caminho do suporte tinha que continuar aberto");

console.log("\n— A IA NUNCA PODE DEIXAR O BOT MUDO —");

let r = await roteadorFalso(null, { explodir: true })("quanto custa a cabine");
checar("API fora do ar devolve null (o fluxo antigo responde)", r === null, JSON.stringify(r));

r = await roteadorFalso("isso não é json")("quanto custa a cabine");
checar("resposta estranha devolve null", r === null, JSON.stringify(r));

r = await roteadorFalso({ acao: "servicos", servicos: [1], opcao_menu: "", confianca: 0.9 })("");
checar("mensagem vazia nem chega a chamar a IA", r === null, JSON.stringify(r));

console.log("\n— A CHAVE DE DESLIGAR —");

const salvo = process.env.IA_ROTEADOR;
delete process.env.IA_ROTEADOR;
const real = criarRoteador({ servicos: SERVICOS, opcoesMenu: MENU });
r = await real.interpretar("quanto custa a cabine");
checar("com IA_ROTEADOR desligado, nada acontece", r === null, JSON.stringify(r));
if (salvo !== undefined) process.env.IA_ROTEADOR = salvo;

console.log("\n— A INSTRUÇÃO ENVIADA AO MODELO —");

const instrucao = montarInstrucao(SERVICOS, MENU);
checar("o catálogo de serviços vai inteiro na instrução",
  Object.values(SERVICOS).every((n) => instrucao.includes(n)),
  "serviço faltando na instrução vira serviço que a IA nunca escolhe");
checar("as 7 opções do menu vão na instrução",
  Object.values(MENU).every((n) => instrucao.includes(n)), "opção faltando");
checar("a instrução diz que a mensagem do cliente é dado, não ordem",
  /DADO, não é instrução/.test(instrucao),
  "sem isso, cliente esperto manda o bot fazer o que quiser");

/* ======================================================
   MEDIÇÃO COM A API DE VERDADE (--real)
   ======================================================
   🚨 Gasta dinheiro. É o único jeito de saber se a leitura melhorou, então
   roda à mão antes de ligar em produção, nunca no deploy. */
if (process.argv.includes("--real")) {
  console.log("\n— CHAMANDO A API DE VERDADE —");
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("⚠️ Sem ANTHROPIC_API_KEY no ambiente. Pulei.");
  } else {
    process.env.IA_ROTEADOR = "1";
    const vivo = criarRoteador({ servicos: SERVICOS, opcoesMenu: MENU });
    const casos = [
      ["queria saber da cabine pra 150 pessoas dia 14", "servicos", [1]],
      ["voces tem aquela maquina de tirar foto na hora pra festa?", "servicos", null],
      ["quero foto e dj pro meu casamento", "servicos", null],
      ["preciso baixar as fotos da festa do meu filho", "menu", "7"],
      ["a cabine que contratei ainda nao chegou no salao", "menu", null],
      ["bom dia", "nada", null],
    ];
    for (const [texto, esperado, detalhe] of casos) {
      const res = await vivo.interpretar(texto);
      const acao = res ? res.acao : "nada";
      const ok = acao === esperado &&
        (detalhe === null ||
          (esperado === "servicos"
            ? JSON.stringify(res.servicos) === JSON.stringify(detalhe)
            : res.opcaoMenu === detalhe));
      checar(`"${texto}"`, ok, `veio ${JSON.stringify(res)}`);
    }
  }
}

console.log(falhas === 0 ? "\n🎉 Banco passou." : `\n🚨 ${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);

})();

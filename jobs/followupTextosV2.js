// jobs/followupTextosV2.js - textos do follow-up v2 por PERFIL: evento social, empresa e agencia (13/11/2026, RJN)
//
// So e usado quando o PhotoMusic Pro devolve `v2: true` em /leads-followup
// (opcao pm_followup_v2_ativo = 1). Desligado, o follow-up sai com os textos
// de sempre (montarMensagemFollowup em followupLeads.js).
//
// Regras (ChatGPT/Mario, 13/11):
//  - servico, celebracao, data e valores REAIS do orcamento (os valores vem do
//    mesmo motor do PDF, em lead.precos, pelos blocos de followupLeads.js);
//  - NENHUMA condicao especial inventada: o texto antigo dizia "consegui uma
//    condicao especial" quando o que mudava era so o pacote mostrado;
//  - toda mensagem termina com as 3 respostas rapidas.

const RESPOSTAS_RAPIDAS =
  "\n\nPara agilizar, responda com o número:\n" +
  "*1* - Quero contratar\n" +
  "*2* - Tenho uma dúvida\n" +
  "*3* - Agora não";

/* Social: o texto de sempre (tom de familia, aprovado pela Adriana), sem as
   frases que prometiam condicao especial. Cada troca e conferida no teste:
   se o texto antigo mudar, o teste avisa em vez de sair a frase velha. */
const TROCAS_SOCIAL = [
  ["e fui conversar com a equipe pra tentar facilitar pra você. Consegui uma *condição especial, feita com carinho*:",
   "e separei de novo os valores do seu orçamento:"],
  ["Então, pra facilitar de vez, a *melhor condição que consigo*:",
   "Por isso deixo aqui, de novo, os valores do seu orçamento:"],
  ["*💳 Condição especial pra você!*", "*📸 Seu orçamento da PhotoMusic*"],
  ["*💳 Condição especial!*", "*📸 Seu orçamento da PhotoMusic*"],
  ["*💳 Sua melhor condição!*", "*📸 Seu orçamento da PhotoMusic*"],
  ["*💳 Sua condição continua valendo!*", "*📸 Seu orçamento continua aqui*"],
];

function textoSocial(lead, h) {
  let t = h.montarMensagemFollowup(lead);
  for (const [velho, novo] of TROCAS_SOCIAL) t = t.split(velho).join(novo);
  return t;
}

/* Empresa e agencia: objetivo, sem "festa" nem emocao de familia. Fala de
   proposta, aprovacao interna, prazo e o que esta incluido. */
function textoCorporativo(lead, h, agencia) {
  const tipo     = h.tipoDoLead(lead);
  const nome     = (lead.nome || "").split(" ")[0] || "tudo bem";
  const servicos = h.servicosDoLead(lead);
  const evento   = lead.celebracao || "evento";
  const empresa  = String(lead.empresa || "").trim();
  const dataTxt  = lead.dataEvento
    ? (Number(lead.dias) > 1 ? ` de *${Number(lead.dias)} dias* (a partir de *${lead.dataEvento}*)` : ` do dia *${lead.dataEvento}*`)
    : "";
  const deQuem   = empresa ? ` (${empresa})` : "";
  const preco    = h.blocoPreco(lead, tipo);
  const multi    = h.linhaMulti(lead);
  const ajuste   = agencia
    ? "Se precisar, adapto a proposta para você apresentar ao seu cliente (formato, itens ou horários)."
    : "Se precisar de algum ajuste para a aprovação interna (horários, número de participantes ou formato da proposta), é só me dizer.";
  const titulo   = agencia ? "*📄 Proposta para o seu cliente*" : "*📄 Proposta PhotoMusic*";
  const abre     = `${titulo}\n\nOlá, *${nome}*! Aqui é da *PhotoMusic Produções*.\n\n`;

  switch (tipo) {
    case "24h":
      return abre +
        `Segue o resumo da proposta de *${servicos}* para o *${evento}*${dataTxt}${deQuem}.\n\n` +
        preco + multi + ajuste;
    case "48h":
      return abre +
        `Passando para saber se a proposta de *${servicos}* para o *${evento}*${dataTxt} já foi avaliada` +
        (agencia ? " pelo seu cliente." : " pela equipe.") + "\n\n" +
        "Ficou alguma dúvida sobre o que está incluído, a montagem ou os horários? Explico por aqui.\n\n" +
        preco + multi.trim();
    case "72h":
      return abre +
        `Deixo aqui, de novo, os valores da proposta para o *${evento}*${dataTxt}${deQuem}:\n\n` +
        h.frasePrecoMenor(lead, tipo).replace("pra caber melhor no seu bolso. 🙌", "para facilitar a aprovação.") +
        preco + multi + ajuste;
    case "promo_30dias":
      return abre +
        `Falta *cerca de 1 mês* para o *${evento}*${dataTxt}${deQuem}.\n\n` +
        "Conforme a data se aproxima, a nossa agenda fica mais concorrida. A data fica reservada com a contratação.\n\n" +
        preco + multi.trim();
    case "promo_15dias":
      return abre +
        `Estamos a *cerca de 15 dias* do *${evento}*${dataTxt}${deQuem}.\n\n` +
        "Se a proposta ainda estiver em aprovação, me diga o prazo previsto que eu confiro a disponibilidade da equipe para a data.\n\n" +
        preco + multi.trim();
    case "promo_mensal":
      return abre +
        `A proposta para o *${evento}*${dataTxt}${deQuem} continua em aberto.\n\n` +
        "Se houver mudança de data, local ou formato, atualizo a proposta para você.\n\n" +
        preco + multi.trim();
    case "7dias":
    default:
      return abre +
        `Retomando a proposta de *${servicos}* para o *${evento}*${dataTxt}${deQuem}.\n\n` +
        "A data só fica reservada com a contratação. Se a aprovação ainda estiver em andamento, me diga o prazo previsto que eu acompanho por aqui.\n\n" +
        preco + multi.trim();
  }
}

/* h = ajudantes de followupLeads.js (blocoPreco, montarMensagemFollowup...).
   Passados por parametro para nao criar require circular. */
function corpoV2(lead, h) {
  const perfil = lead.perfil === "empresa" || lead.perfil === "agencia" ? lead.perfil : "social";
  const corpo  = perfil === "social" ? textoSocial(lead, h) : textoCorporativo(lead, h, perfil === "agencia");
  return corpo.replace(/\s+$/, "");
}

function montarMensagemV2(lead, h) {
  return corpoV2(lead, h) + RESPOSTAS_RAPIDAS;
}

/* 13/11/2026 (pedido do Mario): o follow-up sai com BOTÕES, "Quero contratar" primeiro.
   O sendButtonList escreve "*1* - Quero contratar..." no corpo (quem não vê botão
   responde o número) e o toque no botão chega ao bot como "1", "2" ou "3". */
const BOTOES_RESPOSTA = [
  { id: "1", label: "Quero contratar" },
  { id: "2", label: "Tenho uma dúvida" },
  { id: "3", label: "Agora não" },
];
function montarBotoesV2(lead, h) {
  return { pergunta: corpoV2(lead, h) + "\n\nPara agilizar, toque numa opção:", opcoes: BOTOES_RESPOSTA };
}

module.exports = { montarMensagemV2, montarBotoesV2, BOTOES_RESPOSTA, RESPOSTAS_RAPIDAS, TROCAS_SOCIAL };

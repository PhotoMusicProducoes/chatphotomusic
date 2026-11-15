// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\jobs\followupTextosV3.js
// Textos do follow-up V3 (14/11/2026, RJN; aprovado pelo ChatGPT/Mario). Só é usado quando o PhotoMusic Pro
// devolve `v3: true` (opção pm_followup_v3_ativo). Cada mensagem tem UM objetivo; curtas; títulos diferentes
// (é o que aparece na lista de conversas); preço em UMA linha e só onde ajuda; nada de escassez inventada,
// pressão ou desconto que não existe; nada de "conformidade total com a LGPD".
//   d1 = confirmar a proposta · d3 = dúvida ou opção mais econômica (com a diferença real do pacote) ·
//   d7 = ajudar a decidir (agenda real) · e30 / e15 = lembrete da data (a e15 é a última) ·
//   proximo = evento em 4 a 10 dias (mensagem única) · lembrete = autorizado no "Agora não".

const BOTOES = [
  { id: "1", label: "Quero contratar" },
  { id: "2", label: "Tenho uma dúvida" },
  { id: "3", label: "Agora não" },
];

function brl(v) {
  return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dados(lead) {
  const p = lead.precos || {};
  const cols = Array.isArray(p.colunas) ? p.colunas.filter(c => c && c.total > 0) : [];
  const nParc = p.cartao_parcelas || 10;
  const fora = Array.isArray(p.nao_atende) ? p.nao_atende : [];
  const servicos = (fora.length && lead.servicos
    ? String(lead.servicos).split(/\s*,\s*/).filter(n => !fora.includes(n)).join(", ")
    : lead.servicos) || "nossos serviços";
  const multiDia = Number(lead.dias) > 1;
  return {
    nome: String(lead.nome || "").split(" ")[0] || "",
    servicos,
    celeb: lead.celebracao || "evento",
    data: lead.dataEvento || "",
    dataTxt: lead.dataEvento ? (multiDia ? ` de *${Number(lead.dias)} dias* (a partir de *${lead.dataEvento}*)` : ` do dia *${lead.dataEvento}*`) : "",
    empresa: String(lead.empresa || "").trim(),
    cols, nParc,
    aPartir: p.alternativas ? " (a partir de)" : "",
    descricao: lead.pacotes_descricao || {},
    agenda: String(lead.agenda || ""),
  };
}

/** Uma linha de preço: "💰 Pacote Premium: R$ 2.297,00 ou 10x de R$ 229,70 sem juros" (sem tabela). */
function linhaPreco(d, col) {
  if (!col) return "";
  const titulo = d.cols.length > 1 && col.titulo ? `Pacote *${col.titulo}*` : "Seu orçamento";
  return `💰 ${titulo}${d.aPartir}: *${brl(col.total)}* ou *${d.nParc}x de ${brl(col.total / d.nParc)}* sem juros no cartão`;
}

/** Opção mais econômica, SÓ com a diferença real entre os pacotes (mesma regra do PDF). Sem ela, "". */
function linhaEconomica(d, corporativo) {
  if (d.cols.length < 2) return "";
  const topo = d.cols[0], leve = d.cols[d.cols.length - 1];
  const dTopo = d.descricao[topo.titulo], dLeve = d.descricao[leve.titulo];
  if (!dTopo || !dLeve || !(leve.total < topo.total)) return "";
  return (corporativo ? "Se for preciso reduzir o investimento" : "Se preferir um valor menor") +
    `, o pacote *${leve.titulo}* fica em *${brl(leve.total)}* (ou *${d.nParc}x de ${brl(leve.total / d.nParc)}*). ` +
    `A diferença está nas fotos impressas por sessão: *${leve.titulo}*, ${dLeve.charAt(0).toLowerCase() + dLeve.slice(1)}; ` +
    `*${topo.titulo}*, ${dTopo.charAt(0).toLowerCase() + dTopo.slice(1)}.`;
}

/** Agenda REAL (consultada no PhotoMusic Pro). Sem informação, não afirma nada. */
function linhaAgenda(d) {
  if (d.agenda === "livre") return "Ainda temos disponibilidade para essa data, e ela fica reservada assim que o contrato é assinado.";
  if (d.agenda === "ultima") return "Temos só mais uma disponibilidade para essa data, e ela fica reservada assim que o contrato é assinado.";
  if (d.agenda === "lotada") return "Me confirme se ainda tem interesse, que eu verifico a disponibilidade da equipe para a data.";
  return "A data fica reservada assim que o contrato é assinado.";
}

function social(tipo, d) {
  const oi = `Oi${d.nome ? ", *" + d.nome + "*" : ""}!`;
  switch (tipo) {
    case "d1":
      return `*📸 Sua proposta da PhotoMusic*\n\n${oi} ❤️ Aqui é o Rapha, da PhotoMusic Produções.\n\n` +
        `Conseguiu ver a proposta de *${d.servicos}* para o *${d.celeb}*${d.dataTxt}?\n\n` +
        (d.cols[0] ? linhaPreco(d, d.cols[0]) + "\n\n" : "") +
        "Se quiser mudar o pacote, o horário ou tirar alguma dúvida, é só me responder. 😊";
    case "d3": {
      const eco = linhaEconomica(d, false);
      return eco
        ? `*💡 Uma opção mais econômica*\n\n${oi} 😊 ${eco}\n\nPosso te ajudar a escolher?`
        : `*💬 Uma ajuda para decidir*\n\n${oi} 😊 Ficou alguma dúvida sobre a *${d.servicos}*, como funciona no dia ou os horários? Me pergunte, que eu explico.`;
    }
    case "d7":
      return `*📅 Sobre a sua data*\n\n${oi} Passando para saber como está a decisão sobre o *${d.celeb}*${d.dataTxt}.\n\n` +
        `${linhaAgenda(d)}\n\nSe quiser, já deixo tudo pronto para você só confirmar. ❤️`;
    case "e30":
      return `*📅 Falta cerca de 1 mês*\n\n${oi} Falta cerca de 1 mês para o *${d.celeb}*${d.dataTxt}.\n\n` +
        `${linhaAgenda(d)}\n\nQuer que eu deixe a contratação pronta?`;
    case "e15":
      return `*📅 Falta cerca de 15 dias*\n\n${oi} Estamos a cerca de 15 dias do *${d.celeb}*${d.dataTxt}.\n\n` +
        "Esta é a última mensagem que envio sobre esta proposta, para não te incomodar. Se ainda quiser contar com a PhotoMusic, é só tocar em *Quero contratar*. ❤️";
    case "proximo":
      return `*📅 Seu evento está chegando*\n\n${oi} O *${d.celeb}*${d.dataTxt} está bem perto.\n\n` +
        `${linhaAgenda(d)} Se quiser contar com a PhotoMusic, toque em *Quero contratar* que a nossa equipe fala com você em seguida. ❤️`;
    case "lembrete":
    default:
      return `*🔔 O lembrete que você pediu*\n\n${oi} Como combinamos, passando perto da data do *${d.celeb}*${d.dataTxt}.\n\n` +
        `${linhaAgenda(d)}\n\nSe quiser contar com a PhotoMusic, é só tocar em *Quero contratar*. ❤️`;
  }
}

function corporativo(tipo, d, agencia) {
  const ola = `Olá${d.nome ? ", *" + d.nome + "*" : ""}!`;
  const deQuem = d.empresa ? ` (${d.empresa})` : "";
  const prop = agencia ? "a proposta para o seu cliente" : "a proposta";
  switch (tipo) {
    case "d1":
      return `*📄 ${agencia ? "Proposta para o seu cliente" : "Proposta PhotoMusic"}*\n\n${ola} Aqui é da PhotoMusic Produções.\n\n` +
        `Segue o resumo d${prop.slice(1)} de *${d.servicos}* para o *${d.celeb}*${d.dataTxt}${deQuem}.\n\n` +
        (d.cols[0] ? linhaPreco(d, d.cols[0]) + "\n\n" : "") +
        (agencia ? "Se precisar, adapto a proposta para você apresentar (itens, horários ou formato)."
                 : "Se a aprovação interna precisar de ajuste de horário, número de participantes ou formato da proposta, ajusto por aqui.");
    case "d3": {
      const eco = linhaEconomica(d, true);
      if (eco) return `*💡 Uma alternativa de investimento*\n\n${ola} ${eco}\n\nPosso ajustar ${prop} com essa opção?`;
      return agencia
        ? `*💬 Apoio para o seu cliente*\n\n${ola} O seu cliente ficou com alguma dúvida sobre a ativação? Posso preparar as respostas para você repassar.`
        : `*💬 Apoio para a aprovação*\n\n${ola} Para apoiar a aprovação: emitimos nota fiscal e o contrato é assinado eletronicamente. ` +
          "Ficou alguma dúvida sobre o escopo, a montagem ou os horários?";
    }
    case "d7":
      return `*📅 Sobre a data do evento*\n\n${ola} ${agencia ? "Já tem retorno do seu cliente sobre" : "Como está a aprovação de"} ${prop} para *${d.data || "a data do evento"}*? ` +
        "Me informe o prazo previsto, que eu acompanho a disponibilidade da equipe.\n\n" + linhaAgenda(d);
    case "e30":
      return `*📅 Falta cerca de 1 mês*\n\n${ola} Falta cerca de 1 mês para o *${d.celeb}*${d.dataTxt}${deQuem}.\n\n${linhaAgenda(d)}\n\n` +
        "Se a proposta já estiver aprovada, envio o contrato para assinatura.";
    case "e15":
      return `*📅 Falta cerca de 15 dias*\n\n${ola} Estamos a cerca de 15 dias do *${d.celeb}*${d.dataTxt}${deQuem}.\n\n` +
        `Esta é a última mensagem que envio sobre ${prop}. Se quiser seguir, toque em *Quero contratar* que a nossa equipe formaliza com você.`;
    case "proximo":
      return `*📅 Evento próximo*\n\n${ola} O *${d.celeb}*${d.dataTxt}${deQuem} está bem perto.\n\n${linhaAgenda(d)} ` +
        "Se quiser seguir, toque em *Quero contratar* que a nossa equipe fala com você em seguida.";
    case "lembrete":
    default:
      return `*🔔 Lembrete combinado*\n\n${ola} Como combinamos, retomo ${prop} perto da data do *${d.celeb}*${d.dataTxt}.\n\n${linhaAgenda(d)}\n\n` +
        "Se quiser seguir, é só tocar em *Quero contratar*.";
  }
}

function corpoV3(lead) {
  const d = dados(lead);
  const perfil = lead.perfil === "empresa" || lead.perfil === "agencia" ? lead.perfil : "social";
  const tipo = lead.tipo || "d1";
  return perfil === "social" ? social(tipo, d) : corporativo(tipo, d, perfil === "agencia");
}

function montarBotoesV3(lead) {
  return { pergunta: corpoV3(lead) + "\n\nPara agilizar, toque numa opção:", opcoes: BOTOES };
}

// "Agora não": a pergunta é feita UMA vez (o PhotoMusic Pro marca)
const PERGUNTA_LEMBRETE = "Tudo bem, obrigado por responder! 😊 Posso te enviar um lembrete perto da data do evento?";
const BOTOES_LEMBRETE = [{ id: "1", label: "Sim, pode lembrar" }, { id: "2", label: "Não, obrigado" }];

module.exports = { montarBotoesV3, corpoV3, BOTOES, PERGUNTA_LEMBRETE, BOTOES_LEMBRETE, linhaEconomica, dados };

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

/* Concordância com a celebração (14/11, ChatGPT): "as Bodas", "a Formatura", "o Aniversário". */
function artigo(celeb) {
  const c = String(celeb || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (/^bodas\b/.test(c)) return { o: "as", O: "As", do: "das", no: "nas", esta: "estão" };
  if (/^(formatura|festa|confraternizacao|celebracao|comemoracao|inauguracao|crisma|primeira eucaristia|cerimonia|missa)\b/.test(c))
    return { o: "a", O: "A", do: "da", no: "na", esta: "está" };
  return { o: "o", O: "O", do: "do", no: "no", esta: "está" };
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
    a: artigo(lead.celebracao || "evento"),
  };
}

/** Uma linha de preço, sem tabela. Com vários pacotes, a FAIXA da proposta (14/11, ChatGPT: nenhum pacote é
    apresentado como o escolhido; o cliente escolhe). Valores do motor do PDF. */
function linhaPreco(d) {
  if (!d.cols.length) return "";
  const totais = d.cols.map(c => c.total), min = Math.min(...totais), max = Math.max(...totais);
  if (d.cols.length === 1 || min === max)
    return `💰 Seu orçamento${d.aPartir}: *${brl(min)}* ou *${d.nParc}x de ${brl(min / d.nParc)}* sem juros no cartão`;
  return `💰 Na sua proposta, os pacotes vão de *${brl(min)}* a *${brl(max)}*, em até *${d.nParc}x sem juros* no cartão`;
}

/** Opção mais econômica, SÓ com a diferença real entre os pacotes (mesma regra do PDF). Sem ela, "". */
function linhaEconomica(d, corporativo) {
  if (d.cols.length < 2) return "";
  const topo = d.cols[0], leve = d.cols[d.cols.length - 1];
  const dTopo = d.descricao[topo.titulo], dLeve = d.descricao[leve.titulo];
  if (!dTopo || !dLeve || !(leve.total < topo.total)) return "";
  return (corporativo ? "Se for preciso reduzir o investimento, uma sugestão da própria proposta" : "Se preferir um valor menor, uma sugestão da sua proposta") +
    `: o pacote *${leve.titulo}* fica em *${brl(leve.total)}* (ou *${d.nParc}x de ${brl(leve.total / d.nParc)}*). ` +
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
        `Conseguiu ver a proposta de *${d.servicos}* para ${d.a.o} *${d.celeb}*${d.dataTxt}?\n\n` +
        (d.cols.length ? linhaPreco(d) + "\n\n" : "") +
        "Se quiser mudar o pacote, o horário ou tirar alguma dúvida, é só me responder. 😊";
    case "d3": {
      const eco = linhaEconomica(d, false);
      return eco
        ? `*💡 Uma opção mais econômica*\n\n${oi} 😊 ${eco}\n\nPosso te ajudar a escolher?`
        : `*💬 Uma ajuda para decidir*\n\n${oi} 😊 Ficou alguma dúvida sobre o serviço (*${d.servicos}*), como funciona no dia ou os horários? Me pergunte, que eu explico.`;
    }
    case "d7":
      return `*📅 Sobre a sua data*\n\n${oi} Passando para saber como está a decisão sobre ${d.a.o} *${d.celeb}*${d.dataTxt}.\n\n` +
        `${linhaAgenda(d)}\n\nSe quiser, já deixo tudo pronto para você só confirmar. ❤️`;
    case "e30":
      return `*📅 Falta cerca de 1 mês*\n\n${oi} Falta cerca de 1 mês para ${d.a.o} *${d.celeb}*${d.dataTxt}.\n\n` +
        `${linhaAgenda(d)}\n\nQuer que eu deixe a contratação pronta?`;
    case "e15":
      return `*📅 Falta cerca de 15 dias*\n\n${oi} Estamos a cerca de 15 dias ${d.a.do} *${d.celeb}*${d.dataTxt}.\n\n` +
        "Esta é a última mensagem que envio sobre esta proposta, para não te incomodar. Se ainda quiser contar com a PhotoMusic, é só tocar em *Quero contratar*. ❤️";
    case "proximo":
      return `*📅 Seu evento está chegando*\n\n${oi} ${d.a.O} *${d.celeb}*${d.dataTxt} ${d.a.esta} bem perto.\n\n` +
        `${linhaAgenda(d)} Se quiser contar com a PhotoMusic, toque em *Quero contratar* que a nossa equipe fala com você em seguida. ❤️`;
    case "lembrete":
    default:
      return `*🔔 O lembrete que você pediu*\n\n${oi} Como combinamos, passando perto da data ${d.a.do} *${d.celeb}*${d.dataTxt}.\n\n` +
        `${linhaAgenda(d)}\n\nSe quiser contar com a PhotoMusic, é só tocar em *Quero contratar*. ❤️`;
  }
}

function corporativo(tipo, d, agencia) {
  const ola = `Olá${d.nome ? ", *" + d.nome + "*" : ""}!`;
  const deQuem = d.empresa ? ` (${d.empresa})` : "";
  switch (tipo) {
    case "d1":
      return `*📄 ${agencia ? "Proposta para o seu cliente" : "Proposta PhotoMusic"}*\n\n${ola} Aqui é da PhotoMusic Produções.\n\n` +
        (agencia ? `Segue o resumo da proposta de *${d.servicos}* que preparamos para o seu cliente: ${d.a.o} *${d.celeb}*${d.dataTxt}${deQuem}.\n\n`
                 : `Segue o resumo da proposta de *${d.servicos}* para ${d.a.o} *${d.celeb}*${d.dataTxt}${deQuem}.\n\n`) +
        (d.cols.length ? linhaPreco(d) + "\n\n" : "") +
        (agencia ? "Se precisar, adapto a proposta para você apresentar (itens, horários ou formato)."
                 : "Se a aprovação interna precisar de ajuste de horário, número de participantes ou formato da proposta, ajusto por aqui.");
    case "d3": {
      const eco = linhaEconomica(d, true);
      if (eco) return `*💡 Uma alternativa de investimento*\n\n${ola} ${eco}\n\nQuer que eu ajuste a proposta com essa opção?`;
      return agencia
        ? `*💬 Apoio para o seu cliente*\n\n${ola} O seu cliente ficou com alguma dúvida sobre a ativação? Posso preparar as respostas para você repassar.`
        : `*💬 Apoio para a aprovação*\n\n${ola} Para apoiar a aprovação: emitimos nota fiscal e o contrato é assinado eletronicamente. ` +
          "Ficou alguma dúvida sobre o escopo, a montagem ou os horários?";
    }
    case "d7":
      return `*📅 Sobre a data do evento*\n\n${ola} ` + (agencia
          ? `Já tem retorno do seu cliente sobre a proposta${d.data ? " do dia *" + d.data + "*" : ""}? `
          : `Como está a aprovação da proposta${d.data ? " do dia *" + d.data + "*" : ""}? `) +
        "Me informe o prazo previsto, que eu acompanho a disponibilidade da equipe.\n\n" + linhaAgenda(d);
    case "e30":
      return `*📅 Falta cerca de 1 mês*\n\n${ola} Falta cerca de 1 mês para ${d.a.o} *${d.celeb}*${d.dataTxt}${deQuem}.\n\n${linhaAgenda(d)}\n\n` +
        "Se a proposta já estiver aprovada, envio o contrato para assinatura.";
    case "e15":
      return `*📅 Falta cerca de 15 dias*\n\n${ola} Estamos a cerca de 15 dias ${d.a.do} *${d.celeb}*${d.dataTxt}${deQuem}.\n\n` +
        `Esta é a última mensagem que envio sobre esta proposta. Se quiser seguir, toque em *Quero contratar* que a nossa equipe formaliza com você.`;
    case "proximo":
      return `*📅 Evento próximo*\n\n${ola} ${d.a.O} *${d.celeb}*${d.dataTxt}${deQuem} ${d.a.esta} bem perto.\n\n${linhaAgenda(d)} ` +
        "Se quiser seguir, toque em *Quero contratar* que a nossa equipe fala com você em seguida.";
    case "lembrete":
    default:
      return `*🔔 Lembrete combinado*\n\n${ola} Como combinamos, retomo a proposta perto da data ${d.a.do} *${d.celeb}*${d.dataTxt}.\n\n${linhaAgenda(d)}\n\n` +
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

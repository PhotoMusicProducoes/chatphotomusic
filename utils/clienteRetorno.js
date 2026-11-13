// utils/clienteRetorno.js - CLIENTE QUE VOLTA com orcamento em aberto (13/11/2026, NAZ, caso Luciana / orc. 415)
//
// A Luciana recebeu o orcamento em 13/10, nao teve follow-up e voltou um mes depois pelo site. O bot mandou o menu
// de cliente novo. Agora, na PRIMEIRA mensagem, o bot consulta o PhotoMusic Pro (rota /cliente-retorno, so leitura,
// SEM valores) e, havendo orcamento de evento futuro, oferece a continuacao. Funcoes PURAS: texto e leitura da resposta.
// Quem consulta, decide e envia e o index.js. Sem preco antigo; disponibilidade so pela agenda (/data-livre).

function semAcento(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function primeiroNome(nome) {
  const n = String(nome || "").trim().split(/\s+/)[0] || "";
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "";
}

function juntarE(lista) {
  const l = (lista || []).filter(Boolean);
  return l.length > 1 ? l.slice(0, -1).join(", ") + " e " + l[l.length - 1] : (l[0] || "");
}

/** "Espaco Multiplo Zouk, Itaipu - Niteroi" (sem repetir a cidade que ja esta no bairro). */
function localDoOrcamento(o) {
  const partes = [];
  const add = (v) => { const x = String(v || "").trim(); if (x && !partes.some(p => semAcento(p).includes(semAcento(x)))) partes.push(x); };
  add(o && o.local); add(o && o.bairro); add(o && o.cidade);
  return partes.join(", ");
}

/** Uma linha curta do evento: "Foto Cabine · Aniversario de 15 anos · 03/04/2027". */
function linhaEvento(o) {
  return [juntarE(o.servicos), o.celebracao, o.data_evento].filter(Boolean).join(" · ");
}

const OPCOES_RETORNO = [
  { id: "1", label: "Ver meu orçamento anterior" },
  { id: "2", label: "Atualizar os valores ou informações do evento" },
  { id: "3", label: "Verificar a disponibilidade da minha data" },
  { id: "4", label: "Quero contratar" },
  { id: "5", label: "Falar com a equipe PhotoMusic" },
  { id: "6", label: "É outro evento ou outro assunto" },
];

function linhasOpcoesRetorno() {
  return OPCOES_RETORNO.map(o => `*${o.id}* - ${o.label}`).join("\n");
}

/** Mensagem de boas-vindas de quem volta (proposta do ChatGPT, 13/11/2026). */
function textoRetorno(o) {
  const nome = primeiroNome(o.nome);
  const serv = juntarE(o.servicos);
  const local = localDoOrcamento(o);
  let txt = `Olá${nome ? ", *" + nome + "*" : ""}! 😊 Que bom receber seu contato novamente!\n\n`;
  txt += `Vi que você já pediu um orçamento${serv ? " de *" + serv + "*" : ""}`;
  if (o.celebracao && o.celebracao !== "Outros") txt += ` para *${o.celebracao}*`;
  if (o.data_evento) txt += `, previsto para *${o.data_evento}*`;
  if (local) txt += `, em *${local}*`;
  txt += ". ❤️\n\nPosso te ajudar a retomar a sua proposta! O que gostaria de fazer?\n\n" + linhasOpcoesRetorno();
  return txt;
}

/** Mais de um orcamento em aberto: pergunta qual evento antes de tudo. */
function textoEscolherEvento(orcs, nomeCliente) {
  const nome = primeiroNome(nomeCliente || (orcs[0] && orcs[0].nome));
  return `Olá${nome ? ", *" + nome + "*" : ""}! 😊 Que bom receber seu contato novamente!\n\n` +
    "Encontrei mais de um orçamento seu. Sobre qual evento você quer falar?\n\n" +
    orcs.map((o, i) => `*${i + 1}* - ${linhaEvento(o)}`).join("\n") +
    `\n*${orcs.length + 1}* - É outro evento ou outro assunto`;
}

/** Resposta ao menu de retorno: "1".."6", o titulo da opcao ou palavras-chave; null se nao entendeu. */
function opcaoRetorno(texto) {
  const t = semAcento(texto).trim();
  if (!t) return null;
  const d = t.match(/^\*?([1-6])\*?\b/);
  if (d) return d[1];
  for (const o of OPCOES_RETORNO) if (t === semAcento(o.label)) return o.id;
  if (/\b(contratar|fechar|quero fechar|vou fechar)\b/.test(t) && !/\bnao\b/.test(t)) return "4";
  if (/\b(disponib|vaga|data livre|tem data)/.test(t)) return "3";
  if (/\b(atualiz|novo valor|valor atual|refazer|mudar|alterar)/.test(t)) return "2";
  if (/\b(ver|consultar|mandar|manda|reenviar|pdf|orcamento anterior)\b/.test(t)) return "1";
  if (/\b(equipe|atendente|humano|pessoa|falar com)\b/.test(t)) return "5";
  if (/\b(outro evento|outro assunto|outra coisa|nao e isso)\b/.test(t)) return "6";
  return null;
}

/** Escolha do evento quando ha varios: indice (0..n-1), "outro" ou null. */
function escolhaEvento(texto, qtd) {
  const t = semAcento(texto).trim();
  const m = t.match(/^\*?(\d)\*?\b/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= qtd) return n - 1;
    if (n === qtd + 1) return "outro";
  }
  if (/\b(outro evento|outro assunto|outra coisa)\b/.test(t)) return "outro";
  return null;
}

module.exports = { textoRetorno, textoEscolherEvento, opcaoRetorno, escolhaEvento, linhasOpcoesRetorno, localDoOrcamento, linhaEvento, primeiroNome, OPCOES_RETORNO };

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
function textoRetorno(o, opcoes = {}) {
  const nome = primeiroNome(o.nome);
  const serv = juntarE(o.servicos);
  const local = localDoOrcamento(o);
  // semSaudacao: a pessoa ja foi cumprimentada na lista de assuntos (13/11/2026)
  let txt = opcoes.semSaudacao ? "" : `Olá${nome ? ", *" + nome + "*" : ""}! 😊 Que bom receber seu contato novamente!\n\n`;
  txt += `${opcoes.semSaudacao ? "Esse é o orçamento" : "Vi que você já pediu um orçamento"}${serv ? " de *" + serv + "*" : ""}`;
  if (o.celebracao && o.celebracao !== "Outros") txt += ` para *${o.celebracao}*`;
  if (o.data_evento) txt += `, previsto para *${o.data_evento}*`;
  if (local) txt += `, em *${local}*`;
  txt += ". ❤️\n\nPosso te ajudar a retomar a sua proposta! O que gostaria de fazer?\n\n" + linhasOpcoesRetorno();
  return txt;
}

/* ── LISTA DE ASSUNTOS (Mario, 13/11/2026) ──────────────────────────────────
   Ter evento contratado ou orcamento antigo NAO decide sozinho o assunto: a agencia/empresa volta para OUTRO evento
   (o pedido anterior pode ter desistido ou fechado com outra empresa). Entao, quando ha evento contratado, quando e
   empresa/agencia ou quando ha mais de um assunto, o bot PERGUNTA. Social com um orcamento so vai direto nele. */

/** Precisa perguntar o assunto antes? (senao vai direto na proposta do unico orcamento social) */
function precisaPerguntarAssunto(orcs, eventos) {
  const o = orcs || [], e = eventos || [];
  if (e.length) return true;
  if (o.length !== 1) return o.length > 1;
  return !!(o[0].corporativo || (o[0].perfil && o[0].perfil !== "social"));
}

/** Itens da lista, na ordem: eventos contratados, orcamentos em aberto, novo orcamento, outro assunto. */
function itensAssunto(orcs, eventos) {
  const itens = [];
  (eventos || []).forEach(e => itens.push({ tipo: "evento", e }));
  (orcs || []).forEach(o => itens.push({ tipo: "orcamento", o }));
  itens.push({ tipo: "novo" }, { tipo: "outro" });
  return itens;
}

function linhaItem(it, ehEmpresa) {
  if (it.tipo === "evento") return `🎉 Meu evento contratado: ${[it.e.motivo, it.e.data_evento].filter(Boolean).join(" · ")}`;
  if (it.tipo === "orcamento") return `📄 Orçamento de ${linhaEvento(it.o)}${it.o.criado ? " (enviado em " + it.o.criado + ")" : ""}`;
  if (it.tipo === "novo") return ehEmpresa ? "✨ Um novo evento (outro cliente, outra data ou outro serviço)" : "✨ Um novo evento ou novo orçamento";
  return "Outro assunto";
}

function textoEscolherAssunto(itens, nomeCliente, ehEmpresa) {
  const nome = primeiroNome(nomeCliente);
  return `Olá${nome ? ", *" + nome + "*" : ""}! 😊 Que bom falar com você de novo!\n\n` +
    "Sobre o que você quer falar?\n\n" +
    itens.map((it, i) => `*${i + 1}* - ${linhaItem(it, ehEmpresa)}`).join("\n");
}

/** Resposta da lista: indice (0..n-1) ou null. Aceita o numero ou palavras ("novo", "contratado", "outro"). */
function escolhaItem(texto, itens) {
  const t = semAcento(texto).trim();
  const m = t.match(/^\*?(\d{1,2})\*?\b/);
  if (m) { const n = Number(m[1]); return n >= 1 && n <= itens.length ? n - 1 : null; }
  const achar = (tipo) => { const i = itens.findIndex(x => x.tipo === tipo); return i >= 0 ? i : null; };
  if (/\b(novo|nova|outro evento|outra data|outro servico|outro cliente)\b/.test(t)) return achar("novo");
  if (/\b(contratad|meu evento|minha festa|suporte)\b/.test(t)) return achar("evento");
  if (/\b(orcamento|proposta)\b/.test(t) && itens.filter(x => x.tipo === "orcamento").length === 1) return achar("orcamento");
  if (/\b(outro assunto|outra coisa)\b/.test(t)) return achar("outro");
  return null;
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

module.exports = { textoRetorno, opcaoRetorno, linhasOpcoesRetorno, localDoOrcamento, linhaEvento, primeiroNome, OPCOES_RETORNO,
  precisaPerguntarAssunto, itensAssunto, linhaItem, textoEscolherAssunto, escolhaItem };

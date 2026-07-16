// services/paroquiaSaoJose.js
// ⛪ BANCADA DE TESTE do Sistema de Gestão Paroquial (Rapha Lumen Pro).
//
// Roda DENTRO do ChatPhotoMusic só para testar a experiência no WhatsApp real
// (lista clicável, texto, depois QR do Pix e intenções). Gatilho OCULTO "#psj"
// — nunca divulgar a fiel real: o ChatPhotoMusic está em iad/EUA e batismo tem
// dado de menor. Aqui = só dados fictícios (Mario testando).
//
// Isolamento proposital:
//  - módulo autocontido, ZERO acoplamento com o fluxo de orçamento;
//  - estado num namespace próprio: sessions[chatId].psj (nunca .orcamento);
//  - todo step começa com "psj_"; o index.js delega tudo pra cá por 1 gancho.
// Migração: quando virar o repo da paróquia (Node separado, Postgres gru),
// isto é recorta-e-cola. Escrito no padrão de lá.
//
// Conteúdo real da Paróquia São José em RaphaLumen/ParoquiaPro/conteudo-saojose.md
// (fonte da verdade). O que é FLUXO (intenção, batismo, Pix) entra em fatias.

const { sendText, sendTyping, sendOptionList } = require("../utils/index.js");

// ---------------------------------------------------------------------------
// MENU (12 itens da Maju). tipo: "fluxo" | "rapida". "rapida" = manda o texto.
// ---------------------------------------------------------------------------
const MENU = [
  { n: 1,  titulo: "Missa (horários e intenções)", tipo: "fluxo",  destino: "missa" },
  { n: 2,  titulo: "Batismo",                       tipo: "fluxo",  destino: "batismo" },
  { n: 3,  titulo: "Casamento",                     tipo: "rapida", destino: "casamento" },
  { n: 4,  titulo: "Agendamentos com o padre",      tipo: "rapida", destino: "agenda_padre" },
  { n: 5,  titulo: "Catequese (Infantil)",          tipo: "rapida", destino: "catequese" },
  { n: 6,  titulo: "Catecumenato (Jovens e adultos)", tipo: "rapida", destino: "catecumenato" },
  { n: 7,  titulo: "Dízimo",                         tipo: "rapida", destino: "dizimo" },
  { n: 8,  titulo: "Informações bancárias",          tipo: "fluxo",  destino: "banco" },
  { n: 9,  titulo: "2ª vias, declarações e certidões", tipo: "rapida", destino: "certidoes" },
  { n: 10, titulo: "Programação semanal",           tipo: "rapida", destino: "programacao" },
  { n: 11, titulo: "Creche Santo Antônio",          tipo: "rapida", destino: "creche" },
  { n: 12, titulo: "Outros assuntos",               tipo: "rapida", destino: "outros" }
];

// ---------------------------------------------------------------------------
// RESPOSTAS RÁPIDAS — texto EXATO da Maju (17/07). Não reescrever: o jeito
// delas é o jeito do sistema.
// ---------------------------------------------------------------------------
const RESPOSTAS = {
  casamento:
    "*Requisitos para o Casamento Religioso*\n\n" +
    "1. Os noivos devem participar da vida religiosa da comunidade Católica (batizados e participando das Missas dominicais);\n" +
    "2. Pelo menos um dos noivos deve residir no território da Paróquia São José - Piratininga; caso contrário, o processo é aberto na Paróquia de origem com transferência ao Pároco;\n" +
    "3. Documentos dos noivos:\n" +
    "   a) Certidão de Batismo para fins Matrimoniais (original, validade máx. 6 meses) ou certidão negativa e justificação de estado livre, assinadas pelo Pároco. NÃO aceitamos lembrança de batismo;\n" +
    "   b) Certificado do Curso de noivos;\n" +
    "   c) Xerox da certidão de nascimento, identidade, CPF e comprovante de residência dos noivos;\n" +
    "   d) Comprovante civil de entrada dos papéis (Certidão de Tramitação);\n" +
    "   e) Ficha dos padrinhos preenchida + xerox de identidade, CPF e comprovante de residência deles;\n" +
    "4. Menores de 18 anos: trazer os responsáveis para assinar autorização;\n" +
    "5. O Processo começa pela Entrevista com o Sacerdote, marcada com antecedência na Secretaria (os noivos vêm juntos, com todos os documentos);\n" +
    "6. Prazo mínimo: 2 meses antes da data escolhida;\n" +
    "7. Verificar no Cartório se a Certidão de Habilitação Matrimonial está pronta ANTES do casamento;\n" +
    "8. Convites só devem ser impressos após a conclusão do Processo;\n" +
    "9. Padrinhos e madrinhas devidamente vestidos;\n" +
    "10. Música por conta dos noivos, aprovada antes pelo Sacerdote (não é permitido usar a aparelhagem da Igreja);\n" +
    "11. Decoração agendada na secretaria, sob responsabilidade dos noivos;\n" +
    "12. As testemunhas do processo devem comparecer; se não puderem, avisar a secretaria com antecedência.\n\n" +
    "*Valores:*\n" +
    "R$ 1.700,00 - Cerimônia na paróquia + processo\n" +
    "R$ 1.500,00 - Só cerimônia (noivos de fora)\n" +
    "R$ 200,00 - Só o processo (noivos daqui, cerimônia em outra igreja)",

  agenda_padre:
    "*Agendamento com o padre*\n\n" +
    "Temos alguns tipos de atendimento. Me diga qual e envie os dados:\n\n" +
    "*Conversa na paróquia* (direção espiritual, conversa particular, negociação, confissão):\n" +
    "- Nome completo\n- Tipo de atendimento\n- Sua disponibilidade (melhores dias e horários)\n\n" +
    "*Unção dos enfermos / confissão / comunhão em casa:*\n" +
    "- Nome completo\n- Contato\n- Endereço (residência/hospital)\n- Leito/quarto (se hospital)\n- Nome e contato do responsável\n- Estado civil\n- Estado físico (doenças, cirurgias etc.)\n\n" +
    "*Bênção no lar:*\n" +
    "- Nome completo\n- Endereço\n- Responsável\n- Contato\n- Disponibilidade",

  catequese:
    "*Catequese (Infantil)*\n\n" +
    "As inscrições começam em *maio*.\n" +
    "Link de inscrição: https://docs.google.com/forms/d/e/1FAIpQLSedcW6au7B3ZYlVgMITlooPeUb4edSV1KUeaigcXB-g4dGjjg/closedform\n\n" +
    "*Horários:*\n" +
    "Segunda: 19h - Camboinhas\n" +
    "Terça: 19h - Camboinhas / 18h30 - Penha\n" +
    "Quinta: 19h - Camboinhas\n" +
    "Sexta: 18h30 - Matriz\n" +
    "Domingo: 8h - Bonsucesso",

  catecumenato:
    "*Catecumenato (Jovens e adultos)*\n\n" +
    "As inscrições começam em *maio*.\n" +
    "Link de inscrição: https://docs.google.com/forms/d/e/1FAIpQLSeAlFkPK7D6lQnUpNXta4rp8aCMekDxxJgbteqB71eTj9ngiQ/viewform\n\n" +
    "*Horários:*\n" +
    "Domingo: 9h15 - Bonsucesso\n" +
    "Terça: 18h - Matriz / 19h - Jacaré\n" +
    "Quarta: 18h - Camboinhas / 20h15 - Matriz / 20h - Camboinhas (adultos)\n" +
    "Sábado: 16h - Tibau / 18h - Camboinhas\n" +
    "Sexta: 18h30 - Matriz",

  dizimo:
    "*Dízimo*\n\n" +
    "Você quer *contribuir* ou *se cadastrar* como dizimista?\n\n" +
    "Para *contribuir* agora, use a opção *Informações bancárias* do menu (chave PIX e QR Code).\n\n" +
    "Para o *cadastro de dizimista*, em breve enviaremos o link com o formulário. 🙏",

  certidoes:
    "*2ª vias, declarações e certidões*\n\n" +
    "Para solicitar, me envie:\n" +
    "- Qual sacramento (batismo, 1ª eucaristia, crisma)\n" +
    "- Nome completo\n" +
    "- Data da celebração (se não lembrar o dia e o mês, informe o ano)\n" +
    "- Data de nascimento\n" +
    "- Nome da mãe\n" +
    "- Nome do pai\n" +
    "- Para qual finalidade é o documento (matrimônio, catequese etc.)",

  programacao:
    "*Programação semanal - Paróquia São José*\n\n" +
    "*Missas*\n" +
    "Segunda a Sexta: 7h\n" +
    "Terça a Sexta: 19h30\n" +
    "Domingo: 10h e 19h30\n\n" +
    "*Grupo de Oração:* Segunda 19h30\n" +
    "*Legião de Maria:* Terça 9h\n" +
    "*Terço dos Homens:* Terça 20h\n" +
    "*Adoração ao Santíssimo:* Quinta 7h30 às 19h\n" +
    "*Mães que Oram pelos Filhos:* Quinta 15h\n" +
    "*Confissões:* antes das Missas da noite\n" +
    "*Jovens Sarados:* Domingo 17h",

  creche:
    "*Creche Santo Antônio*\n\n" +
    "Atende diariamente 50 crianças em horário integral, com educação infantil de qualidade, 4 refeições diárias e atividades de desenvolvimento social.\n\n" +
    "Venha visitar: Estrada Frei Orlando, 370 - Jacaré, Piratininga.\n\n" +
    "Para fazer uma *doação* (PIX):\n" +
    "CNPJ: 30147995007949\n" +
    "Celular: 21985560659\n" +
    "Banco Sicredi (748) - Ag 0720 - C/C 69674-1",

  outros:
    "*Outros assuntos*\n\n" +
    "Me conte no que posso ajudar que eu encaminho para a secretaria. 🙏"
};

// Texto para os fluxos ainda não construídos nesta bancada (fatias seguintes).
const EM_BREVE = {
  missa:   "🙏 O agendamento de *intenções de Missa* já já entra aqui. (em construção)",
  batismo: "🙏 O fluxo de *Batismo* já já entra aqui. (em construção)",
  banco:   "🙏 As *Informações bancárias* com PIX e QR Code já já entram aqui. (em construção)"
};

// ---------------------------------------------------------------------------
// Estado isolado
// ---------------------------------------------------------------------------
function estado(sessions, chatId) {
  if (!sessions[chatId]) sessions[chatId] = {};
  if (!sessions[chatId].psj) sessions[chatId].psj = {};
  return sessions[chatId].psj;
}

async function mostrarMenu(chatId, sessions) {
  sessions[chatId].step = "psj_menu";
  await sendTyping(chatId);
  await sendText(
    chatId,
    "⛪ *Paróquia São José - Piratininga*\n_(bancada de teste Rapha Lumen)_"
  );
  // A lista do WhatsApp aceita no máx. 10 itens e o menu tem 12. Para NÃO cair
  // no fallback de texto (perder o clique), a última linha é "Outros" e agrupa
  // os 3 itens menos pedidos (creche, programação, 2ª vias) num submenu.
  // Assim a lista principal fica com 10 itens clicáveis. Os números de 1 a 12
  // continuam válidos digitando, então quem sabe o número não perde nada.
  const principais = MENU.filter(m => ![9, 10, 11].includes(m.n));   // 9 itens
  const linhas = principais.map(m => ({ id: String(m.n), title: m.titulo }));
  linhas.push({ id: "outros_mais", title: "Outros (certidões, programação, creche)" }); // 10º
  await sendOptionList(
    chatId,
    "Como posso te ajudar hoje?",
    linhas,
    { title: "Secretaria", buttonLabel: "Ver opções" }
  );
}

async function mostrarSubmenuOutros(chatId, sessions) {
  sessions[chatId].step = "psj_menu";
  await sendTyping(chatId);
  await sendOptionList(
    chatId,
    "Sobre qual assunto?",
    [
      { id: "9",  title: "2ª vias, declarações e certidões" },
      { id: "10", title: "Programação semanal" },
      { id: "11", title: "Creche Santo Antônio" },
      { id: "12", title: "Outros assuntos" }
    ],
    { title: "Outros", buttonLabel: "Ver opções" }
  );
}

async function tratarEscolhaMenu(chatId, sessions, corpo) {
  // "Outros" da lista principal abre o submenu com os itens agrupados.
  if (String(corpo).trim().toLowerCase() === "outros_mais") {
    await mostrarSubmenuOutros(chatId, sessions);
    return;
  }

  const n = parseInt(String(corpo).replace(/\D+/g, ""), 10);
  const item = MENU.find(m => m.n === n);

  if (!item) {
    await sendTyping(chatId);
    await sendText(chatId, "Não entendi. Escolha um número de *1 a 12* (ou toque em *Ver opções*).");
    return;
  }

  if (item.tipo === "rapida") {
    await sendTyping(chatId);
    await sendText(chatId, RESPOSTAS[item.destino] || "(sem texto)");
    await sendTyping(chatId);
    await sendText(chatId, "Posso te ajudar em algo mais? Toque em *Ver opções* ou digite o número. Para sair, digite *sair*.");
    sessions[chatId].step = "psj_menu";
    return;
  }

  // fluxo ainda em construção nesta bancada
  await sendTyping(chatId);
  await sendText(chatId, EM_BREVE[item.destino] || "(em construção)");
  await sendText(chatId, "Toque em *Ver opções* para voltar ao menu, ou digite *sair*.");
  sessions[chatId].step = "psj_menu";
}

// ---------------------------------------------------------------------------
// Ponto de entrada. O index.js chama isto quando corpo == "#psj" OU o step
// atual começa com "psj_". Retorna true se tratou a mensagem.
// ---------------------------------------------------------------------------
async function handleParoquia(chatId, sessions, corpoMensagem) {
  const corpo = String(corpoMensagem || "").trim();
  const low = corpo.toLowerCase();

  estado(sessions, chatId); // garante o namespace

  // Entrar / reiniciar a bancada
  if (low === "#psj") {
    await mostrarMenu(chatId, sessions);
    return true;
  }

  // Sair da bancada e devolver o controle ao fluxo normal
  if (low === "sair") {
    sessions[chatId].step = "finalizado";
    delete sessions[chatId].psj;
    await sendText(chatId, "Você saiu da bancada de teste da Paróquia. 🙏");
    return true;
  }

  const step = sessions[chatId]?.step || "";
  if (!step.startsWith("psj_")) return false; // não é comigo

  if (step === "psj_menu") {
    await tratarEscolhaMenu(chatId, sessions, corpo);
    return true;
  }

  // step psj_ desconhecido: volta ao menu
  await mostrarMenu(chatId, sessions);
  return true;
}

module.exports = { handleParoquia };

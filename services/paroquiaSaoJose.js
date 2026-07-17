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
//  - todo step começa com "psj_"; o index.js delega tudo por 1 gancho.
// Migração: quando virar o repo da paróquia (Node separado, Postgres gru),
// isto é recorta-e-cola. Conteúdo real em ParoquiaPro/conteudo-saojose.md.

const fs = require("fs");
const path = require("path");
const { sendText, sendTyping, sendOptionList } = require("../utils/index.js");
const { pixBrCode } = require("../utils/pixBrCode.js");
const { sendImageBase64 } = require("../utils/sendImageBase64.js");
const QRCode = require("qrcode");
const calendario = require("./paroquiaCalendario.js");
const intencoesDB = require("./paroquiaIntencoes.js");

// ---------------------------------------------------------------------------
// INTENÇÕES DE MISSA — dados
// ---------------------------------------------------------------------------
// Tipos de intenção: fonte única em paroquiaIntencoes (usada também na tela
// da secretaria).
const TIPOS_INTENCAO = intencoesDB.TIPOS_INTENCAO;

// O calendário de missas agora mora em paroquiaCalendario.js (editável pela
// secretaria: padrão por local + exceções + períodos). proximasMissas() lê de
// lá. Antes havia um CALENDARIO_MATRIZ fixo aqui — removido p/ ter 1 só fonte.

// "Agora" no horário de São Paulo (o servidor roda em UTC/iad). Truque simples,
// suficiente p/ a bancada; timezone fino fica p/ a migração ao Postgres gru.
function agoraSP() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function rotuloMissa(dt) {
  const dia = DIAS_SEMANA[dt.getDay()];
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const h = dt.getHours();
  const min = dt.getMinutes();
  const hora = min ? `${h}h${String(min).padStart(2, "0")}` : `${h}h`;
  return `${dia}, ${dd}/${mm} - ${hora}`;
}

// Hora do CORTE de uma missa: até quando o chat aceita intenção para ela.
// [OK 16/07, Mario] A secretaria encerra às 17h (dia útil) e imprime. Regras:
//   - DOMINGO (10h e 19h30) e SEGUNDA 7h: corte às 17h da SEXTA (último dia
//     útil), porque a secretaria não trabalha no fim de semana. A missa das
//     10h SÓ existe no domingo, então SEMPRE cai aqui (não é "manhã de dia útil").
//   - Dia útil ter-sex, missa da NOITE (19h30): corte às 17h do MESMO dia;
//   - Dia útil ter-sex, missa da MANHÃ (7h): corte às 17h do dia útil ANTERIOR.
// A ordem dos `if` abaixo garante isso: o dia da semana é checado ANTES do horário.
// ⚠️ Não trata FERIADO ainda (se sexta é feriado, o real seria quinta) — refino
// com as secretárias / na migração. CORTE_HORA fixo em 17h (decisão do Mario).
const CORTE_HORA = 17;

function deadlineMissa(dt) {
  const dow = dt.getDay();      // 0=dom ... 6=sáb
  const hora = dt.getHours();

  // Domingo ou segunda (segunda só tem 7h) => fecha na sexta anterior 17h.
  if (dow === 0 || dow === 1) {
    const sx = new Date(dt);
    while (sx.getDay() !== 5) sx.setDate(sx.getDate() - 1);
    sx.setHours(CORTE_HORA, 0, 0, 0);
    return sx;
  }
  // Dia útil (ter-sex):
  if (hora < CORTE_HORA) {
    // manhã: 17h do dia anterior (que é útil, pois ter-sex manhã)
    const a = new Date(dt);
    a.setDate(a.getDate() - 1);
    a.setHours(CORTE_HORA, 0, 0, 0);
    return a;
  }
  // noite (19h30): 17h do mesmo dia
  const d = new Date(dt);
  d.setHours(CORTE_HORA, 0, 0, 0);
  return d;
}

// Próximas `qtd` missas ABERTAS para intenção pelo chat, a partir de agora (SP).
// Lê do CALENDÁRIO EDITÁVEL (paroquiaCalendario) — já com exceções e períodos
// da secretaria aplicados —, filtra as que aceitam intenção pelo chat (matriz)
// e exclui as que já passaram do corte (a secretaria fechou/imprimiu).
// `agora` injetável p/ teste.
function proximasMissas(qtd, agora) {
  agora = agora || agoraSP();
  return calendario.gerarMissas(agora, 21)
    .filter(m => m.intencao)                          // só as que aceitam intenção (matriz)
    .filter(m => m.iso > agora)                       // ainda vão acontecer
    .filter(m => agora < deadlineMissa(m.iso))        // corte AUTOMÁTICO das 17h
    .filter(m => !intencoesDB.estaFechadaManual(m.iso)) // corte MANUAL da secretaria
    .slice(0, qtd)
    .map(m => ({ iso: m.iso.toISOString(), rotulo: rotuloMissa(m.iso) }));
}

// Intenções e cortes moram em paroquiaIntencoes.js (compartilhado com a tela
// da secretaria). Aqui só usamos gravarIntencao e estaFechadaManual.
const gravarIntencao = intencoesDB.gravarIntencao;

// Contas para contribuição (item 7). Duas contas reais [OK 17/07, Maju]:
// a da paróquia (dízimo/oferta) e a da Creche Santo Antônio (doação). Cada
// uma com CNPJ/conta próprios. Do `chave` sai o Pix Copia e Cola + QR.
const CONTAS = {
  dizimo: {
    titulo: "Dízimo e Oferta - Paróquia São José",
    chave: "30147995009488",  // chave que gera o QR/copia-e-cola (CNPJ)
    // Chaves alternativas rotuladas (a pessoa vê qual é qual e copia a que quiser).
    chaves_alt: [
      { rotulo: "CNPJ",    valor: "30147995009488" },
      { rotulo: "Celular", valor: "21984692112" },
      { rotulo: "E-mail",  valor: "p84@arqnit.org.br" }
    ],
    beneficiario: "PAROQUIA SAO JOSE",
    cidade: "NITEROI",
    banco: "Sicredi (748)", agencia: "0720", conta: "68527-1"
  },
  creche: {
    titulo: "Doação - Creche Santo Antônio",
    chave: "30147995007949",  // CNPJ
    chaves_alt: [
      { rotulo: "CNPJ",    valor: "30147995007949" },
      { rotulo: "Celular", valor: "21985560659" }
    ],
    beneficiario: "CRECHE STO ANTONIO",
    cidade: "NITEROI",
    banco: "Sicredi (748)", agencia: "0720", conta: "69674-1"
  }
};

// ---------------------------------------------------------------------------
// MENU DE 10 ITENS (organização do Mario, 17/07 — cabe na lista sem submenu de
// "Outros"). "submenu" agrupa 2 assuntos irmãos.
// ---------------------------------------------------------------------------
const MENU = [
  // Item 1 (pedido do Mario, 17/07): no CORPO da mensagem aparece o nome
  // completo (label), e a LINHA clicável da lista fica curta (titulo, limite
  // ~24 chars) com a descrição embaixo. Assim a pessoa lê "intenções" nas
  // duas formas de render.
  { n: 1,  titulo: "Missa e intenções", label: "Horário de Missa, intenções e Programação", desc: "Horários, intenções e programação", tipo: "submenu", destino: "missa" },
  { n: 2,  titulo: "Batismo",                    tipo: "submenu", destino: "batismo" },
  { n: 3,  titulo: "Casamento",                  tipo: "rapida",  destino: "casamento" },
  { n: 4,  titulo: "Agendamento com o padre",    tipo: "rapida",  destino: "agenda_padre" },
  { n: 5,  titulo: "Catequese / Catecumenato",   tipo: "submenu", destino: "catequese_cat" },
  { n: 6,  titulo: "Dízimo",                     tipo: "rapida",  destino: "dizimo" },
  { n: 7,  titulo: "Informações bancárias",      tipo: "banco",   destino: "banco" },
  { n: 8,  titulo: "2ª vias e certidões",        tipo: "rapida",  destino: "certidoes" },
  { n: 9,  titulo: "Creche Santo Antônio",       tipo: "rapida",  destino: "creche" },
  { n: 10, titulo: "Outros assuntos",            tipo: "rapida",  destino: "outros" }
];

// Submenus (2 opções cada). Cada sub-opção é "rapida" (texto) ou "fluxo".
const SUBMENUS = {
  missa: {
    titulo: "Missa",
    opcoes: [
      { titulo: "Horários e programação",       tipo: "rapida", destino: "programacao" },
      { titulo: "Horários das Missas nas capelas", tipo: "rapida", destino: "horarios_capelas" },
      { titulo: "Cadastrar intenção",           tipo: "fluxo",  destino: "intencao" }
    ]
  },
  catequese_cat: {
    titulo: "Catequese e Catecumenato",
    opcoes: [
      { titulo: "Catequese (infantil)",           tipo: "rapida", destino: "catequese" },
      { titulo: "Catecumenato (jovens e adultos)", tipo: "rapida", destino: "catecumenato" }
    ]
  },
  batismo: {
    titulo: "Batismo",
    opcoes: [
      { titulo: "Datas para o batizado",     tipo: "rapida", destino: "batismo_datas" },
      { titulo: "Curso de pais e padrinhos", tipo: "rapida", destino: "batismo_curso" }
    ]
  }
};

// ---------------------------------------------------------------------------
// RESPOSTAS RÁPIDAS — texto EXATO da Maju (17/07). Não reescrever.
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

  // Batismo (fluxo da Maju, 18/07). Duas frases dela cortaram na borda do print
  // e ficaram de fora ATÉ ela mandar o final: (1) "Para reservar a data, é
  // necessário ..." e (2) o fim do "obs" do curso ("...comparecer na data e ...").
  batismo_datas:
    "*Datas para o Batismo*\n\n" +
    "O Batismo é *comunitário* (pode haver mais crianças no mesmo dia) e é sempre às *10h*.\n\n" +
    "*Onde e quando:*\n" +
    "2º sábado do mês - Matriz São José\n" +
    "3º sábado do mês - Capela Santa Teresinha (Camboinhas)\n" +
    "4º sábado do mês - Capela Nossa Senhora da Penha (Tibau)\n\n" +
    "*Documentos necessários (somente xerox):*\n" +
    "1. Certidão de nascimento da criança\n" +
    "2. Carteira de identidade civil dos padrinhos, se solteiros\n" +
    "3. Certidão do casamento religioso dos padrinhos, se casados ou viúvos\n" +
    "4. Comprovante dos sacramentos (Batismo, 1ª Eucaristia e Crisma) dos dois padrinhos\n" +
    "5. Ficha dos padrinhos preenchida e assinada\n" +
    "6. Comprovante de residência dos pais\n" +
    "7. Autorização da paróquia onde os pais residem, caso não pertençam a esta comunidade (cópia original)\n\n" +
    "_Caso a situação não se encontre dentro dos padrões, procure a secretaria paroquial._",

  batismo_curso:
    "*Curso de pais e padrinhos*\n\n" +
    "Acontece todo *1º sábado do mês*. Próximas datas:\n" +
    "01/08\n05/09\n03/10\n07/11\n05/12\n\n" +
    "_Não é necessário fazer inscrição, é só comparecer na data._",

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

  // Sem as chaves Pix no texto: elas vão em mensagens separadas (copiáveis)
  // via enviarChavesPix — ver CHAVES_POR_DESTINO / entregar().
  creche:
    "*Creche Santo Antônio*\n\n" +
    "Atende diariamente 50 crianças em horário integral, com educação infantil de qualidade, 4 refeições diárias e atividades de desenvolvimento social.\n\n" +
    "Venha visitar: Estrada Frei Orlando, 370 - Jacaré, Piratininga.\n\n" +
    "Para doar por *transferência*: Banco Sicredi (748) - Ag 0720 - C/C 69674-1.",

  outros:
    "*Outros assuntos*\n\n" +
    "Me conte no que posso ajudar que eu encaminho para a secretaria. 🙏"
};

// Fluxos ainda não construídos nesta bancada (próximas fatias).
const EM_BREVE = {
  intencao: "🙏 O *registro de intenção* na Missa já já entra aqui. (em construção)"
};

// ---------------------------------------------------------------------------
// Estado isolado
// ---------------------------------------------------------------------------
function estado(sessions, chatId) {
  if (!sessions[chatId]) sessions[chatId] = {};
  if (!sessions[chatId].psj) sessions[chatId].psj = {};
  return sessions[chatId].psj;
}

// Saudação de abertura da Maju (só na 1ª tela; nas voltas ao menu usamos um
// cabeçalho curto). "_(teste)_" é a marquinha discreta da bancada — some quando
// migrar pro bot real da paróquia.
const SAUDACAO =
  "Olá! Seja bem-vindo(a) à secretaria da *Paróquia São José*! 😊\n" +
  "É um prazer falar com você!\n_(bancada de teste Rapha Lumen)_";

async function mostrarMenu(chatId, sessions, cabecalho) {
  const primeiraTela = !cabecalho;
  sessions[chatId].step = "psj_menu";
  sessions[chatId].psj.submenu = null;

  if (primeiraTela) {
    await sendTyping(chatId);
    await sendText(chatId, SAUDACAO);
  }

  await sendTyping(chatId);
  await sendOptionList(
    chatId,
    cabecalho || "Como posso te ajudar hoje?",
    MENU.map(m => ({ id: String(m.n), title: m.titulo, ...(m.label ? { label: m.label } : {}), ...(m.desc ? { description: m.desc } : {}) })),
    { title: "Secretaria", buttonLabel: "Ver opções" }
  );
}

// Destinos de resposta rápida que também mostram chaves Pix (em mensagens
// separadas, copiáveis). Reusa as chaves da mesma conta do item 7.
const CHAVES_POR_DESTINO = { creche: CONTAS.creche.chaves_alt };

// "8h e 11h" | "8h" — junta os horários de um mesmo dia.
function juntarHoras(horas) {
  if (horas.length <= 1) return horas[0] || "";
  return horas.slice(0, -1).join(", ") + " e " + horas[horas.length - 1];
}

// Horários das Missas nas CAPELAS, montados na hora a partir do calendário
// editável (não é texto fixo): se a secretaria mudar um horário, muda aqui.
// Fica SEPARADO da "programação" (pedido da Maju: não misturar com os grupos
// de oração e a agenda da paróquia). Só capelas — a matriz vai na programação.
function textoHorariosCapelas() {
  const capelas = calendario.agendaSemanal().filter(b => b.local !== calendario.MATRIZ);
  if (capelas.length === 0) return "*Horários das Missas nas capelas*\n\nEm breve.";
  const blocos = capelas.map(b => {
    const linhas = b.dias.map(d => `${d.nome}: ${juntarHoras(d.horas)}`).join("\n");
    return `*${b.local}*\n${linhas}`;
  }).join("\n\n");
  return "*Horários das Missas nas capelas*\n\n" + blocos +
    "\n\n_Nas capelas a intenção é anotada na hora: chegue *20 minutos antes* e fale com o(a) comentarista. 🙏_";
}

// Respostas geradas na hora (leem do calendário -> mudam sozinhas quando a
// secretaria edita). Diferem das RESPOSTAS estáticas (texto fixo da Maju).
const GERADAS = { horarios_capelas: textoHorariosCapelas };

// Entrega uma "rapida" (texto) ou um "fluxo" e volta ao menu.
async function entregar(chatId, sessions, item) {
  // Fluxo de intenção (fatia 3a): inicia a máquina de estados própria.
  if (item.tipo === "fluxo" && item.destino === "intencao") {
    await iniciarIntencao(chatId, sessions);
    return;
  }

  await sendTyping(chatId);
  if (item.tipo === "rapida") {
    const texto = GERADAS[item.destino] ? GERADAS[item.destino]() : (RESPOSTAS[item.destino] || "(sem texto)");
    await sendText(chatId, texto);
    if (CHAVES_POR_DESTINO[item.destino]) {
      await enviarChavesPix(chatId, CHAVES_POR_DESTINO[item.destino]);
    }
  } else {
    await sendText(chatId, EM_BREVE[item.destino] || "(em construção)");
  }
  // Volta ao menu já como lista clicável (o botão fica sempre à mão).
  await mostrarMenu(chatId, sessions, "Posso te ajudar em algo mais? (ou digite *sair*)");
}

async function mostrarSubmenu(chatId, sessions, destino) {
  const sub = SUBMENUS[destino];
  sessions[chatId].step = "psj_submenu";
  sessions[chatId].psj.submenu = destino;
  await sendTyping(chatId);
  await sendOptionList(
    chatId,
    `*${sub.titulo}*\nEscolha uma opção:`,
    sub.opcoes.map((o, i) => ({ id: String(i + 1), title: o.titulo })),
    { title: sub.titulo, buttonLabel: "Ver opções" }
  );
}

async function tratarEscolhaMenu(chatId, sessions, corpo) {
  const n = parseInt(String(corpo).replace(/\D+/g, ""), 10);
  const item = MENU.find(m => m.n === n);

  if (!item) {
    await sendTyping(chatId);
    await sendText(chatId, "Não entendi. Escolha um número de *1 a 10* (ou toque em *Ver opções*).");
    return;
  }

  if (item.tipo === "submenu") {
    await mostrarSubmenu(chatId, sessions, item.destino);
    return;
  }
  if (item.tipo === "banco") {
    await abrirBanco(chatId, sessions);
    return;
  }
  await entregar(chatId, sessions, item);
}

async function tratarEscolhaSubmenu(chatId, sessions, corpo) {
  const destino = sessions[chatId]?.psj?.submenu;
  const sub = SUBMENUS[destino];
  if (!sub) { await mostrarMenu(chatId, sessions); return; }

  const i = parseInt(String(corpo).replace(/\D+/g, ""), 10) - 1;
  const op = sub.opcoes[i];
  if (!op) {
    await sendTyping(chatId);
    await sendText(chatId, `Não entendi. Escolha de *1* a *${sub.opcoes.length}* (ou toque em *Ver opções*).`);
    return;
  }
  await entregar(chatId, sessions, op);
}

// ---------------------------------------------------------------------------
// CHAVES PIX — cada VALOR numa mensagem própria (2026-07-16, Mario).
// No WhatsApp, copiar = segurar a mensagem, que copia a mensagem INTEIRA. Se o
// CNPJ estiver junto do rótulo, copia rótulo+número. Então mandamos o rótulo
// numa msg e o valor sozinho na seguinte — aí a pessoa segura e copia só o
// número. (Telefone e e-mail viram link e já dão pra copiar, mas mantemos o
// mesmo padrão pra ficar consistente.) O delay garante a ordem de entrega.
// ---------------------------------------------------------------------------
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function enviarChavesPix(chatId, chaves) {
  await sendTyping(chatId);
  await sendText(chatId, "Ou use a *chave Pix* direto no seu banco. Toque e segure o número para *copiar* 👇");
  for (const k of chaves) {
    await delay(400);
    await sendText(chatId, `*Chave Pix ${k.rotulo}:*`);
    await delay(300);
    await sendText(chatId, k.valor);
  }
}

// ---------------------------------------------------------------------------
// ITEM 7 — INFORMAÇÕES BANCÁRIAS (Pix Copia e Cola + QR no chat)
// ---------------------------------------------------------------------------
async function abrirBanco(chatId, sessions) {
  sessions[chatId].step = "psj_banco";
  await sendTyping(chatId);
  await sendOptionList(
    chatId,
    "Para qual finalidade você deseja contribuir?",
    [
      { id: "1", title: "Dízimo e Oferta" },
      { id: "2", title: "Creche Santo Antônio" }
    ],
    { title: "Contribuir", buttonLabel: "Ver opções" }
  );
}

async function enviarPix(chatId, sessions, chaveConta) {
  const c = CONTAS[chaveConta];
  const copiaECola = pixBrCode({
    chave: c.chave, beneficiario: c.beneficiario, cidade: c.cidade
  });

  await sendTyping(chatId);
  await sendText(chatId, `*${c.titulo}*\n\nVocê escolhe o valor. Copie o código *Pix Copia e Cola* abaixo e cole no app do seu banco 👇`);

  // O copia-e-cola vai SOZINHO num bloco de código, para o WhatsApp mostrar o
  // botão de copiar (a pessoa não seleciona à mão um código enorme).
  await sendText(chatId, "```" + copiaECola + "```");

  // QR gerado do MESMO código, para quem prefere pagar de outro aparelho.
  try {
    const dataUrl = await QRCode.toDataURL(copiaECola, { margin: 1, width: 400 });
    await sendImageBase64(chatId, dataUrl, "QR Code Pix - " + c.titulo);
  } catch (e) {
    console.error("🚨 [psj] Falha ao gerar QR:", e.message);
    // Sem imagem, o copia-e-cola acima já resolve.
  }

  // Chaves Pix, cada valor numa mensagem própria (dá pra copiar o CNPJ).
  await enviarChavesPix(chatId, c.chaves_alt);

  // Dados da conta para quem prefere depósito/transferência (diferente de Pix).
  await delay(400);
  await sendText(
    chatId,
    "Ou, se preferir *depósito ou transferência*:\n" +
    `Banco: ${c.banco}\nAgência: ${c.agencia}\nConta: ${c.conta}` +
    "\n\n_Que Deus recompense a sua generosidade!_ 🙏"
  );

  await mostrarMenu(chatId, sessions, "Posso te ajudar em algo mais? (ou digite *sair*)");
}

async function tratarEscolhaBanco(chatId, sessions, corpo) {
  const n = parseInt(String(corpo).replace(/\D+/g, ""), 10);
  const mapa = { 1: "dizimo", 2: "creche" };
  const conta = mapa[n];
  if (!conta) {
    await sendTyping(chatId);
    await sendText(chatId, "Não entendi. Escolha *1* (Dízimo e Oferta) ou *2* (Creche).");
    return;
  }
  await enviarPix(chatId, sessions, conta);
}

// ---------------------------------------------------------------------------
// INTENÇÕES DE MISSA — fluxo do fiel (fatia 3a)
// Passos: quem pede -> tipo -> [Outros: digita] -> nome de quem recebe a
// oração -> escolhe a missa -> confirma -> grava no arquivo isolado.
// ---------------------------------------------------------------------------
async function iniciarIntencao(chatId, sessions) {
  sessions[chatId].psj.intencao = {};
  // Quem está pedindo: perguntado UMA vez por conversa e reaproveitado nas
  // próximas intenções da mesma pessoa (ela pode registrar várias seguidas).
  if (!sessions[chatId].psj.solicitante) {
    sessions[chatId].step = "psj_int_solicitante";
    await sendTyping(chatId);
    await sendText(
      chatId,
      "Vamos registrar sua intenção de Missa 🙏\n\nAntes, qual é o *seu nome*?\n_(de quem está pedindo a intenção)_"
    );
    return;
  }
  await pedirTipoIntencao(chatId, sessions, "Vamos registrar sua intenção de Missa 🙏");
}

async function intSolicitante(chatId, sessions, corpo) {
  const nome = String(corpo || "").trim().replace(/\s+/g, " ");
  if (nome.length < 2) {
    await sendText(chatId, "Informe o seu nome, por favor.");
    return;
  }
  sessions[chatId].psj.solicitante = nome;
  await pedirTipoIntencao(chatId, sessions, `Obrigado, ${nome.split(" ")[0]}! 🙏`);
}

async function pedirTipoIntencao(chatId, sessions, cabecalho) {
  sessions[chatId].step = "psj_int_tipo";
  await sendTyping(chatId);
  await sendOptionList(
    chatId,
    (cabecalho ? cabecalho + "\n\n" : "") + "Qual o tipo de intenção?",
    TIPOS_INTENCAO.map((t, i) => ({ id: String(i + 1), title: t })),
    { title: "Intenção", buttonLabel: "Ver opções" }
  );
}

async function intTipo(chatId, sessions, corpo) {
  const i = parseInt(String(corpo).replace(/\D+/g, ""), 10) - 1;
  const tipo = TIPOS_INTENCAO[i];
  if (!tipo) {
    await sendTyping(chatId);
    await sendText(chatId, "Não entendi. Escolha um número da lista (ou toque em *Ver opções*).");
    return;
  }
  if (tipo === "Outros") {
    sessions[chatId].step = "psj_int_outros";
    await sendTyping(chatId);
    await sendText(chatId, "Descreva a intenção (ex: *ação de graças*, *conversão*, *emprego*):");
    return;
  }
  sessions[chatId].psj.intencao.tipo = tipo;
  // Aniversário de casamento: os anos viram as bodas no relatório do padre.
  if (tipo === intencoesDB.TIPO_CASAMENTO) {
    sessions[chatId].step = "psj_int_anos";
    await sendTyping(chatId);
    await sendText(chatId, "Quantos *anos de casados*?\n_(só o número, ex: 25)_");
    return;
  }
  await pedirNomeOracao(chatId, sessions);
}

async function intAnosCasamento(chatId, sessions, corpo) {
  const anos = parseInt(String(corpo).replace(/\D+/g, ""), 10);
  if (!anos || anos < 1 || anos > 100) {
    await sendText(chatId, "Informe só o *número* de anos de casados (ex: *25*).");
    return;
  }
  sessions[chatId].psj.intencao.anos_casamento = anos;
  await pedirNomeOracao(chatId, sessions);
}

async function intOutros(chatId, sessions, corpo) {
  const txt = String(corpo || "").trim();
  if (txt.length < 2) {
    await sendText(chatId, "Descreva a intenção, por favor.");
    return;
  }
  sessions[chatId].psj.intencao.tipo = txt;
  await pedirNomeOracao(chatId, sessions);
}

async function pedirNomeOracao(chatId, sessions) {
  sessions[chatId].step = "psj_int_nome";
  await sendTyping(chatId);
  if (sessions[chatId].psj.intencao.tipo === intencoesDB.TIPO_CASAMENTO) {
    await sendText(chatId, "Qual o *nome do casal*?\n_(ex: Mario e Adriana)_");
    return;
  }
  await sendText(
    chatId,
    "Qual o *nome* da pessoa por quem devemos rezar?\n\n" +
    "Se for mais de uma, envie os nomes separados por *vírgula*.\n_(ex: Cléa Nazeanze, João da Silva)_"
  );
}

// "A", "A e B", "A, B e C"
function juntarNomes(nomes) {
  if (nomes.length <= 1) return nomes[0] || "";
  return nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
}

async function intNome(chatId, sessions, corpo) {
  // Vários nomes na MESMA intenção: separados por vírgula/ponto-e-vírgula.
  // (Não separo por " e " para não quebrar nomes compostos.)
  const nomes = String(corpo || "")
    .split(/[,;]+/).map(n => n.trim()).filter(n => n.length >= 2);
  if (nomes.length === 0) {
    await sendText(chatId, "Informe o nome, por favor.");
    return;
  }
  sessions[chatId].psj.intencao.nomes = nomes;
  sessions[chatId].psj.intencao.nome = nomes.join(", ");

  const missas = proximasMissas(6);
  if (missas.length === 0) {
    await sendText(chatId, "No momento não há missas disponíveis para intenção pelo chat. Procure a secretaria. 🙏");
    await mostrarMenu(chatId, sessions, "Posso te ajudar em algo mais? (ou digite *sair*)");
    return;
  }
  sessions[chatId].psj.intencao.missasOferecidas = missas;
  sessions[chatId].step = "psj_int_missa";
  await sendTyping(chatId);
  // A lista de intenção é sempre da matriz (só ela aceita intenção pelo chat);
  // deixa isso claro no título p/ a pessoa não procurar a missa da capela aqui.
  await sendOptionList(
    chatId,
    `Para qual Missa na *${calendario.MATRIZ}*?`,
    missas.map((m, i) => ({ id: String(i + 1), title: m.rotulo })),
    { title: "Missas", buttonLabel: "Ver missas" }
  );
  // A missa que a pessoa quer pode não estar na lista por 2 motivos: é de uma
  // CAPELA (intenção anotada na hora) ou já foi ENCERRADA pela secretaria. Nos
  // dois casos o caminho é o mesmo: comentarista, 20 min antes. (Maju, 18/07.)
  await sendText(
    chatId,
    "_Não encontrou a Missa desejada? Pode ser uma Missa de *capela*, ou uma Missa cujas intenções já foram encerradas na secretaria. Nos dois casos, chegue *20 minutos antes* e fale com o(a) comentarista, que anotará o nome. 🙏_"
  );
}

async function intMissa(chatId, sessions, corpo) {
  const missas = sessions[chatId].psj.intencao.missasOferecidas || [];
  const i = parseInt(String(corpo).replace(/\D+/g, ""), 10) - 1;
  const missa = missas[i];
  if (!missa) {
    await sendTyping(chatId);
    await sendText(chatId, "Não entendi. Escolha uma das missas da lista (ou toque em *Ver missas*).");
    return;
  }
  sessions[chatId].psj.intencao.missa = missa;
  sessions[chatId].step = "psj_int_confirma";

  const it = sessions[chatId].psj.intencao;
  const rotuloNomes = (it.nomes && it.nomes.length > 1) ? "Nomes" : "Nome";
  await sendTyping(chatId);
  await sendOptionList(
    chatId,
    "Confira os dados da intenção:\n\n" +
    `*Tipo:* ${it.tipo}\n` +
    `*${rotuloNomes}:* ${juntarNomes(it.nomes || [it.nome])}\n` +
    (it.anos_casamento ? `*Casados há:* ${intencoesDB.rotuloBodas(it.anos_casamento)}\n` : "") +
    `*Missa:* ${missa.rotulo}\n` +
    `*Quem está pedindo:* ${sessions[chatId].psj.solicitante || "-"}\n\n` +
    "Está tudo certo?",
    [
      { id: "1", title: "Sim, registrar" },
      { id: "2", title: "Não, começar de novo" }
    ],
    { title: "Confirmar", buttonLabel: "Ver opções" }
  );
}

async function intConfirma(chatId, sessions, corpo) {
  const r = String(corpo).replace(/\D+/g, "");
  if (r === "2") {
    await iniciarIntencao(chatId, sessions);
    return;
  }
  if (r !== "1") {
    await sendText(chatId, "Responda *1* para registrar ou *2* para começar de novo.");
    return;
  }

  const it = sessions[chatId].psj.intencao || {};
  const nomes = it.nomes || (it.nome ? [it.nome] : []);
  // Formato = tabela `intencoes` (Rapha Lumen Pro). paroquia_id fixo 1 (bancada).
  // nome_oracao = string p/ o relatório; `nomes` = array (vários na mesma intenção).
  gravarIntencao({
    paroquia_id: 1,
    tipo: it.tipo,
    nome_oracao: nomes.join(", "),
    nomes: nomes,
    missa_iso: it.missa?.iso,
    missa_rotulo: it.missa?.rotulo,
    anos_casamento: it.anos_casamento || null,
    solicitante_nome: sessions[chatId].psj.solicitante || "",
    ofertante_whatsapp: String(chatId).replace("@c.us", ""),
    origem: "chatbot",
    criada_em: new Date().toISOString()
  });

  delete sessions[chatId].psj.intencao;
  await sendTyping(chatId);
  await sendText(
    chatId,
    `🙏 Intenção registrada!\n\nRezaremos por *${juntarNomes(nomes)}* na Missa de *${it.missa?.rotulo}*.\nQue Deus abençoe você e sua família!`
  );
  // A mesma pessoa pode ter mais de uma intenção (tipos/missas diferentes).
  await perguntarOutraIntencao(chatId, sessions);
}

async function perguntarOutraIntencao(chatId, sessions) {
  sessions[chatId].step = "psj_int_outra";
  await sendTyping(chatId);
  await sendOptionList(
    chatId,
    "Deseja registrar *outra intenção*?",
    [
      { id: "1", title: "Sim, outra intenção" },
      { id: "2", title: "Não, obrigado(a)" }
    ],
    { title: "Intenção", buttonLabel: "Ver opções" }
  );
}

async function intOutra(chatId, sessions, corpo) {
  const r = String(corpo).replace(/\D+/g, "");
  if (r === "1") { await iniciarIntencao(chatId, sessions); return; }
  await mostrarMenu(chatId, sessions, "Posso te ajudar em algo mais? (ou digite *sair*)");
}

// ---------------------------------------------------------------------------
// Ponto de entrada. index.js chama quando corpo == "#psj" OU step começa com
// "psj_". Retorna true se tratou.
// ---------------------------------------------------------------------------
async function handleParoquia(chatId, sessions, corpoMensagem) {
  const corpo = String(corpoMensagem || "").trim();
  const low = corpo.toLowerCase();

  estado(sessions, chatId);

  if (low === "#psj") {
    await mostrarMenu(chatId, sessions);
    return true;
  }

  if (low === "sair") {
    // Zera a sessão inteira (não só o namespace .psj) para devolver o teste ao
    // estado "nova conversa": assim a próxima mensagem ("oi") reabre o menu
    // normal do PhotoMusic. Antes marcava "finalizado" e o bot ignorava o "oi"
    // (o Mario ficava preso após sair da bancada, teste 16/07).
    delete sessions[chatId];
    await sendText(chatId, "Você saiu da bancada de teste da Paróquia. Para voltar, digite *#psj*. 🙏");
    return true;
  }

  const step = sessions[chatId]?.step || "";
  if (!step.startsWith("psj_")) return false;

  if (step === "psj_int_solicitante") { await intSolicitante(chatId, sessions, corpo); return true; }
  if (step === "psj_int_tipo")     { await intTipo(chatId, sessions, corpo);     return true; }
  if (step === "psj_int_outros")   { await intOutros(chatId, sessions, corpo);   return true; }
  if (step === "psj_int_anos")     { await intAnosCasamento(chatId, sessions, corpo); return true; }
  if (step === "psj_int_nome")     { await intNome(chatId, sessions, corpo);     return true; }
  if (step === "psj_int_missa")    { await intMissa(chatId, sessions, corpo);    return true; }
  if (step === "psj_int_confirma") { await intConfirma(chatId, sessions, corpo); return true; }
  if (step === "psj_int_outra")    { await intOutra(chatId, sessions, corpo);    return true; }
  if (step === "psj_banco")   { await tratarEscolhaBanco(chatId, sessions, corpo);   return true; }
  if (step === "psj_submenu") { await tratarEscolhaSubmenu(chatId, sessions, corpo); return true; }
  if (step === "psj_menu")    { await tratarEscolhaMenu(chatId, sessions, corpo);    return true; }

  await mostrarMenu(chatId, sessions);
  return true;
}

module.exports = { handleParoquia };

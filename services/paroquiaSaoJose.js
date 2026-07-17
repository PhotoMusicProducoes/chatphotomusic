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

// ---------------------------------------------------------------------------
// INTENÇÕES DE MISSA — dados
// ---------------------------------------------------------------------------
// Tipos que a Maju passou (17/07) + "Outros" (a pessoa digita).
const TIPOS_INTENCAO = [
  "7º dia de falecido",
  "1 mês de falecido",
  "1 ano de falecido",
  "15 anos - aniversário",
  "Saúde",
  "Outros"
];

// Calendário da MATRIZ (só as missas que aceitam intenção pelo chat). Capela
// nunca entra (comentarista). dia: 0=dom 1=seg ... 6=sáb. [OK 17/07, Maju]
// Segunda não tem 19h30. (Regra de corte do ciclo = fatia 3b; aqui, fatia 3a,
// o fiel só escolhe a missa e a intenção é gravada.)
const CALENDARIO_MATRIZ = [
  { dia: 1, hora: "07:00" },
  { dia: 2, hora: "07:00" }, { dia: 2, hora: "19:30" },
  { dia: 3, hora: "07:00" }, { dia: 3, hora: "19:30" },
  { dia: 4, hora: "07:00" }, { dia: 4, hora: "19:30" },
  { dia: 5, hora: "07:00" }, { dia: 5, hora: "19:30" },
  { dia: 0, hora: "10:00" }, { dia: 0, hora: "19:30" }
];

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

// Próximas `qtd` missas da matriz a partir de agora (SP).
function proximasMissas(qtd) {
  const agora = agoraSP();
  const lista = [];
  for (let d = 0; d < 14 && lista.length < qtd; d++) {
    const base = new Date(agora);
    base.setDate(agora.getDate() + d);
    const dow = base.getDay();
    CALENDARIO_MATRIZ
      .filter(m => m.dia === dow)
      .forEach(m => {
        const [h, mi] = m.hora.split(":").map(Number);
        const dt = new Date(base);
        dt.setHours(h, mi, 0, 0);
        if (dt > agora) lista.push({ iso: dt.toISOString(), rotulo: rotuloMissa(dt) });
      });
  }
  return lista.sort((a, b) => a.iso.localeCompare(b.iso)).slice(0, qtd);
}

// Persistência isolada (arquivo próprio, NUNCA o banco do PhotoMusic). Formato
// = tabela `intencoes` do schema Rapha Lumen Pro, p/ migrar sem reescrever.
const DIR_DADOS = fs.existsSync("/data") ? "/data" : __dirname;
const ARQ_INTENCOES = path.join(DIR_DADOS, "psj-intencoes.json");

function lerIntencoes() {
  try { return JSON.parse(fs.readFileSync(ARQ_INTENCOES, "utf8")); }
  catch { return []; }
}

function gravarIntencao(reg) {
  const arr = lerIntencoes();
  arr.push(reg);
  try { fs.writeFileSync(ARQ_INTENCOES, JSON.stringify(arr, null, 2)); }
  catch (e) { console.error("🚨 [psj] Falha ao gravar intenção:", e.message); }
  return reg;
}

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
  { n: 2,  titulo: "Batismo",                    tipo: "fluxo",   destino: "batismo" },
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
      { titulo: "Horários e programação",  tipo: "rapida", destino: "programacao" },
      { titulo: "Cadastrar intenção",      tipo: "fluxo",  destino: "intencao" }
    ]
  },
  catequese_cat: {
    titulo: "Catequese e Catecumenato",
    opcoes: [
      { titulo: "Catequese (infantil)",           tipo: "rapida", destino: "catequese" },
      { titulo: "Catecumenato (jovens e adultos)", tipo: "rapida", destino: "catecumenato" }
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
  batismo:  "🙏 O fluxo de *Batismo* já já entra aqui. (em construção)",
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

// Entrega uma "rapida" (texto) ou um "fluxo" e volta ao menu.
async function entregar(chatId, sessions, item) {
  // Fluxo de intenção (fatia 3a): inicia a máquina de estados própria.
  if (item.tipo === "fluxo" && item.destino === "intencao") {
    await iniciarIntencao(chatId, sessions);
    return;
  }

  await sendTyping(chatId);
  if (item.tipo === "rapida") {
    await sendText(chatId, RESPOSTAS[item.destino] || "(sem texto)");
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
    await sendText(chatId, `Não entendi. Escolha *1* ou *2* (ou toque em *Ver opções*).`);
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
// Passos: tipo -> [Outros: digita] -> nome de quem recebe a oração -> escolhe
// a missa -> confirma -> grava no arquivo isolado.
// ---------------------------------------------------------------------------
async function iniciarIntencao(chatId, sessions) {
  sessions[chatId].psj.intencao = {};
  sessions[chatId].step = "psj_int_tipo";
  await sendTyping(chatId);
  await sendOptionList(
    chatId,
    "Vamos registrar sua intenção de Missa 🙏\n\nQual o tipo de intenção?",
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
  await sendText(chatId, "Qual o *nome* da pessoa por quem devemos rezar?");
}

async function intNome(chatId, sessions, corpo) {
  const nome = String(corpo || "").trim();
  if (nome.length < 2) {
    await sendText(chatId, "Informe o nome, por favor.");
    return;
  }
  sessions[chatId].psj.intencao.nome = nome;

  const missas = proximasMissas(6);
  if (missas.length === 0) {
    await sendText(chatId, "No momento não há missas disponíveis para intenção pelo chat. Procure a secretaria. 🙏");
    await mostrarMenu(chatId, sessions, "Posso te ajudar em algo mais? (ou digite *sair*)");
    return;
  }
  sessions[chatId].psj.intencao.missasOferecidas = missas;
  sessions[chatId].step = "psj_int_missa";
  await sendTyping(chatId);
  await sendOptionList(
    chatId,
    "Para qual Missa?",
    missas.map((m, i) => ({ id: String(i + 1), title: m.rotulo })),
    { title: "Missas", buttonLabel: "Ver missas" }
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
  await sendTyping(chatId);
  await sendOptionList(
    chatId,
    "Confira os dados da intenção:\n\n" +
    `*Tipo:* ${it.tipo}\n` +
    `*Nome:* ${it.nome}\n` +
    `*Missa:* ${missa.rotulo}\n\n` +
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
  // Formato = tabela `intencoes` (Rapha Lumen Pro). paroquia_id fixo 1 (bancada).
  gravarIntencao({
    paroquia_id: 1,
    tipo: it.tipo,
    nome_oracao: it.nome,
    missa_iso: it.missa?.iso,
    missa_rotulo: it.missa?.rotulo,
    ofertante_whatsapp: String(chatId).replace("@c.us", ""),
    origem: "chatbot",
    criada_em: new Date().toISOString()
  });

  delete sessions[chatId].psj.intencao;
  await sendTyping(chatId);
  await sendText(
    chatId,
    `🙏 Intenção registrada!\n\nRezaremos por *${it.nome}* na Missa de *${it.missa?.rotulo}*.\nQue Deus abençoe você e sua família!`
  );
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

  if (step === "psj_int_tipo")     { await intTipo(chatId, sessions, corpo);     return true; }
  if (step === "psj_int_outros")   { await intOutros(chatId, sessions, corpo);   return true; }
  if (step === "psj_int_nome")     { await intNome(chatId, sessions, corpo);     return true; }
  if (step === "psj_int_missa")    { await intMissa(chatId, sessions, corpo);    return true; }
  if (step === "psj_int_confirma") { await intConfirma(chatId, sessions, corpo); return true; }
  if (step === "psj_banco")   { await tratarEscolhaBanco(chatId, sessions, corpo);   return true; }
  if (step === "psj_submenu") { await tratarEscolhaSubmenu(chatId, sessions, corpo); return true; }
  if (step === "psj_menu")    { await tratarEscolhaMenu(chatId, sessions, corpo);    return true; }

  await mostrarMenu(chatId, sessions);
  return true;
}

module.exports = { handleParoquia };

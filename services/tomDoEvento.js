// services/tomDoEvento.js
//
// 🎭 O TOM DA MENSAGEM MUDA COM A CELEBRAÇÃO (Mario, 06/09/2026)
//
// O problema, nas palavras dele: "os pais da 1ª Eucaristia estão recebendo msg
// como se nós tivéssemos trabalhado na festa de aniversário do filho kkk".
// E era verdade: TODA mensagem saía com "🥳", "Bem-vindos aos...", "Parabéns
// pelo seu evento". Numa Primeira Eucaristia isso soa fora de lugar - é um
// momento de igreja, de família, não de festa.
//
// A correção não é escrever mensagens separadas (elas iriam divergir na
// primeira alteração, como já aconteceu antes neste projeto). É ter UM texto
// com as PALAVRAS certas para cada ocasião, escolhidas aqui.
//
// De onde vem o tipo: `tipo_celebracao` da tabela pm_eventos, entregue pelo
// WordPress em /eventos-chatbot e /eventos-avisos. Valores possíveis:
//   aniversario · casamento · corporativo · formatura · bodas · 1eucaristia · outro
// Vazio (evento antigo, sem o campo preenchido) cai no tom padrão de festa,
// que é o que sempre foi - ninguém perde nada por não ter preenchido.

const TONS = {
  /* 🙏 CELEBRAÇÃO RELIGIOSA: sem confete, sem "parabéns pela festa".
     Continua caloroso, só que do jeito certo para o momento. */
  '1eucaristia': {
    abre:        (num) => `📸 *AS FOTOS JÁ ESTÃO DISPONÍVEIS - SALVE ESTE CONTATO ${num}*`,
    /* 🚨 NÃO usa a preposição aqui. Ela foi escrita para caber em
       "Bem-vindos ___ evento" e, encaixada em outra frase, sai errado:
       "Que alegria registrar DA 1ª Eucaristia". O título sozinho em
       negrito serve para qualquer celebração, sem risco de gramática. */
    boasVindas:  (prep, titulo) => `*${titulo}* 🙏\n\nQue alegria registrar este dia com vocês!`,
    fecho:       'Muito obrigado pela confiança 🙏',
    // contratante
    inicioOla:   (ola) => `${ola} A nossa equipe já está no local. 🙏`,
    fimTitulo:   '🙏 *Que celebração linda!*',
    fimAlegria:  'Foi uma honra registrar esse dia tão especial com vocês.',
    fimObrigado: 'Muito obrigado pela confiança em escolher a PhotoMusic para guardar essas memórias. 🙏',
    palavraDia:  'celebração'
  },

  /* 💍 CASAMENTO e BODAS: festa, mas com emoção no lugar da farra. */
  casamento: {
    abre:        (num) => `🎉 *ATENÇÃO SALVE ESTE CONTATO ${num}*`,
    boasVindas:  (prep, titulo) => `*Bem-vindos ${prep} ${titulo}* ❤️`,
    fecho:       'Muitíssimo obrigado ❤️',
    inicioOla:   (ola) => `${ola} O seu grande dia começou. ❤️`,
    fimTitulo:   '❤️ *Parabéns pelo casamento!*',
    fimAlegria:  'Foi uma alegria enorme fazer parte desse dia com vocês.',
    fimObrigado: 'Muito obrigado pela confiança em escolher a PhotoMusic para cuidar dessas memórias. ❤️',
    palavraDia:  'casamento'
  },

  /* 🏢 CORPORATIVO: profissional, sem intimidade de festa de família. */
  corporativo: {
    abre:        (num) => `📸 *ATENÇÃO SALVE ESTE CONTATO ${num}*`,
    boasVindas:  (prep, titulo) => `*Bem-vindos ${prep} ${titulo}* 📸`,
    fecho:       'Muito obrigado 📸',
    inicioOla:   (ola) => `${ola} O serviço começou agora.`,
    fimTitulo:   '📸 *Obrigado pelo evento!*',
    fimAlegria:  'Foi uma satisfação trabalhar com vocês nesse dia.',
    fimObrigado: 'Muito obrigado pela confiança em escolher a PhotoMusic. 📸',
    palavraDia:  'evento'
  }
};

/* 🥳 O TOM PADRÃO É O DE SEMPRE: aniversário, formatura, "outro" e todo evento
   antigo sem o campo preenchido continuam com a mensagem que o Mario já
   conhece, palavra por palavra. Mudança de tom nunca pode ser surpresa. */
const PADRAO = {
  abre:        (num) => `🎉 *ATENÇÃO SALVE ESTE CONTATO ${num}*`,
  boasVindas:  (prep, titulo) => `*Bem-vindos ${prep} ${titulo}* 🥳`,
  fecho:       'Muitíssimo obrigado🥳',
  inicioOla:   (ola) => `${ola} O seu serviço começou agora. 🥳`,
  fimTitulo:   '❤️ *Parabéns pelo seu evento!*',
  fimAlegria:  'Foi uma alegria enorme fazer parte desse dia com vocês.',
  fimObrigado: 'Muito obrigado pela confiança em escolher a PhotoMusic para cuidar dessas memórias. 🥳',
  palavraDia:  'evento'
};

/** @param {string} tipoCelebracao valor de pm_eventos.tipo_celebracao */
function tomDoEvento(tipoCelebracao) {
  const chave = String(tipoCelebracao || '').trim().toLowerCase();
  if (chave === 'bodas') return TONS.casamento;   // bodas é casamento com anos
  return TONS[chave] || PADRAO;
}

module.exports = { tomDoEvento, TONS, PADRAO };

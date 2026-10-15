// teste-regras-do-plugin.js
// Banco de medicao das REGRAS DE VENDA que o bot passou a LER do PhotoMusic Pro.
// Rodar:  node teste-regras-do-plugin.js      (0 = tudo OK, 1 = falhou)
//
// 🚨 POR QUE ESTE BANCO EXISTE (15/10/2026): a regra de qual servico a empresa
// vende para qual celebracao existia em DUAS copias - uma dentro do bot
// (`CELEBRACOES_POR_SERVICO`) e outra dentro do plugin. Mudar numa valia so de
// um lado, e quem descobria era o CLIENTE: em 13/10 o gerador ofereceu
// Cobertura Fotografica numa festa de 15 anos, servico que a empresa nao vende.
//
// 📌 O QUE ESTE BANCO MAIS PROTEGE: **a trava nao pode sumir.** O endpoint de
// preco gera valor para as 9 celebracoes; quem recusa e esta regra. Se ela
// virar "true" por falta de cache, de slug ou de resposta do site, o cliente
// recebe PDF de um servico que a empresa recusa vender.
//
// 🚨 NAO carrega `services/orcamentoGerado.js`: aquele arquivo puxa o bot
// inteiro e o processo nao termina (medido - o `node -e` com ele travou em
// 15/10). A logica de `usaOrcamentoGerado` e copiada aqui e a ESTRUTURA do
// arquivo real e medida por leitura, que e o que pega copia esquecida.

const fs = require("fs");
const path = require("path");

let falhas = 0;
function checa(cond, rotulo, dica) {
  if (!cond) falhas++;
  console.log((cond ? "[OK]    " : "[FALHOU]"), rotulo, cond ? "" : (dica ? "-> " + dica : ""));
}

const regras = require("./utils/regrasServico.js");

/* ============================================================
   1) O QUE O BANCO DO PLUGIN MANDA
   ============================================================ */
console.log("--- as regras vindas do plugin ---");
regras._definirCache({
  "fotografia":  { nome: "Cobertura Fotográfica", celebracoes: [3, 4, 5, 6, 7, 8, 9], automatico: [3, 4, 5], addon: false, no_site: true },
  "me-conta":    { nome: "Me Conta", celebracoes: [8, 9], automatico: [], addon: false, no_site: true },
  "guetbook-aniversario": { nome: "GuetBook Aniversário", celebracoes: [], automatico: [], addon: true, addon_de: ["foto-cabine"], no_site: true },
  "foto-cabine": { nome: "Foto Cabine", celebracoes: [], automatico: [], addon: false, no_site: true },
});

foreach15([1, 2], cel => checa(regras.atende("fotografia", cel) === false,
  `celebracao ${cel}: a empresa NAO vende Cobertura`,
  "era o caso de 13/10 - PDF de servico que a empresa recusa"));
foreach15([3, 4, 5], cel => checa(regras.automatico("fotografia", cel),
  `celebracao ${cel}: Cobertura sai com preco na hora`));
foreach15([6, 7, 8, 9], cel => checa(regras.aMao("fotografia", cel),
  `celebracao ${cel}: atende, proposta A MAO`,
  "corporativo pede proposta a dedo; preco de tabela aqui perde dinheiro"));

checa(regras.atende("me-conta", 9) && regras.atende("me-conta", 1) === false,
      "Me Conta: so empresa (8) e Outros (9)");
checa(regras.ehAddon("guetbook-aniversario"), "GuestBook e adicional");
checa(regras.ehAddon("foto-cabine") === false, "Foto Cabine nao e adicional");

console.log("\n--- lista vazia quer dizer TODAS (convencao do banco) ---");
checa(regras.atende("foto-cabine", 1) && regras.atende("foto-cabine", 9),
      "Foto Cabine atende as 9");
checa(regras.automatico("foto-cabine", 7), "e sai com preco em todas");
checa(regras.automatico("me-conta", 8),
      "`automatico` vazio = automatico onde atende",
      "senao todo servico sem a coluna preenchida viraria proposta a mao");

console.log("\n--- 🚨 servico DESCONTINUADO (Foto Maluca) ---");
/* Mario, 15/10/2026: "a foto maluca nao e utilizada, ela esta ali para
   servicos antigos pq estamos digitalizando os contratos antigos e antes da
   cabine existia o servico de foto maluca, ele nao existe mais". */
regras._definirCache({
  "foto-maluca": { nome: "Foto Maluca", celebracoes: [], automatico: [], addon: false, no_site: false, descontinuado: true },
  "foto-cabine": { nome: "Foto Cabine", celebracoes: [], automatico: [], addon: false, no_site: true, descontinuado: false },
});
checa(regras.descontinuado("foto-maluca"), "o bot sabe que a Foto Maluca saiu de linha");
[1, 3, 8, 9].forEach(cel => checa(regras.atende("foto-maluca", cel) === false,
  `celebracao ${cel}: Foto Maluca NAO e vendida`,
  "lista de celebracoes vazia quer dizer TODAS - sem o campo proprio ela seria oferecida em tudo"));
checa(regras.automatico("foto-maluca", 3) === false, "e nao sai com preco");
checa(regras.atende("foto-cabine", 1), "o vizinho continua normal");

console.log("\n--- servico que o plugin nao conhece ---");
regras._definirCache({});
checa(regras.atende("servico-novo-qualquer", 1), "servico sem regra nao e barrado");
checa(regras.automatico("servico-novo-qualquer", 1), "e sai com preco");

console.log("\n--- sem celebracao, nada e barrado ---");
checa(regras.atende("fotografia", null), "celebracao nula nao barra");
checa(regras.atende("fotografia", 0), "celebracao 0 nao barra");

/* ============================================================
   2) 🚨 O SITE FORA DO AR NAO PODE APAGAR A REGRA
   ============================================================ */
console.log("\n--- sem cache (site fora do ar na subida) ---");
regras._definirCache(null);           // zera: e o estado de quem nunca leu
checa(regras.SEMENTE.fotografia !== undefined,
      "existe SEMENTE no codigo, como rede",
      "sem ela, falha de rede = bot vendendo o que a empresa recusa");
checa(regras.atende("fotografia", 1) === false,
      "🚨 pela SEMENTE, 15 anos continua recusado",
      "e exatamente aqui que a regra sumiria calada");
checa(regras.automatico("fotografia", 8) === false,
      "pela SEMENTE, corporativo continua a mao");
checa(regras.atende("foto-cabine", 1),
      "servico sem semente segue liberado");

/* ============================================================
   3) usaOrcamentoGerado: a trava do PDF
   ============================================================ */
console.log("\n--- usaOrcamentoGerado (copia fiel da funcao real) ---");
const SERVICOS_GERADOS = [13, 1, 3, 2, 4, 5, 6, 7, 8];
const SLUG_POR_SERVICO = {
  1: "foto-cabine", 2: "totem", 3: "plataforma-360", 4: "foto-paparazzi",
  5: "foto-lembranca", 6: "fotografia", 7: "som-dj", 8: "iluminacao-pista",
  13: "totem-retro",
};
function usaOrcamentoGerado(servicoId, celebracao = null) {
  const id = Number(servicoId);
  if (!SERVICOS_GERADOS.includes(id)) return false;
  if (celebracao == null) return true;
  const slug = SLUG_POR_SERVICO[id];
  if (!slug) return true;
  return regras.automatico(slug, celebracao);
}

regras._definirCache({
  "fotografia": { celebracoes: [3, 4, 5, 6, 7, 8, 9], automatico: [3, 4, 5] },
});
checa(usaOrcamentoGerado(6, 1) === false, "Cobertura em 15 anos: NAO manda PDF gerado");
checa(usaOrcamentoGerado(6, 3) === true,  "Cobertura em infantil: manda");
checa(usaOrcamentoGerado(6, 8) === false, "Cobertura em corporativo: nao manda (a mao)");
checa(usaOrcamentoGerado(6) === true,     "sem celebracao, responde so pela migracao");
checa(usaOrcamentoGerado(99, 3) === false, "servico nao migrado nao usa o gerado");
checa(usaOrcamentoGerado(1, 1) === true,  "Foto Cabine vale em 15 anos");

console.log("\n--- 🚨 o Mario muda na TELA e o bot obedece ---");
/* Era isto que nao acontecia: com a lista no codigo, marcar Bodas como
   automatica na tela nao mudava NADA no WhatsApp. */
regras._definirCache({
  "fotografia": { celebracoes: [3, 4, 5, 6, 7, 8, 9], automatico: [3, 4, 5, 6] },
});
checa(usaOrcamentoGerado(6, 6) === true,
      "marcou Bodas como automatica: o bot passa a mandar preco",
      "com a lista no codigo isso exigia deploy");
regras._definirCache({
  "fotografia": { celebracoes: [3, 4, 5], automatico: [3, 4, 5] },
});
checa(usaOrcamentoGerado(6, 7) === false,
      "tirou Formatura do 'atende': o bot para de mandar preco");

/* ============================================================
   4) A ESTRUTURA: as copias acabaram
   ============================================================ */
console.log("\n--- as copias acabaram ---");
const og   = fs.readFileSync(path.join(__dirname, "services/orcamentoGerado.js"), "utf8");
const foto = fs.readFileSync(path.join(__dirname, "services/fotografia.js"), "utf8");
const idx  = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

/* 🚨 AS MEDICOES DE ESTRUTURA OLHAM SO O CODIGO. Duas vezes hoje um
   `includes`/regex simples acusou falha com o arquivo CERTO, porque o
   comentario que explica a mudanca CITA o trecho antigo - inclusive em
   linha de continuacao de bloco, que nao comeca com `*`. Teste que quebra
   por comentario treina a gente a ignorar teste. */
function soCodigo(txt) {
  return String(txt)
    .replace(/\/\*[\s\S]*?\*\//g, "")   // blocos /* ... */
    .replace(/(^|[^:])\/\/.*$/gm, "$1");       // linha //, poupando http://
}
const ogCod   = soCodigo(og);
const fotoCod = soCodigo(foto);
const idxCod  = soCodigo(idx);

checa(ogCod.includes("CELEBRACOES_POR_SERVICO") === false,
      "orcamentoGerado nao DECLARA mais a lista de celebracoes",
      "medir declaracao, nao a palavra: o comentario cita o nome antigo");
checa(ogCod.includes('require("../utils/regrasServico.js")'),
      "orcamentoGerado le as regras do plugin");
checa(/regrasServico\.automatico\(slug, celebracao\)/.test(ogCod),
      "a trava do PDF pergunta `automatico`");

checa(/clb === 1 \|\| clb === 2/.test(fotoCod) === false,
      "fotografia nao tem mais o 15 anos/casamento na mao",
      "marcar na tela nao mudava nada aqui");
checa(/clb === 3 \|\| clb === 4 \|\| clb === 5/.test(fotoCod) === false,
      "fotografia nao tem mais o 3/4/5 na mao");
checa(/\[6, 7, 8, 9\]\.includes\(clb\)/.test(fotoCod) === false,
      "fotografia nao tem mais o 6/7/8/9 na mao");
checa(/regrasServico\.atende\(SLUG_COBERTURA, clb\)/.test(fotoCod), "o ramo da recusa pergunta `atende`");
checa(/regrasServico\.automatico\(SLUG_COBERTURA, clb\)/.test(fotoCod), "o ramo do preco pergunta `automatico`");
checa(/regrasServico\.aMao\(SLUG_COBERTURA, clb\)/.test(fotoCod), "o ramo da proposta a mao pergunta `aMao`");
/* 🚨 A recusa dizia o nome da celebracao com um ternario de 2 opcoes. Com a
   regra no banco ela pode cair em qualquer uma - o ternario passaria a mentir. */
/* 🚨 Mede CODIGO, nao a palavra: o comentario logo acima da linha cita o
   ternario antigo para explicar por que ele saiu, e um `includes` simples
   acusava falha com o arquivo certo (aconteceu agora, 15/10). */
checa(fotoCod.includes('clb === 1 ? "15 anos"') === false,
      "a recusa nao escreve o nome da celebracao a mao",
      "com a regra no banco a recusa pode cair em qualquer celebracao");

checa(idxCod.includes("regrasServico.iniciar()"),
      "o bot le as regras na subida e renova sozinho",
      "sem isto o cache nunca enche e tudo roda pela semente");

console.log("");
if (falhas) { console.log(`RESULTADO: ${falhas} falha(s).`); process.exit(1); }
console.log("RESULTADO: tudo OK - a regra de venda vem do PhotoMusic Pro.");
process.exit(0);

/* Ajudante declarado no fim de proposito: `function` sobe (hoisting) e o
   banco se le de cima para baixo, na ordem dos casos. */
function foreach15(lista, fn) { lista.forEach(fn); }

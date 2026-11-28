// D:\PhotoMusic Produções\Blog\ChatBot\ChatPhotoMusic\teste-link-contratante.js
// 28/11/2026 (RJN): link do contratante no FIM da festa - sai a qualquer hora (nao segue a janela
// 10h-21h das comemorativas) e leva Instagram + avaliacao como a mensagem dos convidados.
// Rodar: node teste-link-contratante.js  (codigo de saida 0 = tudo ok)
const fs = require("fs");
const path = require("path");
const { mensagemDeEncerramento } = require("./jobs/avisosGaleria.js");

let falhas = 0, ok = 0;
function checar(n, c, d = "") { if (c) { ok++; console.log("✅ " + n); } else { falhas++; console.log("❌ " + n + "\n" + d); } }

const base = { contratante: "Carlos Diego dos Santos", tipo_celebracao: "", link_contratante: "https://photomusic.com.br/galeria/X/aceite/?tipo=contratante" };
let m = mensagemDeEncerramento(base);
checar("sem Me Conta: Instagram da PhotoMusic", /\*Instagram PhotoMusic\*/.test(m) && /instagram\.com\/photomusicproducoes/.test(m), m);
checar("sem Me Conta: avaliacao no Google da PhotoMusic", /Link para avaliação no Google/.test(m) && /g\.page\/r\/CVcwPOqAtId5EBM\/review/.test(m), m);
checar("link do contratante continua na mensagem", m.includes(base.link_contratante));
checar("redes antes da assinatura", m.indexOf("Instagram") < m.indexOf("Com carinho"));

m = mensagemDeEncerramento({ ...base, instagram: "@utec", instagram_nome: "UTEC", google_review: "https://g.page/r/FICTICIO/review" });
checar("com Me Conta: redes da empresa", /\*Instagram UTEC\*/.test(m) && /instagram\.com\/utec/.test(m) && /FICTICIO/.test(m), m);

const src = fs.readFileSync(path.join(__dirname, "jobs/avisosGaleria.js"), "utf8");
checar("sem a janela antiga das comemorativas", !/podeAgradecer|HORA_MIN_AGRADO|HORA_MAX_AGRADO/.test(src));

const { podeMandarLinkContratante: pode } = require("./jobs/avisosGaleria.js");
const sp = (s) => new Date(s + "-03:00");                  // horario de Brasilia
const seg = (d) => Math.floor(d.getTime() / 1000);
checar("festa acaba 22h: link sai 22h05", pode(seg(sp("2026-11-27T22:00:00")), sp("2026-11-27T22:05:00")));
checar("festa acaba 2h da manha: link sai 2h05", pode(seg(sp("2026-11-28T02:00:00")), sp("2026-11-28T02:05:00")));
checar("ATRASADO (fim 22h, agora 5h): espera", !pode(seg(sp("2026-11-27T22:00:00")), sp("2026-11-28T05:00:00")));
checar("ATRASADO: sai as 10h", pode(seg(sp("2026-11-27T22:00:00")), sp("2026-11-28T10:00:00")));
checar("sem fim_em (PhotoMusic Pro antigo): 5h espera, 22h sai", !pode(null, sp("2026-11-28T05:00:00")) && pode(null, sp("2026-11-27T22:30:00")));

console.log(`\n${ok} OK, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

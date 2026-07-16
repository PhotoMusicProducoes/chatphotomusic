// utils/pixBrCode.js
// Gera o "Pix Copia e Cola" (BR Code / payload EMV) ESTÁTICO a partir da chave.
// Sem valor fixo: a pessoa digita quanto quer dar no app do banco — é o certo
// para dízimo, oferta e doação (valor livre). Do mesmo payload sai o QR Code.
//
// Não depende de API externa nem da paróquia mandar o "copia e cola": geramos
// da chave + beneficiário + cidade. Técnica offline (mesmo espírito do QR do
// PhotoMusic). Padrão EMV-QRCPS do Banco Central.

// Remove acentos, deixa maiúsculo e corta no limite (nome 25, cidade 15).
function limpar(txt, max) {
  return String(txt || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // tira acento
    .replace(/[^A-Za-z0-9 ]/g, "")                      // só ASCII básico
    .toUpperCase()
    .trim()
    .slice(0, max);
}

// Campo EMV: ID (2) + tamanho (2, com zero à esquerda) + valor.
function campo(id, valor) {
  const len = String(valor.length).padStart(2, "0");
  return `${id}${len}${valor}`;
}

// CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF) — exigido no fim do payload.
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Monta o Pix Copia e Cola estático.
 * @param {object} p
 * @param {string} p.chave        chave Pix (CNPJ, celular, email, aleatória)
 * @param {string} p.beneficiario nome do recebedor (máx. 25, sem acento)
 * @param {string} p.cidade       cidade do recebedor (máx. 15, sem acento)
 * @returns {string} payload BR Code pronto (serve p/ copia-e-cola e p/ QR)
 */
function pixBrCode({ chave, beneficiario, cidade }) {
  const nome = limpar(beneficiario, 25) || "RECEBEDOR";
  const cid  = limpar(cidade, 15) || "BRASIL";

  const merchantAccount =
    campo("00", "br.gov.bcb.pix") +
    campo("01", String(chave));

  let payload =
    campo("00", "01") +                 // Payload Format Indicator
    campo("26", merchantAccount) +      // conta Pix
    campo("52", "0000") +               // categoria
    campo("53", "986") +                // moeda BRL
    campo("58", "BR") +                 // país
    campo("59", nome) +                 // beneficiário
    campo("60", cid) +                  // cidade
    campo("62", campo("05", "***"));    // txid livre

  payload += "6304";                    // ID+len do CRC
  payload += crc16(payload);            // CRC calculado sobre tudo, incl. "6304"
  return payload;
}

module.exports = { pixBrCode };

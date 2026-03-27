.htaccess — Proteção TOTAL do plugin

/wp-content/plugins/photomusic-pro/.htaccess


.htaccess (plugin root)
   ├── BLOQUEIO GERAL
   │       └── <Files "*"> Deny from all
   │
   ├── PERMISSÃO DE ASSETS PÚBLICOS
   │       └── <FilesMatch "\.(jpg|jpeg|png|gif|svg|css|js)$"> Allow from all
   │
   ├── BLOQUEIO DE EXECUÇÃO DE PHP
   │       └── <FilesMatch "\.(php|php5|php7|phtml)$"> Deny from all
   │
   ├── IMPEDIR LISTAGEM
   │       └── Options -Indexes
   │
   └── BLOQUEIO DE BOTS MALICIOSOS
           ├── BrowserMatchNoCase "AhrefsBot"
           ├── BrowserMatchNoCase "SemrushBot"
           ├── BrowserMatchNoCase "MJ12bot"
           ├── BrowserMatchNoCase "DotBot"
           ├── BrowserMatchNoCase "crawler"
           └── Deny from env=bad_bot


DESCRIÇÃO COMPLETA
Este arquivo protege toda a pasta do plugin PhotoMusic Pro contra acesso externo.
Ele impede que qualquer arquivo interno seja acessado diretamente, bloqueia execução de scripts PHP, impede listagem de diretórios e filtra bots maliciosos conhecidos.
Somente arquivos públicos (CSS, JS, imagens) podem ser acessados pelo navegador.

DESCRIÇÃO REDUZIDA
Protege toda a pasta do plugin contra acesso externo, execução de scripts e bots.
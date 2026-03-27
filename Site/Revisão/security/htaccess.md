.htaccess — Proteção da pasta security/

photomusic-pro/includes/security/.htaccess

.htaccess (security/)
   ├── BLOQUEIO TOTAL
   │       └── <Files "*"> Deny
   │
   ├── PERMITIR APENAS IMAGENS
   │       └── <FilesMatch "\.(jpg|jpeg|png|gif)$"> Allow
   │
   ├── BLOQUEIO DE SCRIPTS
   │       └── <FilesMatch "\.(php|php5|php7|phtml)$"> Deny
   │
   └── IMPEDIR LISTAGEM
           └── Options -Indexes



DESCRIÇÃO COMPLETA
Protege arquivos internos do plugin, como logs, tokens, chaves e dados sensíveis.
Impede acesso direto, bloqueia scripts e impede listagem da pasta.

DESCRIÇÃO REDUZIDA
Protege arquivos internos e impede execução de scripts.
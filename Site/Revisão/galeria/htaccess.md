.htaccess — Proteção da Galeria de Fotos

/wp-content/uploads/galeria/.htaccess

.htaccess (galeria)
   ├── BLOQUEIO TOTAL DE ACESSO DIRETO
   │       └── <Files "*"> Deny
   │
   ├── IMPEDIR EXECUÇÃO DE SCRIPTS
   │       └── <FilesMatch "\.(php|php5|php7|phtml)$"> Deny
   │
   ├── IMPEDIR LISTAGEM
   │       └── Options -Indexes
   │
   └── ANTI-HOTLINKING
           ├── RewriteEngine On
           ├── RewriteCond %{HTTP_REFERER} !photomusic.com.br
           └── RewriteRule \.(jpg|jpeg|png|gif|webp)$ - [F]


DESCRIÇÃO COMPLETA
A galeria contém fotos privadas de eventos.
Este arquivo impede acesso direto, bloqueia scripts, impede listagem e evita hotlinking.
Somente o endpoint seguro do PhotoMusic Pro pode entregar as imagens.

DESCRIÇÃO REDUZIDA
Protege a galeria contra acesso direto, hotlinking e scripts.
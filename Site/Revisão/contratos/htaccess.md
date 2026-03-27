.htaccess — Proteção de PDFs de contratos

/wp-content/uploads/contratos/.htaccess


.htaccess (contratos)
   ├── BLOQUEIO DE EXECUÇÃO DE SCRIPTS
   │       └── <FilesMatch "\.(php|php5|php7|phtml)$"> Deny
   │
   ├── BLOQUEIO DE ACESSO DIRETO A PDFs
   │       └── <FilesMatch "\.(pdf)$"> Deny
   │
   └── IMPEDIR LISTAGEM
           └── Options -Indexes


DESCRIÇÃO COMPLETA
Este arquivo impede que PDFs de contratos sejam acessados diretamente via URL.
Somente o sistema pode entregar esses arquivos, garantindo privacidade e segurança jurídica.
Também bloqueia execução de scripts e impede listagem da pasta.

DESCRIÇÃO REDUZIDA
Bloqueia acesso direto a PDFs de contratos e impede execução de scripts.
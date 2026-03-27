PhotoMusic_Galeria_Routes
   ├── __construct()
   │       ├── add_rewrite_rules()
   │       ├── add_query_vars()
   │       └── route_handler()
   │
   ├── add_rewrite_rules()
   │       ├── /galeria/{slug}/aceite/
   │       └── /galeria/{slug}/
   │
   ├── add_query_vars()
   │       ├── pm_evento_slug
   │       └── pm_galeria_acao
   │
   └── route_handler()
           ├── valida slug e ação
           ├── carrega evento
           ├── valida status
           ├── SE ação = aceite:
           │       ├── processar_aceite()
           │       └── render_form()
           └── SE ação = galeria:
                   └── controller->handle_request()


MAPA DAS TABELAS USADAS
Tabela	    Uso
pm_eventos	Busca evento pelo slug e valida status

DESCRIÇÃO OFICIAL — PhotoMusic_Galeria_Routes
Gerencia todas as rotas amigáveis da galeria protegida do PhotoMusic Pro.
Converte URLs como /galeria/{evento}/aceite/ e /galeria/{evento}/ em chamadas para os controladores responsáveis pelo aceite e pela exibição da galeria.
Valida o evento, carrega controladores, aplica segurança e integra com o fluxo completo de acesso protegido.
PhotoMusic_WhatsApp_Settings
   ├── init()
   │       ├── add_action('admin_menu', register_settings_page)
   │       └── add_action('admin_init', register_settings)
   │
   ├── register_settings_page()
   │       └── add_submenu_page('photomusic-eventos', 'WhatsApp', ...)
   │
   ├── register_settings()
   │       ├── registra pm_whatsapp_provider
   │       ├── registra DSLBoot:
   │       │       pm_dslboot_url
   │       │       pm_dslboot_key
   │       ├── registra LumaBoot:
   │       │       pm_lumaboot_url
   │       │       pm_lumaboot_key
   │       ├── registra API genérica:
   │       │       pm_generic_api_url
   │       │       pm_generic_api_key
   │       └── registra templates:
   │               pm_msg_convite
   │               pm_msg_contratante
   │
   └── render_page()
           ├── formulário de configurações
           ├── seleção de provedor
           ├── campos DSLBoot
           ├── campos LumaBoot
           ├── campos API genérica
           ├── templates de mensagens
           └── submit_button()


MAPA DAS OPÇÕES USADAS

Option	                Uso
pm_whatsapp_provider	Provedor selecionado
pm_dslboot_url	        URL da API DSLBoot
pm_dslboot_key	        Chave DSLBoot
pm_lumaboot_url	        URL LumaBoot
pm_lumaboot_key	        Chave LumaBoot
pm_generic_api_url	    URL API genérica
pm_generic_api_key	    Chave API genérica
pm_msg_convite	        Template de mensagem de convite
pm_msg_contratante	    Template de mensagem do contratante

DESCRIÇÃO OFICIAL — PhotoMusic_WhatsApp_Settings
Gerencia todas as configurações de envio de WhatsApp no PhotoMusic Pro.
Permite selecionar o provedor (DSLBoot, LumaBoot ou API Genérica), configurar URLs e chaves de API, além de definir templates de mensagens para convites e contratantes.
É a camada administrativa que controla o comportamento do módulo de comunicação automática.
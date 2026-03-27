PhotoMusic_Helpers_Representantes
   ├── get_representante_padrao()
   │       └── retorna o primeiro usuário com meta pm_representante_legal = 1
   │
   ├── get_todos()
   │       └── retorna todos os representantes legais cadastrados
   │
   ├── get_dados(user_id)
   │       ├── retorna:
   │       │       id
   │       │       nome
   │       │       email
   │       │       cargo
   │       │       cpf
   │       │       telefone
   │       │       pode_assinar
   │       └── SE usuário não existe → null
   │
   ├── usuario_pode_assinar(user_id)
   │       └── verifica meta pm_assinar_contratos = 1
   │
   └── get_dados_para_pdf()
           ├── pega representante padrão
           └── retorna dados formatados para PDF


MAPA DAS TABELAS USADAS
✔ wp_users
ID
display_name
user_email

✔ wp_usermeta
Metas usadas:
pm_representante_legal
pm_representante_cargo
pm_representante_cpf
pm_representante_telefone
pm_assinar_contratos


DESCRIÇÃO OFICIAL — PhotoMusic_Helpers_Representantes
Classe auxiliar responsável por fornecer dados estruturados dos representantes legais da empresa.
Permite recuperar o representante padrão, listar todos os representantes, validar permissões de assinatura e fornecer dados formatados para uso no PDF e nas cláusulas do contrato.
É utilizada internamente pelos módulos de contratos, PDF e cláusulas.
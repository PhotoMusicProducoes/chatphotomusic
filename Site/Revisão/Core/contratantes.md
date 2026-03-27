DIAGRAMA COMPLETO - includes/core/class-photomusic-contratantes.php

PhotoMusic_Contratantes
   ├── table()
   │       └── retorna nome da tabela pm_contratantes
   │
   ├── create_pf($data)
   │       ├── monta array $insert:
   │       │       tipo = PF
   │       │       nome
   │       │       cpf
   │       │       rg
   │       │       rg_orgao
   │       │       data_nascimento
   │       │       parentesco
   │       │       telefone
   │       │       email
   │       │       instagram
   │       │       facebook
   │       │       logradouro
   │       │       numero
   │       │       complemento
   │       │       bairro
   │       │       cidade
   │       │       estado
   │       │       cep
   │       │       criado_em = now()
   │       ├── INSERT INTO pm_contratantes
   │       └── return insert_id
   │
   ├── create_pj($data)
   │       ├── monta array $insert:
   │       │       tipo = PJ
   │       │       nome_fantasia
   │       │       razao_social
   │       │       cnpj
   │       │       representante_nome
   │       │       representante_cpf
   │       │       representante_rg
   │       │       representante_rg_orgao
   │       │       representante_data_nascimento
   │       │       representante_celular
   │       │       telefone
   │       │       email
   │       │       instagram
   │       │       facebook
   │       │       logradouro
   │       │       numero
   │       │       complemento
   │       │       bairro
   │       │       cidade
   │       │       estado
   │       │       cep
   │       │       criado_em = now()
   │       ├── INSERT INTO pm_contratantes
   │       └── return insert_id
   │
   ├── update_pf($id, $data)
   │       ├── monta array $update:
   │       │       nome
   │       │       cpf
   │       │       rg
   │       │       rg_orgao
   │       │       data_nascimento
   │       │       parentesco
   │       │       telefone
   │       │       email
   │       │       instagram
   │       │       facebook
   │       │       logradouro
   │       │       numero
   │       │       complemento
   │       │       bairro
   │       │       cidade
   │       │       estado
   │       │       cep
   │       ├── UPDATE pm_contratantes SET ... WHERE id = ?
   │       └── return resultado
   │
   ├── update_pj($id, $data)
   │       ├── monta array $update:
   │       │       nome_fantasia
   │       │       razao_social
   │       │       cnpj
   │       │       representante_nome
   │       │       representante_cpf
   │       │       representante_rg
   │       │       representante_rg_orgao
   │       │       representante_data_nascimento
   │       │       representante_celular
   │       │       telefone
   │       │       email
   │       │       instagram
   │       │       facebook
   │       │       logradouro
   │       │       numero
   │       │       complemento
   │       │       bairro
   │       │       cidade
   │       │       estado
   │       │       cep
   │       ├── UPDATE pm_contratantes SET ... WHERE id = ?
   │       └── return resultado
   │
   ├── get($id)
   │       ├── SELECT * FROM pm_contratantes WHERE id = ?
   │       └── retorna objeto contratante
   │
   └── get_by_event($id_evento)
           ├── SELECT id_contratante FROM pm_contratos WHERE id_evento = ?
           ├── SE não encontrou → return null
           └── return get(id_contratante)

MAPA DAS TABELAS USADAS
pm_contratantes
pm_contratos   (apenas para get_by_event)

DESCRIÇÃO OFICIAL DA CLASSE — PhotoMusic_Contratantes
Gerencia todos os dados de contratantes PF e PJ do PhotoMusic Pro.  
Permite criar, atualizar e consultar contratantes, incluindo dados pessoais, documentos, endereço e informações de representante legal.
Também permite localizar o contratante vinculado a um evento através dos contratos.
É a camada central de cadastro de clientes do sistema.

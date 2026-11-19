# 👥 Gestão de Estagiários e Funcionários — Google Sheets + Apps Script

Solução criada para **facilitar a organização de estagiários** em um setor de trabalho. Ela funciona dentro de uma **Planilha Google**, com **Google Apps Script**.

## 💡 Por que este projeto existe

Organizar uma equipe de estagiários dá trabalho. Os contratos têm prazo curto e são renovados com frequência. As férias precisam ser negociadas uma a uma. Cada pessoa tem um horário diferente, e a escala de atendimento muda toda semana. Quando tudo isso fica espalhado em várias planilhas, informações se perdem, contratos vencem sem aviso e as férias se sobrepõem.

Este sistema reúne tudo em um só lugar:

- **Contratos de estágio:** início, fim, renovação e aviso de vencimento.
- **Férias:** períodos, divisão 15 + 15 e acompanhamento da negociação.
- **Horários e escala semanal:** quem está em cada posto, em cada turno.
- **Lista de presença:** com cálculo de atraso e histórico.
- **Painel de consulta:** mostra a situação da equipe de uma vez.

Tudo é feito por um menu próprio e por janelas de formulário, sem editar células à mão.

> O foco principal são os **estagiários**, mas o sistema também aceita outros vínculos (como contratados temporários e servidores efetivos) que trabalham na mesma equipe.

---

## ✨ Funcionalidades

| Módulo | O que faz |
|---|---|
| **Funcionários e contratos** | Cadastro, renovação, alteração de dados, troca de nome, suspensão, reativação e encerramento de contratos. IDs automáticos (`FUNC-0001`, `CONT-0001`). |
| **Férias** | Períodos 1º/2º, divisão 15 + 15, status (*Pendente → Aguardando → Prevista → Tirada* / *Sem direito*), validação de datas e rotina diária automática. |
| **Horários** | Horário de entrada/saída de segunda a sexta, com opção de aplicar o mesmo horário a várias pessoas. |
| **Distribuição** | Escala semanal por posição/posto e turno (*Manhã, Tarde, Manhã+Tarde, Integral*), com regras de jornada por tipo de vínculo. |
| **Lista de presença** | Lançamento diário ou semanal (*Presente, Ausente, Atrasado, Justificado, Férias, Folga*), cálculo de atraso em minutos e consulta de histórico. |
| **Consulta (painel)** | Painel na própria planilha com indicadores, contratos a vencer, pendências e calendário anual de férias. |
| **Histórico / auditoria** | Toda alteração fica registrada (quem, quando, campo, valor anterior e novo). Há ferramentas de auditoria de dados e de gatilhos. |

---

## 🗂️ Estrutura do projeto

```
├── Config.js              # Todas as configurações (abas, colunas, regras, cores, textos)
├── Code.js                # Testes automatizados e verificação da instalação
├── Triggers.js            # Rotina diária de férias e gatilhos
├── Auditoria.js           # Auditoria de dados, validações e desempenho
├── Repositories/          # Leitura e gravação em cada aba (camada de dados)
├── Services/              # Regras de negócio (contratos, férias, presença, etc.)
├── UI/                    # Menu, painel Consulta e janelas HTML
├── Styles/                # CSS das janelas
├── Utils/                 # Datas, IDs, validação e acesso à planilha
├── appsscript.json        # Manifesto do Apps Script (fuso, runtime V8)
└── .clasp.example.json    # Modelo de configuração do clasp
```

O código segue três camadas: **UI → Services → Repositories**. As colunas são localizadas pelo **texto do cabeçalho**, nunca pela posição, então você pode reordenar as colunas da planilha à vontade.

---

## ✅ Pré-requisitos

- Uma conta Google (pessoal ou Workspace).
- Para instalar pelo terminal (opção A): [Node.js](https://nodejs.org/) 18 ou superior.

---

## 🚀 Instalação passo a passo

### 1. Crie a planilha

1. Acesse [sheets.new](https://sheets.new) e crie uma planilha em branco.
2. Dê um nome a ela (por exemplo, *Gestão de Pessoas*).
3. Em **Arquivo → Configurações**, defina a **localidade** como *Brasil* e o **fuso horário** como *(GMT-03:00) São Paulo*.

### 2. Crie as abas com os cabeçalhos

Crie as abas abaixo **com exatamente estes nomes** e escreva os cabeçalhos na **linha 1**. A ordem das colunas não importa, mas o texto precisa ser idêntico (acentos inclusive).

> As abas **Consulta** e **Presença** são criadas automaticamente pelo sistema e não precisam ser criadas à mão.

<details>
<summary><b>Funcionários</b></summary>

`ID do contrato` · `ID do funcionário` · `Nome completo` · `Cargo` · `Setor` · `Tipo de vínculo` · `Início do contrato` · `Fim do contrato` · `Duração` · `Status` · `Data de desligamento` · `Observações`
</details>

<details>
<summary><b>Férias</b></summary>

`ID do contrato` · `ID do funcionário` · `Nome` · `Período (1º / 2º)` · `Início das férias` · `Fim das férias` · `Dias` · `Deseja 15 dias` · `Status` · `Observações`
</details>

<details>
<summary><b>Horários</b></summary>

`ID do funcionário` · `Nome` · `Segunda — De` · `Segunda — Até` · `Terça — De` · `Terça — Até` · `Quarta — De` · `Quarta — Até` · `Quinta — De` · `Quinta — Até` · `Sexta — De` · `Sexta — Até`

> O separador é o travessão `—` (não o hífen `-`).
</details>

<details>
<summary><b>Preferências</b></summary>

`ID do contrato` · `ID do funcionário` · `Nome` · `Deseja dividir férias?` · `Preferência do primeiro período` · `Preferência do segundo período` · `Observações`
</details>

<details>
<summary><b>Distribuição</b></summary>

`ID do funcionário` · `Nome` · `Setor` · `Posição` · `Segunda` · `Terça` · `Quarta` · `Quinta` · `Sexta` · `Observações`
</details>

<details>
<summary><b>Histórico</b></summary>

`Data e hora` · `Usuário` · `ID do funcionário` · `ID do contrato` · `Operação` · `Campo alterado` · `Valor anterior` · `Novo valor`
</details>

### 3. Envie o código para o Apps Script

Escolha **uma** das opções.

#### Opção A — Pelo terminal, com o `clasp` (recomendado)

```bash
# 1. Instale o clasp e faça login na sua conta Google
npm install -g @google/clasp
clasp login

# 2. Clone este repositório
git clone https://github.com/DiBlusa/EMP.git
cd EMP
```

3. Na planilha, abra **Extensões → Apps Script**. Isso cria um projeto vinculado à planilha.
4. No editor do Apps Script, vá em **⚙️ Configurações do projeto** e copie o **ID do script**.
5. Ative a API do Apps Script em <https://script.google.com/home/usersettings>.
6. Crie o arquivo de configuração local a partir do modelo:

```bash
cp .clasp.example.json .clasp.json
# edite .clasp.json e troque COLE_AQUI_O_ID_DO_SEU_SCRIPT pelo ID copiado
```

7. Envie os arquivos:

```bash
clasp push
```

> O `.clasp.json` está no `.gitignore` para que o ID do seu script não vá parar no GitHub.

#### Opção B — Copiando e colando no editor

1. Na planilha, abra **Extensões → Apps Script**.
2. Para cada arquivo `.js` deste repositório, crie um arquivo **Script** com o mesmo caminho (ex.: `Services/FeriasService`) e cole o conteúdo. Comece pelo `Config`.
3. Para cada arquivo `.html`, crie um arquivo **HTML** com o mesmo caminho (ex.: `UI/DialogFuncionario`, `Styles/Estilos`).
4. Em **⚙️ Configurações do projeto**, marque *Mostrar o arquivo de manifesto "appsscript.json"* e substitua o conteúdo dele pelo deste repositório.
5. Salve tudo (`Ctrl + S`).

> Os nomes precisam ter as pastas (`UI/`, `Styles/`), porque as janelas incluem arquivos pelo caminho, por exemplo `incluirArquivoHtml('Styles/Estilos')`.

### 4. Personalize o `Config.js`

Abra o `Config.js` e ajuste pelo menos:

```js
CONSULTA: {
  TITULO: 'Gestão de Estagiários e Funcionários',
  ORGAO: 'Nome do Órgão',     // ← nome da sua instituição
  SETOR: 'Nome do Setor',     // ← nome do seu setor
  BRASAO_URL: '',             // ← (opcional) link público de uma imagem de logotipo
  ...
},

CARGOS: [],    // ← ex.: ['Assistente', 'Analista']
SETORES: [],   // ← ex.: ['Atendimento', 'Financeiro']

PRESENCA: {
  EMAILS_AUTORIZADOS: [],     // vazio = qualquer pessoa com acesso à planilha pode lançar presença
  ...
}
```

Outras opções úteis:

| Chave | Para que serve |
|---|---|
| `TIPOS_VINCULO` | Tipos de vínculo aceitos (padrão: `Estágio`, `PSS`, `Cargo`). |
| `JORNADA` | Horários padrão e minutos de almoço por vínculo. |
| `FERIAS.MESES_PARA_FERIAS` | Meses de contrato antes de criar o 1º período (0 = imediato). |
| `FERIAS.HORA_ROTINA_DIARIA` | Hora em que a rotina automática de férias roda. |
| `CONSULTA.DIAS_AVISO_VENCIMENTO` | Antecedência (dias) para avisar contratos a vencer. |
| `CONSULTA.CORES` | Paleta do painel Consulta. |

Se usou o `clasp`, rode `clasp push` de novo depois de editar.

### 5. Autorize e ative o sistema

1. Volte à planilha e **recarregue a página** (F5). O menu **👥 Funcionários** aparece na barra superior.
2. Clique em qualquer item do menu. Na primeira vez, o Google pede autorização: escolha sua conta → **Avançado** → **Acessar (não seguro)** → **Permitir**.
   > O aviso aparece porque o script é seu e não foi publicado pelo Google. Ele só acessa a planilha à qual está vinculado.
3. Em **👥 Funcionários → 🛠️ Manutenção**, rode na ordem:
   1. **🔍 Verificar instalação**: confere se todos os arquivos e funções estão no projeto.
   2. **📝 Aplicar listas suspensas nas abas**: cria as validações (vínculo, status, turno…).
   3. **⚙️ Configurar automações**: instala o gatilho diário de férias.
4. Clique em **📊 Atualizar Consulta** para gerar o painel.

### 6. (Opcional) Rode os testes

No editor do Apps Script, selecione a função `executarTodosOsTestes` e clique em **▶ Executar**.

Os testes criam registros temporários com nomes iniciados por `Zz Teste…` e os removem no final. **Rode-os de preferência numa cópia da planilha**, porque `testarEtapa5` redesenha a aba Consulta.

---

## 📖 Como usar

Tudo é feito pelo menu **👥 Funcionários**:

1. **➕ Cadastrar funcionário**: informe nome, vínculo, cargo, setor e datas do contrato. Os períodos de férias são criados sozinhos.
2. **🕘 Horários de trabalho** e **🗂️ Distribuição do balcão**: defina a jornada e a escala semanal.
3. **🏖️ Atualizar período de férias**: registre as datas combinadas e mude o status.
4. **📋 Lista de presença**: marque a presença do dia ou da semana e consulte o histórico.
5. **🔁 Renovar / ⏸️ Suspender / ⛔ Desativar contrato**: gerencie o ciclo de vida do contrato.
6. **📊 Atualizar Consulta**: veja o painel com indicadores e o calendário de férias.

> Evite editar as abas de dados diretamente. Use as janelas do menu: elas validam os dados, mantêm os nomes sincronizados entre as abas e gravam o histórico.

---

## 🛠️ Solução de problemas

| Problema | Solução |
|---|---|
| O menu não aparece | Recarregue a planilha. Se continuar, rode `onOpen` pelo editor do Apps Script. |
| `A aba "X" não foi encontrada` | Confira o nome da aba (acentos e maiúsculas) com o passo 2. |
| Erro de cabeçalho ausente | Algum cabeçalho da linha 1 está diferente do esperado. A mensagem lista quais. |
| Funções faltando | Rode **🔍 Verificar instalação**: ele diz qual arquivo está faltando ou desatualizado. |
| Rotina de férias não roda | Rode **⚙️ Configurar automações** (remove gatilhos duplicados e instala o que falta). |
| Lentidão | Rode **⏱️ Medir desempenho**. Etapas acima de 3 s merecem atenção. |

---

## 🔒 Privacidade

- Nenhum dado sai da sua planilha: o script não usa serviços externos.
- O histórico guarda o e-mail de quem fez cada alteração, para fins de auditoria.
- **Nunca publique no repositório** o seu `.clasp.json`, exportações da planilha ou dados reais de funcionários.

---

## 📄 Licença

Este projeto é **open source** e está sob a [Licença MIT](LICENSE).

Qualquer pessoa ou instituição pode **usar, copiar, modificar e distribuir** o sistema livremente, inclusive para uso comercial. A única condição é manter o aviso de copyright e a licença nas cópias.

## 🤝 Contribuições

Contribuições são bem-vindas! Se você encontrou um problema ou tem uma ideia de melhoria:

1. Abra uma [issue](../../issues) descrevendo o problema ou a sugestão.
2. Ou faça um *fork*, crie uma *branch* com a sua alteração e abra um *pull request*.

> Antes de enviar, rode `executarTodosOsTestes` numa cópia da planilha e confira se todos os testes passam. Nunca inclua dados reais de funcionários nas contribuições.

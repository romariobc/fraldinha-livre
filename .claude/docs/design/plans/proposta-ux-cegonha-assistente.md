# Estudo e Planejamento de UX: Personificação da Cegonha & Acessibilidade do Assistente

Este documento apresenta uma proposta conceitual e de design de interface (UX/UI) para a personificação do assistente inteligente de compras do **Fraldinha Livre** com a figura da **Cegonha**, além de planejar a visibilidade e descoberta (discoverability) deste recurso na aplicação.

---

## 1. 🐣 A Persona: Dona Cegonha

A cegonha já é a identidade visual central do Fraldinha Livre (presente na logo do cabeçalho). Transformar esse elemento gráfico no assistente conversacional dá vida à marca, tornando-a humana, amigável e memorável.

### Diretrizes de Personificação
* **Nome**: **Dona Cegonha** (ou simplesmente **Cegonha**). Traz um tom caloroso, experiente e acolhedor (remetendo ao cuidado de mãe/avó/tia).
* **Avatar Visual**: Uma ilustração da cegonha no topo do chat e em todas as mensagens do assistente. Idealmente, uma versão simpática (ex: usando óculos de leitura, bico sorridente ou carregando uma fralda/pacote no bico).
* **Tom de Voz Conversacional (Tone of Voice)**:
  * **Empático e Cuidadoso**: Entende a rotina cansativa de pais de bebês e a pressa de compradores corporativos de creches/hospitais.
  * **Temática Leve (Vocabulário da Persona)**:
    * *"Abastecer o ninho"* ou *"Preparar o ninho"* (em vez de "fazer uma compra").
    * *"Bicar as melhores ofertas"* ou *"Bicar o estoque"* (em vez de "procurar no banco de dados").
    * *"Bater asas"* (em vez de "enviar a entrega").
  * **Conversas Diretas**: Fazer perguntas curtas e diretas, guiando o comprador sem sobrecarregá-lo de textos longos.

---

## 2. 🗺️ Descobrabilidade: Onde Posicionar os Links de Acesso?

Atualmente, a rota `/assistente` está oculta e exige digitação direta da URL. Propomos quatro pontos estratégicos de acesso na interface do usuário (com níveis de impacto visual diferentes):

### Opção A: Destaque no Menu Superior (Header)
* **Design**: Adicionar aos links principais do `Header.tsx` (ao lado de *Catálogo* ou *Contato*).
* **Visual**: Usar uma etiqueta visual diferente, como `✨ Assistente Inteligente` ou `💬 Falar com a Cegonha` com um sutil efeito de badge colorido ou animação de pulso.
* **Vantagem**: Acesso universal e rápido de qualquer página da plataforma.

### Opção B: Seção e CTA na Página Inicial (Home Page)
* **Design**: Criar uma seção dedicada ou banner promocional na Home (`front/src/app/(main)/page.tsx`), logo abaixo da seção de marcas ou junto ao fluxo "Como Funciona".
* **Visual**:
  * Ilustração ampliada da Cegonha com uma caixa de diálogo: *"Olá! Não sabe que tamanho escolher ou quer comparar marcas? Eu posso montar sua sacola de compras em segundos no chat!"*.
  * Botão de ação (CTA) destacado: `💬 Conversar com a Cegonha`.
* **Vantagem**: Excelente onboarding de conversão para novos usuários que chegam pela landing page.

### Opção C: Atalho Dedicado na Área do Comprador (Minha Conta)
* **Design**: Adicionar um banner ou link fixo no painel principal da conta do comprador (`/minha-conta`).
* **Visual**: Um card informativo de boas-vindas: *"Olá, [Nome]! Precisa reabastecer o ninho hoje? [Chamar a Cegonha]"*.
* **Vantagem**: Focado no usuário recorrente que já está logado e conhece o sistema, mas deseja praticidade para refazer compras.

### Opção D: Widget Flutuante Persistente (Floating Chat Bubble)
* **Design**: Um botão flutuante redondo e discreto no canto inferior direito de todas as telas (ou das páginas de navegação e catálogo).
* **Visual**: O rosto ou ícone da Cegonha. Ao passar o mouse, exibe um balãozinho: *"Dúvidas sobre fraldas? Pergunte para mim!"*.
* **Vantagem**: Segue o padrão estabelecido da web para assistentes virtuais e não ocupa espaço fixo no layout de navegação.

---

## 3. 💬 Experiência de Chat Enriquecida (UX Conversacional)

Além do visual da Cegonha, a própria dinâmica do chat pode ser melhorada para aumentar a conversão de vendas:

### A. Respostas Rápidas / Botões de Sugestão (Quick Replies)
No início do chat ou após buscas vazias, exibir pílulas clicáveis embaixo da caixa de entrada de texto:
* `[ 🔎 Fraldas G da Huggies ]`
* `[ 🤑 Ver ofertas do dia ]`
* `[ 🍼 Como calcular quantidades? ]`
* **Vantagem**: Reduz a barreira de digitação do usuário e o ajuda a entender o que o assistente consegue fazer.

### B. Apresentação de Produtos Ricos (Rich Cards)
Em vez de responder com texto plano enumerando os produtos, o chat pode renderizar pequenos componentes visuais (Cards de Produto) contendo:
* Imagem do produto.
* Título, tamanho e quantidade de tiras.
* Preço em destaque.
* Botão `[ Adicionar à Sacola ]`.

### C. Fluxo de Checkout Suave (Non-Disruptive Purchase)
Atualmente, quando a IA identifica o produto que o usuário quer comprar, ela adiciona na sacola e redireciona o usuário bruscamente para `/checkout`.
* **Melhoria de UX**: O assistente deve adicionar o item na sacola e manter o usuário no chat, enviando um link/botão para finalização: *"Adicionei 2 pacotes de Pampers M à sua sacola. Gostaria de ir para o checkout para pagar ou quer procurar mais alguma coisa?"* com botões de `[ Ir para o Pagamento ]` ou `[ Continuar Conversa ]`.

---

## 🙋 Perguntas para Discussão e Decisão (Sem Codificação)

Antes de iniciar qualquer código, vamos alinhar as preferências sobre este fluxo:

1. **Qual a sua combinação preferida de Pontos de Acesso?** (Recomendado: Menu Superior + Card na Home Page + Widget Flutuante apenas em páginas de catálogo).
2. **Como você prefere que a Cegonha seja apresentada visualmente no avatar do chat?**
   * Opção 1: Ilustração da cegonha inteira (semelhante ao logo do Header).
   * Opção 2: Apenas o rosto ilustrado estilizado (ideal para avatares circulares de chat).
3. **Qual tom conversacional você prefere?**
   * Opção A: Bastante lúdico (usando palavras como "ninho", "bicar", "bebês", etc.).
   * Opção B: Mais corporativo/direto (mantendo o respeito e a agilidade, mas com uma saudação e avatar simpáticos de cegonha).

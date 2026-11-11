# Grid Padrão Profissional

Este diretório contém todos os arquivos necessários para implementar um grid profissional altamente customizável em qualquer tela do sistema.

## O que está incluso:
1. **StandardDataGrid.tsx**: Componente React principal com Drag & Drop, Resize, Ordenação e Renderização dinâmica.
2. **use-dynamic-grid.ts**: Hook para gerenciamento de estado e ordenação.
3. **grid-config.ts**: Utilitários para salvar configurações por usuário (largura, ordem, visibilidade).
4. **grid-render-utils.tsx**: Lógica de renderização de células (Tags, Destaques, Moedas) e Totalizadores.
5. **generic-route.ts**: Template de API Node.js/Next.js para busca dinâmica com Joins automáticos.

## Como importar para uma nova tela:

### 1. Preparação da Tela (Page)
Utilize o seguinte prompt:
> "Transforme esta tela em um grid profissional utilizando os componentes da pasta `grid_padrao`. 
> A entidade principal é [NOME_ENTIDADE] e o ID do grid deve ser [GRID_ID].
> Implemente as configurações de coluna, redimensionamento e ordenação."

### 2. Configuração da API
Copie o arquivo `generic-route.ts` para a rota da sua nova entidade e ajuste as constantes no topo:
```typescript
const TABLE_NAME = 'sua_tabela';
const MODULE_NAME = 'SeuModulo';
const GRID_ID = 'seu_grid_id';
```

## Funcionalidades Prontas:
- **Resizing**: Arraste a borda da coluna para redimensionar.
- **Reordering**: Arraste o cabeçalho para mudar a ordem das colunas.
- **Sorting**: Clique no ícone de ordenação (Crescente -> Decrescente -> Natural).
- **Custom SQL**: Suporte a SQL customizado via configurações.
- **Dynamic Joins**: Se uma coluna for configurada com "Tabela Display", o Join é feito automaticamente na API.
- **Filtering**: Filtros inteligentes iniciados por string (LIKE "valor%").

export interface GridColumnConfig {
  nome_do_modulo: string;
  nome_do_grid: string;
  nome_da_coluna: string;
  largura_da_coluna: string;
  visivel?: boolean;
  ordem?: number;
  tipo_apresentacao?: 'texto' | 'numero' | 'moeda' | 'inteiro' | 'data';
  tabela_display?: string;
  sql_custom?: string;
  label?: string;
  estilo_apresentacao?: 'Normal' | 'Tag' | 'Destaque';
  totalizador?: 'Nenhum' | 'Soma' | 'Média' | 'Contagem';
}

export async function getGridConfigs(): Promise<GridColumnConfig[]> {
  try {
    const res = await fetch('/api/user/config-grid');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Error fetching grid configs:', err);
  }
  return [];
}

export function getColumnWidth(gridName: string, colName: string, defaultWidth: string = '150px', configs: GridColumnConfig[] = []): string {
  const config = configs.find(c => c.nome_do_grid === gridName && c.nome_da_coluna === colName);
  return config?.largura_da_coluna || defaultWidth; 
}

export function saveColumnWidth(gridName: string, colName: string, width: string) {
  console.log(`Saving width for ${gridName}.${colName}: ${width}`);
}

export async function deleteGridConfigColumn(modulo: string, gridName: string, colName: string) {
  try {
    const currentConfigs = await getGridConfigs();
    const updatedConfigs = currentConfigs.filter(c => 
      !(c.nome_do_modulo === modulo && c.nome_do_grid === gridName && c.nome_da_coluna === colName)
    );
    
    await fetch('/api/user/config-grid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedConfigs)
    });
  } catch (err) {
    console.error('Error deleting grid config:', err);
  }
}
export async function saveGridConfigs(newConfigs: GridColumnConfig[]) {
  try {
    const currentConfigs = await getGridConfigs();
    
    const updatedConfigs = [...currentConfigs];
    
    newConfigs.forEach(newCfg => {
      const idx = updatedConfigs.findIndex(c => 
        c.nome_do_modulo === newCfg.nome_do_modulo && 
        c.nome_do_grid === newCfg.nome_do_grid && 
        c.nome_da_coluna === newCfg.nome_da_coluna
      );
      
      if (idx !== -1) {
        updatedConfigs[idx].largura_da_coluna = newCfg.largura_da_coluna;
        if (newCfg.visivel !== undefined) updatedConfigs[idx].visivel = newCfg.visivel;
        if (newCfg.ordem !== undefined) updatedConfigs[idx].ordem = newCfg.ordem;
        if (newCfg.tipo_apresentacao !== undefined) updatedConfigs[idx].tipo_apresentacao = newCfg.tipo_apresentacao;
        if (newCfg.tabela_display !== undefined) updatedConfigs[idx].tabela_display = newCfg.tabela_display;
        if (newCfg.sql_custom !== undefined) updatedConfigs[idx].sql_custom = newCfg.sql_custom;
        if (newCfg.label !== undefined) updatedConfigs[idx].label = newCfg.label;
        if (newCfg.estilo_apresentacao !== undefined) updatedConfigs[idx].estilo_apresentacao = newCfg.estilo_apresentacao;
        if (newCfg.totalizador !== undefined) updatedConfigs[idx].totalizador = newCfg.totalizador;
      } else {
        updatedConfigs.push(newCfg);
      }
    });

    await fetch('/api/user/config-grid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedConfigs)
    });
    return true;
  } catch (err) {
    console.error('Error saving grid configs:', err);
    return false;
  }
}

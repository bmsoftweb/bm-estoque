export interface GridColumnConfig {
  nome_do_modulo: string;
  nome_do_grid: string;
  nome_da_coluna: string;
  largura_da_coluna: string;
  visivel?: boolean;
  ordem?: number;
  tipo_apresentacao?: 'texto' | 'numero' | 'inteiro' | 'data';
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

export async function saveGridConfigs(newConfigs: GridColumnConfig[]) {
  try {
    const currentConfigs = await getGridConfigs();
    const updatedConfigs = [...currentConfigs];
    
    newConfigs.forEach(newCfg => {
      const idx = updatedConfigs.findIndex(c => 
        c.nome_do_grid === newCfg.nome_do_grid && 
        c.nome_da_coluna === newCfg.nome_da_coluna
      );
      
      if (idx !== -1) {
        Object.assign(updatedConfigs[idx], newCfg);
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

// State Management
let budgetState = {
  panels: [],
  theme: 'dark'
};

// Draft equipments for the panel currently being created
let draftEquipments = [];

// Default Components per Panel Type (Dummy values)
// Calculate detailed panel components and pricing based on the PRECOS_DATABASE
function calculatePanelComponents(panel) {
  if (typeof PRECOS_DATABASE === 'undefined') {
    console.error("PRECOS_DATABASE não carregado! Verifique precos.js.");
    return [];
  }

  const componentsMap = {}; // Key: componentCode -> { code, name, qty, unit, unitPrice, value }
  
  const addComp = (code, qtyMultiplier = 1) => {
    if (!code) return;
    const catItem = PRECOS_DATABASE.catalog[code];
    if (!catItem) {
      console.warn(`Componente não encontrado no catálogo: ${code}`);
      return;
    }
    if (componentsMap[code]) {
      componentsMap[code].qty += qtyMultiplier;
      componentsMap[code].value = componentsMap[code].qty * componentsMap[code].unitPrice;
    } else {
      componentsMap[code] = {
        code: code,
        name: catItem.desc,
        brand: catItem.brand,
        unit: catItem.unit,
        qty: qtyMultiplier,
        unitPrice: catItem.price,
        value: qtyMultiplier * catItem.price
      };
    }
  };

  const type = panel.type;
  const voltage = panel.voltage || '220V';
  
  // 1. Shared / Panel-level structural components
  let totalEquips = 0;
  if (type === 'comando' || type === 'remoto') {
    totalEquips = parseInt(panel.quantity) || 1;
  } else if (panel.equipments) {
    totalEquips = panel.equipments.length;
  }
  
  // Quadro de montagem sizing
  let boxCode = 'QMON-300x200x250';
  const hasClpOrIhm = (type === 'automacao' || type === 'completo' || panel.hasIhm || type === 'remoto');
  if (hasClpOrIhm) {
    if (totalEquips <= 2) {
      boxCode = 'QMON-600x400x250';
    } else {
      boxCode = 'QMON-600x600x200';
    }
  } else {
    if (totalEquips <= 2) {
      boxCode = 'QMON-300x200x250';
    } else if (totalEquips <= 4) {
      boxCode = 'QMON-600x400x250';
    } else {
      boxCode = 'QMON-600x600x200';
    }
  }
  addComp(boxCode, 1);
  
  // Common shared items
  addComp('BARRAMENTO-TERRA', 1);
  addComp('BARRAMENTO-NEUTRO', 1);
  addComp('CANALETA-50X50', 1);
  addComp('CANALETA-30X50', 1);
  addComp('SECCIONADORA-3POS', 1);
  addComp('TOMADA-DIM', 1);
  
  // Transformador de comando para 440V
  if (voltage === '440V' && (type === 'automacao' || type === 'completo' || type === 'potencia-comando' || type === 'comando')) {
    addComp('TRANSFORMADOR-440-220', 1);
  }
  
  // Ventilação forçada se houver potência de motor
  const hasMotors = (type === 'potencia' || type === 'potencia-comando' || type === 'completo' || type === 'comando');
  if (hasMotors) {
    addComp('VENTILADOR-GRELHA', 2);
  }
  
  // Fonte 24V se houver automação
  const isAutomationPanel = (type === 'automacao' || type === 'completo' || type === 'remoto');
  if (isAutomationPanel) {
    addComp('FONTE-PSS24-W5', 1);
  }
  
  // 2. Equipment-level components
  if (type === 'comando') {
    const qty = parseInt(panel.quantity) || 1;
    for (let i = 0; i < qty; i++) {
      addComp('MINIDISJ-MDW-C10', 1);
      addComp('CONTATOR-CWM9', 1);
      addComp('BORNE-BTWP-2.5', 5);
      addComp('CABO-1.0', 10);
      addComp('PORTA-PLAQUETA', 1);
    }
  } 
  else if (type === 'remoto') {
    const qty = parseInt(panel.quantity) || 1;
    for (let i = 0; i < qty; i++) {
      addComp('MINIDISJ-MDW-C10', 1);
      addComp('SECCIONADORA-3POS', 1);
      addComp('PORTA-PLAQUETA', 2);
      addComp('BORNE-BTWP-2.5', 4);
      addComp('CABO-1.0', 10);
    }
    // Remote HMI
    if (panel.remotoIhmSize) {
      const ihmSizeStr = panel.remotoIhmSize;
      const ihmConfig = PRECOS_DATABASE.ihmMapping[ihmSizeStr];
      if (ihmConfig) {
        addComp(ihmConfig.code, ihmConfig.qty);
        if (ihmSizeStr === '7.0"') {
          addComp('MOLDURA-IHM-7', 1);
        }
      }
    }
  }
  else if (panel.equipments && panel.equipments.length > 0) {
    let automationEquipsCount = { 'UTA': 0, 'EX/CV': 0, 'BOMBAS': 0 };
    
    panel.equipments.forEach(eq => {
      const eqType = eq.type;
      
      // A) Power starting components
      const hasPowerCol = (type === 'potencia' || type === 'potencia-comando' || type === 'completo');
      if (hasPowerCol) {
        let startingType = eq.starts;
        if (Array.isArray(startingType)) {
          startingType = startingType[0];
        }
        let power = eq.power;
        
        if (startingType && power) {
          const compKey = `${startingType}_${power}_${voltage}`;
          const composition = PRECOS_DATABASE.compositions[compKey];
          if (composition) {
            composition.forEach(c => {
              addComp(c.code, c.qty);
            });
            addComp('PORTA-PLAQUETA', 1);
          }
        }
      }
      
      // B) Automation sensors and digital outputs
      const hasAutomationCol = (type === 'automacao' || type === 'completo');
      if (hasAutomationCol) {
        let hasAutomationComponents = false;
        
        if (eqType === 'UTA' && eq.readings) {
          eq.readings.forEach(sensor => {
            const sensKey = `UTA_${sensor}`;
            const sensComp = PRECOS_DATABASE.sensors[sensKey];
            if (sensComp) {
              sensComp.forEach(sc => addComp(sc.code, sc.qty));
              hasAutomationComponents = true;
            }
          });
          if (eq.nestedStarts) {
            eq.nestedStarts.forEach(start => {
              let sensorName = start;
              if (start === 'Direta') sensorName = 'Partida Direta';
              const sensKey = `UTA_${sensorName}`;
              const sensComp = PRECOS_DATABASE.sensors[sensKey];
              if (sensComp) {
                sensComp.forEach(sc => addComp(sc.code, sc.qty));
                hasAutomationComponents = true;
              }
            });
          }
        } 
        else if (eqType === 'EX/CV' && eq.readings) {
          eq.readings.forEach(sensor => {
            const sensKey = `EX/CV_${sensor}`;
            const sensComp = PRECOS_DATABASE.sensors[sensKey];
            if (sensComp) {
              sensComp.forEach(sc => addComp(sc.code, sc.qty));
              hasAutomationComponents = true;
            }
          });
        } 
        else if (eqType === 'BOMBAS' && eq.nestedStandards) {
          eq.nestedStandards.forEach(standard => {
            const sensKey = `BOMBAS_${standard}`;
            const sensComp = PRECOS_DATABASE.sensors[sensKey];
            if (sensComp) {
              sensComp.forEach(sc => addComp(sc.code, sc.qty));
              hasAutomationComponents = true;
            }
          });
        } 
        else if (eqType === 'CHILLER' && eq.readings) {
          eq.readings.forEach(sensor => {
            const sensKey = `CHILLER_${sensor}`;
            const sensComp = PRECOS_DATABASE.sensors[sensKey];
            if (sensComp) {
              sensComp.forEach(sc => addComp(sc.code, sc.qty));
              hasAutomationComponents = true;
            }
          });
        }
        
        if (hasAutomationComponents) {
          if (eqType in automationEquipsCount) {
            automationEquipsCount[eqType]++;
          }
        }
      }
    });
    
    // C) CLP and Connector kit rules based on equipment counts
    let selectedClpRule = null;
    if (automationEquipsCount['UTA'] > 0) {
      const count = automationEquipsCount['UTA'];
      selectedClpRule = PRECOS_DATABASE.clpRules.find(r => r.equipType === 'UTA' && count >= r.minQty && count <= r.maxQty);
    } else if (automationEquipsCount['EX/CV'] > 0) {
      const count = automationEquipsCount['EX/CV'];
      selectedClpRule = PRECOS_DATABASE.clpRules.find(r => r.equipType === 'EX/CV' && count >= r.minQty && count <= r.maxQty);
    } else if (automationEquipsCount['BOMBAS'] > 0) {
      const count = automationEquipsCount['BOMBAS'];
      selectedClpRule = PRECOS_DATABASE.clpRules.find(r => r.equipType === 'BOMBAS' && count >= r.minQty && count <= r.maxQty);
    }
    
    if (selectedClpRule) {
      if (selectedClpRule.clpCode) addComp(selectedClpRule.clpCode, selectedClpRule.clpQty);
      if (selectedClpRule.connCode) addComp(selectedClpRule.connCode, selectedClpRule.connQty);
    }
  }
  
  // 3. HMI Selection
  if ((type === 'automacao' || type === 'completo') && panel.hasIhm && panel.ihmSize) {
    const ihmSizeStr = panel.ihmSize;
    const ihmConfig = PRECOS_DATABASE.ihmMapping[ihmSizeStr];
    if (ihmConfig) {
      addComp(ihmConfig.code, ihmConfig.qty);
      if (ihmSizeStr === '7.0"') {
        addComp('MOLDURA-IHM-7', 1);
      }
    }
  }
  
  // 4. SCADA Supervisório Selection
  if (panel.hasSupervisorio) {
    const supervisorioConfig = PRECOS_DATABASE.supervisorio;
    if (supervisorioConfig) {
      addComp(supervisorioConfig.code, supervisorioConfig.qty);
    }
  }
  
  return Object.values(componentsMap);
}

// Wrapper for backward compatibility / fallback
function getDefaultComponents(panelType) {
  return calculatePanelComponents({ type: panelType, voltage: '220V', quantity: 1, equipments: [] });
}

// DOM Elements
const views = {
  'dashboard-view': document.getElementById('dashboard-view'),
  'creator-view': document.getElementById('creator-view'),
  'list-view': document.getElementById('list-view'),
  'help-view': document.getElementById('help-view')
};

const navLinks = document.querySelectorAll('.nav-link');
const viewTitle = document.getElementById('view-title');
const viewSubtitle = document.getElementById('view-subtitle');

// Load data from LocalStorage
function loadState() {
  const savedState = localStorage.getItem('panel_builder_state');
  if (savedState) {
    try {
      budgetState = JSON.parse(savedState);
      if (!budgetState.panels) budgetState.panels = [];
      if (!budgetState.theme) budgetState.theme = 'dark';
      
      // Migrate existing panels if they don't have components
      budgetState.panels.forEach(panel => {
        if (!panel.components) {
          panel.components = calculatePanelComponents(panel);
        }
      });
    } catch (e) {
      console.error("Erro ao carregar dados do LocalStorage:", e);
    }
  }
  
  // Apply theme
  document.body.setAttribute('data-theme', budgetState.theme);
  updateThemeIcon();
  
  // Render views
  renderDashboard();
  renderPanelsList();
}

// Save data to LocalStorage
function saveState() {
  localStorage.setItem('panel_builder_state', JSON.stringify(budgetState));
  renderDashboard();
  renderPanelsList();
}

// Save data silently (updates localStorage and dashboard, but not the panel lists to prevent losing input focus)
function saveStateSilently() {
  localStorage.setItem('panel_builder_state', JSON.stringify(budgetState));
  renderDashboard();
}

// Navigation
function navigateTo(viewId) {
  // Hide all views
  Object.keys(views).forEach(key => {
    views[key].classList.remove('active');
  });
  
  // Show selected view
  views[viewId].classList.add('active');
  
  // Update nav menu active state
  navLinks.forEach(link => {
    if (link.getAttribute('data-target') === viewId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Update page header titles
  switch(viewId) {
    case 'dashboard-view':
      viewTitle.textContent = 'Painel Geral';
      viewSubtitle.textContent = 'Resumo estatístico e exportação do orçamento de quadros elétricos.';
      break;
    case 'creator-view':
      viewTitle.textContent = 'Configurar Novo Quadro';
      viewSubtitle.textContent = 'Adicione um novo quadro elétrico definindo tipo, características e equipamentos.';
      resetCreatorForm();
      break;
    case 'list-view':
      viewTitle.textContent = 'Lista de Quadros';
      viewSubtitle.textContent = 'Consulte, edite ou exclua os quadros elétricos adicionados anteriormente.';
      break;
    case 'help-view':
      viewTitle.textContent = 'Ajuda & Guia';
      viewSubtitle.textContent = 'Manual de uso do sistema de especificação de quadros.';
      break;
  }
  
  // Close sidebar on mobile after clicking
  document.getElementById('sidebar-nav').classList.remove('mobile-active');
}

// Helper to navigate to creator directly
function navigateToCreator() {
  navigateTo('creator-view');
}

// Theme Toggle
function toggleTheme() {
  budgetState.theme = budgetState.theme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', budgetState.theme);
  updateThemeIcon();
  saveState();
}

function updateThemeIcon() {
  const themeIcon = document.getElementById('theme-icon');
  if (budgetState.theme === 'light') {
    // Show Sun Icon
    themeIcon.innerHTML = `<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 7a5 5 0 100 10 5 5 0 000-10z"/>`;
  } else {
    // Show Moon Icon
    themeIcon.innerHTML = `<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>`;
  }
}

// Format panel and equipments details into standard text output
function formatPanelDescription(panel, index) {
  let output = `Quadro ${index + 1} - ${panel.name} (${panel.voltage || '220V'})\n`;
  
  if (panel.type === 'comando') {
    output += `${panel.quantity} equipamentos\n`;
  } 
  else if (panel.type === 'remoto') {
    output += `IHM - ${panel.remotoIhmSize}\n`;
    output += `${panel.quantity} equipamentos\n`;
  } 
  else {
    // Handle panel equipment list formats
    panel.equipments.forEach((equip, eqIdx) => {
      let eqDesc = `Equipamento ${eqIdx + 1} - `;
      
      if (panel.type === 'potencia' || panel.type === 'potencia-comando') {
        const startsStr = equip.starts && equip.starts.length > 0 ? equip.starts.join(' - ') : 'Não definida';
        eqDesc += `Potência ${equip.power}, Partida ${startsStr}, ${equip.type}`;
      } 
      else if (panel.type === 'automacao') {
        eqDesc += `${equip.type}`;
        
        if (equip.type === 'UTA') {
          const readings = equip.readings && equip.readings.length > 0 ? ' - ' + equip.readings.join(' - ') : '';
          const starts = equip.nestedStarts && equip.nestedStarts.length > 0 ? ' - ' + equip.nestedStarts.join(' - ') : '';
          eqDesc += `${readings}${starts}`;
        } 
        else if (equip.type === 'EX/CV') {
          const readings = equip.readings && equip.readings.length > 0 ? ' - ' + equip.readings.join(' - ') : '';
          eqDesc += `${readings}`;
        } 
        else if (equip.type === 'BOMBAS') {
          const standards = equip.nestedStandards && equip.nestedStandards.length > 0 ? ' - ' + equip.nestedStandards.join(' - ') : '';
          eqDesc += `${standards}`;
        } 
        else if (equip.type === 'CHILLER') {
          const readings = equip.readings && equip.readings.length > 0 ? ' - ' + equip.readings.join(' - ') : '';
          eqDesc += `${readings}`;
        }
      } 
      else if (panel.type === 'completo') {
        // Potência, Comando e Automação
        const startsStr = equip.starts && equip.starts.length > 0 ? equip.starts.join(' - ') : 'Não definida';
        eqDesc += `Potência ${equip.power}, Partida ${startsStr}, ${equip.type}`;
        
        // Append automation configurations if present
        let autoDetails = [];
        if (equip.type === 'UTA') {
          if (equip.readings && equip.readings.length > 0) autoDetails.push(`Leituras: ${equip.readings.join('/')}`);
          if (equip.nestedStarts && equip.nestedStarts.length > 0) autoDetails.push(`Partida Automação: ${equip.nestedStarts.join('/')}`);
        } 
        else if (equip.type === 'EX/CV' && equip.readings && equip.readings.length > 0) {
          autoDetails.push(`Leituras: ${equip.readings.join('/')}`);
        } 
        else if (equip.type === 'BOMBAS' && equip.nestedStandards && equip.nestedStandards.length > 0) {
          autoDetails.push(`Padrão: ${equip.nestedStandards.join('/')}`);
        } 
        else if (equip.type === 'CHILLER' && equip.readings && equip.readings.length > 0) {
          autoDetails.push(`Leituras: ${equip.readings.join('/')}`);
        }
        
        if (autoDetails.length > 0) {
          eqDesc += ` (${autoDetails.join(' | ')})`;
        }
      }
      
      output += `${eqDesc}\n`;
    });

    // HMI size at panel-level for automation / completo
    if ((panel.type === 'automacao' || panel.type === 'completo') && panel.hasIhm) {
      output += `IHM - ${panel.ihmSize}\n`;
    }
  }

  // Include components list and sum in consolidated text output
  if (panel.components && panel.components.length > 0) {
    const totalVal = panel.components.reduce((sum, comp) => sum + (parseFloat(comp.value) || 0), 0);
    output += `Componentes Elétricos (Total: R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}):\n`;
    panel.components.forEach(comp => {
      const qtyDetails = comp.qty ? ` (${comp.qty} ${comp.unit} x R$ ${(comp.value / comp.qty).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})})` : '';
      output += `  - ${comp.name}${qtyDetails}: R$ ${comp.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    });
  }

  return output;
}

// Generate fully consolidated budget description
function getConsolidatedBudget() {
  if (budgetState.panels.length === 0) {
    return 'Nenhum quadro elétrico cadastrado ainda. Vá em "Criar Quadro" para começar.';
  }
  
  return budgetState.panels.map((panel, idx) => formatPanelDescription(panel, idx)).join('\n');
}

// Render Dashboard
function renderDashboard() {
  const consolidatedBox = document.getElementById('budget-consolidated-text');
  consolidatedBox.textContent = getConsolidatedBudget();
  
  // Stats
  document.getElementById('stat-total-panels').textContent = budgetState.panels.length;
  
  let totalEquipments = 0;
  let ihmCount = 0;
  let totalBudgetPrice = 0;
  
  const categoryCounts = {
    'potencia': 0,
    'comando': 0,
    'potencia-comando': 0,
    'automacao': 0,
    'completo': 0,
    'remoto': 0
  };
  
  budgetState.panels.forEach(panel => {
    categoryCounts[panel.type] = (categoryCounts[panel.type] || 0) + 1;
    
    if (panel.type === 'comando' || panel.type === 'remoto') {
      totalEquipments += parseInt(panel.quantity) || 0;
    } else {
      totalEquipments += panel.equipments.length;
    }
    
    if (panel.type === 'remoto') {
      ihmCount++;
    } else if ((panel.type === 'automacao' || panel.type === 'completo') && panel.hasIhm) {
      ihmCount++;
    }

    // Sum components values
    if (panel.components) {
      totalBudgetPrice += panel.components.reduce((sum, comp) => sum + (parseFloat(comp.value) || 0), 0);
    }
  });
  
  document.getElementById('stat-total-equipments').textContent = totalEquipments;
  document.getElementById('stat-ihm-count').textContent = ihmCount;
  document.getElementById('stat-total-price').textContent = totalBudgetPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  // Render Category List
  const categoryList = document.getElementById('dashboard-category-summary');
  categoryList.innerHTML = '';
  
  const categoryLabels = {
    'potencia': { label: 'Potência', class: 'type-potencia' },
    'comando': { label: 'Comando', class: 'type-comando' },
    'potencia-comando': { label: 'Potência e Comando', class: 'type-potencia-comando' },
    'automacao': { label: 'Automação', class: 'type-automacao' },
    'completo': { label: 'Potência, Comando e Aut.', class: 'type-completo' },
    'remoto': { label: 'Automação Remoto', class: 'type-remoto' }
  };
  
  Object.keys(categoryLabels).forEach(key => {
    const info = categoryLabels[key];
    const count = categoryCounts[key] || 0;
    
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.justify = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '8px 0';
    item.style.borderBottom = '1px solid var(--border-color)';
    
    item.innerHTML = `
      <span class="panel-type-tag ${info.class}" style="font-size: 0.75rem;">${info.label}</span>
      <span style="font-weight: 600; font-size: 1rem;">${count}</span>
    `;
    categoryList.appendChild(item);
  });
}

// Render Panels List View
function renderPanelsList() {
  const listGrid = document.getElementById('panels-list-grid');
  const emptyState = document.getElementById('panels-empty-state');
  
  if (budgetState.panels.length === 0) {
    listGrid.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }
  
  listGrid.style.display = 'grid';
  emptyState.style.display = 'none';
  
  listGrid.innerHTML = '';
  
  budgetState.panels.forEach((panel, idx) => {
    const card = document.createElement('div');
    card.className = 'panel-card';
    
    let typeClass = 'type-potencia';
    let typeLabel = 'Potência';
    
    switch(panel.type) {
      case 'potencia': typeClass = 'type-potencia'; typeLabel = 'Potência'; break;
      case 'comando': typeClass = 'type-comando'; typeLabel = 'Comando'; break;
      case 'potencia-comando': typeClass = 'type-potencia-comando'; typeLabel = 'Potência e Comando'; break;
      case 'automacao': typeClass = 'type-automacao'; typeLabel = 'Automação'; break;
      case 'completo': typeClass = 'type-completo'; typeLabel = 'Pot., Com. & Aut.'; break;
      case 'remoto': typeClass = 'type-remoto'; typeLabel = 'Aut. Remoto'; break;
    }
    
    // Format equipment listing for visual cards
    let equipmentsHTML = '';
    
    if (panel.type === 'comando') {
      equipmentsHTML = `<li class="panel-equip-li"><strong>Dispositivos:</strong> ${panel.quantity} equipamentos</li>`;
    } 
    else if (panel.type === 'remoto') {
      equipmentsHTML = `
        <li class="panel-equip-li"><strong>IHM:</strong> ${panel.remotoIhmSize}</li>
        <li class="panel-equip-li"><strong>Dispositivos:</strong> ${panel.quantity} equipamentos</li>
      `;
    } 
    else {
      panel.equipments.forEach((eq, eqIdx) => {
        let details = [];
        
        if (panel.type === 'potencia' || panel.type === 'potencia-comando' || panel.type === 'completo') {
          details.push(`<span class="badge badge-accent">${eq.power}</span>`);
          if (eq.starts && eq.starts.length > 0) {
            details.push(`<span class="badge badge-success">Partida: ${eq.starts.join('/')}</span>`);
          }
        }
        
        if (panel.type === 'automacao' || panel.type === 'completo') {
          if (eq.type === 'UTA') {
            if (eq.readings && eq.readings.length > 0) details.push(`<span class="badge">Leituras: ${eq.readings.join('/')}</span>`);
            if (eq.nestedStarts && eq.nestedStarts.length > 0) details.push(`<span class="badge badge-success">Partida Aut.: ${eq.nestedStarts.join('/')}</span>`);
          } 
          else if (eq.type === 'EX/CV') {
            if (eq.readings && eq.readings.length > 0) details.push(`<span class="badge">Leituras: ${eq.readings.join('/')}</span>`);
          } 
          else if (eq.type === 'BOMBAS') {
            if (eq.nestedStandards && eq.nestedStandards.length > 0) details.push(`<span class="badge badge-success">Bomba: ${eq.nestedStandards.join('/')}</span>`);
          } 
          else if (eq.type === 'CHILLER') {
            if (eq.readings && eq.readings.length > 0) details.push(`<span class="badge">Leituras: ${eq.readings.join('/')}</span>`);
          }
        }
        
        const eqNameLabel = eq.name ? `<strong>${eq.name}</strong> (${eq.type})` : `<strong>${eq.type}</strong>`;
        
        equipmentsHTML += `
          <li class="panel-equip-li">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>${eqNameLabel}</div>
              <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end; max-width:60%;">${details.join('')}</div>
            </div>
          </li>
        `;
      });
      
      if ((panel.type === 'automacao' || panel.type === 'completo') && panel.hasIhm) {
        equipmentsHTML += `
          <li class="panel-equip-li" style="background-color:rgba(245, 158, 11, 0.05); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid rgba(245, 158, 11, 0.15);">
            <strong>IHM Integrada:</strong> tamanho de ${panel.ihmSize}
          </li>
        `;
      }
      if ((panel.type === 'automacao' || panel.type === 'completo') && panel.hasSupervisorio) {
        equipmentsHTML += `
          <li class="panel-equip-li" style="background-color:rgba(6, 182, 212, 0.05); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid rgba(6, 182, 212, 0.15); margin-top:8px;">
            <strong>Sistema Supervisório:</strong> Integrado ao painel
          </li>
        `;
      }
    }

    // Component Pricing HTML block
    let componentsHTML = '';
    const totalComponentsValue = panel.components.reduce((sum, comp) => sum + (parseFloat(comp.value) || 0), 0);
    const totalFormatted = totalComponentsValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    panel.components.forEach((comp, compIdx) => {
      const qtyDetails = comp.qty ? ` (${comp.qty} ${comp.unit} x R$ ${(comp.value / comp.qty).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})})` : '';
      componentsHTML += `
        <div class="component-row">
          <span class="component-name">${comp.name}${qtyDetails}</span>
          <div class="component-price-container">
            <span class="component-price-symbol">R$</span>
            <input type="number" step="0.01" class="component-price-input" 
                   data-panel-id="${panel.id}" data-comp-idx="${compIdx}" 
                   value="${comp.value.toFixed(2)}">
          </div>
        </div>
      `;
    });
    
    card.innerHTML = `
      <div class="panel-card-header">
        <h3 style="font-size:1.05rem; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:55%;" title="${panel.name}">${panel.name}</h3>
        <div style="display:flex; gap:6px; align-items:center;">
          <span class="badge" style="background-color:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-primary); font-size:0.75rem; padding:4px 8px; font-weight:600;">${panel.voltage || '220V'}</span>
          <span class="panel-type-tag ${typeClass}">${typeLabel}</span>
        </div>
      </div>
      <div class="panel-card-body">
        <!-- Collapsible Components Section -->
        <details class="components-details">
          <summary>
            <div class="summary-left">
              <span class="summary-toggle-icon">▶</span>
              <span>Componentes Elétricos</span>
            </div>
            <div class="summary-right">
              <strong>Total: R$ <span id="total-val-${panel.id}">${totalFormatted}</span></strong>
            </div>
          </summary>
          <div class="components-list">
            ${componentsHTML}
          </div>
        </details>

        <!-- Equipments List -->
        <ul class="panel-equipments-summary" style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;">
          ${equipmentsHTML}
        </ul>
      </div>
      <div class="panel-card-footer">
        <button class="btn btn-secondary btn-icon-only" onclick="openEditModal(${panel.id})" title="Editar Quadro">
          <svg viewBox="0 0 24 24" style="width:16px; height:16px;"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button class="btn btn-danger btn-icon-only" onclick="deletePanel(${panel.id})" title="Excluir Quadro">
          <svg viewBox="0 0 24 24" style="width:16px; height:16px;"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    `;
    
    listGrid.appendChild(card);
  });

  // Setup Event Delegation for Component Price inputs to prevent focus loss during typing
  const priceInputs = listGrid.querySelectorAll('.component-price-input');
  priceInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const panelId = parseInt(e.target.getAttribute('data-panel-id'));
      const compIdx = parseInt(e.target.getAttribute('data-comp-idx'));
      const newValue = parseFloat(e.target.value) || 0;
      
      const panel = budgetState.panels.find(p => p.id === panelId);
      if (panel && panel.components[compIdx]) {
        panel.components[compIdx].value = newValue;
        
        // Update Panel specific Total text
        const newTotal = panel.components.reduce((sum, comp) => sum + (parseFloat(comp.value) || 0), 0);
        const totalSpan = document.getElementById(`total-val-${panelId}`);
        if (totalSpan) {
          totalSpan.textContent = newTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        
        // Save silently to localstorage and refresh dashboard sum
        saveStateSilently();
      }
    });
  });
}

// Delete Panel
function deletePanel(id) {
  if (confirm("Tem certeza que deseja excluir este quadro elétrico do orçamento?")) {
    budgetState.panels = budgetState.panels.filter(p => p.id !== id);
    saveState();
  }
}

// Reset Creator Form
function resetCreatorForm() {
  document.getElementById('panel-name').value = '';
  document.getElementById('panel-type').value = '';
  
  // Reset HMI Checkbox
  const hasIhmCheckbox = document.getElementById('panel-has-ihm');
  hasIhmCheckbox.checked = false;
  document.getElementById('panel-has-ihm-label').textContent = 'Não';
  document.getElementById('panel-ihm-checkbox-tile').classList.remove('checked');
  
  // Reset Voltage Checkboxes
  const voltageCbs = document.querySelectorAll('input[name="panel-voltage"]');
  voltageCbs.forEach(cb => {
    cb.checked = false;
    const tile = cb.closest('.checkbox-tile');
    if (tile) tile.classList.remove('checked');
  });
  
  // Reset Supervisory Checkbox
  const hasSupervisorioCheckbox = document.getElementById('panel-has-supervisorio');
  hasSupervisorioCheckbox.checked = false;
  document.getElementById('panel-has-supervisorio-label').textContent = 'Não';
  document.getElementById('panel-supervisorio-checkbox-tile').classList.remove('checked');
  
  document.getElementById('panel-ihm-size').selectedIndex = 0;
  document.getElementById('panel-remoto-ihm-size').selectedIndex = 0;
  document.getElementById('panel-equipment-qty').value = '1';
  
  // Hide all dynamic components initially
  document.getElementById('panel-ihm-section').classList.add('hidden-section');
  document.getElementById('panel-ihm-size-group').classList.add('hidden-section');
  document.getElementById('panel-quantity-section').classList.add('hidden-section');
  document.getElementById('panel-remoto-ihm-group').classList.add('hidden-section');
  document.getElementById('equipment-builder-section').classList.add('hidden-section');
  document.getElementById('panel-supervisorio-section').classList.add('hidden-section');
  
  resetEquipmentForm();
  draftEquipments = [];
  renderDraftEquipments();
}

// Reset Equipment Form specifically
function resetEquipmentForm() {
  document.getElementById('equip-name').value = '';
  document.getElementById('equip-type').selectedIndex = 0;
  document.getElementById('equip-motor-power').selectedIndex = 2; // 0.75kW default
  
  // Uncheck all checkboxes
  const checkboxes = document.querySelectorAll('#panel-creator-form input[type="checkbox"]');
  checkboxes.forEach(cb => {
    if (cb.id !== 'panel-has-ihm') {
      cb.checked = false;
      const tile = cb.closest('.checkbox-tile');
      if (tile) tile.classList.remove('checked');
    }
  });
  
  // Reset automation fields
  toggleAutomationFields();
}

// Handle Form Adaptive Fields on Panel Type Change
function handlePanelTypeChange(type) {
  // Hide all sections first
  document.getElementById('panel-ihm-section').classList.add('hidden-section');
  document.getElementById('panel-ihm-size-group').classList.add('hidden-section');
  document.getElementById('panel-quantity-section').classList.add('hidden-section');
  document.getElementById('panel-remoto-ihm-group').classList.add('hidden-section');
  document.getElementById('equipment-builder-section').classList.add('hidden-section');
  document.getElementById('panel-supervisorio-section').classList.add('hidden-section');
  
  // General inputs shown inside Equipment form
  const powerGroup = document.getElementById('equip-power-group');
  const startingGroup = document.getElementById('equip-starting-group');
  const nameGroup = document.getElementById('equip-name-group');
  const automationFields = document.getElementById('equip-automation-fields');

  if (type === 'potencia' || type === 'potencia-comando') {
    // Power panels: show builder, power, starts, name
    document.getElementById('equipment-builder-section').classList.remove('hidden-section');
    
    nameGroup.classList.remove('hidden-section');
    powerGroup.classList.remove('hidden-section');
    startingGroup.classList.remove('hidden-section');
    automationFields.classList.add('hidden-section');
  } 
  else if (type === 'comando') {
    // Pure control: hide builder, show quantity
    document.getElementById('panel-quantity-section').classList.remove('hidden-section');
  } 
  else if (type === 'automacao') {
    // Automation: show builder, hide name, power, general starts, show HMI option and readings/nested
    document.getElementById('panel-ihm-section').classList.remove('hidden-section');
    document.getElementById('equipment-builder-section').classList.remove('hidden-section');
    
    nameGroup.classList.add('hidden-section');
    powerGroup.classList.add('hidden-section');
    startingGroup.classList.add('hidden-section');
    automationFields.classList.remove('hidden-section');
    
    toggleAutomationFields();
  } 
  else if (type === 'completo') {
    // Power + Control + Automation: show everything
    document.getElementById('panel-ihm-section').classList.remove('hidden-section');
    document.getElementById('equipment-builder-section').classList.remove('hidden-section');
    
    nameGroup.classList.remove('hidden-section');
    powerGroup.classList.remove('hidden-section');
    startingGroup.classList.remove('hidden-section');
    automationFields.classList.remove('hidden-section');
    
    toggleAutomationFields();
  } 
  else if (type === 'remoto') {
    // Remote automation: show quantity, HMI size
    document.getElementById('panel-quantity-section').classList.remove('hidden-section');
    document.getElementById('panel-remoto-ihm-group').classList.remove('hidden-section');
  }

  // Show SCADA section conditionally
  if (type === 'automacao' || type === 'completo' || type === 'remoto') {
    document.getElementById('panel-supervisorio-section').classList.remove('hidden-section');
  }
}

// Toggle nested automation fields inside equipment builder based on Equipment Type select
function toggleAutomationFields() {
  const equipType = document.getElementById('equip-type').value;
  
  // Hide all sub-sections
  document.getElementById('aut-fields-uta').classList.add('hidden-section');
  document.getElementById('aut-fields-excv').classList.add('hidden-section');
  document.getElementById('aut-fields-bombas').classList.add('hidden-section');
  document.getElementById('aut-fields-chiller').classList.add('hidden-section');
  
  const panelType = document.getElementById('panel-type').value;
  if (panelType !== 'automacao' && panelType !== 'completo') return;
  
  // Show matched sub-section
  if (equipType === 'UTA') {
    document.getElementById('aut-fields-uta').classList.remove('hidden-section');
  } else if (equipType === 'EX/CV') {
    document.getElementById('aut-fields-excv').classList.remove('hidden-section');
  } else if (equipType === 'BOMBAS') {
    document.getElementById('aut-fields-bombas').classList.remove('hidden-section');
  } else if (equipType === 'CHILLER') {
    document.getElementById('aut-fields-chiller').classList.remove('hidden-section');
  }
}

// Render temporary draft equipments in creation form
function renderDraftEquipments() {
  const container = document.getElementById('draft-equipments-container');
  
  if (draftEquipments.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 30px; margin-top: 0; background-color: transparent; border: 1px dashed var(--border-color);">
        <p style="margin: 0; font-size: 0.9rem;">Nenhum equipamento adicionado a este quadro ainda.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  draftEquipments.forEach((eq, idx) => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    
    let subDetails = [];
    if (eq.power) subDetails.push(`Potência: ${eq.power}`);
    if (eq.starts && eq.starts.length > 0) subDetails.push(`Partida: ${eq.starts.join('/')}`);
    if (eq.readings && eq.readings.length > 0) subDetails.push(`Leituras: ${eq.readings.join('/')}`);
    if (eq.nestedStarts && eq.nestedStarts.length > 0) subDetails.push(`Partida Aut: ${eq.nestedStarts.join('/')}`);
    if (eq.nestedStandards && eq.nestedStandards.length > 0) subDetails.push(`Padrão: ${eq.nestedStandards.join('/')}`);
    
    const detailsString = subDetails.map(d => `<span class="badge">${d}</span>`).join(' ');
    
    item.innerHTML = `
      <div class="preview-item-info">
        <h4>${eq.name ? eq.name : `Equipamento ${idx+1}`} <span class="badge badge-accent" style="margin-left: 6px;">${eq.type}</span></h4>
        <div class="preview-item-desc">${detailsString}</div>
      </div>
      <button type="button" class="btn btn-danger btn-icon-only" onclick="deleteDraftEquipment(${idx})" style="padding: 4px;">
        <svg viewBox="0 0 24 24" style="width:14px; height:14px;"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
    `;
    container.appendChild(item);
  });
}

// Add equipment to draft
function addEquipmentToDraft() {
  const panelType = document.getElementById('panel-type').value;
  if (!panelType) {
    alert("Selecione o tipo de quadro primeiro.");
    return;
  }
  
  const equipType = document.getElementById('equip-type').value;
  const name = document.getElementById('equip-name').value.trim();
  
  let newEquip = {
    id: Date.now() + Math.random(),
    type: equipType,
    name: name
  };
  
  // Power / Starts
  if (panelType === 'potencia' || panelType === 'potencia-comando' || panelType === 'completo') {
    newEquip.power = document.getElementById('equip-motor-power').value;
    
    // Starts checkboxes
    const checkedStarts = Array.from(document.querySelectorAll('input[name="starting-type"]:checked')).map(cb => cb.value);
    newEquip.starts = checkedStarts;
  }
  
  // Automation fields
  if (panelType === 'automacao' || panelType === 'completo') {
    if (equipType === 'UTA') {
      newEquip.readings = Array.from(document.querySelectorAll('input[name="uta-readings"]:checked')).map(cb => cb.value);
      newEquip.nestedStarts = Array.from(document.querySelectorAll('input[name="uta-starts"]:checked')).map(cb => cb.value);
    } 
    else if (equipType === 'EX/CV') {
      newEquip.readings = Array.from(document.querySelectorAll('input[name="excv-readings"]:checked')).map(cb => cb.value);
    } 
    else if (equipType === 'BOMBAS') {
      newEquip.nestedStandards = Array.from(document.querySelectorAll('input[name="bombas-standards"]:checked')).map(cb => cb.value);
    } 
    else if (equipType === 'CHILLER') {
      newEquip.readings = Array.from(document.querySelectorAll('input[name="chiller-readings"]:checked')).map(cb => cb.value);
    }
  }
  
  draftEquipments.push(newEquip);
  renderDraftEquipments();
  resetEquipmentForm();
}

function deleteDraftEquipment(index) {
  draftEquipments.splice(index, 1);
  renderDraftEquipments();
}

// Save Full Panel into Budget
function savePanel() {
  const name = document.getElementById('panel-name').value.trim();
  const type = document.getElementById('panel-type').value;
  
  if (!name) {
    alert("Por favor, preencha o Nome do Quadro.");
    return;
  }
  
  if (!type) {
    alert("Por favor, escolha o Tipo de Quadro.");
    return;
  }
  
  const selectedVoltageCb = document.querySelector('input[name="panel-voltage"]:checked');
  if (!selectedVoltageCb) {
    alert("Por favor, selecione a Tensão de Alimentação.");
    return;
  }
  
  let newPanel = {
    id: Date.now(),
    name: name,
    type: type,
    voltage: selectedVoltageCb.value,
    components: []
  };
  
  if (type === 'comando') {
    const qty = parseInt(document.getElementById('panel-equipment-qty').value) || 1;
    newPanel.quantity = qty;
    newPanel.equipments = [];
  } 
  else if (type === 'remoto') {
    const qty = parseInt(document.getElementById('panel-equipment-qty').value) || 1;
    newPanel.quantity = qty;
    newPanel.remotoIhmSize = document.getElementById('panel-remoto-ihm-size').value;
    newPanel.equipments = [];
    newPanel.hasSupervisorio = document.getElementById('panel-has-supervisorio').checked;
  } 
  else {
    // Must have at least one equipment in draft
    if (draftEquipments.length === 0) {
      alert("Adicione pelo menos um equipamento a este quadro antes de salvá-lo.");
      return;
    }
    
    newPanel.equipments = [...draftEquipments];
    
    if (type === 'automacao' || type === 'completo') {
      newPanel.hasIhm = document.getElementById('panel-has-ihm').checked;
      newPanel.ihmSize = document.getElementById('panel-ihm-size').value;
      newPanel.hasSupervisorio = document.getElementById('panel-has-supervisorio').checked;
    }
  }
  
  // Calculate components list dynamically!
  newPanel.components = calculatePanelComponents(newPanel);
  
  budgetState.panels.push(newPanel);
  saveState();
  resetCreatorForm();
  navigateTo('list-view');
}

// Clear Entire Budget
function clearBudget() {
  if (confirm("ATENÇÃO: Isso apagará TODOS os quadros elétricos criados neste orçamento. Deseja continuar?")) {
    budgetState.panels = [];
    saveState();
  }
}

// Copy Consolidated Budget to Clipboard
function copyBudgetToClipboard() {
  const text = getConsolidatedBudget();
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-copy-budget');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg> Copiado!`;
    btn.style.backgroundColor = 'var(--success)';
    btn.style.color = '#ffffff';
    
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.backgroundColor = '';
      btn.style.color = '';
    }, 1500);
  }).catch(err => {
    alert("Falha ao copiar orçamento: " + err);
  });
}

// ==========================================
// EDIT PANEL MODAL FUNCTIONALITIES
// ==========================================
const editModal = document.getElementById('edit-panel-modal');

function openEditModal(panelId) {
  const panel = budgetState.panels.find(p => p.id === panelId);
  if (!panel) return;
  
  document.getElementById('edit-panel-id').value = panel.id;
  document.getElementById('edit-panel-name').value = panel.name;
  document.getElementById('edit-panel-type-hidden').value = panel.type;
  
  // Load Voltage checkbox states
  const voltage = panel.voltage || '220V';
  const editVoltageCbs = document.querySelectorAll('input[name="edit-panel-voltage"]');
  editVoltageCbs.forEach(cb => {
    const isCurrent = cb.value === voltage;
    cb.checked = isCurrent;
    const tile = cb.closest('.checkbox-tile');
    if (tile) {
      if (isCurrent) {
        tile.classList.add('checked');
      } else {
        tile.classList.remove('checked');
      }
    }
  });
  
  // Hide sections initially in edit form
  document.getElementById('edit-panel-ihm-section').classList.add('hidden-section');
  document.getElementById('edit-panel-ihm-size-group').classList.add('hidden-section');
  document.getElementById('edit-panel-qty-section').classList.add('hidden-section');
  document.getElementById('edit-panel-remoto-ihm-group').classList.add('hidden-section');
  document.getElementById('edit-equipments-list-section').classList.add('hidden-section');
  document.getElementById('edit-panel-supervisorio-section').classList.add('hidden-section');
  
  if (panel.type === 'comando') {
    document.getElementById('edit-panel-qty-section').classList.remove('hidden-section');
    document.getElementById('edit-panel-qty').value = panel.quantity;
  } 
  else if (panel.type === 'remoto') {
    document.getElementById('edit-panel-qty-section').classList.remove('hidden-section');
    document.getElementById('edit-panel-remoto-ihm-group').classList.remove('hidden-section');
    document.getElementById('edit-panel-qty').value = panel.quantity;
    document.getElementById('edit-panel-remoto-ihm-size').value = panel.remotoIhmSize;
  } 
  else {
    // Shows details of equipments
    document.getElementById('edit-equipments-list-section').classList.remove('hidden-section');
    renderEditEquipments(panel);
    
    if (panel.type === 'automacao' || panel.type === 'completo') {
      document.getElementById('edit-panel-ihm-section').classList.remove('hidden-section');
      
      const editHasIhm = document.getElementById('edit-panel-has-ihm');
      editHasIhm.checked = !!panel.hasIhm;
      document.getElementById('edit-panel-has-ihm-label').textContent = panel.hasIhm ? 'Sim' : 'Não';
      
      const checkboxTile = document.getElementById('edit-ihm-checkbox-tile');
      if (panel.hasIhm) {
        checkboxTile.classList.add('checked');
        document.getElementById('edit-panel-ihm-size-group').classList.remove('hidden-section');
        document.getElementById('edit-panel-ihm-size').value = panel.ihmSize;
      } else {
        checkboxTile.classList.remove('checked');
      }
    }
  }

  // Show SCADA option independently of equipments list / layout (for automacao, completo and remoto)
  if (panel.type === 'automacao' || panel.type === 'completo' || panel.type === 'remoto') {
    document.getElementById('edit-panel-supervisorio-section').classList.remove('hidden-section');
    
    const editHasSupervisorio = document.getElementById('edit-panel-has-supervisorio');
    editHasSupervisorio.checked = !!panel.hasSupervisorio;
    document.getElementById('edit-panel-has-supervisorio-label').textContent = panel.hasSupervisorio ? 'Sim' : 'Não';
    
    const scadaCheckboxTile = document.getElementById('edit-supervisorio-checkbox-tile');
    if (panel.hasSupervisorio) {
      scadaCheckboxTile.classList.add('checked');
    } else {
      scadaCheckboxTile.classList.remove('checked');
    }
  }
  
  editModal.classList.add('active');
}

function closeEditModal() {
  editModal.classList.remove('active');
}

function renderEditEquipments(panel) {
  const container = document.getElementById('edit-equipments-container');
  container.innerHTML = '';
  
  if (panel.equipments.length === 0) {
    container.innerHTML = '<p style="font-size:0.9rem; color:var(--text-secondary);">Nenhum equipamento neste quadro.</p>';
    return;
  }
  
  panel.equipments.forEach((eq, idx) => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.style.backgroundColor = 'var(--bg-secondary)';
    
    let subDetails = [];
    if (eq.power) subDetails.push(`Potência: ${eq.power}`);
    if (eq.starts && eq.starts.length > 0) subDetails.push(`Partida: ${eq.starts.join('/')}`);
    if (eq.readings && eq.readings.length > 0) subDetails.push(`Leituras: ${eq.readings.join('/')}`);
    if (eq.nestedStarts && eq.nestedStarts.length > 0) subDetails.push(`Partida Aut: ${eq.nestedStarts.join('/')}`);
    if (eq.nestedStandards && eq.nestedStandards.length > 0) subDetails.push(`Padrão: ${eq.nestedStandards.join('/')}`);
    
    const detailsString = subDetails.map(d => `<span class="badge">${d}</span>`).join(' ');
    
    item.innerHTML = `
      <div class="preview-item-info">
        <h5 style="font-size:0.9rem; font-weight:600;">${eq.name ? eq.name : `Equipamento ${idx+1}`} <span class="badge badge-accent">${eq.type}</span></h5>
        <div class="preview-item-desc">${detailsString}</div>
      </div>
      <button type="button" class="btn btn-danger btn-icon-only" onclick="deleteEquipmentFromPanel(${panel.id}, ${eq.id})" style="padding: 4px;">
        <svg viewBox="0 0 24 24" style="width:14px; height:14px;"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
    `;
    container.appendChild(item);
  });
}

function deleteEquipmentFromPanel(panelId, equipId) {
  const panel = budgetState.panels.find(p => p.id === panelId);
  if (!panel) return;
  
  if (panel.equipments.length === 1) {
    alert("O quadro deve conter pelo menos um equipamento. Caso queira deletar o quadro inteiro, use a opção de exclusão na lista.");
    return;
  }
  
  if (confirm("Remover este equipamento do quadro?")) {
    panel.equipments = panel.equipments.filter(e => e.id !== equipId);
    panel.components = calculatePanelComponents(panel);
    saveState();
    renderEditEquipments(panel);
    renderPanelsList();
  }
}

function saveEditPanelChanges() {
  const id = parseInt(document.getElementById('edit-panel-id').value);
  const name = document.getElementById('edit-panel-name').value.trim();
  const type = document.getElementById('edit-panel-type-hidden').value;
  
  if (!name) {
    alert("O nome do quadro é obrigatório.");
    return;
  }
  
  const panel = budgetState.panels.find(p => p.id === id);
  if (!panel) return;
  
  const selectedVoltageCb = document.querySelector('input[name="edit-panel-voltage"]:checked');
  if (!selectedVoltageCb) {
    alert("Por favor, selecione a Tensão de Alimentação.");
    return;
  }
  
  panel.name = name;
  panel.voltage = selectedVoltageCb.value;
  
  if (type === 'comando') {
    panel.quantity = parseInt(document.getElementById('edit-panel-qty').value) || 1;
  } 
  else if (type === 'remoto') {
    panel.quantity = parseInt(document.getElementById('edit-panel-qty').value) || 1;
    panel.remotoIhmSize = document.getElementById('edit-panel-remoto-ihm-size').value;
    panel.hasSupervisorio = document.getElementById('edit-panel-has-supervisorio').checked;
  } 
  else if (type === 'automacao' || type === 'completo') {
    panel.hasIhm = document.getElementById('edit-panel-has-ihm').checked;
    panel.ihmSize = document.getElementById('edit-panel-ihm-size').value;
    panel.hasSupervisorio = document.getElementById('edit-panel-has-supervisorio').checked;
  }
  
  // Recalculate components list dynamically on edit save!
  panel.components = calculatePanelComponents(panel);
  
  saveState();
  closeEditModal();
}

// ==========================================
// INITIALIZATION AND EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Load Local Storage budget
  loadState();
  
  // Sidebar Navigation Links
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const target = link.getAttribute('data-target');
      navigateTo(target);
    });
  });
  
  // Theme Toggle Button
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  
  // Hamburger Menu
  const hamburger = document.getElementById('hamburger-toggle');
  const sidebar = document.getElementById('sidebar-nav');
  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-active');
  });
  
  // Close sidebar on main click if mobile active
  document.querySelector('.main-content').addEventListener('click', () => {
    sidebar.classList.remove('mobile-active');
  });

  // Panel Type selection listener in creator form
  document.getElementById('panel-type').addEventListener('change', (e) => {
    handlePanelTypeChange(e.target.value);
  });
  
  // Equipment type selection listener (for automation/completo sub-options)
  document.getElementById('equip-type').addEventListener('change', toggleAutomationFields);
  
  // Creator form - Panel HMI toggler checkbox
  const panelHasIhmCb = document.getElementById('panel-has-ihm');
  panelHasIhmCb.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.getElementById('panel-has-ihm-label').textContent = isChecked ? 'Sim' : 'Não';
    
    const tile = document.getElementById('panel-ihm-checkbox-tile');
    if (isChecked) {
      tile.classList.add('checked');
      document.getElementById('panel-ihm-size-group').classList.remove('hidden-section');
    } else {
      tile.classList.remove('checked');
      document.getElementById('panel-ihm-size-group').classList.add('hidden-section');
    }
  });

  // Creator form - Panel SCADA toggler checkbox
  const panelHasSupervisorioCb = document.getElementById('panel-has-supervisorio');
  panelHasSupervisorioCb.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.getElementById('panel-has-supervisorio-label').textContent = isChecked ? 'Sim' : 'Não';
    
    const tile = document.getElementById('panel-supervisorio-checkbox-tile');
    if (isChecked) {
      tile.classList.add('checked');
    } else {
      tile.classList.remove('checked');
    }
  });

  // Modal edit form - Panel HMI toggler checkbox
  const editHasIhmCb = document.getElementById('edit-panel-has-ihm');
  editHasIhmCb.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.getElementById('edit-panel-has-ihm-label').textContent = isChecked ? 'Sim' : 'Não';
    
    const tile = document.getElementById('edit-ihm-checkbox-tile');
    if (isChecked) {
      tile.classList.add('checked');
      document.getElementById('edit-panel-ihm-size-group').classList.remove('hidden-section');
    } else {
      tile.classList.remove('checked');
      document.getElementById('edit-panel-ihm-size-group').classList.add('hidden-section');
    }
  });

  // Modal edit form - Panel SCADA toggler checkbox
  const editHasSupervisorioCb = document.getElementById('edit-panel-has-supervisorio');
  editHasSupervisorioCb.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.getElementById('edit-panel-has-supervisorio-label').textContent = isChecked ? 'Sim' : 'Não';
    
    const tile = document.getElementById('edit-supervisorio-checkbox-tile');
    if (isChecked) {
      tile.classList.add('checked');
    } else {
      tile.classList.remove('checked');
    }
  });
  
  // Toggle checkbox tiles visually on click
  const checkboxInputs = document.querySelectorAll('.checkbox-tile input[type="checkbox"]');
  checkboxInputs.forEach(input => {
    // Avoid double bindings on our special ones which are handled manually above
    if (input.id === 'panel-has-ihm' || input.id === 'edit-panel-has-ihm' || 
        input.id === 'panel-has-supervisorio' || input.id === 'edit-panel-has-supervisorio' ||
        input.name === 'panel-voltage' || input.name === 'edit-panel-voltage' ||
        input.name === 'starting-type' || input.name === 'uta-starts' || 
        input.name === 'bombas-standards') return;
    
    input.addEventListener('change', (e) => {
      const tile = e.target.closest('.checkbox-tile');
      if (tile) {
        if (e.target.checked) {
          tile.classList.add('checked');
        } else {
          tile.classList.remove('checked');
        }
      }
    });
  });

  // Handle mutual exclusivity for Creator supply voltage checkboxes
  const voltageCbs = document.querySelectorAll('input[name="panel-voltage"]');
  voltageCbs.forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked) {
        voltageCbs.forEach(other => {
          if (other !== e.target) {
            other.checked = false;
            const tile = other.closest('.checkbox-tile');
            if (tile) tile.classList.remove('checked');
          }
        });
        const tile = e.target.closest('.checkbox-tile');
        if (tile) tile.classList.add('checked');
      } else {
        const tile = e.target.closest('.checkbox-tile');
        if (tile) tile.classList.remove('checked');
      }
    });
  });

  // Handle mutual exclusivity for Edit modal supply voltage checkboxes
  const editVoltageCbs = document.querySelectorAll('input[name="edit-panel-voltage"]');
  editVoltageCbs.forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked) {
        editVoltageCbs.forEach(other => {
          if (other !== e.target) {
            other.checked = false;
            const tile = other.closest('.checkbox-tile');
            if (tile) tile.classList.remove('checked');
          }
        });
        const tile = e.target.closest('.checkbox-tile');
        if (tile) tile.classList.add('checked');
      } else {
        const tile = e.target.closest('.checkbox-tile');
        if (tile) tile.classList.remove('checked');
      }
    });
  });
  
  // Handle mutual exclusivity for Starting Types in Equipment Builder
  const makeMutuallyExclusive = (name) => {
    const checkboxes = document.querySelectorAll(`input[name="${name}"]`);
    checkboxes.forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          checkboxes.forEach(other => {
            if (other !== e.target) {
              other.checked = false;
              const tile = other.closest('.checkbox-tile');
              if (tile) tile.classList.remove('checked');
            }
          });
          const tile = e.target.closest('.checkbox-tile');
          if (tile) tile.classList.add('checked');
        } else {
          const tile = e.target.closest('.checkbox-tile');
          if (tile) tile.classList.remove('checked');
        }
      });
    });
  };

  makeMutuallyExclusive('starting-type');
  makeMutuallyExclusive('uta-starts');
  makeMutuallyExclusive('bombas-standards');

  // Add Equipment click handler
  document.getElementById('btn-add-equipment').addEventListener('click', addEquipmentToDraft);
  
  // Save Panel click handler
  document.getElementById('btn-save-panel').addEventListener('click', savePanel);
  
  // Cancel Creator click handler
  document.getElementById('btn-cancel-creator').addEventListener('click', () => {
    if (draftEquipments.length > 0 || document.getElementById('panel-name').value.trim() !== '') {
      if (confirm("Descartar alterações atuais e voltar para a lista?")) {
        resetCreatorForm();
        navigateTo('list-view');
      }
    } else {
      resetCreatorForm();
      navigateTo('list-view');
    }
  });
  
  // Clipboard buttons
  document.getElementById('btn-copy-budget').addEventListener('click', copyBudgetToClipboard);
  document.getElementById('btn-clear-budget').addEventListener('click', clearBudget);
  
  // Save Edit modal changes
  document.getElementById('btn-save-edit-panel').addEventListener('click', saveEditPanelChanges);
});

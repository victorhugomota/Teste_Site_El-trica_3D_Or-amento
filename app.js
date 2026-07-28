// State Management
let budgetState = {
  panels: [],
  theme: 'dark'
};

// Draft equipments for the panel currently being created
let draftEquipments = [];

// Helper to find the next highest standard power rating key in compositions database
function getNextStandardPower(customKw) {
  const stdPowers = [
    { val: 0.18, key: "0.18kW" },
    { val: 0.37, key: "0.37kW" },
    { val: 0.75, key: "0.75kW" },
    { val: 1.5,  key: "1.5kW" },
    { val: 2.2,  key: "2.2kW" },
    { val: 3.0,  key: "3.0kW" },
    { val: 4.0,  key: "4.0kW" },
    { val: 5.5,  key: "5.5kW" },
    { val: 7.5,  key: "7.5kW" },
    { val: 11.0, key: "11kW" },
    { val: 15.0, key: "15kW" },
    { val: 18.5, key: "18.5kW" },
    { val: 22.0, key: "22kW" },
    { val: 30.0, key: "30kW" },
    { val: 37.0, key: "37kW" },
    { val: 45.0, key: "45kW" },
    { val: 55.0, key: "55kW" },
    { val: 75.0, key: "75kW" }
  ];
  for (let i = 0; i < stdPowers.length; i++) {
    if (stdPowers[i].val >= customKw) {
      return stdPowers[i].key;
    }
  }
  return "75kW";
}

// Helper to find the tripolar breaker code based on resistive kW power and voltage
function parsePowerKw(powerStr) {
  if (!powerStr) return 0;
  const clean = powerStr.toString().replace("kW", "").trim().replace(",", ".");
  return parseFloat(clean) || 0;
}

function getTripolarBreakerCode(kw, voltage) {
  const vVal = parseInt(voltage.replace("V", "")) || 220;
  const current = (kw * 1000) / (Math.sqrt(3) * vVal);
  if (current <= 10) return 'MINIDISJ-MDW-C10-3';
  if (current <= 16) return 'MINIDISJ-MDW-C16-3';
  if (current <= 20) return 'MINIDISJ-MDW-C20-3';
  if (current <= 25) return 'MINIDISJ-MDW-C25-3';
  if (current <= 32) return 'MINIDISJ-MDW-C32-3';
  if (current <= 40) return 'MINIDISJ-MDW-C40-3';
  if (current <= 50) return 'MINIDISJ-MDW-C50-3';
  return 'MINIDISJ-MDW-C63-3';
}

// Helper to find the contactor code based on calculated current
function getContatorCodeForCurrent(current) {
  if (current <= 9) return 'CONTATOR-CWM9';
  if (current <= 12) return 'CONTATOR-CWM12';
  if (current <= 18) return 'CONTATOR-CWM18';
  if (current <= 25) return 'CONTATOR-CWM25';
  if (current <= 32) return 'CONTATOR-CWM32';
  return 'CONTATOR-CWM50_80';
}

function getEquipmentDetailsHTML(eq) {
  let html = `<div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px; display:flex; flex-direction:column; gap:2px;">`;
  
  let hasCabling = false;
  if (eq.power && eq.calculatedCurrent && eq.calculatedCable) {
    html += `<div><strong>Principal:</strong> Potência de ${eq.power} - Corrente: ${eq.calculatedCurrent} - Cabo: ${eq.calculatedCable}</div>`;
    hasCabling = true;
  }
  
  if (eq.type === 'UTA') {
    if (eq.hasHeating && eq.heatingPower && eq.heatingCalculatedCurrent && eq.heatingCalculatedCable) {
      const hStg = eq.heatingStages || 1;
      html += `<div><strong>Aquecimento (${hStg} Est.):</strong> Potência de ${eq.heatingPower} - Corrente: ${eq.heatingCalculatedCurrent} - Cabo: ${eq.heatingCalculatedCable} (por est.)</div>`;
      hasCabling = true;
    }
    if (eq.hasHumid && eq.humidPower && eq.humidCalculatedCurrent && eq.humidCalculatedCable) {
      const huStg = eq.humidStages || 1;
      html += `<div><strong>Umidificação (${huStg} Est.):</strong> Potência de ${eq.humidPower} - Corrente: ${eq.humidCalculatedCurrent} - Cabo: ${eq.humidCalculatedCable} (por est.)</div>`;
      hasCabling = true;
    }
  }
  
  html += `</div>`;
  return hasCabling ? html : '';
}

// Default Components per Panel Type (Dummy values)
// Calculate detailed panel components and pricing based on the PRECOS_DATABASE
function calculatePanelComponents(panel) {
  if (typeof PRECOS_DATABASE === 'undefined') {
    console.error("PRECOS_DATABASE não carregado! Verifique precos.js.");
    return [];
  }

  const getRule = (pathStr, fallback) => {
    try {
      const parts = pathStr.split('.');
      let obj = (typeof budgetState !== 'undefined') ? budgetState.customRules : null;
      if (!obj) return fallback;
      for (const p of parts) {
        if (obj[p] === undefined) return fallback;
        obj = obj[p];
      }
      return obj;
    } catch (e) {
      return fallback;
    }
  };

  const rules = {
    brumBarCurrentThreshold: getRule('brumBarCurrentThreshold', 75),
    transformerVoltageRequired: getRule('transformerVoltageRequired', '440V'),
    transformerVaRating: getRule('transformerVaRating', '400VA'),
    transformerPrice: getRule('transformerPrice', 600.0),
    cables10mm: {
      potenciaComando: {
        cinza: getRule('cables10mm.potenciaComando.cinza', 50),
        vermelho: getRule('cables10mm.potenciaComando.vermelho', 25),
        azul: getRule('cables10mm.potenciaComando.azul', 25)
      },
      completo: {
        cinza: getRule('cables10mm.completo.cinza', 50),
        vermelho: getRule('cables10mm.completo.vermelho', 25),
        azul: getRule('cables10mm.completo.azul', 25)
      },
      automacao: {
        cinza: getRule('cables10mm.automacao.cinza', 50),
        vermelho: getRule('cables10mm.automacao.vermelho', 25),
        azul: getRule('cables10mm.automacao.azul', 25)
      },
      comando: {
        vermelho: getRule('cables10mm.comando.vermelho', 10),
        azul: getRule('cables10mm.comando.azul', 10),
        cinza: getRule('cables10mm.comando.cinza', 10)
      },
      remoto: {
        vermelho: getRule('cables10mm.remoto.vermelho', 50),
        azul: getRule('cables10mm.remoto.azul', 50),
        cinza: getRule('cables10mm.remoto.cinza', 50)
      }
    },
    bornesPerEquip: {
      comando: getRule('bornesPerEquip.comando', 6),
      remoto: getRule('bornesPerEquip.remoto', 6),
      potencia: getRule('bornesPerEquip.potencia', 4),
      'potencia-comando': getRule('bornesPerEquip.potencia-comando', 10),
      automacao: getRule('bornesPerEquip.automacao', 15),
      completo: getRule('bornesPerEquip.completo', 20)
    },
    borneAccessories: {
      posteFinal: getRule('borneAccessories.posteFinal', 2),
      borneTerra: getRule('borneAccessories.borneTerra', 3),
      identificadorBr5: getRule('borneAccessories.identificadorBr5', 3),
      identificadorBtw: getRule('borneAccessories.identificadorBtw', 3),
      tampaBtwmp: getRule('borneAccessories.tampaBtwmp', 3),
      portaPlaqueta: getRule('borneAccessories.portaPlaqueta', 3)
    },
    trilhoDinQty: getRule('trilhoDinQty', 1)
  };

  const componentsMap = {}; // Key: componentCode -> { code, name, qty, unit, unitPrice, value }
  
  let currentMotorCurrent = 0;
  
  const getDisjMotorCodeByCurrent = (current) => {
    if (current <= 1.5) return 'DISJ-MOTOR-0.18_0.37kW';
    if (current <= 2.5) return 'DISJ-MOTOR-0.75kW';
    if (current <= 4.0) return 'DISJ-MOTOR-1.5kW';
    if (current <= 6.3) return 'DISJ-MOTOR-2.2kW';
    if (current <= 10.0) return 'DISJ-MOTOR-3.0_4.0kW';
    if (current <= 16.0) return 'DISJ-MOTOR-5.5_7.5kW';
    if (current <= 32.0) return 'DISJ-MOTOR-11_15kW';
    return 'DISJ-MOTOR-ACIMA-15kW';
  };
  
  const addComp = (code, qtyMultiplier = 1, customName = null, reason = "Adicionado por especificação básica do equipamento") => {
    if (!code) return;
    if (code === 'BORNE-RELE-BTWR') return; // Handled separately at the end of the function
    
    // Intercept MANOPLA-MSW-B3
    if (code === 'MANOPLA-MSW-B3') {
      const isSingleExCv = (panel.equipments && panel.equipments.length === 1 && panel.equipments[0].type === 'EX/CV');
      if (!isSingleExCv) return;
    }
    
    // Intercept DISJ-MOTOR- and replace with dynamic code if we have active motor context
    if (code.startsWith('DISJ-MOTOR-') && currentMotorCurrent > 0) {
      code = getDisjMotorCodeByCurrent(currentMotorCurrent);
    }
    
    const catItem = PRECOS_DATABASE.catalog[code];
    if (!catItem) {
      console.warn(`Componente não encontrado no catálogo: ${code}`);
      return;
    }
    const finalName = customName || catItem.desc;
    if (componentsMap[code]) {
      componentsMap[code].qty += qtyMultiplier;
      componentsMap[code].value = componentsMap[code].qty * componentsMap[code].unitPrice;
      if (customName) {
        componentsMap[code].name = customName;
      }
      if (componentsMap[code].reasons && !componentsMap[code].reasons.includes(reason)) {
        componentsMap[code].reasons.push(reason);
      }
    } else {
      componentsMap[code] = {
        code: code,
        name: finalName,
        brand: catItem.brand,
        unit: catItem.unit,
        qty: qtyMultiplier,
        unitPrice: catItem.price,
        value: qtyMultiplier * catItem.price,
        reasons: [reason]
      };
    }
  };

  const type = panel.type;
  const voltage = panel.voltage || '220V';
  
  if (type === 'comando') {
    const qty = parseInt(panel.quantity) || 1;
    
    // Fixed items (1x of each)
    addComp('CANALETA-50X80', 1, null, "Item fixo do painel tipo Comando: Canaleta 50x80");
    addComp('CANALETA-30X80', 1, null, "Item fixo do painel tipo Comando: Canaleta 30x80");
    addComp('TOMADA-DIM', 1, null, "Item fixo do painel tipo Comando: Tomada DIN");
    addComp('MINIDISJ-MDW-C10', 1, null, "Item fixo do painel tipo Comando: Minidisjuntor MDW C10");
    addComp('SINALEIRO-BRANCO', 1, null, "Item fixo do painel tipo Comando: Sinaleiro Branco");
    
    // Multiplied items (Quantity x ...)
    addComp('CHAVE-SELETORA-3POS', qty * 1, null, "Item de Comando: Chave Seletora de 3 posições");
    
    const cabCfg = rules.cables10mm.comando;
    addComp('CABO-1.0-VERMELHO', qty * cabCfg.vermelho, null, `Regra de Cabos de Controle: ${cabCfg.vermelho}m de cabo Vermelho por equipamento no Comando`);
    addComp('CABO-1.0-AZUL', qty * cabCfg.azul, null, `Regra de Cabos de Controle: ${cabCfg.azul}m de cabo Azul por equipamento no Comando`);
    addComp('CABO-1.0-CINZA', qty * cabCfg.cinza, null, `Regra de Cabos de Controle: ${cabCfg.cinza}m de cabo Cinza por equipamento no Comando`);
  }
  
  // A) Count total equipments
  let totalEquips = 0;
  if (type === 'comando' || type === 'remoto') {
    totalEquips = parseInt(panel.quantity) || 1;
  } else if (panel.equipments) {
    totalEquips = panel.equipments.length;
  }

  // Helper functions
  const parsePowerKw = (powerStr) => {
    if (!powerStr) return 0;
    const clean = powerStr.toString().replace("kW", "").trim().replace(",", ".");
    return parseFloat(clean) || 0;
  };

  const getNBR5410CableSection = (current) => {
    if (current <= 21) return '2.5';
    if (current <= 28) return '4.0';
    if (current <= 36) return '6.0';
    if (current <= 50) return '10.0';
    if (current <= 68) return '16.0';
    if (current <= 89) return '25.0';
    if (current <= 110) return '35.0';
    if (current <= 134) return '50.0';
    if (current <= 171) return '70.0';
    if (current <= 207) return '95.0';
    if (current <= 239) return '120.0';
    if (current <= 272) return '150.0';
    if (current <= 310) return '185.0';
    return '240.0';
  };

  // B) Calculate Total Power & Three-Phase Current to select WEG MSW switch
  let totalPowerKw = 0;
  if (type === 'potencia' || type === 'potencia-comando' || type === 'completo') {
    if (panel.equipments) {
      panel.equipments.forEach(eq => {
        if (eq.power) {
          const val = parsePowerKw(eq.power);
          totalPowerKw += val;
        }
        // Add custom heating power (resistive load)
        if (eq.type === 'UTA' && eq.hasHeating && eq.heatingPower) {
          const val = parsePowerKw(eq.heatingPower);
          totalPowerKw += val;
        }
        // Add custom humidification power
        if (eq.type === 'UTA' && eq.hasHumid && eq.humidPower) {
          const val = parsePowerKw(eq.humidPower);
          totalPowerKw += val;
        }
      });
    }
  } else if (type === 'automacao') {
    totalPowerKw = 2.0; // standard power of 2kW
  } else if (type === 'comando' || type === 'remoto') {
    totalPowerKw = 2.0; // 2kW monofásico for comando and remoto
  }
  
  let calculatedCurrent = 0;
  if (totalPowerKw > 0) {
    const voltageVal = parseInt(voltage.replace("V", "")) || 220;
    if (type === 'comando' || type === 'remoto') {
      calculatedCurrent = (totalPowerKw * 1000) / voltageVal;
    } else {
      calculatedCurrent = (totalPowerKw * 1000) / (Math.sqrt(3) * voltageVal * 0.85);
    }
  }
  
  // Save total power and current on panel for display/stats
  panel.totalPowerKw = totalPowerKw;
  panel.calculatedCurrent = calculatedCurrent;

  // 1. Shared / Panel-level structural components
  
  const isPureBombas = panel.equipments && panel.equipments.length > 0 && panel.equipments.every(eq => eq.type === 'BOMBAS');
  const isSingleUta = panel.equipments && panel.equipments.length === 1 && panel.equipments[0].type === 'UTA';

  // Sizing of assembly box
  let boxCode = 'QMON-300x200x250';
  let spaceUnits = 0;

  if (type === 'comando' || type === 'remoto') {
    const qty = parseInt(panel.quantity) || 1;
    spaceUnits += qty * 1.5;
    if (type === 'remoto' && panel.remotoIhmSize) {
      spaceUnits += 3;
    }
  } else {
    if (panel.equipments) {
      panel.equipments.forEach(eq => {
        if (eq.power) {
          let startType = eq.starts;
          if (Array.isArray(startType)) startType = startType[0];
          
          if (startType === 'Direta') {
            spaceUnits += 1.5;
          } else if (startType === 'Inversor') {
            const pKw = parsePowerKw(eq.power);
            if (pKw <= 2.2) spaceUnits += 3;
            else if (pKw <= 7.5) spaceUnits += 5;
            else if (pKw <= 22) spaceUnits += 8;
            else spaceUnits += 15;
          } else if (startType === 'SoftStarter') {
            const pKw = parsePowerKw(eq.power);
            if (pKw <= 7.5) spaceUnits += 3;
            else if (pKw <= 22) spaceUnits += 5;
            else spaceUnits += 10;
          } else if (startType === 'EC') {
            spaceUnits += 0.8;
          } else {
            spaceUnits += 1.5;
          }
        } else {
          spaceUnits += 1.0;
        }

        if (eq.hasHeating && eq.heatingPower) {
          const stages = parseInt(eq.heatingStages) || 1;
          if (eq.heatingControl === 'Proporcional') {
            spaceUnits += 3.5 * stages;
          } else {
            spaceUnits += 1.5 * stages;
          }
        }

        if (eq.hasHumid && eq.humidPower) {
          const stages = parseInt(eq.humidStages) || 1;
          if (eq.humidControl === 'Proporcional') {
            spaceUnits += 3.5 * stages;
          } else {
            spaceUnits += 1.5 * stages;
          }
        }
      });
    }

    if (type === 'automacao' || type === 'completo') {
      spaceUnits += 4;
    }
    if (panel.hasIhm && panel.ihmSize) {
      spaceUnits += 3;
    }
  }

  const boxes = [
    { code: 'QMON-300x200x250', cap: 2 },
    { code: 'QMON-300x300x200', cap: 3 },
    { code: 'QMON-400x300x200', cap: 4 },
    { code: 'QMON-500x400x200', cap: 6 },
    { code: 'QMON-500x500x200', cap: 8 },
    { code: 'QMON-600x400x250', cap: 10 },
    { code: 'QMON-600x500x250', cap: 12 },
    { code: 'QMON-600x600x200', cap: 16 },
    { code: 'QMON-700x600x200', cap: 22 },
    { code: 'QMON-800x600x200', cap: 30 },
    { code: 'QMON-1000x600x200', cap: 42 },
    { code: 'QMON-1200x800x200', cap: 60 },
    { code: 'QMON-1700x600x400', cap: 999 }
  ];

  let matchedBox = boxes.find(b => spaceUnits <= b.cap);
  boxCode = matchedBox ? matchedBox.code : 'QMON-1700x600x400';

  let minBoxCode = 'QMON-300x200x250';
  if (type === 'potencia' || type === 'potencia-comando' || type === 'automacao' || type === 'completo' || type === 'remoto') {
    minBoxCode = 'QMON-500x400x200';
  } else if (type === 'comando') {
    minBoxCode = 'QMON-400x300x200';
  }

  const matchedIdx = boxes.findIndex(b => b.code === boxCode);
  const minIdx = boxes.findIndex(b => b.code === minBoxCode);
  if (matchedIdx < minIdx) {
    boxCode = minBoxCode;
  }

  if (calculatedCurrent > rules.brumBarCurrentThreshold) {
    boxCode = 'QMON-1700x600x400';
    addComp('KIT-VOLT-BRUM-400A', 1, null, `Regra de Corrente Máxima: Corrente calculada (${calculatedCurrent.toFixed(1)}A) maior que o limite de ${rules.brumBarCurrentThreshold}A`);
    addComp('KIT-CONEXAO-BRUM-400A', 1, null, `Regra de Corrente Máxima: Corrente calculada (${calculatedCurrent.toFixed(1)}A) maior que o limite de ${rules.brumBarCurrentThreshold}A`);
  }

  addComp(boxCode, 1, null, `Regra de Caixa de Montagem: Quadro dimensionado como ${boxCode} devido à ocupação estimada`);

  // Transformer for 440V non-potencia panels
  if (voltage === rules.transformerVoltageRequired && type !== 'potencia') {
    addComp('TRANSFORMADOR-440-220-400VA', 1, null, `Regra de Transformador de Comando: Quadro configurado em ${voltage} e não é do tipo Potência (exige transformador de ${rules.transformerVaRating})`);
  }

  // Trilho DIN Brum 1m
  addComp('TRILHO-DIN-1M', rules.trilhoDinQty, null, `Regra Geral do Trilho DIN: Adicionado obrigatoriamente para todos os quadros elétricos (${rules.trilhoDinQty} barra(s) de 1m)`);
  
  // Canaletas based on board size
  let width = 300;
  let height = 200;
  const dimMatch = boxCode.match(/QMON-(\d+)x(\d+)/i);
  if (dimMatch) {
    width = parseInt(dimMatch[1]);
    height = parseInt(dimMatch[2]);
  }
  if (width > 400 || height > 300) {
    addComp('CANALETA-50X80', 4);
    addComp('CANALETA-30X80', 2);
  } else {
    addComp('CANALETA-50X80', 1);
    addComp('CANALETA-30X80', 1);
  }

  // 50 bornes de passagem for Potência, comando e Automação (completo)
  if (type === 'completo') {
    addComp('BORNE-BTWP-2.5', 50);
  }

  // WEG MSW Rotary switch or Disjuntor em Caixa Moldada (AGW) selection based on total three-phase current
  if (type === 'potencia' || type === 'potencia-comando' || type === 'automacao' || type === 'completo' || type === 'remoto') {
    let hasOtherThanBombasOrChiller = false;
    if (panel.equipments && panel.equipments.length > 0) {
      panel.equipments.forEach(eq => {
        if (eq.type !== 'BOMBAS' && eq.type !== 'CHILLER') {
          hasOtherThanBombasOrChiller = true;
        }
      });
    } else {
      hasOtherThanBombasOrChiller = true;
    }
    
    const mswLimit = hasOtherThanBombasOrChiller ? 160 : 100;
    const forceCaixaMoldada = isPureBombas;
    
    if (calculatedCurrent <= mswLimit && !forceCaixaMoldada) {
      let mswCode = 'MSW012F-3P00-3R';
      if (calculatedCurrent <= 12) mswCode = 'MSW012F-3P00-3R';
      else if (calculatedCurrent <= 16) mswCode = 'MSW016F-3P00-3R';
      else if (calculatedCurrent <= 20) mswCode = 'MSW020F-3P00-3R';
      else if (calculatedCurrent <= 25) mswCode = 'MSW025F-3P00-3R';
      else if (calculatedCurrent <= 32) mswCode = 'MSW032F-3P00-3R';
      else if (calculatedCurrent <= 40) mswCode = 'MSW040F-3P00-3R';
      else if (calculatedCurrent <= 63) mswCode = 'MSW063F-3P00-3R';
      else if (calculatedCurrent <= 80) mswCode = 'MSW080F-3P00-3R';
      else if (calculatedCurrent <= 100) mswCode = 'MSW100F-3P00-3R';
      else if (calculatedCurrent <= 125) mswCode = 'MSW125F-3P00-3R';
      else mswCode = 'MSW160F-3P00-3R';
      
      addComp(mswCode, 1);
    } else {
      let cbCode = 'DISJ-AGW100-3P-32A';
      let manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
      
      if (calculatedCurrent <= 32) {
        cbCode = 'DISJ-AGW100-3P-32A';
        manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
      } else if (calculatedCurrent <= 40) {
        cbCode = 'DISJ-AGW100-3P-40A';
        manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
      } else if (calculatedCurrent <= 50) {
        cbCode = 'DISJ-AGW100-3P-50A';
        manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
      } else if (calculatedCurrent <= 63) {
        cbCode = 'DISJ-AGW100-3P-63A';
        manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
      } else if (calculatedCurrent <= 80) {
        cbCode = 'DISJ-AGW100-3P-80A';
        manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
      } else if (calculatedCurrent <= 100) {
        cbCode = 'DISJ-AGW100-3P-100A';
        manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
      } else if (calculatedCurrent <= 125) {
        cbCode = 'DISJ-AGW250-3P-125A';
        manoplaCode = 'MANOPLA-ROTATIVA-AGW250';
      } else if (calculatedCurrent <= 160) {
        cbCode = 'DISJ-AGW250-3P-160A';
        manoplaCode = 'MANOPLA-ROTATIVA-AGW250';
      } else if (calculatedCurrent <= 200) {
        cbCode = 'DISJ-AGW250-3P-200A';
        manoplaCode = 'MANOPLA-ROTATIVA-AGW250';
      } else if (calculatedCurrent <= 250) {
        cbCode = 'DISJ-AGW250-3P-250A';
        manoplaCode = 'MANOPLA-ROTATIVA-AGW250';
      } else if (calculatedCurrent <= 315) {
        cbCode = 'DISJ-AGW400-3P-315A';
        manoplaCode = 'MANOPLA-ROTATIVA-AGW400';
      } else {
        cbCode = 'DISJ-AGW400-3P-400A';
        manoplaCode = 'MANOPLA-ROTATIVA-AGW400';
      }
      
      addComp(cbCode, 1);
      addComp(manoplaCode, 1);
    }
  }
  
  // Common shared items
  addComp('BARRAMENTO-TERRA', 1);
  addComp('BARRAMENTO-NEUTRO', 1);
  addComp('TOMADA-DIM', 1);
  
  // Transformador de comando para 440V
  if (voltage === '440V' && (type === 'automacao' || type === 'completo' || type === 'potencia-comando' || type === 'comando')) {
    addComp('TRANSFORMADOR-440-220', 1);
  }
  
  // Ventilação forçada se houver inversor ou aquecimento/umidificação proporcional
  let needsVentilation = false;
  if (panel.equipments && panel.equipments.length > 0) {
    panel.equipments.forEach(eq => {
      if (eq.starts && eq.starts.includes('Inversor')) needsVentilation = true;
      if (eq.nestedStarts && eq.nestedStarts.includes('Inversor')) needsVentilation = true;
      if (eq.nestedStandards && eq.nestedStandards.includes('Inversor')) needsVentilation = true;
      if (eq.type === 'UTA') {
        if (eq.hasHeating && eq.heatingControl === 'Proporcional') needsVentilation = true;
        if (eq.hasHumid && eq.humidControl === 'Proporcional') needsVentilation = true;
      }
    });
  }
  if (needsVentilation) {
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
    const cabCfg = rules.cables10mm.comando;
    for (let i = 0; i < qty; i++) {
      addComp('MINIDISJ-MDW-C10', 1, null, "Item de Comando: Minidisjuntor MDW C10 por equipamento");
      addComp('CONTATOR-CWM9', 1, null, "Item de Comando: Contator CWM9 por equipamento");
      addComp('CHAVE-SELETORA-3POS', 1, null, "Item de Comando: Chave Seletora de 3 posições por equipamento");
      addComp('SINALEIRO-VERDE', 1, null, "Item de Comando: Sinaleiro Verde de ligado por equipamento");
      addComp('SINALEIRO-VERMELHO', 1, null, "Item de Comando: Sinaleiro Vermelho de desligado por equipamento");
      addComp('BORNE-BTWP-2.5', 6, null, "Regra de Bornes de Passagem: Bornes de passagem por equipamento");
      addComp('PORTA-PLAQUETA', 3, null, "Regra de Acessórios de Bornes: Porta plaqueta por equipamento");
      // Cabos de comando separados por cor
      addComp('CABO-1.0-VERMELHO', cabCfg.vermelho, null, `Regra de Cabos de Controle: ${cabCfg.vermelho}m de cabo Vermelho por equipamento no Comando`);
      addComp('CABO-1.0-AZUL', cabCfg.azul, null, `Regra de Cabos de Controle: ${cabCfg.azul}m de cabo Azul por equipamento no Comando`);
      addComp('CABO-1.0-CINZA', cabCfg.cinza, null, `Regra de Cabos de Controle: ${cabCfg.cinza}m de cabo Cinza por equipamento no Comando`);
    }
  } 
  else if (type === 'remoto') {
    const qty = parseInt(panel.quantity) || 1;
    const cabCfg = rules.cables10mm.remoto;
    for (let i = 0; i < qty; i++) {
      addComp('MINIDISJ-MDW-C10', 1, null, "Item de Automação Remota: Minidisjuntor MDW C10 por equipamento");
      addComp('CHAVE-SELETORA-3POS', 1, null, "Item de Automação Remota: Chave Seletora de 3 posições por equipamento");
      addComp('SINALEIRO-VERDE', 1, null, "Item de Automação Remota: Sinaleiro Verde de ligado por equipamento");
      addComp('SINALEIRO-VERMELHO', 1, null, "Item de Automação Remota: Sinaleiro Vermelho de desligado por equipamento");
      // Cabos de comando separados por cor
      addComp('CABO-1.0-VERMELHO', cabCfg.vermelho, null, `Regra de Cabos de Controle: ${cabCfg.vermelho}m de cabo Vermelho por equipamento no Automação Remota`);
      addComp('CABO-1.0-AZUL', cabCfg.azul, null, `Regra de Cabos de Controle: ${cabCfg.azul}m de cabo Azul por equipamento no Automação Remota`);
      addComp('CABO-1.0-CINZA', cabCfg.cinza, null, `Regra de Cabos de Controle: ${cabCfg.cinza}m de cabo Cinza por equipamento no Automação Remota`);
    }
    addComp('SINALEIRO-BRANCO', 1, null, "Item de Automação Remota: Sinaleiro Branco de energizado");
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
      const voltageVal = parseInt(voltage.replace("V", "")) || 220;

      // Control cables rules for potencia-comando, completo, automacao
      if (type === 'potencia-comando' || type === 'completo' || type === 'automacao') {
        const typeKey = type === 'potencia-comando' ? 'potenciaComando' : (type === 'completo' ? 'completo' : 'automacao');
        const cabCfg = rules.cables10mm[typeKey];
        addComp('CABO-1.0-CINZA', cabCfg.cinza, null, `Regra de Cabos de Controle: ${cabCfg.cinza}m de cabo Cinza por equipamento no quadro tipo ${type}`);
        addComp('CABO-1.0-VERMELHO', cabCfg.vermelho, null, `Regra de Cabos de Controle: ${cabCfg.vermelho}m de cabo Vermelho por equipamento no quadro tipo ${type}`);
        addComp('CABO-1.0-AZUL', cabCfg.azul, null, `Regra de Cabos de Controle: ${cabCfg.azul}m de cabo Azul por equipamento no quadro tipo ${type}`);
      }

      // Borne Relé rule:
      if (type === 'completo') {
        if (eqType === 'UTA' || eqType === 'EX/CV') {
          addComp('PRESSOSTATO-DIF', 2);
        }
      }
      if (eqType === 'UTA') {
        addComp('BORNE-RELE-BTWR', 5);
        if (eq.hasHeating) addComp('BORNE-RELE-BTWR', 1);
        if (eq.hasHumid) addComp('BORNE-RELE-BTWR', 1);
      } else if (eqType === 'EX/CV') {
        addComp('BORNE-RELE-BTWR', 5);
      } else if (eqType === 'BOMBAS' || eqType === 'CHILLER') {
        addComp('BORNE-RELE-BTWR', 3);
      }

      // Calculate primary power cable using NBR 5410
      let motorCurrent = 0;
      if (eq.power) {
        const motorPowerKw = parsePowerKw(eq.power);
        if (motorPowerKw > 0) {
          motorCurrent = (motorPowerKw * 1000) / (Math.sqrt(3) * voltageVal * 0.85);
          const sec = getNBR5410CableSection(motorCurrent);
          if (type !== 'automacao' && type !== 'remoto') {
        addComp(`CABO-POT-${sec}-PRETO`, 25);
        addComp(`CABO-POT-${sec}-VERDE`, 10);
      }
          eq.calculatedCurrent = motorCurrent.toFixed(1).replace('.', ',') + ' A';
          eq.calculatedCable = sec + ' mm²';
        } else {
          eq.calculatedCurrent = null;
          eq.calculatedCable = null;
        }
      } else {
        eq.calculatedCurrent = null;
        eq.calculatedCable = null;
      }
      currentMotorCurrent = motorCurrent;
      
      // A) Power starting components
      const hasPowerCol = (type === 'potencia' || type === 'potencia-comando' || type === 'completo');
      if (hasPowerCol) {
        let startingType = eq.starts;
        if (Array.isArray(startingType)) {
          startingType = startingType[0];
        }
        let power = eq.power;
        
        if (eqType === 'CHILLER' && power) {
          const kw = parsePowerKw(power);
          if (kw > 0) {
            const current = (kw * 1000) / (Math.sqrt(3) * voltageVal * 0.85);
            
            let cbCode = 'DISJ-AGW100-3P-32A';
            let manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
            
            if (current <= 32) {
              cbCode = 'DISJ-AGW100-3P-32A';
              manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
            } else if (current <= 40) {
              cbCode = 'DISJ-AGW100-3P-40A';
              manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
            } else if (current <= 50) {
              cbCode = 'DISJ-AGW100-3P-50A';
              manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
            } else if (current <= 63) {
              cbCode = 'DISJ-AGW100-3P-63A';
              manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
            } else if (current <= 80) {
              cbCode = 'DISJ-AGW100-3P-80A';
              manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
            } else if (current <= 100) {
              cbCode = 'DISJ-AGW100-3P-100A';
              manoplaCode = 'MANOPLA-ROTATIVA-AGW100';
            } else if (current <= 125) {
              cbCode = 'DISJ-AGW250-3P-125A';
              manoplaCode = 'MANOPLA-ROTATIVA-AGW250';
            } else if (current <= 160) {
              cbCode = 'DISJ-AGW250-3P-160A';
              manoplaCode = 'MANOPLA-ROTATIVA-AGW250';
            } else if (current <= 200) {
              cbCode = 'DISJ-AGW250-3P-200A';
              manoplaCode = 'MANOPLA-ROTATIVA-AGW250';
            } else if (current <= 250) {
              cbCode = 'DISJ-AGW250-3P-250A';
              manoplaCode = 'MANOPLA-ROTATIVA-AGW250';
            } else if (current <= 315) {
              cbCode = 'DISJ-AGW400-3P-315A';
              manoplaCode = 'MANOPLA-ROTATIVA-AGW400';
            } else {
              cbCode = 'DISJ-AGW400-3P-400A';
              manoplaCode = 'MANOPLA-ROTATIVA-AGW400';
            }
            
            addComp(cbCode, 1);
            addComp(manoplaCode, 1);
            addComp('PORTA-PLAQUETA', 1);
          }
        } else if (startingType && power) {
          if (eqType === 'BOMBAS') {
            if (startingType === 'Direta') {
              const compKey = `Direta_${power}_${voltage}`;
              const composition = PRECOS_DATABASE.compositions[compKey];
              if (composition) {
                composition.forEach(c => {
                  if (c.code.startsWith('DISJ-MOTOR') || c.code.startsWith('CONTATOR')) {
                    addComp(c.code, c.qty);
                  }
                });
                addComp('PORTA-PLAQUETA', 1);
              }
            } else if (startingType === 'Inversor') {
              const compKey = `Inversor_${power}_${voltage}`;
              const composition = PRECOS_DATABASE.compositions[compKey];
              if (composition) {
                composition.forEach(c => {
                  if (c.code.startsWith('CFW500') || c.code.startsWith('INVERSOR')) {
                    addComp(c.code, c.qty);
                  }
                });
              }
              const diretaKey = `Direta_${power}_${voltage}`;
              const diretaComp = PRECOS_DATABASE.compositions[diretaKey];
              if (diretaComp) {
                diretaComp.forEach(c => {
                  if (c.code.startsWith('DISJ-MOTOR')) {
                    addComp(c.code, c.qty);
                  }
                });
              }
              addComp('PORTA-PLAQUETA', 1);
            } else if (startingType === 'SoftStarter') {
              const compKey = `SoftStarter_${power}_${voltage}`;
              const composition = PRECOS_DATABASE.compositions[compKey];
              if (composition) {
                composition.forEach(c => {
                  if (c.code.startsWith('SOFTSTARTER')) {
                    addComp(c.code, c.qty);
                  }
                });
              }
              const diretaKey = `Direta_${power}_${voltage}`;
              const diretaComp = PRECOS_DATABASE.compositions[diretaKey];
              if (diretaComp) {
                diretaComp.forEach(c => {
                  if (c.code.startsWith('DISJ-MOTOR')) {
                    addComp(c.code, c.qty);
                  }
                });
              }
              addComp('PORTA-PLAQUETA', 1);
            }
          } else {
            const compKey = `${startingType}_${power}_${voltage}`;
            const composition = PRECOS_DATABASE.compositions[compKey];
            if (composition) {
              composition.forEach(c => {
                addComp(c.code, c.qty);
              });
              addComp('PORTA-PLAQUETA', 1);
            }
            if (startingType === 'EC') {
              addComp('MINIDISJ-MDW-C10-3', 1); // 1x Disjuntor Tripolar de proteção 10A
            }
          }
        }
      }
      
      // B) Command items (signal lights + selector switch + bornes)
      const hasCommandItems = (type === 'potencia-comando' || type === 'completo');
      if (hasCommandItems) {
        addComp('CHAVE-SELETORA-3POS', 1);
        addComp('SINALEIRO-VERDE', 1);
        addComp('SINALEIRO-VERMELHO', 1);
        addComp('BORNE-BTWP-2.5', 6);
        addComp('PORTA-PLAQUETA', 3);
      }
      
      // C) Automation sensors and digital outputs
      const hasAutomationCol = (type === 'automacao' || type === 'completo');
      if (hasAutomationCol) {
        let hasAutomationComponents = false;
        
        if ((eqType === 'UTA' || eqType === 'EX/CV') && eq.readings) {
          const readings = eq.readings;
          
          let hasTempDuto = readings.includes("Temp Duto");
          let hasUmidDuto = readings.includes("Umid Duto");
          let hasTempAmb = readings.includes("Temp Ambiente");
          let hasUmidAmb = readings.includes("Umid Ambiente");
          
          if (hasTempDuto && hasUmidDuto) {
            addComp('SENS-TEMP-UMID-DUTO', 1);
            hasAutomationComponents = true;
          } else {
            if (hasTempDuto) {
              addComp('SENS-TEMP-DUTO', 1);
              hasAutomationComponents = true;
            }
            if (hasUmidDuto) {
              addComp('SENS-UMIDADE-DUTO', 1);
              hasAutomationComponents = true;
            }
          }
          
          if (hasTempAmb && hasUmidAmb) {
            addComp('SENS-TEMP-UMID-AMBIENTE', 1);
            hasAutomationComponents = true;
          } else {
            if (hasTempAmb) {
              addComp('SENS-TEMP-AMBIENTE', 1);
              hasAutomationComponents = true;
            }
            if (hasUmidAmb) {
              addComp('SENS-UMIDADE-AMBIENTE', 1);
              hasAutomationComponents = true;
            }
          }
          
          if (readings.includes("CO2 Duto")) {
            addComp('SENS-CO2-DUTO', 1);
            hasAutomationComponents = true;
          }
          if (readings.includes("CO2 Ambiente")) {
            addComp('SENS-CO2-AMBIENTE', 1);
            hasAutomationComponents = true;
          }
          
          if ((eqType === 'UTA' || eqType === 'EX/CV') && readings.includes("Vazão")) {
            addComp('TRANS-PRES-DIF', 1);
            hasAutomationComponents = true;
          }
          
          if (eqType === 'UTA' && eq.nestedStarts) {
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

      // D) Custom UTA additional configurations (Heating, Humidification, Valve)
      if (eqType === 'UTA') {
        // Heating components
        if (eq.hasHeating && eq.heatingPower) {
      const customKw = parsePowerKw(eq.heatingPower);
      const stages = parseInt(eq.heatingStages) || 1;
      const stageKw = customKw / stages;
      
      const stageCurrent = (stageKw * 1000) / (Math.sqrt(3) * voltageVal);
      const breakerCode = getTripolarBreakerCode(stageKw, voltage);
      const sec = getNBR5410CableSection(stageCurrent);
      
      if (type !== 'automacao' && type !== 'remoto') {
        // Power cable for heating stages
        addComp(`CABO-POT-${sec}-PRETO`, stages * 25);
        addComp(`CABO-POT-${sec}-VERDE`, stages * 10);
        
        if (eq.heatingControl === 'OnOff') {
          const contatorCode = getContatorCodeForCurrent(stageCurrent);
          addComp(contatorCode, stages);
          addComp(breakerCode, stages);
          addComp('PORTA-PLAQUETA', stages);
        } else if (eq.heatingControl === 'Proporcional') {
          const powerStr = stageKw % 1 === 0 ? stageKw.toFixed(0) : stageKw.toFixed(1).replace('.', ',');
          const customName = `CONVERSOR DE POTÊNCIA ${powerStr}kW TENSÃO ${voltage} 0 À 10V`;
          addComp('CONTROLADOR-PROP-AQUECIMENTO', stages, customName);
          addComp(breakerCode, stages);
          addComp('PORTA-PLAQUETA', stages);
        }
      }
      
      eq.heatingCalculatedCurrent = stageCurrent.toFixed(1).replace('.', ',') + ' A';
      eq.heatingCalculatedCable = sec + ' mm²';
    } else {
          eq.heatingCalculatedCurrent = null;
          eq.heatingCalculatedCable = null;
        }

        // Humidification components
        if (eq.hasHumid && eq.humidPower) {
      const customKw = parsePowerKw(eq.humidPower);
      const stages = parseInt(eq.humidStages) || 1;
      const stageKw = customKw / stages;
      
      const stageCurrent = (stageKw * 1000) / (Math.sqrt(3) * voltageVal);
      const breakerCode = getTripolarBreakerCode(stageKw, voltage);
      const sec = getNBR5410CableSection(stageCurrent);
      
      if (type !== 'automacao' && type !== 'remoto') {
        // Power cable for humidification stages
        addComp(`CABO-POT-${sec}-PRETO`, stages * 25);
        addComp(`CABO-POT-${sec}-VERDE`, stages * 10);
        
        if (eq.humidControl === 'OnOff') {
          const contatorCode = getContatorCodeForCurrent(stageCurrent);
          addComp(contatorCode, stages);
          addComp(breakerCode, stages);
          addComp('PORTA-PLAQUETA', stages);
        } else if (eq.humidControl === 'Proporcional') {
          const powerStr = stageKw % 1 === 0 ? stageKw.toFixed(0) : stageKw.toFixed(1).replace('.', ',');
          const customName = `CONVERSOR DE POTÊNCIA ${powerStr}kW TENSÃO ${voltage} 0 À 10V`;
          addComp('CONTROLADOR-PROP-UMIDIFICACAO', stages, customName);
          addComp(breakerCode, stages);
          addComp('PORTA-PLAQUETA', stages);
        }
      }
      
      eq.humidCalculatedCurrent = stageCurrent.toFixed(1).replace('.', ',') + ' A';
      eq.humidCalculatedCable = sec + ' mm²';
    } else {
          eq.humidCalculatedCurrent = null;
          eq.humidCalculatedCable = null;
        }

        // Expansion valves removed for UTA (they are only for Chiller)
      }
    });
    
    // D) CLP and Connector kit rules based on equipment counts
  if (type === 'automacao' || type === 'remoto' || type === 'completo') {
    let clpCode = null;
    let connCode = null;

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
      clpCode = selectedClpRule.clpCode;
      connCode = selectedClpRule.connCode;
    } else {
      // Fallback/Virtual equipments based selection for control panels
      const totalCount = panel.equipments && panel.equipments.length > 0 ? panel.equipments.length : (parseInt(panel.quantity) || 0);
      if (totalCount >= 3) {
        clpCode = 'CLP-CAREL-PCOOEM-MEDIO';
        connCode = 'CONECTORES-PCOOEM-MEDIO';
      } else {
        clpCode = 'CLP-CAREL-CPCO-MINI';
        connCode = 'CONECTORES-CPCO-SMALL';
      }
    }

    if (clpCode) addComp(clpCode, 1);
    if (connCode) addComp(connCode, 1);
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
  
  // 4. SCADA Supervisório Selection (Rules based on equipment count)
  if (panel.hasSupervisorio) {
    const rule = PRECOS_DATABASE.supervisorioRules.find(r => totalEquips >= r.minQty && totalEquips <= r.maxQty);
    if (rule) {
      addComp(rule.code, rule.qty);
    }
  }

  // 5. Borne accessories and terminal block calculations (Unified override)
  delete componentsMap['BORNE-BTWP-2.5'];
  delete componentsMap['POSTE-FINAL'];
  delete componentsMap['BORNE-TERRA-2.5T'];
  delete componentsMap['IDENTIFICADOR-BR5'];
  delete componentsMap['IDENTIFICADOR-BTW'];
  delete componentsMap['TAMPA-BTWMP'];
  delete componentsMap['PORTA-PLAQUETA'];

  const totalEquipsCount = (type === 'comando' || type === 'remoto') ? (panel.quantity || 1) : (panel.equipments ? panel.equipments.length : 0);
  if (totalEquipsCount > 0) {
    let bornesPerEquip = 0;
    if (type === 'comando') bornesPerEquip = rules.bornesPerEquip.comando;
    else if (type === 'remoto') bornesPerEquip = rules.bornesPerEquip.remoto;
    else if (type === 'potencia') bornesPerEquip = rules.bornesPerEquip.potencia;
    else if (type === 'potencia-comando') bornesPerEquip = rules.bornesPerEquip['potencia-comando'];
    else if (type === 'automacao') bornesPerEquip = rules.bornesPerEquip.automacao;
    else if (type === 'completo') bornesPerEquip = rules.bornesPerEquip.completo;

    if (bornesPerEquip > 0) {
      addComp('BORNE-BTWP-2.5', totalEquipsCount * bornesPerEquip, null, `Regra de Bornes de Passagem: ${bornesPerEquip} bornes de passagem por equipamento no quadro tipo ${type}`);
    }

    const acc = rules.borneAccessories;
    addComp('POSTE-FINAL', totalEquipsCount * acc.posteFinal, null, `Regra de Acessórios de Bornes: ${acc.posteFinal} Poste Final por equipamento`);
    addComp('BORNE-TERRA-2.5T', totalEquipsCount * acc.borneTerra, null, `Regra de Acessórios de Bornes: ${acc.borneTerra} Borne Terra por equipamento`);
    addComp('IDENTIFICADOR-BR5', totalEquipsCount * acc.identificadorBr5, null, `Regra de Acessórios de Bornes: ${acc.identificadorBr5} Identificador BR 5mm por equipamento`);
    addComp('IDENTIFICADOR-BTW', totalEquipsCount * acc.identificadorBtw, null, `Regra de Acessórios de Bornes: ${acc.identificadorBtw} Identificador BTW por equipamento`);
    addComp('TAMPA-BTWMP', totalEquipsCount * acc.tampaBtwmp, null, `Regra de Acessórios de Bornes: ${acc.tampaBtwmp} Tampa de fechamento por equipamento`);
    addComp('PORTA-PLAQUETA', totalEquipsCount * acc.portaPlaqueta, null, `Regra de Acessórios de Bornes: ${acc.portaPlaqueta} Porta Plaqueta por equipamento`);
  }

  // 6. Contact Auxiliar for Disjuntor Motor rule
  let totalDisjMotorQty = 0;
  Object.keys(componentsMap).forEach(key => {
    if (key.startsWith('DISJ-MOTOR')) {
      totalDisjMotorQty += componentsMap[key].qty;
    }
  });
  if (totalDisjMotorQty > 0) {
    addComp('CONTATO-AUX-ACBF11', totalDisjMotorQty, null, `Regra de Contato Auxiliar: 1 contato auxiliar ACBF11 para cada disjuntor motor do quadro`);
  }
  
  // 7. Manual Additions (Bypassing interceptors)
  // Add exactly 1 unit of SINALEIRO-BRANCO for all standard panels
  const sinaleiroCode = 'SINALEIRO-BRANCO';
  const sinItem = PRECOS_DATABASE.catalog[sinaleiroCode];
  if (sinItem) {
    componentsMap[sinaleiroCode] = {
      code: sinaleiroCode,
      name: sinItem.desc,
      brand: sinItem.brand,
      unit: sinItem.unit,
      qty: 1,
      unitPrice: sinItem.price,
      value: sinItem.price,
      reasons: ["Regra Geral de Segurança: Adicionado 1 Sinaleiro Branco de painel energizado por padrão"]
    };
  }

  // Add exactly 2 x BORNE-RELE-BTWR per equipment for standard panels
  if (panel.equipments && panel.equipments.length > 0) {
    const totalEquipsCount = panel.equipments.length;
    const releCode = 'BORNE-RELE-BTWR';
    const releItem = PRECOS_DATABASE.catalog[releCode];
    if (releItem) {
      componentsMap[releCode] = {
        code: releCode,
        name: releItem.desc,
        brand: releItem.brand,
        unit: releItem.unit,
        qty: 2 * totalEquipsCount,
        unitPrice: releItem.price,
        value: 2 * totalEquipsCount * releItem.price,
        reasons: [`Regra de Interface de Revezamento: Adicionado 2 Relés de Interface de Acoplamento por equipamento (${2 * totalEquipsCount} total)`]
      };
    }
  }
  
  return Object.values(componentsMap);
}

let currentLogicModalState = null; // { panelId, compIdx, ruleKey, subKey }

function closeLogicModal() {
  const popup = document.getElementById('dynamic-logic-popup');
  if (popup) {
    popup.remove();
  }
  currentLogicModalState = null;
}

function openLogicModal(panelId, compIdx) {
  try {
    // Clean up any existing popup first
    const existing = document.getElementById('dynamic-logic-popup');
    if (existing) {
      existing.remove();
    }

    const panel = budgetState.panels.find(p => p.id === panelId);
    if (!panel || !panel.components[compIdx]) return;
    
    const comp = panel.components[compIdx];
    currentLogicModalState = { panelId, compIdx };

    const reasonsHTML = comp.reasons && comp.reasons.length > 0 
      ? comp.reasons.map(r => `<div style="padding: 8px 12px; background: rgba(99, 102, 241, 0.05); border-left: 3px solid var(--primary, #6366f1); margin-bottom: 8px; border-radius: 4px; line-height: 1.4; color: var(--text-primary, #ffffff); font-size: 0.8rem;">${r}</div>`).join('')
      : `<div style="padding: 8px 12px; background: rgba(245, 158, 11, 0.05); border-left: 3px solid #f59e0b; margin-bottom: 8px; border-radius: 4px; font-size: 0.8rem; color: var(--text-primary, #ffffff);">Item adicionado por especificação padrão de componentes.</div>`;

    let adjustHTML = '';
    const code = comp.code;
    const rules = budgetState.customRules;

    if (code === 'BORNE-BTWP-2.5') {
      const type = panel.type;
      adjustHTML = `
        <div style="margin-top: 15px; border-top: 1px solid var(--border-color, #3a3a4a); padding-top: 15px;">
          <h4 style="font-weight:600; margin-bottom:10px; font-size:0.9rem; color:var(--text-primary, #ffffff);">Ajustar Lógica de Bornes de Passagem</h4>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" style="font-size:0.75rem; margin-bottom:4px; color: var(--text-secondary, #a0a0b0); display: block;">Bornes por Equipamento (Tipo ${type.toUpperCase()})</label>
            <input type="number" class="form-control" id="edit-logic-value" value="${rules.bornesPerEquip[type] || 6}" min="0" style="height:36px; background: var(--bg-primary, #0f0f1a); border: 1px solid var(--border-color, #3a3a4a); color: var(--text-primary, #ffffff); width: 100%; border-radius: 4px; padding: 0 10px; box-sizing: border-box;">
          </div>
        </div>
      `;
      currentLogicModalState.ruleKey = 'bornesPerEquip';
      currentLogicModalState.subKey = type;
    }
    else if (code === 'KIT-VOLT-BRUM-400A' || code === 'KIT-CONEXAO-BRUM-400A') {
      adjustHTML = `
        <div style="margin-top: 15px; border-top: 1px solid var(--border-color, #3a3a4a); padding-top: 15px;">
          <h4 style="font-weight:600; margin-bottom:10px; font-size:0.9rem; color:var(--text-primary, #ffffff);">Ajustar Limite de Corrente do Barramento Brum</h4>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" style="font-size:0.75rem; margin-bottom:4px; color: var(--text-secondary, #a0a0b0); display: block;">Limite de Corrente para Barramento (Amperes)</label>
            <input type="number" class="form-control" id="edit-logic-value" value="${rules.brumBarCurrentThreshold}" min="10" style="height:36px; background: var(--bg-primary, #0f0f1a); border: 1px solid var(--border-color, #3a3a4a); color: var(--text-primary, #ffffff); width: 100%; border-radius: 4px; padding: 0 10px; box-sizing: border-box;">
          </div>
        </div>
      `;
      currentLogicModalState.ruleKey = 'brumBarCurrentThreshold';
    }
    else if (code === 'TRANSFORMADOR-440-220-400VA') {
      adjustHTML = `
        <div style="margin-top: 15px; border-top: 1px solid var(--border-color, #3a3a4a); padding-top: 15px;">
          <h4 style="font-weight:600; margin-bottom:10px; font-size:0.9rem; color:var(--text-primary, #ffffff);">Ajustar Preço do Transformador de Comando</h4>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" style="font-size:0.75rem; margin-bottom:4px; color: var(--text-secondary, #a0a0b0); display: block;">Preço Unitário do Transformador (R$)</label>
            <input type="number" class="form-control" id="edit-logic-value" value="${rules.transformerPrice}" min="0" step="0.01" style="height:36px; background: var(--bg-primary, #0f0f1a); border: 1px solid var(--border-color, #3a3a4a); color: var(--text-primary, #ffffff); width: 100%; border-radius: 4px; padding: 0 10px; box-sizing: border-box;">
          </div>
        </div>
      `;
      currentLogicModalState.ruleKey = 'transformerPrice';
    }
    else if (code === 'TRILHO-DIN-1M') {
      adjustHTML = `
        <div style="margin-top: 15px; border-top: 1px solid var(--border-color, #3a3a4a); padding-top: 15px;">
          <h4 style="font-weight:600; margin-bottom:10px; font-size:0.9rem; color:var(--text-primary, #ffffff);">Ajustar Quantidade de Trilho DIN</h4>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" style="font-size:0.75rem; margin-bottom:4px; color: var(--text-secondary, #a0a0b0); display: block;">Barras de 1m por Quadro</label>
            <input type="number" class="form-control" id="edit-logic-value" value="${rules.trilhoDinQty}" min="0" style="height:36px; background: var(--bg-primary, #0f0f1a); border: 1px solid var(--border-color, #3a3a4a); color: var(--text-primary, #ffffff); width: 100%; border-radius: 4px; padding: 0 10px; box-sizing: border-box;">
          </div>
        </div>
      `;
      currentLogicModalState.ruleKey = 'trilhoDinQty';
    }
    else if (code.startsWith('CABO-1.0-')) {
      const type = panel.type;
      const typeKey = type === 'potencia-comando' ? 'potenciaComando' : (type === 'completo' ? 'completo' : (type === 'automacao' ? 'automacao' : (type === 'comando' ? 'comando' : 'remoto')));
      const color = code.endsWith('CINZA') ? 'cinza' : (code.endsWith('VERMELHO') ? 'vermelho' : 'azul');
      const cabConfig = rules.cables10mm[typeKey] || { cinza: 50, vermelho: 25, azul: 25 };
      adjustHTML = `
        <div style="margin-top: 15px; border-top: 1px solid var(--border-color, #3a3a4a); padding-top: 15px;">
          <h4 style="font-weight:600; margin-bottom:10px; font-size:0.9rem; color:var(--text-primary, #ffffff);">Ajustar Metragem do Cabo de Comando 1.0mm²</h4>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" style="font-size:0.75rem; margin-bottom:4px; color: var(--text-secondary, #a0a0b0); display: block;">Metragem do Cabo ${color.toUpperCase()} por Equipamento (Tipo ${type.toUpperCase()})</label>
            <input type="number" class="form-control" id="edit-logic-value" value="${cabConfig[color] || 25}" min="0" style="height:36px; background: var(--bg-primary, #0f0f1a); border: 1px solid var(--border-color, #3a3a4a); color: var(--text-primary, #ffffff); width: 100%; border-radius: 4px; padding: 0 10px; box-sizing: border-box;">
          </div>
        </div>
      `;
      currentLogicModalState.ruleKey = 'cables10mm';
      currentLogicModalState.subKey = typeKey;
      currentLogicModalState.color = color;
    }
    else if (['POSTE-FINAL', 'BORNE-TERRA-2.5T', 'IDENTIFICADOR-BR5', 'IDENTIFICADOR-BTW', 'TAMPA-BTWMP', 'PORTA-PLAQUETA'].includes(code)) {
      let key = 'posteFinal';
      let label = 'Poste Final';
      if (code === 'BORNE-TERRA-2.5T') { key = 'borneTerra'; label = 'Borne Terra 2.5mm²'; }
      else if (code === 'IDENTIFICADOR-BR5') { key = 'identificadorBr5'; label = 'Identificador BR 5mm'; }
      else if (code === 'IDENTIFICADOR-BTW') { key = 'identificadorBtw'; label = 'Identificador BTW'; }
      else if (code === 'TAMPA-BTWMP') { key = 'tampaBtwmp'; label = 'Tampa de fechamento'; }
      else if (code === 'PORTA-PLAQUETA') { key = 'portaPlaqueta'; label = 'Porta Plaqueta'; }

      adjustHTML = `
        <div style="margin-top: 15px; border-top: 1px solid var(--border-color, #3a3a4a); padding-top: 15px;">
          <h4 style="font-weight:600; margin-bottom:10px; font-size:0.9rem; color:var(--text-primary, #ffffff);">Ajustar Proporção de Acessórios</h4>
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label" style="font-size:0.75rem; margin-bottom:4px; color: var(--text-secondary, #a0a0b0); display: block;">Quantidade de ${label} por Equipamento</label>
            <input type="number" class="form-control" id="edit-logic-value" value="${rules.borneAccessories[key] || 3}" min="0" style="height:36px; background: var(--bg-primary, #0f0f1a); border: 1px solid var(--border-color, #3a3a4a); color: var(--text-primary, #ffffff); width: 100%; border-radius: 4px; padding: 0 10px; box-sizing: border-box;">
          </div>
        </div>
      `;
      currentLogicModalState.ruleKey = 'borneAccessories';
      currentLogicModalState.subKey = key;
    }
    else {
      adjustHTML = `
        <div style="margin-top: 15px; border-top: 1px solid var(--border-color, #3a3a4a); padding-top: 15px; color: var(--text-secondary, #a0a0b0); text-align: center; font-size: 0.8rem; line-height: 1.4;">
          A inclusão deste componente é gerada dinamicamente com base nas especificações da planilha de composição ou sensores. Para alterar estes valores, modifique o equipamento na tela de criação/edição.
        </div>
      `;
    }

    // Create the Popup Overlay container
    const overlay = document.createElement('div');
    overlay.id = 'dynamic-logic-popup';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '99999';

    // Container card
    const card = document.createElement('div');
    card.style.backgroundColor = 'var(--bg-secondary, #1e1e2e)';
    card.style.border = '1px solid var(--border-color, #3a3a4a)';
    card.style.borderRadius = '8px';
    card.style.width = '90%';
    card.style.maxWidth = '460px';
    card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.overflow = 'hidden';
    card.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '14px 18px';
    header.style.borderBottom = '1px solid var(--border-color, #3a3a4a)';
    header.innerHTML = `
      <h3 style="margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-primary, #ffffff);">Ajustar Lógica de Inclusão</h3>
      <button type="button" id="close-dynamic-logic-btn" style="background: none; border: none; color: var(--text-secondary, #a0a0b0); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px;">
        <svg viewBox="0 0 24 24" style="width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><path d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    `;

    // Body
    const pBody = document.createElement('div');
    pBody.style.padding = '18px';
    pBody.style.overflowY = 'auto';
    pBody.style.maxHeight = '65vh';
    pBody.innerHTML = `
      <div style="margin-bottom: 15px;">
        <span style="font-size: 0.72rem; color: var(--text-secondary, #a0a0b0); display: block; margin-bottom: 4px;">Componente</span>
        <strong style="font-size: 0.92rem; color: var(--text-primary, #ffffff);">${comp.name}</strong>
        <span style="font-size: 0.7rem; color: var(--text-secondary, #a0a0b0); display: block; font-family: monospace; margin-top:2px;">Código: ${comp.code}</span>
      </div>
      <div style="margin-bottom: 15px;">
        <span style="font-size: 0.72rem; color: var(--text-secondary, #a0a0b0); display: block; margin-bottom: 6px;">Por que este item está na lista?</span>
        ${reasonsHTML}
      </div>
      ${adjustHTML}
    `;

    // Footer
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.style.padding = '14px 18px';
    footer.style.borderTop = '1px solid var(--border-color, #3a3a4a)';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.style.padding = '8px 16px';
    cancelBtn.style.fontSize = '0.8rem';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.border = '1px solid var(--border-color, #3a3a4a)';
    cancelBtn.style.backgroundColor = 'transparent';
    cancelBtn.style.color = 'var(--text-secondary, #a0a0b0)';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.addEventListener('click', closeLogicModal);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Salvar e Recalcular';
    saveBtn.style.padding = '8px 16px';
    saveBtn.style.fontSize = '0.8rem';
    saveBtn.style.borderRadius = '4px';
    saveBtn.style.border = 'none';
    saveBtn.style.backgroundColor = 'var(--primary, #6366f1)';
    saveBtn.style.color = '#ffffff';
    saveBtn.style.cursor = 'pointer';
    if (!currentLogicModalState.ruleKey) {
      saveBtn.style.display = 'none';
    }
    saveBtn.addEventListener('click', saveCustomLogic);

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);

    card.appendChild(header);
    card.appendChild(pBody);
    card.appendChild(footer);
    overlay.appendChild(card);

    document.body.appendChild(overlay);

    // Attach close listener to Header button
    document.getElementById('close-dynamic-logic-btn').addEventListener('click', closeLogicModal);
  } catch (err) {
    console.error("Erro ao abrir modal de lógica:", err);
    alert("Erro ao abrir modal de lógica:\n" + err.message + "\n" + err.stack);
  }
}

function saveCustomLogic() {
  try {
    if (!currentLogicModalState || !currentLogicModalState.ruleKey) {
      closeLogicModal();
      return;
    }

    const input = document.getElementById('edit-logic-value');
    if (!input) {
      closeLogicModal();
      return;
    }

    const value = parseFloat(input.value);
    if (isNaN(value) || value < 0) {
      alert("Por favor, insira um valor válido.");
      return;
    }

    const { ruleKey, subKey, color } = currentLogicModalState;
    
    if (ruleKey === 'cables10mm') {
      budgetState.customRules.cables10mm[subKey][color] = value;
    } else if (ruleKey === 'bornesPerEquip') {
      budgetState.customRules.bornesPerEquip[subKey] = Math.round(value);
    } else if (ruleKey === 'borneAccessories') {
      budgetState.customRules.borneAccessories[subKey] = Math.round(value);
    } else if (ruleKey === 'brumBarCurrentThreshold') {
      budgetState.customRules.brumBarCurrentThreshold = value;
    } else if (ruleKey === 'transformerPrice') {
      budgetState.customRules.transformerPrice = value;
      if (typeof PRECOS_DATABASE !== 'undefined' && PRECOS_DATABASE.catalog && PRECOS_DATABASE.catalog['TRANSFORMADOR-440-220-400VA']) {
        PRECOS_DATABASE.catalog['TRANSFORMADOR-440-220-400VA'].price = value;
      }
    } else if (ruleKey === 'trilhoDinQty') {
      budgetState.customRules.trilhoDinQty = Math.round(value);
    }

    // Recalculate components of all panels to apply the updated custom rules!
    budgetState.panels.forEach(panel => {
      const customPrices = {};
      if (panel.components) {
        panel.components.forEach(c => {
          customPrices[c.code] = c.value;
        });
      }
      panel.components = calculatePanelComponents(panel);
      panel.components.forEach(c => {
        if (customPrices[c.code] !== undefined) {
          if (c.code !== 'TRANSFORMADOR-440-220-400VA') {
            c.value = customPrices[c.code];
          }
        }
      });
    });

    saveState();
    closeLogicModal();
    renderPanelsList(); // Refresh view
  } catch (err) {
    console.error("Erro ao salvar lógica customizada:", err);
    alert("Erro ao salvar lógica:\n" + err.message + "\n" + err.stack);
  }
}

// Wrapper for backward compatibility / fallback
function getDefaultComponents(panelType) {
  return calculatePanelComponents({ type: panelType, voltage: '220V', quantity: 1, equipments: [] });
}

// DOM Elements (initialized in DOMContentLoaded)
let views = {};
let navLinks = [];
let viewTitle = null;
let viewSubtitle = null;

// Load data from LocalStorage
function loadState() {
  try {
    const savedState = localStorage.getItem('panel_builder_state');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        budgetState = parsed;
      } else {
        budgetState = { panels: [], theme: 'dark' };
      }
    }
    
    if (!budgetState) {
      budgetState = { panels: [], theme: 'dark' };
    }
    if (!budgetState.panels) budgetState.panels = [];
    if (!budgetState.theme) budgetState.theme = 'dark';
    if (!budgetState.consolidatedInfraPanels) budgetState.consolidatedInfraPanels = [];
    
    // Defensive deep merge for customRules
    budgetState.customRules = budgetState.customRules || {};
    
    budgetState.customRules.brumBarCurrentThreshold = budgetState.customRules.brumBarCurrentThreshold !== undefined ? budgetState.customRules.brumBarCurrentThreshold : 75;
    budgetState.customRules.transformerVoltageRequired = budgetState.customRules.transformerVoltageRequired || '440V';
    budgetState.customRules.transformerVaRating = budgetState.customRules.transformerVaRating || '400VA';
    budgetState.customRules.transformerPrice = budgetState.customRules.transformerPrice !== undefined ? budgetState.customRules.transformerPrice : 600.0;
    budgetState.customRules.trilhoDinQty = budgetState.customRules.trilhoDinQty !== undefined ? budgetState.customRules.trilhoDinQty : 1;
    
    budgetState.customRules.cables10mm = budgetState.customRules.cables10mm || {};
    const dCables = {
      potenciaComando: { cinza: 50, vermelho: 25, azul: 25 },
      completo: { cinza: 50, vermelho: 25, azul: 25 },
      automacao: { cinza: 50, vermelho: 25, azul: 25 },
      comando: { vermelho: 10, azul: 10, cinza: 10 },
      remoto: { vermelho: 50, azul: 50, cinza: 50 }
    };
    Object.keys(dCables).forEach(k => {
      budgetState.customRules.cables10mm[k] = budgetState.customRules.cables10mm[k] || {};
      Object.keys(dCables[k]).forEach(cKey => {
        if (budgetState.customRules.cables10mm[k][cKey] === undefined) {
          budgetState.customRules.cables10mm[k][cKey] = dCables[k][cKey];
        }
      });
    });

    budgetState.customRules.bornesPerEquip = budgetState.customRules.bornesPerEquip || {};
    const dBornes = { comando: 6, remoto: 6, potencia: 4, 'potencia-comando': 10, automacao: 15, completo: 20 };
    Object.keys(dBornes).forEach(k => {
      if (budgetState.customRules.bornesPerEquip[k] === undefined) {
        budgetState.customRules.bornesPerEquip[k] = dBornes[k];
      }
    });

    budgetState.customRules.borneAccessories = budgetState.customRules.borneAccessories || {};
    const dAcc = { posteFinal: 2, borneTerra: 3, identificadorBr5: 3, identificadorBtw: 3, tampaBtwmp: 3, portaPlaqueta: 3 };
    Object.keys(dAcc).forEach(k => {
      if (budgetState.customRules.borneAccessories[k] === undefined) {
        budgetState.customRules.borneAccessories[k] = dAcc[k];
      }
    });
    
    // Synergize catalog price for transformer
    if (typeof PRECOS_DATABASE !== 'undefined' && PRECOS_DATABASE.catalog && PRECOS_DATABASE.catalog['TRANSFORMADOR-440-220-400VA']) {
      PRECOS_DATABASE.catalog['TRANSFORMADOR-440-220-400VA'].price = budgetState.customRules.transformerPrice;
    }
    
    // Migrate/recalculate existing panels to sync with the new catalog and engineering rules
    budgetState.panels.forEach(panel => {
      if (!panel.equipments) panel.equipments = [];
      if (!panel.infraDistances) panel.infraDistances = {};
      const customPrices = {};
      if (panel.components) {
        panel.components.forEach(c => {
          customPrices[c.code] = c.value;
        });
      }
      panel.components = calculatePanelComponents(panel);
      panel.components.forEach(c => {
        if (customPrices[c.code] !== undefined) {
          c.value = customPrices[c.code];
        }
      });
    });
    
    // Apply theme
    document.body.setAttribute('data-theme', budgetState.theme);
    updateThemeIcon();
    
    // Render views
    renderDashboard();
    renderPanelsList();
    renderCargasView();
    renderInfraView();
  } catch (e) {
    console.error("Erro no loadState:", e);
    budgetState = { panels: [], theme: 'dark' };
  }
}

// Save data to LocalStorage
function saveState() {
  try {
    localStorage.setItem('panel_builder_state', JSON.stringify(budgetState));
    renderDashboard();
    renderPanelsList();
    renderCargasView();
    renderInfraView();
  } catch (e) {
    console.error("Erro no saveState:", e);
  }
}

// Save data silently (updates localStorage and dashboard, but not the panel lists to prevent losing input focus)
function saveStateSilently() {
  try {
    localStorage.setItem('panel_builder_state', JSON.stringify(budgetState));
    renderDashboard();
  } catch (e) {
    console.error("Erro no saveStateSilently:", e);
  }
}

// Navigation
function navigateTo(viewId) {
  // Hide all views
  Object.keys(views).forEach(key => {
    if (views[key]) {
      views[key].classList.remove('active');
    }
  });
  
  // Show selected view
  if (views[viewId]) {
    views[viewId].classList.add('active');
  }
  
  // Update nav menu active state
  if (navLinks) {
    navLinks.forEach(link => {
      if (link.getAttribute('data-target') === viewId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Update page header titles
  if (viewTitle) {
    switch(viewId) {
      case 'dashboard-view':
        viewTitle.textContent = 'Painel Geral';
        if (viewSubtitle) viewSubtitle.textContent = 'Resumo estatístico e exportação do orçamento de quadros elétricos.';
        break;
      case 'creator-view':
        viewTitle.textContent = 'Configurar Novo Quadro';
        if (viewSubtitle) viewSubtitle.textContent = 'Adicione um novo quadro elétrico definindo tipo, características e equipamentos.';
        resetCreatorForm();
        break;
      case 'list-view':
        viewTitle.textContent = 'Lista de Quadros';
        if (viewSubtitle) viewSubtitle.textContent = 'Consulte, edite ou exclua os quadros elétricos adicionados anteriormente.';
        break;
      case 'help-view':
        viewTitle.textContent = 'Ajuda & Guia';
        if (viewSubtitle) viewSubtitle.textContent = 'Manual de uso do sistema de especificação de quadros.';
        break;
      case 'infra-view':
        viewTitle.textContent = 'Configuração de Infraestrutura';
        if (viewSubtitle) viewSubtitle.textContent = 'Defina distâncias e dimensione a infraestrutura de tubulação, fiação e suportações.';
        renderInfraView();
        break;
      case 'cargas-view':
        viewTitle.textContent = 'Resumo de Cargas';
        if (viewSubtitle) viewSubtitle.textContent = 'Demonstrativo de cargas, correntes e cabeamento geral do orçamento.';
        renderCargasView();
        break;
    }
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

function formatPanelDescription(panel, index) {
  let output = `Quadro ${index + 1} - ${panel.name} (${panel.voltage || '220V'}`;
  if (panel.totalPowerKw) {
    output += ` | Potência: ${panel.totalPowerKw.toFixed(1)}kW`;
  }
  if (panel.calculatedCurrent) {
    output += ` | Corrente: ${panel.calculatedCurrent.toFixed(1)}A`;
  }
  output += `)\n`;
  
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
        const pStr = equip.power ? (equip.power.toLowerCase().includes("kw") ? equip.power : `${equip.power}kW`) : 'Não definida';
        if (equip.type === 'CHILLER') {
          eqDesc += `Potência ${pStr}, ${equip.type}`;
        } else {
          const startsStr = equip.starts && equip.starts.length > 0 ? equip.starts.join(' - ') : 'Não definida';
          eqDesc += `Potência ${pStr}, Partida ${startsStr}, ${equip.type}`;
        }
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
        const pStr = equip.power ? (equip.power.toLowerCase().includes("kw") ? equip.power : `${equip.power}kW`) : 'Não definida';
        if (equip.type === 'CHILLER') {
          eqDesc += `Potência ${pStr}, ${equip.type}`;
        } else {
          const startsStr = equip.starts && equip.starts.length > 0 ? equip.starts.join(' - ') : 'Não definida';
          eqDesc += `Potência ${pStr}, Partida ${startsStr}, ${equip.type}`;
        }
        
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
      if (equip.type === 'UTA') {
        let utaExtra = [];
        if (equip.hasHeating) {
          utaExtra.push(`Aquecimento: ${equip.heatingPower} (${equip.heatingControl === 'OnOff' ? 'On/Off' : 'Prop.'})`);
        }
        if (equip.hasHumid) {
          utaExtra.push(`Umidificação: ${equip.humidPower} (${equip.humidControl === 'OnOff' ? 'On/Off' : 'Prop.'})`);
        }
        if (equip.expansionType) {
          let expText = `Expansão: ${equip.expansionType}`;
          if (equip.expansionType === 'Indireta' && equip.valveType) {
            expText += ` (${equip.valveType === 'OnOff' ? 'Válvula On/Off' : 'Válvula Prop.'})`;
          }
          utaExtra.push(expText);
        }
        if (utaExtra.length > 0) {
          eqDesc += ` | ${utaExtra.join(' - ')}`;
        }
      }
      
      
      // Cabling details from NBR 5410
      let cablingDetails = [];
      if (equip.power && equip.calculatedCurrent && equip.calculatedCable) {
        cablingDetails.push(`Principal: ${equip.power} - Corrente: ${equip.calculatedCurrent} - Cabo: ${equip.calculatedCable}`);
      }
      if (equip.type === 'UTA') {
        if (equip.hasHeating && equip.heatingPower && equip.heatingCalculatedCurrent && equip.heatingCalculatedCable) {
          const hStg = equip.heatingStages || 1;
          cablingDetails.push(`Aquecimento (${hStg} Est.): ${equip.heatingPower} - Corrente: ${equip.heatingCalculatedCurrent} - Cabo: ${equip.heatingCalculatedCable} (por est.)`);
        }
        if (equip.hasHumid && equip.humidPower && equip.humidCalculatedCurrent && equip.humidCalculatedCable) {
          const huStg = equip.humidStages || 1;
          cablingDetails.push(`Umidificação (${huStg} Est.): ${equip.humidPower} - Corrente: ${equip.humidCalculatedCurrent} - Cabo: ${equip.humidCalculatedCable} (por est.)`);
        }
      }
      if (cablingDetails.length > 0) {
        eqDesc += ` | Cabos de Potência: [${cablingDetails.join(' | ')}]`;
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
  // Stats
  document.getElementById('stat-total-panels').textContent = budgetState.panels.length;
  
  let totalEquipments = 0;
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

    // Sum components values
    if (panel.components) {
      totalBudgetPrice += panel.components.reduce((sum, comp) => sum + (parseFloat(comp.value) || 0), 0);
    }
  });
  
  // Calculate total infra price
  const totalInfraItems = getConsolidatedInfraItems();
  const totalInfraPrice = totalInfraItems.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);
  
  document.getElementById('stat-total-equipments').textContent = totalEquipments;
  document.getElementById('stat-total-price').textContent = totalBudgetPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  document.getElementById('stat-total-infra-price').textContent = totalInfraPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  // Render Panels List in Dashboard
  const panelsListContainer = document.getElementById('dashboard-panels-list');
  if (panelsListContainer) {
    panelsListContainer.innerHTML = '';
    if (budgetState.panels.length === 0) {
      panelsListContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); padding: 24px;">
          Nenhum quadro elétrico cadastrado ainda. Vá em "Criar Quadro" para começar.
        </div>
      `;
    } else {
      budgetState.panels.forEach(p => {
        const item = document.createElement('div');
        item.style.padding = '12px';
        item.style.border = '1px solid var(--border-color)';
        item.style.borderRadius = 'var(--radius-md)';
        item.style.backgroundColor = 'var(--bg-secondary)';
        
        let label = '';
        if (p.type === 'potencia') label = 'Potência';
        else if (p.type === 'comando') label = 'Comando';
        else if (p.type === 'potencia-comando') label = 'Potência e Comando';
        else if (p.type === 'automacao') label = 'Automação';
        else if (p.type === 'completo') label = 'Potência, Comando e Automação';
        else if (p.type === 'remoto') label = 'Automação Remoto';
        
        let details = '';
        if (p.type === 'comando' || p.type === 'remoto') {
          details = `Quantidade de equipamentos: ${p.quantity}`;
          if (p.type === 'remoto') {
            details += ` | IHM: ${p.remotoIhmSize || 'Não possui'}`;
            if (p.hasSupervisorio) details += ` | Com Supervisório`;
          }
        } else {
          const eqNames = p.equipments.map(eq => {
            const startName = eq.starts && eq.starts.length > 0 ? eq.starts.join('/') : 'Sem partida';
            return `${eq.name} (${eq.type} - ${startName} - ${eq.power})`;
          }).join(', ');
          details = `Equipamentos: ${eqNames || 'Nenhum'}`;
          if (p.type === 'automacao' || p.type === 'completo') {
            if (p.hasIhm) details += ` | IHM: ${p.ihmSize}`;
            if (p.hasSupervisorio) details += ` | Com Supervisório`;
          }
        }
        
        const panelVal = p.components ? p.components.reduce((sum, c) => sum + (parseFloat(c.value) || 0), 0) : 0;
        
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
            <div>
              <strong style="color: var(--primary); font-size: 0.95rem;">${p.name}</strong>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
                <strong>Tipo:</strong> ${label} | <strong>Tensão:</strong> ${p.voltage}
              </div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                ${details}
              </div>
            </div>
            <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">
              ${panelVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
        `;
        panelsListContainer.appendChild(item);
      });
    }
  }
  
  // Render Category List
  const categoryList = document.getElementById('dashboard-category-summary');
  categoryList.innerHTML = '';
  
  const categoryLabels = {
    'potencia': { label: 'Potência', class: 'type-potencia' },
    'comando': { label: 'Comando', class: 'type-comando' },
    'potencia-comando': { label: 'Potência e Comando', class: 'type-potencia-comando' },
    'automacao': { label: 'Automação', class: 'type-automacao' },
    'completo': { label: 'Pot. Com. Aut.', class: 'type-completo' },
    'remoto': { label: 'Aut. Remoto', class: 'type-remoto' }
  };
  
  Object.keys(categoryLabels).forEach(key => {
    const info = categoryLabels[key];
    const count = categoryCounts[key] || 0;
    
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.justify = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '6px 0';
    item.style.borderBottom = '1px solid var(--border-color)';
    
    item.innerHTML = `
      <span class="panel-type-tag ${info.class}" style="font-size: 0.72rem; padding: 2px 6px;">${info.label}</span>
      <span style="font-weight: 600; font-size: 0.85rem;">${count}</span>
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
        
        const cablingHTML = getEquipmentDetailsHTML(eq);
        equipmentsHTML += `
          <li class="panel-equip-li">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 4px; margin-bottom: 4px;">
              <div>${eqNameLabel}</div>
              <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end; max-width:60%;">${details.join('')}</div>
            </div>
            ${cablingHTML}
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
      const qty = comp.qty || 1;
      const unitPrice = comp.unitPrice !== undefined ? comp.unitPrice : (comp.value / qty);
      
      componentsHTML += `
        <div class="component-row" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--border-color); gap: 10px; flex-wrap: wrap;">
          <span class="component-name" style="flex: 1 1 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem;" title="${comp.name}">${comp.name}</span>
          
          <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
            <!-- Quantidade -->
            <span class="component-qty-badge" style="min-width: 45px; text-align: center;">${qty} ${comp.unit || 'un'}</span>
            
            <!-- Valor Unitário (editável) -->
            <div style="display: flex; flex-direction: column; align-items: flex-end;">
              <span style="font-size: 0.65rem; color: var(--text-secondary); margin-bottom: 2px;">Valor Unitário</span>
              <div class="component-price-container">
                <span class="component-price-symbol">R$</span>
                <input type="text" class="component-price-input" 
                       data-panel-id="${panel.id}" data-comp-idx="${compIdx}" 
                       value="${unitPrice.toFixed(2).replace('.', ',')}"
                       style="width: 80px;">
              </div>
            </div>

            <!-- Valor Total (calculado) -->
            <div style="display: flex; flex-direction: column; align-items: flex-end; min-width: 90px;">
              <span style="font-size: 0.65rem; color: var(--text-secondary); margin-bottom: 2px;">Total</span>
              <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary);" id="total-price-display-${panel.id}-${compIdx}">
                R$ ${comp.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            
            <!-- Botão de Verificar Lógica -->
            <button type="button" class="btn btn-info btn-icon-only btn-logic-component" 
                    data-panel-id="${panel.id}" data-comp-idx="${compIdx}" 
                    style="padding: 2px; font-size: 0.75rem; border-radius: var(--radius-sm); width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; background-color: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); color: var(--primary); margin-right: 4px;"
                    title="Verificar/Ajustar lógica de inclusão">
              <svg viewBox="0 0 24 24" style="width:12px; height:12px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </button>
            
            <!-- Botão de Excluir -->
            <button type="button" class="btn btn-danger btn-icon-only btn-delete-component" 
                    data-panel-id="${panel.id}" data-comp-idx="${compIdx}" 
                    style="padding: 2px; font-size: 0.75rem; border-radius: var(--radius-sm); width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444;"
                    title="Excluir item deste painel">
              <svg viewBox="0 0 24 24" style="width:12px; height:12px; fill:none; stroke:currentColor; stroke-width:2;"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      `;
    });
    
    card.innerHTML = `
      <div class="panel-card-header" style="align-items: center;">
        <h3 style="font-size:1.05rem; font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:50%; margin:0;" title="${panel.name}">${panel.name}</h3>
        <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap; justify-content:flex-end; max-width:50%;">
          ${panel.totalPowerKw ? `<span class="badge" style="background-color:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.15); color:#10b981; font-size:0.7rem; padding:2px 6px; font-weight:600;" title="Potência Total do Quadro">${panel.totalPowerKw.toFixed(1)}kW</span>` : ''}
          ${panel.calculatedCurrent ? `<span class="badge" style="background-color:rgba(99, 102, 241, 0.1); border:1px solid rgba(99, 102, 241, 0.15); color:var(--primary); font-size:0.7rem; padding:2px 6px; font-weight:600;" title="Corrente Trifásica Geral">${panel.calculatedCurrent.toFixed(1)}A</span>` : ''}
          <span class="badge" style="background-color:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-primary); font-size:0.7rem; padding:2px 6px; font-weight:600;">${panel.voltage || '220V'}</span>
          <span class="panel-type-tag ${typeClass}" style="font-size:0.7rem; padding:2px 6px;">${typeLabel}</span>
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
          <svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button class="btn btn-danger btn-icon-only" onclick="deletePanel(${panel.id})" title="Excluir Quadro">
          <svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
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
      
      const cleanValueStr = e.target.value.replace(/\s/g, '').replace(',', '.');
      const unitPrice = parseFloat(cleanValueStr) || 0;
      
      const panel = budgetState.panels.find(p => p.id === panelId);
      if (panel && panel.components[compIdx]) {
        const qty = panel.components[compIdx].qty || 1;
        panel.components[compIdx].unitPrice = unitPrice;
        panel.components[compIdx].value = unitPrice * qty;
        
        // Update row's calculated Total price text
        const compTotalSpan = document.getElementById(`total-price-display-${panelId}-${compIdx}`);
        if (compTotalSpan) {
          compTotalSpan.textContent = 'R$ ' + panel.components[compIdx].value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        
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
    
    input.addEventListener('blur', (e) => {
      const cleanValueStr = e.target.value.replace(/\s/g, '').replace(',', '.');
      const unitPrice = parseFloat(cleanValueStr) || 0;
      e.target.value = unitPrice.toFixed(2).replace('.', ',');
    });
  });
  
  // Setup Event Delegation for checking/adjusting logic of components
  const logicButtons = listGrid.querySelectorAll('.btn-logic-component');
  logicButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      try {
        const targetBtn = e.currentTarget;
        const panelId = parseInt(targetBtn.getAttribute('data-panel-id'));
        const compIdx = parseInt(targetBtn.getAttribute('data-comp-idx'));
        openLogicModal(panelId, compIdx);
      } catch (err) {
        console.error("Erro no clique do botão de lógica:", err);
        alert("Erro no clique do botão de lógica:\n" + err.message + "\n" + err.stack);
      }
    });
  });

  // Setup Event Delegation for deleting components
  const deleteButtons = listGrid.querySelectorAll('.btn-delete-component');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('.btn-delete-component');
      const panelId = parseInt(targetBtn.getAttribute('data-panel-id'));
      const compIdx = parseInt(targetBtn.getAttribute('data-comp-idx'));
      
      const panel = budgetState.panels.find(p => p.id === panelId);
      if (panel && panel.components[compIdx]) {
        const compName = panel.components[compIdx].name;
        if (confirm(`Deseja mesmo excluir o item "${compName}" deste painel?`)) {
          panel.components.splice(compIdx, 1);
          saveState();
        }
      }
    });
  });
}

function renderCargasView() {
  const tableWrapper = document.getElementById('cargas-table-wrapper');
  const emptyState = document.getElementById('cargas-empty-state');
  const tableBody = document.getElementById('cargas-table-body');
  
  if (!tableWrapper || !emptyState || !tableBody) return;
  
  if (budgetState.panels.length === 0) {
    tableWrapper.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }
  
  tableWrapper.style.display = 'block';
  emptyState.style.display = 'none';
  tableBody.innerHTML = '';
  
  budgetState.panels.forEach((panel) => {
    // Determine type label
    let typeLabel = 'Potência';
    switch(panel.type) {
      case 'potencia': typeLabel = 'Potência'; break;
      case 'comando': typeLabel = 'Comando'; break;
      case 'potencia-comando': typeLabel = 'Potência e Comando'; break;
      case 'automacao': typeLabel = 'Automação'; break;
      case 'completo': typeLabel = 'Pot., Com. & Aut.'; break;
      case 'remoto': typeLabel = 'Aut. Remoto'; break;
    }
    
    // Calculate general panel cable from NBR 5410
    const panelCable = getNBR5410CableSectionForPanel(panel.calculatedCurrent);
    
    // Render panel row
    const panelRow = document.createElement('tr');
    panelRow.className = 'panel-row';
    panelRow.style.fontWeight = '600';
    panelRow.style.backgroundColor = 'rgba(99, 102, 241, 0.06)';
    
    panelRow.innerHTML = `
      <td style="padding: 12px 16px; border-left: 4px solid var(--primary); font-weight: 700;">${panel.name}</td>
      <td style="padding: 12px 16px;">Quadro - ${typeLabel}</td>
      <td style="padding: 12px 16px;">${panel.voltage || '220V'}</td>
      <td style="padding: 12px 16px; text-align: right;">${panel.totalPowerKw ? panel.totalPowerKw.toFixed(1).replace('.', ',') : '0,0'} kW</td>
      <td style="padding: 12px 16px; text-align: right; color: var(--primary); font-weight: 700;">${panel.calculatedCurrent ? panel.calculatedCurrent.toFixed(1).replace('.', ',') : '0,0'} A</td>
      <td style="padding: 12px 16px; font-weight: 700;">${panelCable ? panelCable + ' mm²' : '-'}</td>
    `;
    tableBody.appendChild(panelRow);
    
    // Render sub-rows for equipments
    if (panel.type === 'comando' || panel.type === 'remoto') {
      const equipRow = document.createElement('tr');
      equipRow.innerHTML = `
        <td style="padding: 12px 16px 12px 36px; color: var(--text-secondary); font-style: italic;">
          ↳ ${panel.quantity} x Cargas de Acionamento (Comum)
        </td>
        <td style="padding: 12px 16px; font-size: 0.85rem; color: var(--text-secondary);">-</td>
        <td style="padding: 12px 16px; font-size: 0.85rem; color: var(--text-secondary);">-</td>
        <td style="padding: 12px 16px; text-align: right; font-size: 0.85rem; color: var(--text-secondary);">-</td>
        <td style="padding: 12px 16px; text-align: right; font-size: 0.85rem; color: var(--text-secondary);">-</td>
        <td style="padding: 12px 16px; font-size: 0.85rem; color: var(--text-secondary);">-</td>
      `;
      tableBody.appendChild(equipRow);
    } else if (panel.equipments && panel.equipments.length > 0) {
      panel.equipments.forEach((eq, eqIdx) => {
        const eqName = eq.name ? eq.name : `Equipamento ${eqIdx + 1}`;
        
        // Calculations for total power and current
        const motorKw = eq.power ? parsePowerKw(eq.power) : 0;
        const motorCurVal = eq.calculatedCurrent ? parseFloat(eq.calculatedCurrent.replace('A', '').trim().replace(',', '.')) : 0;
        
        let heatingKw = 0;
        let heatingCurVal = 0;
        let heatingCab = '-';
        const hStg = eq.heatingStages || 1;
        if (eq.hasHeating && eq.heatingPower) {
          heatingKw = parsePowerKw(eq.heatingPower);
          heatingCurVal = eq.heatingCalculatedCurrent ? parseFloat(eq.heatingCalculatedCurrent.replace('A', '').trim().replace(',', '.')) : 0;
          heatingCab = eq.heatingCalculatedCable ? eq.heatingCalculatedCable.trim() : '-';
        }
        
        let humidKw = 0;
        let humidCurVal = 0;
        let humidCab = '-';
        const huStg = eq.humidStages || 1;
        if (eq.hasHumid && eq.humidPower) {
          humidKw = parsePowerKw(eq.humidPower);
          humidCurVal = eq.humidCalculatedCurrent ? parseFloat(eq.humidCalculatedCurrent.replace('A', '').trim().replace(',', '.')) : 0;
          humidCab = eq.humidCalculatedCable ? eq.humidCalculatedCable.trim() : '-';
        }
        
        const totalEqPower = motorKw + heatingKw + humidKw;
        const totalEqCurrent = motorCurVal + (eq.hasHeating ? (heatingCurVal * hStg) : 0) + (eq.hasHumid ? (humidCurVal * huStg) : 0);
        
        // 1. Equipment Summary Row (shows total power and current)
        const equipRow = document.createElement('tr');
        equipRow.innerHTML = `
          <td style="padding: 12px 16px 12px 36px; color: var(--text-primary); font-weight: 700;">
            ↳ ${eqName}
          </td>
          <td style="padding: 12px 16px; font-weight: 700; font-size: 0.85rem; color: var(--text-secondary);">${eq.type}</td>
          <td style="padding: 12px 16px; font-size: 0.85rem; color: var(--text-secondary);">-</td>
          <td style="padding: 12px 16px; text-align: right; font-size: 0.85rem; color: var(--text-primary); font-weight: 700;">${totalEqPower.toFixed(1).replace('.', ',')} kW</td>
          <td style="padding: 12px 16px; text-align: right; font-size: 0.85rem; color: var(--primary); font-weight: 700;">${totalEqCurrent.toFixed(1).replace('.', ',')} A</td>
          <td style="padding: 12px 16px; font-size: 0.85rem; color: var(--text-secondary);">-</td>
        `;
        tableBody.appendChild(equipRow);
        
        // 2. Motor Subline Row (always present)
        const motorRow = document.createElement('tr');
        const motorPowerStr = eq.power ? eq.power.replace('kW', '').trim().replace('.', ',') : '-';
        const motorCurStr = eq.calculatedCurrent ? eq.calculatedCurrent.replace('A', '').trim() : '-';
        const motorCabStr = eq.calculatedCable ? eq.calculatedCable.trim() : '-';
        motorRow.innerHTML = `
          <td style="padding: 10px 16px 10px 56px; font-size: 0.8rem; color: var(--text-secondary);">
            ↳ Motor
          </td>
          <td style="padding: 10px 16px; font-size: 0.8rem; color: var(--text-secondary);">Motor</td>
          <td style="padding: 10px 16px; font-size: 0.8rem; color: var(--text-secondary);">-</td>
          <td style="padding: 10px 16px; text-align: right; font-size: 0.8rem; color: var(--text-secondary);">${motorPowerStr !== '-' ? motorPowerStr + ' kW' : '-'}</td>
          <td style="padding: 10px 16px; text-align: right; font-size: 0.8rem; color: var(--text-secondary);">${motorCurStr !== '-' ? motorCurStr + ' A' : '-'}</td>
          <td style="padding: 10px 16px; font-size: 0.8rem; color: var(--text-secondary);">${motorCabStr}</td>
        `;
        tableBody.appendChild(motorRow);
        
        // 3. Heating Subline Row
        if (eq.type === 'UTA' && eq.hasHeating && eq.heatingPower) {
          const heatRow = document.createElement('tr');
          const heatPowerStr = eq.heatingPower.replace('kW', '').trim().replace('.', ',');
          const heatCurStr = eq.heatingCalculatedCurrent ? eq.heatingCalculatedCurrent.replace('A', '').trim() : '-';
          heatRow.innerHTML = `
            <td style="padding: 10px 16px 10px 56px; font-size: 0.8rem; color: var(--text-secondary);">
              ↳ Aquecimento (${hStg} Est.)
            </td>
            <td style="padding: 10px 16px; font-size: 0.8rem; color: var(--text-secondary);">Aquec. UTA</td>
            <td style="padding: 10px 16px; font-size: 0.8rem; color: var(--text-secondary);">-</td>
            <td style="padding: 10px 16px; text-align: right; font-size: 0.8rem; color: var(--text-secondary);">${heatPowerStr} kW</td>
            <td style="padding: 10px 16px; text-align: right; font-size: 0.8rem; color: var(--text-secondary);">${heatCurStr !== '-' ? heatCurStr + ' A' : '-'} (por est.)</td>
            <td style="padding: 10px 16px; font-size: 0.8rem; color: var(--text-secondary);">${heatingCab} (por est.)</td>
          `;
          tableBody.appendChild(heatRow);
        }
        
        // 4. Humidification Subline Row
        if (eq.type === 'UTA' && eq.hasHumid && eq.humidPower) {
          const humidRow = document.createElement('tr');
          const humidPowerStr = eq.humidPower.replace('kW', '').trim().replace('.', ',');
          const humidCurStr = eq.humidCalculatedCurrent ? eq.humidCalculatedCurrent.replace('A', '').trim() : '-';
          humidRow.innerHTML = `
            <td style="padding: 10px 16px 10px 56px; font-size: 0.8rem; color: var(--text-secondary);">
              ↳ Umidificação (${huStg} Est.)
            </td>
            <td style="padding: 10px 16px; font-size: 0.8rem; color: var(--text-secondary);">Umid. UTA</td>
            <td style="padding: 10px 16px; font-size: 0.8rem; color: var(--text-secondary);">-</td>
            <td style="padding: 10px 16px; text-align: right; font-size: 0.8rem; color: var(--text-secondary);">${humidPowerStr} kW</td>
            <td style="padding: 10px 16px; text-align: right; font-size: 0.8rem; color: var(--text-secondary);">${humidCurStr !== '-' ? humidCurStr + ' A' : '-'} (por est.)</td>
            <td style="padding: 10px 16px; font-size: 0.8rem; color: var(--text-secondary);">${humidCab} (por est.)</td>
          `;
          tableBody.appendChild(humidRow);
        }
      });
    }
  });
}

function getNBR5410CableSectionForPanel(current) {
  if (current <= 0) return null;
  if (current <= 21) return '2,5';
  if (current <= 28) return '4,0';
  if (current <= 36) return '6,0';
  if (current <= 50) return '10,0';
  if (current <= 68) return '16,0';
  if (current <= 89) return '25,0';
  if (current <= 110) return '35,0';
  if (current <= 134) return '50,0';
  if (current <= 171) return '70,0';
  if (current <= 207) return '95,0';
  if (current <= 239) return '120,0';
  if (current <= 272) return '150,0';
  if (current <= 310) return '185,0';
  return '240,0';
}

function calculateInfraComponentsForPanel(panel) {
  const infraMap = {};

  const addInfra = (code, qtyMultiplier = 1) => {
    if (!code) return;
    const catItem = PRECOS_DATABASE.catalog[code];
    if (!catItem) return;
    if (infraMap[code]) {
      infraMap[code].qty += qtyMultiplier;
      infraMap[code].value = infraMap[code].qty * infraMap[code].unitPrice;
    } else {
      infraMap[code] = {
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

  const getCableDiameter = (code) => {
    if (code === 'CABO-REDE-CAT6') return 6.0;
    if (code === 'CABO-PP-2X0.75' || code === 'CABO-SHIELD-2X0.75') return 6.5;
    if (code === 'CABO-PP-3X0.75' || code === 'CABO-SHIELD-3X0.75') return 7.2;
    if (code === 'CABO-SHIELD-4X0.75') return 7.8;
    if (code === 'CABO-SHIELD-5X0.75') return 8.5;
    if (code === 'CABO-PP-5X1.5' || code === 'CABO-PP-6X1.5') return 11.5;
    
    if (code.includes('3X1.5') || code.includes('4X1.5')) return 10.0;
    if (code.includes('3X2.5') || code.includes('4X2.5')) return 12.0;
    if (code.includes('3X4.0') || code.includes('4X4.0')) return 14.0;
    if (code.includes('3X6.0') || code.includes('4X6.0')) return 16.0;
    if (code.includes('3X10.0') || code.includes('4X10.0')) return 20.0;
    if (code.includes('3X16.0') || code.includes('4X16.0')) return 24.0;
    if (code.includes('3X25.0') || code.includes('4X25.0')) return 28.0;
    if (code.includes('4X35.0')) return 32.0;
    if (code.includes('4X50.0')) return 38.0;
    return 10.0;
  };

  const getConduitSizeForCables = (cables) => {
    if (cables.length === 0) return '1/2';
    
    let totalCableArea = 0;
    cables.forEach(c => {
      const d = getCableDiameter(c.code);
      const area = (Math.PI * d * d) / 4;
      totalCableArea += area;
    });
    
    let fillFactor = 0.40;
    if (cables.length === 1) fillFactor = 0.53;
    else if (cables.length === 2) fillFactor = 0.31;
    
    const requiredArea = totalCableArea / fillFactor;
    
    const conduits = [
      { size: '1/2', area: 201 },
      { size: '3/4', area: 346 },
      { size: '1', area: 572 },
      { size: '1.1/4', area: 962 },
      { size: '1.1/2', area: 1320 },
      { size: '2', area: 2123 },
      { size: '2.1/2', area: 3300 },
      { size: '3', area: 5000 },
      { size: '4', area: 8500 },
      { size: '5', area: 13000 }
    ];
    
    for (let i = 0; i < conduits.length; i++) {
      if (conduits[i].area >= requiredArea) {
        return conduits[i].size;
      }
    }
    return '5';
  };

  const getReducedConduitSize = (size) => {
    const order = ['1/2', '3/4', '1', '1.1/4', '1.1/2', '2', '2.1/2', '3', '4', '5'];
    const idx = order.indexOf(size);
    if (idx > 0) return order[idx - 1];
    return '1/2';
  };

  const getCablesForEquipment = (eq, D) => {
    const eqCables = [];
    if (panel.type === 'comando') {
      eqCables.push({ code: 'CABO-PP-6X1.5', qty: D });
    } else if (panel.type === 'remoto') {
      eqCables.push({ code: 'CABO-SHIELD-3X0.75', qty: D });
      eqCables.push({ code: 'CABO-REDE-CAT6', qty: D });
    } else {
      // 1. Power Cables
      if (eq.power) {
        let startType = eq.starts;
        if (Array.isArray(startType)) startType = startType[0];

        if (startType === 'EC') {
          eqCables.push({ code: 'CABO-PP-5X1.5', qty: D });
          eqCables.push({ code: 'CABO-PP-6X1.5', qty: D });
        } else if (eq.calculatedCable) {
          const bitola = eq.calculatedCable.replace("mm²", "").replace("mm", "").trim();
          const code = getPPCableCode(4, bitola);
          if (code) {
            eqCables.push({ code: code, qty: D });
          }
        }
      }

      // 2. Automation Cables
      if (panel.type === 'automacao' || panel.type === 'completo') {
        if (eq.readings) {
          const readings = eq.readings;
          let hasTemp = readings.includes("Temp Duto") || readings.includes("Temp Ambiente");
          let hasUmid = readings.includes("Umid Duto") || readings.includes("Umid Ambiente");
          let hasCO2 = readings.includes("CO2 Duto") || readings.includes("CO2 Ambiente");
          let hasVazao = readings.includes("Vazão") || readings.includes("Vazao");

          if (hasTemp && hasUmid && hasCO2) {
            eqCables.push({ code: 'CABO-SHIELD-5X0.75', qty: D });
          } else if (hasTemp && hasUmid) {
            eqCables.push({ code: 'CABO-SHIELD-5X0.75', qty: D });
          } else if (hasTemp) {
            eqCables.push({ code: 'CABO-SHIELD-3X0.75', qty: D });
          } else if (hasUmid) {
            eqCables.push({ code: 'CABO-SHIELD-3X0.75', qty: D });
          } else if (hasCO2) {
            eqCables.push({ code: 'CABO-SHIELD-3X0.75', qty: D });
          }

          if (hasVazao) {
            eqCables.push({ code: 'CABO-SHIELD-2X0.75', qty: D });
          }
        }

        // Valve
        if (eq.type === 'UTA' && eq.expansionType === 'Indireta' && eq.valveType === 'Proporcional') {
          eqCables.push({ code: 'CABO-PP-3X0.75', qty: D });
        }

        // Pressostato default rule
        if (panel.type === 'completo') {
          if (eq.type === 'UTA' || eq.type === 'EX/CV') {
            eqCables.push({ code: 'CABO-PP-2X0.75', qty: D });
            eqCables.push({ code: 'CABO-PP-2X0.75', qty: D });
          }
        }
      }

      // 3. Heating & Humidification stages
      if (eq.type === 'UTA') {
        if (eq.hasHeating && eq.heatingPower && eq.heatingCalculatedCable) {
          const stages = parseInt(eq.heatingStages) || 1;
          const bitola = eq.heatingCalculatedCable.replace("mm²", "").replace("mm", "").trim();
          const code = getPPCableCode(3, bitola);
          if (code) {
            eqCables.push({ code: code, qty: D * stages });
          }
        }
        if (eq.hasHumid && eq.humidPower && eq.humidCalculatedCable) {
          const stages = parseInt(eq.humidStages) || 1;
          const bitola = eq.humidCalculatedCable.replace("mm²", "").replace("mm", "").trim();
          const code = getPPCableCode(3, bitola);
          if (code) {
            eqCables.push({ code: code, qty: D * stages });
          }
        }
      }
    }
    return eqCables;
  };

  const getAutCountForEquipment = (eq) => {
    let autCount = 0;
    if (panel.type === 'automacao' || panel.type === 'completo') {
      if (eq.readings) autCount += eq.readings.length;
      if (eq.hasHeating) autCount++;
      if (eq.hasHumid) autCount++;
      if (eq.type === 'UTA' && eq.expansionType === 'Indireta') autCount++;
    }
    return autCount;
  };

  let equips = [];
  if (panel.equipments && panel.equipments.length > 0) {
    equips = panel.equipments;
  } else if ((panel.type === 'comando' || panel.type === 'remoto') && panel.quantity > 0) {
    for (let i = 1; i <= panel.quantity; i++) {
      equips.push({ id: `virtual-${i}`, name: panel.type === 'comando' ? `Ponto de Comando ${i}` : `Ponto de Automação Remota ${i}`, type: panel.type.toUpperCase() });
    }
  }

  if (equips.length === 0) {
    return [];
  }

  const distances = panel.infraDistances || {};
  const activeEquips = [];
  
  equips.forEach(eq => {
    const D = (panel.type === 'comando' || panel.type === 'remoto') ? (parseFloat(panel.infraDistances['general']) || 0) : (parseFloat(distances[eq.id]) || 0);
    if (D <= 0) return;
    
    const cables = getCablesForEquipment(eq, D);
    const autCount = getAutCountForEquipment(eq);
    const hasPower = !!eq.power;
    
    activeEquips.push({
      eq: eq,
      distance: D,
      cables: cables,
      autCount: autCount,
      hasPower: hasPower
    });
  });

  if (activeEquips.length === 0) {
    return [];
  }

  const isEletrocalhaMode = activeEquips.length > 5;
  const infraType = panel.infraType || 'leve';
  const uniqueDistances = Array.from(new Set(activeEquips.map(ae => ae.distance))).sort((a, b) => a - b);
  
  let uPrev = 0;
  let totalPanelCablesArea = 0;
  let totalEletrocalhaLength = 0;

  uniqueDistances.forEach(u_s => {
    const L_s = u_s - uPrev;
    if (L_s <= 0) return;

    // Find all equipment active in this interval
    const intervalEquips = activeEquips.filter(ae => ae.distance >= u_s);

    // Collect all cables running in this interval
    const intervalCables = [];
    intervalEquips.forEach(ae => {
      ae.cables.forEach(c => {
        intervalCables.push({ code: c.code });
      });
    });

    // Calculate conduit sizes for this interval
    const stdConduitSize = getConduitSizeForCables(intervalCables);
    const redConduitSize = getReducedConduitSize(stdConduitSize);

    // Sum cable areas for eletrocalha sizing
    let intervalCablesArea = 0;
    intervalCables.forEach(c => {
      const d = getCableDiameter(c.code);
      const area = (Math.PI * d * d) / 4;
      intervalCablesArea += area;
    });

    if (isEletrocalhaMode) {
      const trayLen = 0.8 * L_s;
      const condLen = 0.2 * L_s;
      totalEletrocalhaLength += trayLen;
      totalPanelCablesArea = Math.max(totalPanelCablesArea, intervalCablesArea);

      if (infraType === 'pesada') {
        addInfra(`ELETRODUTO-PESADO-${redConduitSize}`, condLen);
      } else {
        addInfra(`ELETRODUTO-GALV-${redConduitSize}`, condLen);
      }
      addInfra(`SUPORTE-ABRACADEIRA`, Math.ceil(condLen / 1.5));

      let conduleteCount = Math.ceil(condLen);
      let autCount = 0;
      const terminatingEquips = activeEquips.filter(ae => ae.distance === u_s);
      terminatingEquips.forEach(ae => {
        autCount += ae.autCount;
      });
      conduleteCount += autCount;

      if (conduleteCount > 0) {
        if (infraType === 'pesada') {
          const qT = Math.floor(conduleteCount / 3);
          const qLR = Math.floor(conduleteCount / 3);
          const qE = conduleteCount - 2 * qT;
          if (qT > 0) addInfra(`CONDULETE-PESADO-T-${redConduitSize}`, qT);
          if (qLR > 0) addInfra(`CONDULETE-PESADO-LR-${redConduitSize}`, qLR);
          if (qE > 0) addInfra(`CONDULETE-PESADO-E-${redConduitSize}`, qE);
        } else {
          addInfra(`CONDULETE-GALV-${redConduitSize}`, conduleteCount);
          addInfra(`UNIDUT-GALV-${redConduitSize}`, 3 * conduleteCount);
        }
      }

      terminatingEquips.forEach(ae => {
        if (ae.hasPower && panel.type !== 'comando' && panel.type !== 'remoto') addInfra(`PRENSA-CABO-3/4`, 1);
        if (ae.autCount > 0) addInfra(`PRENSA-CABO-1/2`, ae.autCount);
      });
    } else {
      const stdLen = 0.7 * L_s;
      const redLen = 0.3 * L_s;

      if (infraType === 'pesada') {
        addInfra(`ELETRODUTO-PESADO-${stdConduitSize}`, stdLen);
        addInfra(`ELETRODUTO-PESADO-${redConduitSize}`, redLen);
      } else {
        addInfra(`ELETRODUTO-GALV-${stdConduitSize}`, stdLen);
        addInfra(`ELETRODUTO-GALV-${redConduitSize}`, redLen);
      }

      addInfra(`SUPORTE-ABRACADEIRA`, Math.ceil((stdLen + redLen) / 1.5));

      let stdCondCount = Math.ceil(stdLen / 1.5);
      let redCondCount = Math.ceil(redLen / 1.5);

      let autCount = 0;
      const terminatingEquips = activeEquips.filter(ae => ae.distance === u_s);
      terminatingEquips.forEach(ae => {
        autCount += ae.autCount;
      });
      redCondCount += autCount;

      if (stdCondCount > 0) {
        if (infraType === 'pesada') {
          const qT = Math.floor(stdCondCount / 3);
          const qLR = Math.floor(stdCondCount / 3);
          const qE = stdCondCount - 2 * qT;
          if (qT > 0) addInfra(`CONDULETE-PESADO-T-${stdConduitSize}`, qT);
          if (qLR > 0) addInfra(`CONDULETE-PESADO-LR-${stdConduitSize}`, qLR);
          if (qE > 0) addInfra(`CONDULETE-PESADO-E-${stdConduitSize}`, qE);
        } else {
          addInfra(`CONDULETE-GALV-${stdConduitSize}`, stdCondCount);
          addInfra(`UNIDUT-GALV-${stdConduitSize}`, 3 * stdCondCount);
        }
      }

      if (redCondCount > 0) {
        if (infraType === 'pesada') {
          const qT = Math.floor(redCondCount / 3);
          const qLR = Math.floor(redCondCount / 3);
          const qE = redCondCount - 2 * qT;
          if (qT > 0) addInfra(`CONDULETE-PESADO-T-${redConduitSize}`, qT);
          if (qLR > 0) addInfra(`CONDULETE-PESADO-LR-${redConduitSize}`, qLR);
          if (qE > 0) addInfra(`CONDULETE-PESADO-E-${redConduitSize}`, qE);
        } else {
          addInfra(`CONDULETE-GALV-${redConduitSize}`, redCondCount);
          addInfra(`UNIDUT-GALV-${redConduitSize}`, 3 * redCondCount);
        }
      }

      terminatingEquips.forEach(ae => {
        if (ae.hasPower && panel.type !== 'comando' && panel.type !== 'remoto') addInfra(`PRENSA-CABO-3/4`, 1);
        if (ae.autCount > 0) addInfra(`PRENSA-CABO-1/2`, ae.autCount);
      });
    }

    uPrev = u_s;
  });

  if (isEletrocalhaMode && totalEletrocalhaLength > 0) {
    let trayCode = 'ELETROCALHA-100x50';
    if (totalPanelCablesArea > 4000) {
      trayCode = 'ELETROCALHA-300x50';
    } else if (totalPanelCablesArea > 2000) {
      trayCode = 'ELETROCALHA-200x50';
    }

    addInfra(trayCode, totalEletrocalhaLength);
    addInfra('SUPORTE-TIRANTE', Math.ceil(totalEletrocalhaLength / 1.5));
  }

  // Add all cables in their full lengths
  activeEquips.forEach(ae => {
    ae.cables.forEach(c => {
      addInfra(c.code, c.qty);
    });
  });

  // Round up any eletroduto quantities to the next multiple of 3 (for 3m bars)
  Object.keys(infraMap).forEach(key => {
    if (key.startsWith('ELETRODUTO-')) {
      const currentQty = infraMap[key].qty;
      const bars = Math.ceil(currentQty / 3);
      infraMap[key].qty = bars * 3;
      infraMap[key].value = infraMap[key].qty * infraMap[key].unitPrice;
    }
  });

  return Object.values(infraMap);
}

function getPPCableCode(vias, sectionStr) {
  const cleanStr = sectionStr.replace("mm²", "").trim().replace(",", ".");
  const sec = parseFloat(cleanStr) || 1.5;
  
  if (vias === 3) {
    if (sec <= 1.5) return "CABO-PP-3X1.5";
    if (sec <= 2.5) return "CABO-PP-3X2.5";
    if (sec <= 4.0) return "CABO-PP-3X4.0";
    if (sec <= 6.0) return "CABO-PP-3X6.0";
    if (sec <= 10.0) return "CABO-PP-3X10.0";
    if (sec <= 16.0) return "CABO-PP-3X16.0";
    return "CABO-PP-3X25.0";
  } else if (vias === 4) {
    if (sec <= 1.5) return "CABO-PP-4X1.5";
    if (sec <= 2.5) return "CABO-PP-4X2.5";
    if (sec <= 4.0) return "CABO-PP-4X4.0";
    if (sec <= 6.0) return "CABO-PP-4X6.0";
    if (sec <= 10.0) return "CABO-PP-4X10.0";
    if (sec <= 16.0) return "CABO-PP-4X16.0";
    if (sec <= 25.0) return "CABO-PP-4X25.0";
    if (sec <= 35.0) return "CABO-PP-4X35.0";
    return "CABO-PP-4X50.0";
  }
  return null;
}

function renderInfraView() {
  const select = document.getElementById('infra-panel-select');
  if (!select) return;
  
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Escolha um Quadro --</option>';
  
  budgetState.panels.forEach(p => {
    const hasEquips = (p.equipments && p.equipments.length > 0) || ((p.type === 'comando' || p.type === 'remoto') && p.quantity > 0);
    if (hasEquips) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    }
  });
  
  const updateAddBtnState = (panel) => {
    const addBtn = document.getElementById('btn-add-infra-to-consolidated');
    if (!addBtn) return;
    
    // Ensure consolidatedInfraPanels is initialized
    budgetState.consolidatedInfraPanels = budgetState.consolidatedInfraPanels || [];
    
    const isAdded = budgetState.consolidatedInfraPanels.includes(panel.id);
    if (isAdded) {
      addBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; margin-right:4px;"><path d="M20 6L9 17l-5-5"/></svg> Adicionado à Lista`;
      addBtn.className = 'btn btn-secondary';
      addBtn.disabled = true;
      addBtn.style.pointerEvents = 'none';
      addBtn.style.opacity = '0.75';
    } else {
      addBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; margin-right:4px;"><path d="M12 5v14M5 12h14"/></svg> Adicionar à Lista Geral`;
      addBtn.className = 'btn btn-primary';
      addBtn.disabled = false;
      addBtn.style.pointerEvents = 'auto';
      addBtn.style.opacity = '1';
    }
    
    addBtn.onclick = () => {
      if (!budgetState.consolidatedInfraPanels.includes(panel.id)) {
        budgetState.consolidatedInfraPanels.push(panel.id);
        saveState();
        renderInfraView(); // Re-render to update lists and tables
      }
    };
  };

  const typeSelect = document.getElementById('infra-type-select');
  if (typeSelect) {
    typeSelect.onchange = (e) => {
      const pId = parseInt(select.value);
      const panel = budgetState.panels.find(p => p.id === pId);
      if (panel) {
        panel.infraType = e.target.value;
        saveStateSilently();
        renderInfraTableForPanel(panel);
      }
    };
  }

  if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
    const panel = budgetState.panels.find(p => p.id === parseInt(currentVal));
    if (panel) {
      document.getElementById('infra-config-panel').classList.remove('hidden-section');
      if (typeSelect) {
        typeSelect.value = panel.infraType || 'leve';
      }
      updateAddBtnState(panel);
    }
  } else {
    document.getElementById('infra-config-panel').classList.add('hidden-section');
  }

  select.onchange = (e) => {
    const pId = parseInt(e.target.value);
    const panel = budgetState.panels.find(p => p.id === pId);
    if (panel) {
      document.getElementById('infra-config-panel').classList.remove('hidden-section');
      if (typeSelect) {
        typeSelect.value = panel.infraType || 'leve';
      }
      renderInfraEquipmentsInputs(panel);
      renderInfraTableForPanel(panel);
      updateAddBtnState(panel);
    } else {
      document.getElementById('infra-config-panel').classList.add('hidden-section');
    }
  };

  const centralCb = document.getElementById('central-automation-checkbox');
  if (centralCb) {
    centralCb.checked = !!budgetState.hasCentralAutomation;
    centralCb.onchange = (e) => {
      budgetState.hasCentralAutomation = e.target.checked;
      saveState();
    };
  }

  renderConsolidatedInfraTable();
}

function renderInfraEquipmentsInputs(panel) {
  const container = document.getElementById('infra-equipments-list');
  if (!container) return;
  container.innerHTML = '';
  
  panel.infraDistances = panel.infraDistances || {};
  
  if (panel.type === 'comando' || panel.type === 'remoto') {
    const item = document.createElement('div');
    item.className = 'card';
    item.style.padding = '16px';
    item.style.backgroundColor = 'var(--bg-secondary)';
    item.style.border = '1px solid var(--border-color)';
    item.style.borderRadius = 'var(--radius-sm)';
    
    const label = panel.type === 'comando' ? 'Quadro de Comando' : 'Quadro de Automação Remota';
    
    item.innerHTML = `
      <h4 style="font-size: 0.9rem; font-weight: 600; margin-bottom: 12px;">Distância Geral do Quadro <span class="badge badge-accent" style="margin-left: 6px; font-size: 0.7rem;">${panel.type.toUpperCase()}</span></h4>
      <div class="form-group" style="margin: 0;">
        <label class="form-label" style="font-size: 0.75rem; margin-bottom: 6px;">Distância Geral até os Equipamentos</label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="number" class="form-control infra-distance-input" data-eq-id="general" value="${panel.infraDistances['general'] || 0}" min="0" style="height: 36px;">
          <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">metros</span>
        </div>
      </div>
    `;
    
    const input = item.querySelector('.infra-distance-input');
    input.addEventListener('input', (e) => {
      const dist = parseFloat(e.target.value) || 0;
      panel.infraDistances['general'] = dist;
      
      localStorage.setItem('panel_builder_state', JSON.stringify(budgetState));
      
      renderInfraTableForPanel(panel);
      renderConsolidatedInfraTable();
    });
    
    container.appendChild(item);
  } else {
    panel.equipments.forEach(eq => {
      const item = document.createElement('div');
      item.className = 'card';
      item.style.padding = '16px';
      item.style.backgroundColor = 'var(--bg-secondary)';
      item.style.border = '1px solid var(--border-color)';
      item.style.borderRadius = 'var(--radius-sm)';
      
      item.innerHTML = `
        <h4 style="font-size: 0.9rem; font-weight: 600; margin-bottom: 12px;">${eq.name || eq.type} <span class="badge badge-accent" style="margin-left: 6px; font-size: 0.7rem;">${eq.type}</span></h4>
        <div class="form-group" style="margin: 0;">
          <label class="form-label" style="font-size: 0.75rem; margin-bottom: 6px;">Distância até o Quadro</label>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="number" class="form-control infra-distance-input" data-eq-id="${eq.id}" value="${panel.infraDistances[eq.id] || 0}" min="0" style="height: 36px;">
            <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">metros</span>
          </div>
        </div>
      `;
      
      const input = item.querySelector('.infra-distance-input');
      input.addEventListener('input', (e) => {
        const dist = parseFloat(e.target.value) || 0;
        panel.infraDistances[eq.id] = dist;
        
        localStorage.setItem('panel_builder_state', JSON.stringify(budgetState));
        
        renderInfraTableForPanel(panel);
        renderConsolidatedInfraTable();
      });
      
      container.appendChild(item);
    });
  }
}

function renderInfraTableForPanel(panel) {
  const tableBody = document.getElementById('infra-panel-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = '';
  
  const infraItems = calculateInfraComponentsForPanel(panel);
  if (infraItems.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 16px;">Defina distâncias maiores que zero para carregar materiais.</td></tr>';
    return;
  }
  
  let totalVal = 0;
  infraItems.forEach(item => {
    totalVal += item.value;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="padding: 10px 16px; font-weight: 500; text-align: left;">${item.code}</td>
      <td style="padding: 10px 16px; text-align: left;">${item.name}</td>
      <td style="padding: 10px 16px; color: var(--text-secondary); font-size: 0.85rem; text-align: left;">${item.brand}</td>
      <td style="padding: 10px 16px; text-align: right; font-weight: 600;">${item.qty.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
      <td style="padding: 10px 16px; color: var(--text-secondary); font-size: 0.85rem; text-align: left;">${item.unit}</td>
      <td style="padding: 10px 16px; text-align: right;">R$ ${item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding: 10px 16px; text-align: right; font-weight: 600; color: var(--text-primary);">R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    `;
    tableBody.appendChild(row);
  });
  
  const totalRow = document.createElement('tr');
  totalRow.style.fontWeight = '700';
  totalRow.style.backgroundColor = 'rgba(99, 102, 241, 0.04)';
  totalRow.innerHTML = `
    <td colspan="6" style="padding: 12px 16px; text-align: right; color: var(--text-primary);">Total do Quadro Selecionado:</td>
    <td style="padding: 12px 16px; text-align: right; color: var(--primary); font-size: 1rem;">R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
  `;
  tableBody.appendChild(totalRow);
}

function getConsolidatedInfraItems() {
  const totalInfraMap = {};
  
  // 1. Gather normal panel items
  const addedPanels = budgetState.panels.filter(p => (budgetState.consolidatedInfraPanels || []).includes(p.id));
  addedPanels.forEach(panel => {
    const items = calculateInfraComponentsForPanel(panel);
    items.forEach(item => {
      if (totalInfraMap[item.code]) {
        totalInfraMap[item.code].qty += item.qty;
        totalInfraMap[item.code].value = totalInfraMap[item.code].qty * totalInfraMap[item.code].unitPrice;
      } else {
        totalInfraMap[item.code] = { ...item };
      }
    });
  });

  // 2. Gather Central Automation items if checked
  if (budgetState.hasCentralAutomation) {
    const addConsolidated = (code, qtyMultiplier = 1) => {
      if (!code) return;
      const catItem = PRECOS_DATABASE.catalog[code];
      if (!catItem) return;
      if (totalInfraMap[code]) {
        totalInfraMap[code].qty += qtyMultiplier;
        totalInfraMap[code].value = totalInfraMap[code].qty * totalInfraMap[code].unitPrice;
      } else {
        totalInfraMap[code] = {
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

    addedPanels.forEach(panel => {
      const isEligible = panel.type === 'automacao' || panel.type === 'remoto' || panel.type === 'completo';
      if (!isEligible) return;
      
      const distances = panel.infraDistances || {};
      const infraType = panel.infraType || 'leve';
      
      let equips = [];
      if (panel.equipments && panel.equipments.length > 0) {
        equips = panel.equipments;
      } else if ((panel.type === 'comando' || panel.type === 'remoto') && panel.quantity > 0) {
        for (let i = 1; i <= panel.quantity; i++) {
          equips.push({ id: `virtual-${i}` });
        }
      }
      
      equips.forEach(eq => {
        const D = (panel.type === 'comando' || panel.type === 'remoto') ? (parseFloat(panel.infraDistances['general']) || 0) : (parseFloat(distances[eq.id]) || 0);
        if (D <= 0) return;
        
        addConsolidated('CABO-REDE-CAT6', D);
        
        const size = '1/2';
        if (infraType === 'pesada') {
          addConsolidated(`ELETRODUTO-PESADO-${size}`, D);
        } else {
          addConsolidated(`ELETRODUTO-GALV-${size}`, D);
        }
        
        addConsolidated('SUPORTE-ABRACADEIRA', Math.ceil(D / 1.5));
        
        const conduleteCount = Math.ceil(D);
        if (conduleteCount > 0) {
          if (infraType === 'pesada') {
            const qT = Math.floor(conduleteCount / 3);
            const qLR = Math.floor(conduleteCount / 3);
            const qE = conduleteCount - 2 * qT;
            if (qT > 0) addConsolidated(`CONDULETE-PESADO-T-${size}`, qT);
            if (qLR > 0) addConsolidated(`CONDULETE-PESADO-LR-${size}`, qLR);
            if (qE > 0) addConsolidated(`CONDULETE-PESADO-E-${size}`, qE);
          } else {
            addConsolidated(`CONDULETE-GALV-${size}`, conduleteCount);
            addConsolidated(`UNIDUT-GALV-${size}`, 3 * conduleteCount);
          }
        }
      });
    });
  }

  return Object.values(totalInfraMap);
}

function renderConsolidatedInfraTable() {
  const tableBody = document.getElementById('infra-consolidated-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = '';
  
  budgetState.consolidatedInfraPanels = budgetState.consolidatedInfraPanels || [];
  const addedPanels = budgetState.panels.filter(p => budgetState.consolidatedInfraPanels.includes(p.id));
  
  const addedPanelsList = document.getElementById('infra-added-panels-list');
  if (addedPanelsList) {
    addedPanelsList.innerHTML = '';
    if (addedPanels.length === 0) {
      addedPanelsList.innerHTML = '<span style="font-size:0.85rem; color:var(--text-secondary);">Nenhum quadro adicionado à lista consolidada ainda. Defina as distâncias e clique em "Adicionar à Lista Geral" acima.</span>';
    } else {
      addedPanels.forEach(p => {
        const badge = document.createElement('div');
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '8px';
        badge.style.padding = '6px 12px';
        badge.style.backgroundColor = 'var(--bg-primary)';
        badge.style.border = '1px solid var(--border-color)';
        badge.style.borderRadius = 'var(--radius-sm)';
        badge.style.fontSize = '0.8rem';
        badge.style.color = 'var(--text-primary)';
        
        badge.innerHTML = `
          <strong style="color:var(--primary);">${p.name}</strong>
          <button type="button" class="btn-icon-only" style="padding: 0; color: var(--danger); background: none; border: none; cursor: pointer; display: flex; align-items: center;" title="Remover da soma geral">
            <svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.5; stroke-linecap:round; stroke-linejoin:round;"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        `;
        
        const removeBtn = badge.querySelector('button');
        removeBtn.onclick = () => {
          budgetState.consolidatedInfraPanels = budgetState.consolidatedInfraPanels.filter(id => id !== p.id);
          saveState();
          renderInfraView();
        };
        
        addedPanelsList.appendChild(badge);
      });
    }
  }
  
  const totalItems = getConsolidatedInfraItems();
  if (totalItems.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 24px;">Adicione quadros na lista acima para ver o consolidado geral de materiais de infraestrutura.</td></tr>';
    return;
  }
  
  let totalVal = 0;
  totalItems.forEach(item => {
    totalVal += item.value;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="padding: 10px 16px; font-weight: 500; text-align: left;">${item.code}</td>
      <td style="padding: 10px 16px; text-align: left;">${item.name}</td>
      <td style="padding: 10px 16px; color: var(--text-secondary); font-size: 0.85rem; text-align: left;">${item.brand}</td>
      <td style="padding: 10px 16px; text-align: right; font-weight: 600;">${item.qty.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
      <td style="padding: 10px 16px; color: var(--text-secondary); font-size: 0.85rem; text-align: left;">${item.unit}</td>
      <td style="padding: 10px 16px; text-align: right;">R$ ${item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding: 10px 16px; text-align: right; font-weight: 600; color: var(--text-primary);">R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    `;
    tableBody.appendChild(row);
  });
  
  const totalRow = document.createElement('tr');
  totalRow.style.fontWeight = '700';
  totalRow.style.backgroundColor = 'rgba(99, 102, 241, 0.04)';
  totalRow.innerHTML = `
    <td colspan="6" style="padding: 12px 16px; text-align: right; color: var(--text-primary);">Total Geral da Infraestrutura:</td>
    <td style="padding: 12px 16px; text-align: right; color: var(--primary); font-size: 1rem;">R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
  `;
  tableBody.appendChild(totalRow);
}

// Delete Panel
function deletePanel(id) {
  if (confirm("Tem certeza que deseja excluir este quadro elétrico do orçamento?")) {
    budgetState.panels = budgetState.panels.filter(p => p.id !== id);
    budgetState.consolidatedInfraPanels = (budgetState.consolidatedInfraPanels || []).filter(pId => pId !== id);
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
  const autExtras = document.getElementById('panel-automation-extras-section');
  if (autExtras) autExtras.classList.add('hidden-section');
  
  resetEquipmentForm();
  draftEquipments = [];
  renderDraftEquipments();
}

// Reset Equipment Form specifically
function resetEquipmentForm() {
  document.getElementById('equip-name').value = '';
  document.getElementById('equip-type').selectedIndex = 0;
  document.getElementById('equip-motor-power').selectedIndex = 2; // 0.75kW default
  const motorPowerTxt = document.getElementById('equip-motor-power-txt');
  if (motorPowerTxt) motorPowerTxt.value = '';
  
  // Uncheck all checkboxes within the equipment builder section
  const checkboxes = document.querySelectorAll('#equipment-builder-section input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = false;
    const tile = cb.closest('.checkbox-tile');
    if (tile) tile.classList.remove('checked');
  });
  
  // Reset custom UTA fields
  const utaHeating = document.getElementById('uta-has-heating');
  if (utaHeating) utaHeating.checked = false;
  const utaHumid = document.getElementById('uta-has-humid');
  if (utaHumid) utaHumid.checked = false;
  
  const heatingSelect = document.getElementById('uta-heating-power');
  if (heatingSelect) heatingSelect.value = '';
  const humidSelect = document.getElementById('uta-humid-power');
  if (humidSelect) humidSelect.value = '';
  
  const heatingStages = document.getElementById('uta-heating-stages');
  if (heatingStages) heatingStages.value = '1';
  const humidStages = document.getElementById('uta-humid-stages');
  if (humidStages) humidStages.value = '1';
  
  const heatingOnOff = document.querySelector('input[name="uta-heating-control"][value="OnOff"]');
  if (heatingOnOff) heatingOnOff.checked = true;
  const humidOnOff = document.querySelector('input[name="uta-humid-control"][value="OnOff"]');
  if (humidOnOff) humidOnOff.checked = true;
  
  const expansionIndireta = document.querySelector('input[name="uta-expansion-type"][value="Indireta"]');
  if (expansionIndireta) expansionIndireta.checked = true;
  const valveProporcional = document.querySelector('input[name="uta-valve-type"][value="Proporcional"]');
  if (valveProporcional) valveProporcional.checked = true;
  
  const heatingPanel = document.getElementById('uta-heating-details-panel');
  if (heatingPanel) heatingPanel.classList.add('hidden-section');
  const humidPanel = document.getElementById('uta-humid-details-panel');
  if (humidPanel) humidPanel.classList.add('hidden-section');
  const valvesPanel = document.getElementById('uta-indirect-valves-panel');
  if (valvesPanel) valvesPanel.classList.remove('hidden-section');
  
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
  const autExtras = document.getElementById('panel-automation-extras-section');
  if (autExtras) autExtras.classList.add('hidden-section');
  
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
    // Automation: show builder, hide name, power, show starts (as automation reference) and readings
    document.getElementById('panel-ihm-section').classList.remove('hidden-section');
    document.getElementById('equipment-builder-section').classList.remove('hidden-section');
    
    nameGroup.classList.add('hidden-section');
    powerGroup.classList.add('hidden-section');
    startingGroup.classList.remove('hidden-section');
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

  // Show SCADA section and extras wrapper conditionally
  if (type === 'automacao' || type === 'completo' || type === 'remoto') {
    document.getElementById('panel-supervisorio-section').classList.remove('hidden-section');
    if (autExtras) autExtras.classList.remove('hidden-section');
  }
  if (type === 'automacao' || type === 'completo') {
    if (autExtras) autExtras.classList.remove('hidden-section');
  }
  
  toggleAutomationFields();
}

// Toggle nested automation fields inside equipment builder based on Equipment Type select
function toggleAutomationFields() {
  const equipType = document.getElementById('equip-type').value;
  const panelType = document.getElementById('panel-type').value;
  
  // Toggle UTA additional configs
  const utaConfigs = document.getElementById('uta-additional-configs');
  if (utaConfigs) {
    if (equipType === 'UTA') {
      utaConfigs.classList.remove('hidden-section');
    } else {
      utaConfigs.classList.add('hidden-section');
    }
  }

  // Toggle Starting Group based on Equipment Type & Panel Type
  const startingGroup = document.getElementById('equip-starting-group');
  if (startingGroup) {
    if (panelType === 'potencia' || panelType === 'potencia-comando' || panelType === 'completo' || panelType === 'automacao') {
      if (equipType === 'CHILLER') {
        startingGroup.classList.add('hidden-section');
      } else {
        startingGroup.classList.remove('hidden-section');
      }
    } else {
      startingGroup.classList.add('hidden-section');
    }
  }

  // Hide EC starting type checkbox for BOMBAS
  const ecTile = document.getElementById('starting-type-ec-tile');
  if (ecTile) {
    if (equipType === 'BOMBAS') {
      ecTile.classList.add('hidden-section');
      // Uncheck it if it was checked
      const ecInput = ecTile.querySelector('input');
      if (ecInput && ecInput.checked) {
        ecInput.checked = false;
        ecTile.classList.remove('checked');
      }
    } else {
      // Don't show if startingGroup is hidden
      if (panelType === 'potencia' || panelType === 'potencia-comando' || panelType === 'completo' || panelType === 'automacao') {
        if (equipType !== 'CHILLER') {
          ecTile.classList.remove('hidden-section');
        } else {
          ecTile.classList.add('hidden-section');
        }
      } else {
        ecTile.classList.add('hidden-section');
      }
    }
  }

  // Toggle Motor Power Input vs Dropdown Select based on Chiller type
  const powerSelect = document.getElementById('equip-motor-power');
  const powerTxt = document.getElementById('equip-motor-power-txt');
  const powerLabel = document.getElementById('equip-motor-power-label');
  if (powerSelect && powerTxt) {
    if (equipType === 'CHILLER') {
      powerSelect.classList.add('hidden-section');
      powerTxt.classList.remove('hidden-section');
      if (powerLabel) powerLabel.textContent = "Potência do Chiller (kW)";
    } else {
      powerSelect.classList.remove('hidden-section');
      powerTxt.classList.add('hidden-section');
      if (powerLabel) powerLabel.textContent = "Potência do Motor";
    }
  }
  
  // Hide all sub-sections
  document.getElementById('aut-fields-uta').classList.add('hidden-section');
  document.getElementById('aut-fields-excv').classList.add('hidden-section');
  document.getElementById('aut-fields-chiller').classList.add('hidden-section');
  
  if (panelType !== 'automacao' && panelType !== 'completo') return;
  
  // Show matched sub-section
  if (equipType === 'UTA') {
    document.getElementById('aut-fields-uta').classList.remove('hidden-section');
  } else if (equipType === 'EX/CV') {
    document.getElementById('aut-fields-excv').classList.remove('hidden-section');
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
    if (eq.power) {
      const pStr = eq.power.toLowerCase().includes("kw") ? eq.power : `${eq.power} kW`;
      subDetails.push(`Potência: ${pStr}`);
    }
    if (eq.starts && eq.starts.length > 0) subDetails.push(`Partida: ${eq.starts.join('/')}`);
    if (eq.readings && eq.readings.length > 0) subDetails.push(`Leituras: ${eq.readings.join('/')}`);
    if (eq.nestedStarts && eq.nestedStarts.length > 0) subDetails.push(`Partida Aut: ${eq.nestedStarts.join('/')}`);
    if (eq.nestedStandards && eq.nestedStandards.length > 0) subDetails.push(`Padrão: ${eq.nestedStandards.join('/')}`);
    
    // Custom UTA details
    if (eq.type === 'UTA') {
      if (eq.hasHeating) {
        const hStg = eq.heatingStages || 1;
        subDetails.push(`Aquecimento: ${eq.heatingPower} (${eq.heatingControl === 'OnOff' ? 'On/Off' : 'Prop.'}, ${hStg} Est.)`);
      }
      if (eq.hasHumid) {
        const huStg = eq.humidStages || 1;
        subDetails.push(`Umidificação: ${eq.humidPower} (${eq.humidControl === 'OnOff' ? 'On/Off' : 'Prop.'}, ${huStg} Est.)`);
      }
      if (eq.expansionType) {
        let expStr = `Exp: ${eq.expansionType}`;
        if (eq.expansionType === 'Indireta' && eq.valveType) expStr += ` (${eq.valveType === 'OnOff' ? 'Válvula On/Off' : 'Válvula Prop.'})`;
        subDetails.push(expStr);
      }
    }
    
    const detailsString = subDetails.map(d => `<span class="badge">${d}</span>`).join(' ');
    
    const cablingHTML = getEquipmentDetailsHTML(eq);
    item.innerHTML = `
      <div class="preview-item-info" style="flex:1;">
        <h4>${eq.name ? eq.name : `Equipamento ${idx+1}`} <span class="badge badge-accent" style="margin-left: 6px;">${eq.type}</span></h4>
        <div class="preview-item-desc">${detailsString}</div>
        ${cablingHTML}
      </div>
      <button type="button" class="btn btn-danger btn-icon-only" onclick="deleteDraftEquipment(${idx})" style="padding: 4px;">
        <svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
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
  
  // Power / Starts / Automation Reference (For all panels except Comando and Remoto)
  if (panelType !== 'comando' && panelType !== 'remoto') {
    if (equipType === 'CHILLER') {
      newEquip.power = document.getElementById('equip-motor-power-txt').value.trim();
      newEquip.starts = [];
    } else {
      newEquip.power = document.getElementById('equip-motor-power').value;
      const checkedStarts = Array.from(document.querySelectorAll('input[name="starting-type"]:checked')).map(cb => cb.value);
      newEquip.starts = checkedStarts;
    }
  }
  
  // Automation fields
  if (panelType === 'automacao' || panelType === 'completo') {
    if (equipType === 'UTA') {
      newEquip.readings = Array.from(document.querySelectorAll('input[name="uta-readings"]:checked')).map(cb => cb.value);
      newEquip.nestedStarts = newEquip.starts || [];
    } 
    else if (equipType === 'EX/CV') {
      newEquip.readings = Array.from(document.querySelectorAll('input[name="excv-readings"]:checked')).map(cb => cb.value);
    } 
    else if (equipType === 'BOMBAS') {
      newEquip.nestedStandards = (newEquip.starts || []).map(s => s === 'Direta' ? 'Partida Direta' : s);
    } 
    else if (equipType === 'CHILLER') {
      newEquip.readings = Array.from(document.querySelectorAll('input[name="chiller-readings"]:checked')).map(cb => cb.value);
    }
  }

  // Custom UTA attributes (available whenever type is UTA, regardless of panelType)
  if (equipType === 'UTA') {
    const hasHeating = document.getElementById('uta-has-heating').checked;
    newEquip.hasHeating = hasHeating;
    if (hasHeating) {
      newEquip.heatingPower = document.getElementById('uta-heating-power').value;
      newEquip.heatingControl = document.querySelector('input[name="uta-heating-control"]:checked').value;
      newEquip.heatingStages = parseInt(document.getElementById('uta-heating-stages').value) || 1;
    }
    
    const hasHumid = document.getElementById('uta-has-humid').checked;
    newEquip.hasHumid = hasHumid;
    if (hasHumid) {
      newEquip.humidPower = document.getElementById('uta-humid-power').value;
      newEquip.humidControl = document.querySelector('input[name="uta-humid-control"]:checked').value;
      newEquip.humidStages = parseInt(document.getElementById('uta-humid-stages').value) || 1;
    }
    
    const expansionRadio = document.querySelector('input[name="uta-expansion-type"]:checked');
    if (expansionRadio) {
      newEquip.expansionType = expansionRadio.value;
      if (newEquip.expansionType === 'Indireta') {
        const valveRadio = document.querySelector('input[name="uta-valve-type"]:checked');
        if (valveRadio) {
          newEquip.valveType = valveRadio.value;
        }
      }
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
function editEquipmentFromPanel(panelId, equipId) {
  const panel = budgetState.panels.find(p => String(p.id) === String(panelId));
  if (!panel) {
    console.error("Painel não encontrado:", panelId);
    return;
  }
  const eq = panel.equipments.find(e => String(e.id) === String(equipId));
  if (!eq) {
    console.error("Equipamento não encontrado:", equipId);
    return;
  }

  // Populate hidden fields
  document.getElementById('edit-eq-panel-id').value = panelId;
  document.getElementById('edit-eq-id').value = equipId;

  // Populate text and type fields
  document.getElementById('edit-eq-name').value = eq.name || '';
  document.getElementById('edit-eq-type').value = eq.type;

  // Populate power dropdown list dynamically from main builder
  const mainPowerSelect = document.getElementById('equip-motor-power');
  const editPowerSelect = document.getElementById('edit-eq-power');
  if (mainPowerSelect && editPowerSelect) {
    editPowerSelect.innerHTML = mainPowerSelect.innerHTML;
  }

  // Populate power values
  const powerTxt = document.getElementById('edit-eq-power-txt');
  if (eq.type === 'CHILLER') {
    editPowerSelect.classList.add('hidden-section');
    powerTxt.classList.remove('hidden-section');
    powerTxt.value = eq.power || '';
    document.getElementById('edit-eq-power-label').textContent = "Potência do Chiller (kW)";
  } else {
    editPowerSelect.classList.remove('hidden-section');
    powerTxt.classList.add('hidden-section');
    editPowerSelect.value = eq.power || '0.75kW';
    document.getElementById('edit-eq-power-label').textContent = "Potência do Motor";
  }

  // Clear starting method checkboxes
  const startCbs = document.querySelectorAll('input[name="edit-eq-start"]');
  startCbs.forEach(cb => {
    cb.checked = false;
    const tile = cb.closest('.checkbox-tile');
    if (tile) tile.classList.remove('checked');
  });

  // Populate starting method checkboxes
  if (eq.starts) {
    const startsArr = Array.isArray(eq.starts) ? eq.starts : [eq.starts];
    startsArr.forEach(start => {
      const cb = Array.from(startCbs).find(c => c.value === start);
      if (cb) {
        cb.checked = true;
        const tile = cb.closest('.checkbox-tile');
        if (tile) tile.classList.add('checked');
      }
    });
  }

  // Hide EC starting type checkbox for BOMBAS
  const ecTile = document.getElementById('edit-eq-start-ec-tile');
  if (ecTile) {
    if (eq.type === 'BOMBAS') {
      ecTile.classList.add('hidden-section');
    } else {
      ecTile.classList.remove('hidden-section');
    }
  }

  // Clear readings checkboxes
  const readingsUTA = document.querySelectorAll('input[name="edit-uta-readings"]');
  const readingsEXCV = document.querySelectorAll('input[name="edit-excv-readings"]');
  const readingsChiller = document.querySelectorAll('input[name="edit-chiller-readings"]');
  
  [readingsUTA, readingsEXCV, readingsChiller].forEach(list => {
    list.forEach(cb => {
      cb.checked = false;
      const tile = cb.closest('.checkbox-tile');
      if (tile) tile.classList.remove('checked');
    });
  });

  // Populate readings checkboxes
  if (eq.readings) {
    let listToUse = [];
    if (eq.type === 'UTA') listToUse = readingsUTA;
    else if (eq.type === 'EX/CV') listToUse = readingsEXCV;
    else if (eq.type === 'CHILLER') listToUse = readingsChiller;

    eq.readings.forEach(read => {
      const cb = Array.from(listToUse).find(c => c.value === read);
      if (cb) {
        cb.checked = true;
        const tile = cb.closest('.checkbox-tile');
        if (tile) tile.classList.add('checked');
      }
    });
  }

  // Show/Hide automation sections
  const autFields = document.getElementById('edit-eq-automation-fields');
  const utaConfigs = document.getElementById('edit-eq-uta-configs');
  
  document.getElementById('edit-aut-fields-uta').classList.add('hidden-section');
  document.getElementById('edit-aut-fields-excv').classList.add('hidden-section');
  document.getElementById('edit-aut-fields-chiller').classList.add('hidden-section');
  
  if (panel.type === 'automacao' || panel.type === 'completo') {
    autFields.classList.remove('hidden-section');
    if (eq.type === 'UTA') {
      document.getElementById('edit-aut-fields-uta').classList.remove('hidden-section');
      utaConfigs.classList.remove('hidden-section');
    } else if (eq.type === 'EX/CV') {
      document.getElementById('edit-aut-fields-excv').classList.remove('hidden-section');
      utaConfigs.classList.add('hidden-section');
    } else if (eq.type === 'CHILLER') {
      document.getElementById('edit-aut-fields-chiller').classList.remove('hidden-section');
      utaConfigs.classList.add('hidden-section');
    } else {
      utaConfigs.classList.add('hidden-section');
    }
  } else {
    autFields.classList.add('hidden-section');
    if (eq.type === 'UTA') {
      utaConfigs.classList.remove('hidden-section');
    } else {
      utaConfigs.classList.add('hidden-section');
    }
  }

  // Populate UTA heating details
  const hasHeating = !!eq.hasHeating;
  document.getElementById('edit-eq-has-heating').checked = hasHeating;
  const heatingTile = document.getElementById('edit-eq-heating-tile');
  if (heatingTile) {
    if (hasHeating) heatingTile.classList.add('checked');
    else heatingTile.classList.remove('checked');
  }
  document.getElementById('edit-eq-heating-power').value = eq.heatingPower || '';
  document.getElementById('edit-eq-heating-stages').value = eq.heatingStages || '1';
  const heatingControlVal = eq.heatingControl || 'OnOff';
  const heatingControlRadio = document.querySelector(`input[name="edit-eq-heating-control"][value="${heatingControlVal}"]`);
  if (heatingControlRadio) heatingControlRadio.checked = true;

  if (hasHeating) {
    document.getElementById('edit-eq-heating-panel').classList.remove('hidden-section');
  } else {
    document.getElementById('edit-eq-heating-panel').classList.add('hidden-section');
  }

  // Populate UTA humidification details
  const hasHumid = !!eq.hasHumid;
  document.getElementById('edit-eq-has-humid').checked = hasHumid;
  const humidTile = document.getElementById('edit-eq-humid-tile');
  if (humidTile) {
    if (hasHumid) humidTile.classList.add('checked');
    else humidTile.classList.remove('checked');
  }
  document.getElementById('edit-eq-humid-power').value = eq.humidPower || '';
  document.getElementById('edit-eq-humid-stages').value = eq.humidStages || '1';
  const humidControlVal = eq.humidControl || 'OnOff';
  const humidControlRadio = document.querySelector(`input[name="edit-eq-humid-control"][value="${humidControlVal}"]`);
  if (humidControlRadio) humidControlRadio.checked = true;

  if (hasHumid) {
    document.getElementById('edit-eq-humid-panel').classList.remove('hidden-section');
  } else {
    document.getElementById('edit-eq-humid-panel').classList.add('hidden-section');
  }

  // Populate expansion and valve options
  const expansionVal = eq.expansionType || 'Indireta';
  const expansionRadio = document.querySelector(`input[name="edit-eq-expansion-type"][value="${expansionVal}"]`);
  if (expansionRadio) expansionRadio.checked = true;

  const valveVal = eq.valveType || 'Proporcional';
  const valveRadio = document.querySelector(`input[name="edit-eq-valve-type"][value="${valveVal}"]`);
  if (valveRadio) valveRadio.checked = true;

  const valvesPanel = document.getElementById('edit-eq-valves-panel');
  if (expansionVal === 'Indireta') {
    valvesPanel.classList.remove('hidden-section');
  } else {
    valvesPanel.classList.add('hidden-section');
  }

  // Show equipment modal
  document.getElementById('edit-equipment-modal').classList.add('active');
}

function closeEditEquipmentModal() {
  document.getElementById('edit-equipment-modal').classList.remove('active');
}

function saveEditEquipment() {
  try {
    const panelId = document.getElementById('edit-eq-panel-id').value;
    const equipId = document.getElementById('edit-eq-id').value;
    
    const panel = budgetState.panels.find(p => String(p.id) === String(panelId));
    if (!panel) {
      alert("Erro ao salvar: Painel não encontrado (ID: " + panelId + ")");
      return;
    }
    const eq = panel.equipments.find(e => String(e.id) === String(equipId));
    if (!eq) {
      alert("Erro ao salvar: Equipamento não encontrado (ID: " + equipId + ")");
      return;
    }

    const type = document.getElementById('edit-eq-type').value;
    const name = document.getElementById('edit-eq-name').value.trim();
    
    if (!name) {
      alert("O nome/tag do equipamento é obrigatório.");
      return;
    }

    eq.type = type;
    eq.name = name;

    if (type === 'CHILLER') {
      eq.power = document.getElementById('edit-eq-power-txt').value.trim();
    } else {
      eq.power = document.getElementById('edit-eq-power').value;
    }

    // Read starting methods
    const startCbs = document.querySelectorAll('input[name="edit-eq-start"]:checked');
    eq.starts = Array.from(startCbs).map(cb => cb.value);

    // Read readings
    let readingsList = [];
    if (type === 'UTA') {
      readingsList = document.querySelectorAll('input[name="edit-uta-readings"]:checked');
    } else if (type === 'EX/CV') {
      readingsList = document.querySelectorAll('input[name="edit-excv-readings"]:checked');
    } else if (type === 'CHILLER') {
      readingsList = document.querySelectorAll('input[name="edit-chiller-readings"]:checked');
    }
    eq.readings = Array.from(readingsList).map(cb => cb.value);

    // Set nested starts / standards
    if (type === 'UTA') {
      eq.nestedStarts = eq.starts || [];
    } else if (type === 'BOMBAS') {
      eq.nestedStandards = (eq.starts || []).map(s => s === 'Direta' ? 'Partida Direta' : s);
    }

    // Heating
    const hasHeating = document.getElementById('edit-eq-has-heating').checked;
    eq.hasHeating = hasHeating;
    if (hasHeating) {
      eq.heatingPower = document.getElementById('edit-eq-heating-power').value.trim();
      const checkedHeating = document.querySelector('input[name="edit-eq-heating-control"]:checked');
      eq.heatingControl = checkedHeating ? checkedHeating.value : 'OnOff';
      eq.heatingStages = parseInt(document.getElementById('edit-eq-heating-stages').value) || 1;
    } else {
      delete eq.heatingPower;
      delete eq.heatingControl;
      delete eq.heatingStages;
    }

    // Humidification
    const hasHumid = document.getElementById('edit-eq-has-humid').checked;
    eq.hasHumid = hasHumid;
    if (hasHumid) {
      eq.humidPower = document.getElementById('edit-eq-humid-power').value.trim();
      const checkedHumid = document.querySelector('input[name="edit-eq-humid-control"]:checked');
      eq.humidControl = checkedHumid ? checkedHumid.value : 'OnOff';
      eq.humidStages = parseInt(document.getElementById('edit-eq-humid-stages').value) || 1;
    } else {
      delete eq.humidPower;
      delete eq.humidControl;
      delete eq.humidStages;
    }

    // Expansion and valves
    if (type === 'UTA') {
      const expansionRadio = document.querySelector('input[name="edit-eq-expansion-type"]:checked');
      eq.expansionType = expansionRadio ? expansionRadio.value : 'Indireta';
      if (eq.expansionType === 'Indireta') {
        const valveRadio = document.querySelector('input[name="edit-eq-valve-type"]:checked');
        eq.valveType = valveRadio ? valveRadio.value : 'Proporcional';
      } else {
        delete eq.valveType;
      }
    } else {
      delete eq.expansionType;
      delete eq.valveType;
    }

    // Recalculate components!
    panel.components = calculatePanelComponents(panel);

    saveState();
    closeEditEquipmentModal();
    renderEditEquipments(panel);
    renderPanelsList();
  } catch (err) {
    console.error("Erro ao salvar equipamento:", err);
    alert("Erro ao salvar equipamento: " + err.message);
  }
}

function setupEditEquipmentEvents() {
  // Toggle sections on type change
  const editEqType = document.getElementById('edit-eq-type');
  if (editEqType) {
    editEqType.addEventListener('change', () => {
      const type = editEqType.value;
      const panelId = parseInt(document.getElementById('edit-eq-panel-id').value) || 0;
      const panel = budgetState.panels.find(p => p.id === panelId);
      
      // Hide EC starting type checkbox for BOMBAS
      const ecTile = document.getElementById('edit-eq-start-ec-tile');
      if (ecTile) {
        if (type === 'BOMBAS') ecTile.classList.add('hidden-section');
        else ecTile.classList.remove('hidden-section');
      }
      
      // Toggle power input vs select
      const powerSelect = document.getElementById('edit-eq-power');
      const powerTxt = document.getElementById('edit-eq-power-txt');
      const powerLabel = document.getElementById('edit-eq-power-label');
      if (powerSelect && powerTxt) {
        if (type === 'CHILLER') {
          powerSelect.classList.add('hidden-section');
          powerTxt.classList.remove('hidden-section');
          if (powerLabel) powerLabel.textContent = "Potência do Chiller (kW)";
        } else {
          powerSelect.classList.remove('hidden-section');
          powerTxt.classList.add('hidden-section');
          if (powerLabel) powerLabel.textContent = "Potência do Motor";
        }
      }
      
      // Hide/show automation fields
      const autFields = document.getElementById('edit-eq-automation-fields');
      const utaConfigs = document.getElementById('edit-eq-uta-configs');
      const autFieldsUta = document.getElementById('edit-aut-fields-uta');
      const autFieldsExcv = document.getElementById('edit-aut-fields-excv');
      const autFieldsChiller = document.getElementById('edit-aut-fields-chiller');
      
      if (autFieldsUta) autFieldsUta.classList.add('hidden-section');
      if (autFieldsExcv) autFieldsExcv.classList.add('hidden-section');
      if (autFieldsChiller) autFieldsChiller.classList.add('hidden-section');
      
      const isAut = panel && (panel.type === 'automacao' || panel.type === 'completo');
      if (isAut && autFields) {
        autFields.classList.remove('hidden-section');
        if (type === 'UTA' && autFieldsUta && utaConfigs) {
          autFieldsUta.classList.remove('hidden-section');
          utaConfigs.classList.remove('hidden-section');
        } else if (type === 'EX/CV' && autFieldsExcv && utaConfigs) {
          autFieldsExcv.classList.remove('hidden-section');
          utaConfigs.classList.add('hidden-section');
        } else if (type === 'CHILLER' && autFieldsChiller && utaConfigs) {
          autFieldsChiller.classList.remove('hidden-section');
          utaConfigs.classList.add('hidden-section');
        } else if (utaConfigs) {
          utaConfigs.classList.add('hidden-section');
        }
      } else if (autFields) {
        autFields.classList.add('hidden-section');
        if (utaConfigs) {
          if (type === 'UTA') utaConfigs.classList.remove('hidden-section');
          else utaConfigs.classList.add('hidden-section');
        }
      }
    });
  }

  // Toggle heating details panel
  const editEqHasHeating = document.getElementById('edit-eq-has-heating');
  if (editEqHasHeating) {
    editEqHasHeating.addEventListener('change', (e) => {
      const heatingPanel = document.getElementById('edit-eq-heating-panel');
      const tile = document.getElementById('edit-eq-heating-tile');
      if (heatingPanel) {
        if (e.target.checked) {
          heatingPanel.classList.remove('hidden-section');
          if (tile) tile.classList.add('checked');
        } else {
          heatingPanel.classList.add('hidden-section');
          if (tile) tile.classList.remove('checked');
        }
      }
    });
  }

  // Toggle humid details panel
  const editEqHasHumid = document.getElementById('edit-eq-has-humid');
  if (editEqHasHumid) {
    editEqHasHumid.addEventListener('change', (e) => {
      const humidPanel = document.getElementById('edit-eq-humid-panel');
      const tile = document.getElementById('edit-eq-humid-tile');
      if (humidPanel) {
        if (e.target.checked) {
          humidPanel.classList.remove('hidden-section');
          if (tile) tile.classList.add('checked');
        } else {
          humidPanel.classList.add('hidden-section');
          if (tile) tile.classList.remove('checked');
        }
      }
    });
  }

  // Toggle expansion type radio change
  const editEqExpansionRadios = document.querySelectorAll('input[name="edit-eq-expansion-type"]');
  editEqExpansionRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const valvesPanel = document.getElementById('edit-eq-valves-panel');
      if (valvesPanel) {
        if (e.target.value === 'Indireta') {
          valvesPanel.classList.remove('hidden-section');
        } else {
          valvesPanel.classList.add('hidden-section');
        }
      }
    });
  });

  // Visual toggle on other checkboxes inside edit equipment modal
  const editEqCbs = document.querySelectorAll('#edit-equipment-modal input[type="checkbox"]');
  editEqCbs.forEach(cb => {
    if (cb.id === 'edit-eq-has-heating' || cb.id === 'edit-eq-has-humid') return; // Handled manually
    cb.addEventListener('change', (e) => {
      const tile = e.target.closest('.checkbox-tile');
      if (tile) {
        if (e.target.checked) tile.classList.add('checked');
        else tile.classList.remove('checked');
      }
    });
  });

  // Save button click
  const btnSaveEditEq = document.getElementById('btn-save-edit-equipment');
  if (btnSaveEditEq) {
    btnSaveEditEq.addEventListener('click', saveEditEquipment);
  }
  
  // Starting method checklist mutual exclusivity
  const makeEditEqMutuallyExclusive = (name) => {
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
  makeEditEqMutuallyExclusive('edit-eq-start');
}

function clearBudget() {
  if (confirm("ATENÇÃO: Isso apagará TODOS os quadros elétricos criados neste orçamento. Deseja continuar?")) {
    budgetState.panels = [];
    budgetState.consolidatedInfraPanels = [];
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
  const editAutExtras = document.getElementById('edit-panel-automation-extras-section');
  if (editAutExtras) editAutExtras.classList.add('hidden-section');
  
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
      if (editAutExtras) editAutExtras.classList.remove('hidden-section');
      
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
    if (editAutExtras) editAutExtras.classList.remove('hidden-section');
    
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
    if (eq.power) {
      const pStr = eq.power.toLowerCase().includes("kw") ? eq.power : `${eq.power} kW`;
      subDetails.push(`Potência: ${pStr}`);
    }
    if (eq.starts && eq.starts.length > 0) subDetails.push(`Partida: ${eq.starts.join('/')}`);
    if (eq.readings && eq.readings.length > 0) subDetails.push(`Leituras: ${eq.readings.join('/')}`);
    if (eq.nestedStarts && eq.nestedStarts.length > 0) subDetails.push(`Partida Aut: ${eq.nestedStarts.join('/')}`);
    if (eq.nestedStandards && eq.nestedStandards.length > 0) subDetails.push(`Padrão: ${eq.nestedStandards.join('/')}`);
    
    // Custom UTA details
    if (eq.type === 'UTA') {
      if (eq.hasHeating) {
        const hStg = eq.heatingStages || 1;
        subDetails.push(`Aquecimento: ${eq.heatingPower} (${eq.heatingControl === 'OnOff' ? 'On/Off' : 'Prop.'}, ${hStg} Est.)`);
      }
      if (eq.hasHumid) {
        const huStg = eq.humidStages || 1;
        subDetails.push(`Umidificação: ${eq.humidPower} (${eq.humidControl === 'OnOff' ? 'On/Off' : 'Prop.'}, ${huStg} Est.)`);
      }
      if (eq.expansionType) {
        let expStr = `Exp: ${eq.expansionType}`;
        if (eq.expansionType === 'Indireta' && eq.valveType) expStr += ` (${eq.valveType === 'OnOff' ? 'Válvula On/Off' : 'Válvula Prop.'})`;
        subDetails.push(expStr);
      }
    }
    
    const detailsString = subDetails.map(d => `<span class="badge">${d}</span>`).join(' ');
    const cablingHTML = getEquipmentDetailsHTML(eq);
    
    item.innerHTML = `
      <div class="preview-item-info" style="flex:1;">
        <h5 style="font-size:0.9rem; font-weight:600; margin:0;">${eq.name ? eq.name : `Equipamento ${idx+1}`} <span class="badge badge-accent" style="margin-left:6px;">${eq.type}</span></h5>
        <div class="preview-item-desc" style="margin-top:4px;">${detailsString}</div>
        ${cablingHTML}
      </div>
      <div style="display:flex; align-items:center; gap:4px;">
        <button type="button" class="btn btn-secondary btn-icon-only" onclick="editEquipmentFromPanel(${panel.id}, ${eq.id})" style="padding: 4px;" title="Editar características">
          <svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button type="button" class="btn btn-danger btn-icon-only" onclick="deleteEquipmentFromPanel(${panel.id}, ${eq.id})" style="padding: 4px;" title="Remover">
          <svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
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
  // Initialize lazy DOM elements
  views = {
    'dashboard-view': document.getElementById('dashboard-view'),
    'creator-view': document.getElementById('creator-view'),
    'list-view': document.getElementById('list-view'),
    'help-view': document.getElementById('help-view'),
    'infra-view': document.getElementById('infra-view'),
    'cargas-view': document.getElementById('cargas-view')
  };

  navLinks = document.querySelectorAll('.nav-link');
  viewTitle = document.getElementById('view-title');
  viewSubtitle = document.getElementById('view-subtitle');

  // Bind Save button for custom rules logic
  const btnSaveCustomLogic = document.getElementById('btn-save-custom-logic');
  if (btnSaveCustomLogic) {
    btnSaveCustomLogic.addEventListener('click', saveCustomLogic);
  }

  // Load Local Storage budget safely
  loadState();
  
  // Sidebar Navigation Links
  if (navLinks) {
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        const target = link.getAttribute('data-target');
        navigateTo(target);
      });
    });
  }
  
  // Theme Toggle Button
  const themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }
  
  // Hamburger Menu
  const hamburger = document.getElementById('hamburger-toggle');
  const sidebar = document.getElementById('sidebar-nav');
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-active');
    });
  }
  
  // Close sidebar on main click if mobile active
  const mainContent = document.querySelector('.main-content');
  if (mainContent && sidebar) {
    mainContent.addEventListener('click', () => {
      sidebar.classList.remove('mobile-active');
    });
  }

  // Panel Type selection listener in creator form
  const panelTypeSelect = document.getElementById('panel-type');
  if (panelTypeSelect) {
    panelTypeSelect.addEventListener('change', (e) => {
      handlePanelTypeChange(e.target.value);
    });
  }
  
  // Equipment type selection listener
  const equipTypeSelect = document.getElementById('equip-type');
  if (equipTypeSelect) {
    equipTypeSelect.addEventListener('change', toggleAutomationFields);
  }
  
  // Creator form - Panel HMI toggler checkbox
  const panelHasIhmCb = document.getElementById('panel-has-ihm');
  if (panelHasIhmCb) {
    panelHasIhmCb.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const label = document.getElementById('panel-has-ihm-label');
      if (label) label.textContent = isChecked ? 'Sim' : 'Não';
      
      const tile = document.getElementById('panel-ihm-checkbox-tile');
      const sizeGroup = document.getElementById('panel-ihm-size-group');
      if (tile) {
        if (isChecked) {
          tile.classList.add('checked');
          if (sizeGroup) sizeGroup.classList.remove('hidden-section');
        } else {
          tile.classList.remove('checked');
          if (sizeGroup) sizeGroup.classList.add('hidden-section');
        }
      }
    });
  }

  // Creator form - Panel SCADA toggler checkbox
  const panelHasSupervisorioCb = document.getElementById('panel-has-supervisorio');
  if (panelHasSupervisorioCb) {
    panelHasSupervisorioCb.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const label = document.getElementById('panel-has-supervisorio-label');
      if (label) label.textContent = isChecked ? 'Sim' : 'Não';
      
      const tile = document.getElementById('panel-supervisorio-checkbox-tile');
      if (tile) {
        if (isChecked) {
          tile.classList.add('checked');
        } else {
          tile.classList.remove('checked');
        }
      }
    });
  }

  // Modal edit form - Panel HMI toggler checkbox
  const editHasIhmCb = document.getElementById('edit-panel-has-ihm');
  if (editHasIhmCb) {
    editHasIhmCb.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const label = document.getElementById('edit-panel-has-ihm-label');
      if (label) label.textContent = isChecked ? 'Sim' : 'Não';
      
      const tile = document.getElementById('edit-ihm-checkbox-tile');
      const sizeGroup = document.getElementById('edit-panel-ihm-size-group');
      if (tile) {
        if (isChecked) {
          tile.classList.add('checked');
          if (sizeGroup) sizeGroup.classList.remove('hidden-section');
        } else {
          tile.classList.remove('checked');
          if (sizeGroup) sizeGroup.classList.add('hidden-section');
        }
      }
    });
  }

  // Modal edit form - Panel SCADA toggler checkbox
  const editHasSupervisorioCb = document.getElementById('edit-panel-has-supervisorio');
  if (editHasSupervisorioCb) {
    editHasSupervisorioCb.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const label = document.getElementById('edit-panel-has-supervisorio-label');
      if (label) label.textContent = isChecked ? 'Sim' : 'Não';
      
      const tile = document.getElementById('edit-supervisorio-checkbox-tile');
      if (tile) {
        if (isChecked) {
          tile.classList.add('checked');
        } else {
          tile.classList.remove('checked');
        }
      }
    });
  }

  // Toggle UTA Heating details panel
  const utaHasHeating = document.getElementById('uta-has-heating');
  if (utaHasHeating) {
    utaHasHeating.addEventListener('change', (e) => {
      const panel = document.getElementById('uta-heating-details-panel');
      if (panel) {
        if (e.target.checked) {
          panel.classList.remove('hidden-section');
        } else {
          panel.classList.add('hidden-section');
        }
      }
    });
  }

  // Toggle UTA Humidification details panel
  const utaHasHumid = document.getElementById('uta-has-humid');
  if (utaHasHumid) {
    utaHasHumid.addEventListener('change', (e) => {
      const panel = document.getElementById('uta-humid-details-panel');
      if (panel) {
        if (e.target.checked) {
          panel.classList.remove('hidden-section');
        } else {
          panel.classList.add('hidden-section');
        }
      }
    });
  }

  // Toggle UTA Expansion details panel
  const utaExpansionRadios = document.querySelectorAll('input[name="uta-expansion-type"]');
  if (utaExpansionRadios) {
    utaExpansionRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const panel = document.getElementById('uta-indirect-valves-panel');
        if (panel) {
          if (e.target.value === 'Indireta') {
            panel.classList.remove('hidden-section');
          } else {
            panel.classList.add('hidden-section');
          }
        }
      });
    });
  }
  
  // Toggle checkbox tiles visually on click
  const checkboxInputs = document.querySelectorAll('.checkbox-tile input[type="checkbox"]');
  if (checkboxInputs) {
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
  }

  // Handle mutual exclusivity for Creator supply voltage checkboxes
  const voltageCbs = document.querySelectorAll('input[name="panel-voltage"]');
  if (voltageCbs) {
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
  }

  // Handle mutual exclusivity for Edit modal supply voltage checkboxes
  const editVoltageCbs = document.querySelectorAll('input[name="edit-panel-voltage"]');
  if (editVoltageCbs) {
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
  }
  
  // Handle mutual exclusivity for Starting Types in Equipment Builder
  const makeMutuallyExclusive = (name) => {
    const checkboxes = document.querySelectorAll(`input[name="${name}"]`);
    if (checkboxes) {
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
    }
  };

  makeMutuallyExclusive('starting-type');
  makeMutuallyExclusive('uta-starts');
  makeMutuallyExclusive('bombas-standards');

  // Add Equipment click handler
  const btnAddEq = document.getElementById('btn-add-equipment');
  if (btnAddEq) {
    btnAddEq.addEventListener('click', addEquipmentToDraft);
  }
  
  // Save Panel click handler
  const btnSavePanel = document.getElementById('btn-save-panel');
  if (btnSavePanel) {
    btnSavePanel.addEventListener('click', savePanel);
  }
  
  // Cancel Creator click handler
  const btnCancelCreator = document.getElementById('btn-cancel-creator');
  if (btnCancelCreator) {
    btnCancelCreator.addEventListener('click', () => {
      const panelNameInput = document.getElementById('panel-name');
      const panelName = panelNameInput ? panelNameInput.value.trim() : '';
      if (draftEquipments.length > 0 || panelName !== '') {
        if (confirm("Descartar alterações atuais e voltar para a lista?")) {
          resetCreatorForm();
          navigateTo('list-view');
        }
      } else {
        resetCreatorForm();
        navigateTo('list-view');
      }
    });
  }
  
  const btnGenTest = document.getElementById('btn-generate-test-scenarios');
  if (btnGenTest) {
    btnGenTest.addEventListener('click', generateTestScenarios);
  }
  
  const btnExportPdf = document.getElementById('btn-export-pdf');
  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', exportToPDF);
  }
  
  // Save Edit modal changes
  const btnSaveEditPanel = document.getElementById('btn-save-edit-panel');
  if (btnSaveEditPanel) {
    btnSaveEditPanel.addEventListener('click', saveEditPanelChanges);
  }
  
  setupEditEquipmentEvents();
});

function clearAllPanels() {
  if (confirm("ATENÇÃO: Você tem certeza de que deseja apagar todos os quadros gerados e limpar o orçamento atual? Esta ação não pode ser desfeita.")) {
    budgetState.panels = [];
    budgetState.consolidatedInfraPanels = [];
    saveState();
    renderDashboard();
    renderPanelsList();
    renderCargasView();
    renderInfraView();
    alert("Orçamento limpo com sucesso.");
  }
}

function generateTestScenarios() {
  const msg = `ATENÇÃO: Este procedimento irá substituir o orçamento atual por 5 quadros de teste para validação.\n\nSerão adicionados os seguintes quadros:\n1. T01 - Quadro de Potência (2 Equips: Bomba Inversor 4kW / Exaustor Direta 1.5kW)\n2. T02 - Quadro de Comando (2 Equips)\n3. T03 - Quadro Remoto (2 Equips + IHM 7.0\")\n4. T04 - Quadro de Automação (2 Equips: UTA c/ sensores / Exaustor c/ sensores)\n5. T05 - Quadro Completo (2 Equips: UTA c/ opc. climatiz. / Bomba SoftStarter 15kW)\n\nDeseja prosseguir com a geração dos cenários de teste?`;
  if (!confirm(msg)) {
    return;
  }
  
  budgetState.panels = [];
  budgetState.consolidatedInfraPanels = [];
  
  const createEquip = (type, name, power, starts, extra = {}) => {
    const id = Date.now() + Math.floor(Math.random() * 1000000);
    return {
      id: id,
      type: type,
      name: name,
      power: power,
      starts: Array.isArray(starts) ? starts : [starts],
      ...extra
    };
  };
  
  const panelsData = [
    {
      name: "T01 - Quadro de Potência",
      type: "potencia",
      voltage: "380V",
      equips: [
        createEquip("BOMBAS", "BOMBA-01", "4.0kW", "Inversor", {
          nestedStandards: ["Inversor"]
        }),
        createEquip("EX/CV", "EX-01", "1.5kW", "Direta")
      ]
    },
    {
      name: "T02 - Quadro de Comando",
      type: "comando",
      voltage: "220V",
      quantity: 2,
      equips: []
    },
    {
      name: "T03 - Quadro Remoto",
      type: "remoto",
      voltage: "220V",
      quantity: 2,
      remotoIhmSize: '7.0"',
      hasSupervisorio: true,
      equips: []
    },
    {
      name: "T04 - Quadro de Automação",
      type: "automacao",
      voltage: "220V",
      hasIhm: true,
      ihmSize: '7.0"',
      equips: [
        createEquip("UTA", "UTA-01", "0.75kW", "Direta", {
          readings: ["Temp Duto", "Umid Duto"]
        }),
        createEquip("EX/CV", "EX-02", "1.5kW", "Inversor", {
          readings: ["Temp Ambiente", "CO2 Ambiente"]
        })
      ]
    },
    {
      name: "T05 - Quadro Completo",
      type: "completo",
      voltage: "380V",
      hasIhm: true,
      ihmSize: '10.0"',
      hasSupervisorio: true,
      equips: [
        createEquip("UTA", "UTA-02", "7.5kW", "Inversor", {
          readings: ["Temp Duto", "Umid Duto", "Vazão"],
          hasHeating: true,
          heatingPower: "6.0kW",
          heatingControl: "Proporcional",
          heatingStages: 2,
          hasHumid: true,
          humidPower: "3.0kW",
          humidControl: "OnOff",
          humidStages: 1,
          expansionType: "Indireta",
          valveType: "Proporcional"
        }),
        createEquip("BOMBAS", "BOMBA-02", "15kW", "SoftStarter", {
          readings: ["Vazão"],
          nestedStandards: ["SoftStarter"]
        })
      ]
    }
  ];
  
  panelsData.forEach((pData, idx) => {
    const pId = Date.now() + idx;
    const panel = {
      id: pId,
      name: pData.name,
      type: pData.type,
      voltage: pData.voltage,
      equipments: pData.equips,
      components: [],
      infraDistances: {}
    };
    
    if (pData.hasIhm !== undefined) panel.hasIhm = pData.hasIhm;
    if (pData.ihmSize !== undefined) panel.ihmSize = pData.ihmSize;
    if (pData.hasSupervisorio !== undefined) panel.hasSupervisorio = pData.hasSupervisorio;
    if (pData.quantity !== undefined) panel.quantity = pData.quantity;
    if (pData.remotoIhmSize !== undefined) panel.remotoIhmSize = pData.remotoIhmSize;
    
    // Set default infra distances to 15 meters for all equipments (and virtual ones)
    if (pData.equips && pData.equips.length > 0) {
      pData.equips.forEach(eq => {
        panel.infraDistances[eq.id] = 15;
      });
    } else if (pData.quantity && (pData.type === 'comando' || pData.type === 'remoto')) {
      panel.infraDistances['general'] = 15;
    }
    
    panel.components = calculatePanelComponents(panel);
    budgetState.panels.push(panel);
    
    // Auto-add to consolidated infra list
    budgetState.consolidatedInfraPanels.push(pId);
  });
  
  saveState();
  renderDashboard();
  renderPanelsList();
  renderCargasView();
  renderInfraView();
  
  alert("5 Cenários de Teste criados com sucesso! Verifique-os nas abas 'Lista de Quadros', 'Resumo de Cargas' e 'Infraestrutura'.");
}

function exportToPDF() {
  try {
    if (!budgetState || !budgetState.panels || budgetState.panels.length === 0) {
      alert("Nenhum quadro cadastrado para exportar.");
      return;
    }
    
    const today = new Date();
    const dateStr = today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Relatório de Orçamento - Quadros Elétricos e Infraestrutura</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body {
      font-family: 'Inter', sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 30px;
      font-size: 10.5pt;
      line-height: 1.4;
      background-color: #ffffff;
    }
    .header {
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 15px;
      margin-bottom: 25px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header h1 {
      font-size: 18pt;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0;
    }
    .header p {
      margin: 4px 0 0 0;
      font-size: 9.5pt;
      color: #64748b;
    }
    .date-info {
      text-align: right;
      font-size: 9.5pt;
      color: #64748b;
    }
    .section-title {
      font-size: 13pt;
      font-weight: 600;
      color: #1e3a8a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 30px;
      margin-bottom: 15px;
      page-break-after: avoid;
    }
    .panel-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 15px;
      background-color: #f8fafc;
      page-break-inside: avoid;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .panel-title {
      font-size: 11pt;
      font-weight: 600;
      color: #0f172a;
    }
    .panel-meta {
      font-size: 8.5pt;
      color: #64748b;
    }
    .report-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      margin-bottom: 15px;
      font-size: 9pt;
    }
    .report-table th {
      background-color: #f1f5f9;
      color: #475569;
      text-align: left;
      padding: 6px 8px;
      font-weight: 600;
      border-bottom: 2px solid #cbd5e1;
    }
    .report-table td {
      padding: 5px 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .report-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .num-col {
      text-align: right;
    }
    .summary-card {
      background-color: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 15px;
      margin-top: 25px;
      page-break-inside: avoid;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 10pt;
    }
    .summary-row.total {
      font-size: 13pt;
      font-weight: 700;
      border-top: 2px solid #3b82f6;
      padding-top: 10px;
      margin-top: 6px;
      color: #1e3a8a;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 8.5pt;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
    }
    @media print {
      body {
        padding: 0;
      }
      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Relatório de Orçamento</h1>
      <p>Quadros Elétricos e Infraestrutura de HVAC</p>
    </div>
    <div class="date-info">
      <strong>Data:</strong> ${dateStr}<br>
      <strong>Total de Quadros:</strong> ${budgetState.panels.length}
    </div>
  </div>
  `;
    
    html += `<h2 class="section-title">1. Detalhamento dos Quadros Elétricos</h2>`;
    
    let grandTotalPanels = 0;
    
    budgetState.panels.forEach((p, idx) => {
      let label = '';
      if (p.type === 'potencia') label = 'Potência';
      else if (p.type === 'comando') label = 'Comando';
      else if (p.type === 'potencia-comando') label = 'Potência e Comando';
      else if (p.type === 'automacao') label = 'Automação';
      else if (p.type === 'completo') label = 'Potência, Comando e Automação';
      else if (p.type === 'remoto') label = 'Automação Remoto';
      
      let details = '';
      if (p.type === 'comando' || p.type === 'remoto') {
        details = `Quantidade de equipamentos: ${p.quantity || 1}`;
        if (p.type === 'remoto') {
          details += ` | IHM: ${p.remotoIhmSize || 'Não possui'}`;
          if (p.hasSupervisorio) details += ` | Com Supervisório`;
        }
      } else {
        const eqNames = (p.equipments || []).map(eq => {
          const startName = eq.starts && eq.starts.length > 0 ? eq.starts.join('/') : 'Sem partida';
          return `${eq.name} (${eq.type} - ${startName} - ${eq.power})`;
        }).join(', ');
        details = `Equipamentos: ${eqNames || 'Nenhum'}`;
        if (p.type === 'automacao' || p.type === 'completo') {
          if (p.hasIhm) details += ` | IHM: ${p.ihmSize}`;
          if (p.hasSupervisorio) details += ` | Com Supervisório`;
        }
      }
      
      const panelVal = p.components ? p.components.reduce((sum, c) => sum + (Number(c.value) || 0), 0) : 0;
      grandTotalPanels += panelVal;
      
      html += `
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">${p.name || 'Quadro sem nome'}</div>
          <div class="panel-title" style="color: var(--primary);">${(Number(panelVal) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>
        <div class="panel-meta">
          <strong>Tipo:</strong> ${label} | <strong>Tensão:</strong> ${p.voltage || '220V'}<br>
          <strong>Características:</strong> ${details}
        </div>
        
        <table class="report-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Marca</th>
              <th class="num-col">Qtd</th>
              <th>Un</th>
              <th class="num-col">Unitário</th>
              <th class="num-col">Total</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      if (p.components && p.components.length > 0) {
        p.components.forEach(c => {
          const uPrice = Number(c.unitPrice) || 0;
          const val = Number(c.value) || 0;
          html += `
            <tr>
              <td>${c.code || '-'}</td>
              <td>${c.name || '-'}</td>
              <td>${c.brand || '-'}</td>
              <td class="num-col">${c.qty || 0}</td>
              <td>${c.unit || 'un'}</td>
              <td class="num-col">${uPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              <td class="num-col">${val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
          `;
        });
      } else {
        html += `<tr><td colspan="7" style="text-align:center; color: #94a3b8;">Nenhum componente cadastrado neste quadro.</td></tr>`;
      }
      
      html += `
          </tbody>
        </table>
      </div>
      `;
    });
    
    html += `<div class="page-break"></div>`;
    html += `<h2 class="section-title">2. Consolidado Geral de Infraestrutura</h2>`;
    
    const addedPanels = budgetState.panels.filter(p => (budgetState.consolidatedInfraPanels || []).includes(p.id));
    
    if (addedPanels.length === 0) {
      html += `<p style="color:#64748b; font-style:italic;">Nenhum quadro adicionado ao consolidado de infraestrutura.</p>`;
    } else {
      html += `<p style="font-size:9.5pt; color:#64748b; margin-bottom:10px;">Quadros considerados na infraestrutura: ${addedPanels.map(p => p.name).join(', ')}</p>`;
      
      const totalItems = getConsolidatedInfraItems();
      let grandTotalInfra = 0;
      
      html += `
      <table class="report-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Descrição</th>
            <th>Marca</th>
            <th class="num-col">Qtd</th>
            <th>Un</th>
            <th class="num-col">Unitário</th>
            <th class="num-col">Total</th>
          </tr>
        </thead>
        <tbody>
      `;
      
      totalItems.forEach(c => {
        const uPrice = Number(c.unitPrice) || 0;
        const val = Number(c.value) || 0;
        grandTotalInfra += val;
        html += `
          <tr>
            <td>${c.code || '-'}</td>
            <td>${c.name || '-'}</td>
            <td>${c.brand || '-'}</td>
            <td class="num-col">${c.qty || 0}</td>
            <td>${c.unit || 'un'}</td>
            <td class="num-col">${uPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td class="num-col">${val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
          </tr>
        `;
      });
      
      html += `
          <tr style="font-weight: 700; background-color: #f1f5f9;">
            <td colspan="6">Total Geral Infraestrutura</td>
            <td class="num-col" style="color: #1e3a8a;">${(Number(grandTotalInfra) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
          </tr>
        </tbody>
      </table>
      `;
    }
    
    html += `<h2 class="section-title">3. Resumo das Cargas Elétricas (NBR 5410)</h2>`;
    
    html += `
    <table class="report-table">
      <thead>
        <tr>
          <th>Quadro / Equipamento</th>
          <th>Tipo</th>
          <th>Tensão</th>
          <th class="num-col">Potência</th>
          <th class="num-col">Corrente</th>
          <th>Cabo Geral (NBR 5410)</th>
        </tr>
      </thead>
      <tbody>
    `;
    
    budgetState.panels.forEach(panel => {
      let typeLabel = 'Potência';
      switch(panel.type) {
        case 'potencia': typeLabel = 'Potência'; break;
        case 'comando': typeLabel = 'Comando'; break;
        case 'potencia-comando': typeLabel = 'Potência e Comando'; break;
        case 'automacao': typeLabel = 'Automação'; break;
        case 'completo': typeLabel = 'Pot., Com. & Aut.'; break;
        case 'remoto': typeLabel = 'Aut. Remoto'; break;
      }
      
      const panelCable = typeof getNBR5410CableSectionForPanel === 'function' ? getNBR5410CableSectionForPanel(panel.calculatedCurrent) : '-';
      const pPower = Number(panel.totalPowerKw) || 0;
      const pCurrent = Number(panel.calculatedCurrent) || 0;
      
      html += `
        <tr style="font-weight: 700; background-color: #f1f5f9;">
          <td>${panel.name || 'Quadro'}</td>
          <td>Quadro - ${typeLabel}</td>
          <td>${panel.voltage || '220V'}</td>
          <td class="num-col">${pPower.toFixed(1).replace('.', ',')} kW</td>
          <td class="num-col" style="color: #1e3a8a;">${pCurrent.toFixed(1).replace('.', ',')} A</td>
          <td>${panelCable ? panelCable + ' mm²' : '-'}</td>
        </tr>
      `;
      
      if (panel.type === 'comando' || panel.type === 'remoto') {
        html += `
          <tr>
            <td colspan="6" style="padding-left: 25px; color: #64748b; font-style: italic;">
              ↳ Carga estimada de 2kW Monofásica por equipamento (padrão de comando)
            </td>
          </tr>
        `;
      } else if (panel.equipments && panel.equipments.length > 0) {
        panel.equipments.forEach(eq => {
          // Calculations for total power and current
          const motorKw = eq.power ? parsePowerKw(eq.power) : 0;
          const motorCurVal = eq.calculatedCurrent ? parseFloat(eq.calculatedCurrent.replace('A', '').trim().replace(',', '.')) : 0;
          
          let heatingKw = 0;
          let heatingCurVal = 0;
          let heatingCab = '-';
          const hStg = eq.heatingStages || 1;
          if (eq.hasHeating && eq.heatingPower) {
            heatingKw = parsePowerKw(eq.heatingPower);
            heatingCurVal = eq.heatingCalculatedCurrent ? parseFloat(eq.heatingCalculatedCurrent.replace('A', '').trim().replace(',', '.')) : 0;
            heatingCab = eq.heatingCalculatedCable ? eq.heatingCalculatedCable.trim() : '-';
          }
          
          let humidKw = 0;
          let humidCurVal = 0;
          let humidCab = '-';
          const huStg = eq.humidStages || 1;
          if (eq.hasHumid && eq.humidPower) {
            humidKw = parsePowerKw(eq.humidPower);
            humidCurVal = eq.humidCalculatedCurrent ? parseFloat(eq.humidCalculatedCurrent.replace('A', '').trim().replace(',', '.')) : 0;
            humidCab = eq.humidCalculatedCable ? eq.humidCalculatedCable.trim() : '-';
          }
          
          const totalEqPower = motorKw + heatingKw + humidKw;
          const totalEqCurrent = motorCurVal + (eq.hasHeating ? (heatingCurVal * hStg) : 0) + (eq.hasHumid ? (humidCurVal * huStg) : 0);
          const startsStr = eq.starts && eq.starts.length > 0 ? eq.starts.join('/') : '-';
          const motorPowerStr = eq.power ? eq.power.replace('kW', '').trim().replace('.', ',') : '-';
          const motorCurStr = eq.calculatedCurrent ? eq.calculatedCurrent.replace('A', '').trim() : '-';
          const motorCabStr = eq.calculatedCable ? eq.calculatedCable.trim() : '-';
          
          // 1. Equipment Summary Row (shows total power and current)
          html += `
            <tr style="font-weight: 700;">
              <td style="padding-left: 25px; color: #1e293b;">↳ ${eq.name || 'Equip.'}</td>
              <td style="color: #475569; font-weight: 700;">${eq.type}</td>
              <td style="color: #64748b;">-</td>
              <td class="num-col" style="color: #1e293b; font-weight: 700;">${totalEqPower.toFixed(1).replace('.', ',')} kW</td>
              <td class="num-col" style="color: #1e3a8a; font-weight: 700;">${totalEqCurrent.toFixed(1).replace('.', ',')} A</td>
              <td style="color: #64748b;">-</td>
            </tr>
          `;
          
          // 2. Motor Subline Row (always present)
          html += `
            <tr>
              <td style="padding-left: 45px; color: #475569;">↳ Motor</td>
              <td style="color: #64748b;">Motor - ${startsStr}</td>
              <td style="color: #64748b;">-</td>
              <td class="num-col" style="color: #64748b;">${motorPowerStr !== '-' ? motorPowerStr + ' kW' : '-'}</td>
              <td class="num-col" style="color: #64748b;">${motorCurStr !== '-' ? motorCurStr + ' A' : '-'}</td>
              <td style="color: #64748b;">${motorCabStr !== '-' ? motorCabStr + ' mm²' : '-'}</td>
            </tr>
          `;
          
          // 3. Heating Subline Row
          if (eq.type === 'UTA' && eq.hasHeating && eq.heatingPower) {
            const heatPowerStr = eq.heatingPower.replace('kW', '').trim().replace('.', ',');
            const heatCurStr = eq.heatingCalculatedCurrent ? eq.heatingCalculatedCurrent.replace('A', '').trim() : '-';
            html += `
              <tr>
                <td style="padding-left: 45px; color: #475569;">↳ Aquecimento (${hStg} Est.)</td>
                <td style="color: #64748b;">Resistência - ${eq.heatingControl || 'OnOff'}</td>
                <td style="color: #64748b;">-</td>
                <td class="num-col" style="color: #64748b;">${heatPowerStr} kW</td>
                <td class="num-col" style="color: #64748b;">${heatCurStr !== '-' ? heatCurStr + ' A' : '-'} (por est.)</td>
                <td style="color: #64748b;">${heatingCab !== '-' ? heatingCab + ' mm²' : '-'} (por est.)</td>
              </tr>
            `;
          }
          
          // 4. Humidification Subline Row
          if (eq.type === 'UTA' && eq.hasHumid && eq.humidPower) {
            const humidPowerStr = eq.humidPower.replace('kW', '').trim().replace('.', ',');
            const humidCurStr = eq.humidCalculatedCurrent ? eq.humidCalculatedCurrent.replace('A', '').trim() : '-';
            html += `
              <tr>
                <td style="padding-left: 45px; color: #475569;">↳ Umidificação (${huStg} Est.)</td>
                <td style="color: #64748b;">Umidificação - ${eq.humidControl || 'OnOff'}</td>
                <td style="color: #64748b;">-</td>
                <td class="num-col" style="color: #64748b;">${humidPowerStr} kW</td>
                <td class="num-col" style="color: #64748b;">${humidCurStr !== '-' ? humidCurStr + ' A' : '-'} (por est.)</td>
                <td style="color: #64748b;">${humidCab !== '-' ? humidCab + ' mm²' : '-'} (por est.)</td>
              </tr>
            `;
          }
        });
      }
    });
    
    html += `
      </tbody>
    </table>
    `;
    
    let grandTotalInfra = 0;
    addedPanels.forEach(panel => {
      const items = typeof calculateInfraComponentsForPanel === 'function' ? calculateInfraComponentsForPanel(panel) : [];
      grandTotalInfra += items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    });
    
    const grandTotal = grandTotalPanels + grandTotalInfra;
    
    html += `
    <div class="summary-card">
      <h3 style="margin-top:0; color:#1e3a8a; border-bottom:1px solid #bfdbfe; padding-bottom:8px;">Resumo Financeiro do Orçamento</h3>
      <div class="summary-row">
        <span>Valor Total dos Quadros Elétricos:</span>
        <strong>${(Number(grandTotalPanels) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
      </div>
      <div class="summary-row">
        <span>Valor Total da Infraestrutura Elétrica:</span>
        <strong>${(Number(grandTotalInfra) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
      </div>
      <div class="summary-row total">
        <span>VALOR TOTAL GERAL DO ORÇAMENTO:</span>
        <span>${(Number(grandTotal) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
      </div>
    </div>
    
    <div class="footer">
      Relatório gerado automaticamente pelo Sistema de Orçamento 3D &copy; ${today.getFullYear()}
    </div>
  </body>
  </html>
    `;
    
    // Create a temporary hidden iframe to perform printing without popups or local file origin SecurityErrors
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    
    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1000);
    }, 500);
  } catch (err) {
    console.error("Erro ao exportar PDF:", err);
    alert("Ocorreu um erro ao gerar o PDF: " + err.message + "\n\nPor favor, verifique o console do navegador para mais detalhes.");
  }
}

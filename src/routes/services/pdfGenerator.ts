import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { BuildingInsightsResponse, SolarPanelConfig } from '../solar';
import { showMoney, showNumber } from '../utils';

// Professional color palette based on your theme
const Colors = {
  primary: [45, 77, 49] as [number, number, number],      // Main green
  primaryLight: [106, 153, 112] as [number, number, number], // Lighter green
  secondary: [249, 200, 70] as [number, number, number],    // Yellow accent
  tertiary: [241, 90, 41] as [number, number, number],     // Orange accent
  textDark: [20, 20, 20] as [number, number, number],      // Dark text
  textMedium: [60, 60, 60] as [number, number, number],    // Medium gray
  textLight: [120, 120, 120] as [number, number, number],  // Light gray
  background: [248, 250, 252] as [number, number, number], // Light background
  white: [255, 255, 255] as [number, number, number],      // Pure white
  border: [220, 220, 220] as [number, number, number],     // Light border
  success: [76, 175, 80] as [number, number, number],      // Success green
  warning: [255, 152, 0] as [number, number, number],      // Warning orange
};

export interface PDFReportData {
  location: {
    name: string;
    address: string;
    coordinates: { lat: number; lng: number };
  };
  buildingInsights: BuildingInsightsResponse;
  configId: number;
  panelCapacityWatts: number;
  monthlyAverageEnergyBill: number;
  energyCostPerKwh: number;
  dcToAcDerate: number;
  solarIncentivesPercent: number;
  installationCostPerWatt: number;
  installationLifeSpan: number;
  efficiencyDepreciationFactor: number;
  costIncreaseFactor: number;
  discountRate: number;
  // Financial calculations
  installationSizeKw: number;
  installationCostTotal: number;
  yearlyKwhEnergyConsumption: number;
  yearlyProductionAcKwh: number;
  totalCostWithSolar: number;
  totalCostWithoutSolar: number;
  savings: number;
  breakEvenYear: number;
  energyCovered: number;
  // Generated date
  reportDate: Date;
}

export class PDFGenerator {
  private doc: jsPDF;
  private currentY: number = 20;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private contentWidth: number;
  private headerHeight: number = 60;

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - 2 * this.margin;
    
    // Add custom fonts if needed (using built-in fonts for better compatibility)
    this.doc.setFont('helvetica');
  }

  async generateSolarReport(data: PDFReportData): Promise<jsPDF> {
    // Reset position
    this.currentY = 20;

    // Add header
    this.addHeader(data);
    this.addNewPage();

    // Add location information
    this.addLocationSection(data);
    this.addNewPage();

    // Add building insights
    this.addBuildingInsightsSection(data);
    this.addNewPage();

    // Add solar potential analysis
    this.addSolarPotentialSection(data);
    this.addNewPage();

    // Add financial analysis
    this.addFinancialAnalysisSection(data);
    this.addNewPage();

    // Add technical specifications
    this.addTechnicalSpecificationsSection(data);

    return this.doc;
  }

  private addHeader(data: PDFReportData) {
    // Add header background
    this.doc.setFillColor(...Colors.primary);
    this.doc.rect(0, 0, this.pageWidth, this.headerHeight, 'F');
    
    // Add subtle pattern overlay (optional decorative element)
    this.doc.setFillColor(...Colors.primaryLight);
    this.doc.setGState(this.doc.GState({ opacity: 0.1 }));
    for (let i = 0; i < this.pageWidth; i += 10) {
      this.doc.circle(i, 20, 2, 'F');
      this.doc.circle(i + 5, 40, 1.5, 'F');
    }
    this.doc.setGState(this.doc.GState({ opacity: 1 })); // Reset opacity
    
    // Company logo area (placeholder - you can add actual logo later)
    this.doc.setFillColor(...Colors.white);
    this.doc.roundedRect(this.margin, 15, 40, 30, 3, 3, 'F');
    this.doc.setTextColor(...Colors.primary);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('KLARYO', this.margin + 20, 35, { align: 'center' });
    
    // Main title
    this.doc.setTextColor(...Colors.white);
    this.doc.setFontSize(22);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Solar Potential Analysis Report', this.pageWidth - this.margin, 25, { align: 'right' });
    
    // Subtitle with date
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...Colors.background);
    this.doc.text(`Generated on ${data.reportDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`, this.pageWidth - this.margin, 40, { align: 'right' });
    
    // Location info in header
    this.doc.setFontSize(10);
    this.doc.text(`Location: ${data.location.name || 'Unknown'}`, this.pageWidth - this.margin, 50, { align: 'right' });
    
    this.currentY = this.headerHeight + 20;
    
    // Executive summary box
    this.addExecutiveSummaryBox(data);
  }

  private addExecutiveSummaryBox(data: PDFReportData) {
    const boxHeight = 80;
    
    // Main summary box with gradient effect
    this.doc.setFillColor(...Colors.white);
    this.doc.setDrawColor(...Colors.border);
    this.doc.setLineWidth(0.5);
    this.doc.roundedRect(this.margin, this.currentY, this.contentWidth, boxHeight, 5, 5, 'FD');
    
    // Add shadow effect
    this.doc.setFillColor(200, 200, 200);
    this.doc.setGState(this.doc.GState({ opacity: 0.3 }));
    this.doc.roundedRect(this.margin + 1, this.currentY + 1, this.contentWidth, boxHeight, 5, 5, 'F');
    this.doc.setGState(this.doc.GState({ opacity: 1 }));
    
    // Header bar
    this.doc.setFillColor(...Colors.secondary);
    this.doc.roundedRect(this.margin, this.currentY, this.contentWidth, 15, 5, 5, 'F');
    this.doc.setFillColor(...Colors.secondary);
    this.doc.rect(this.margin, this.currentY + 10, this.contentWidth, 5, 'F');
    
    // Title
    this.doc.setTextColor(...Colors.textDark);
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Executive Summary', this.margin + 10, this.currentY + 10);
    
    const panelConfig = data.buildingInsights.solarPotential.solarPanelConfigs[data.configId];
    if (!panelConfig) {
      throw new Error('Solar panel configuration not found');
    }
    const panelCapacityRatio = data.panelCapacityWatts / data.buildingInsights.solarPotential.panelCapacityWatts;
    const yearlyEnergyKwh = (panelConfig?.yearlyEnergyDcKwh || 0) * panelCapacityRatio;
    
    // Key metrics in a grid layout
    const startY = this.currentY + 25;
    const col1X = this.margin + 15;
    const col2X = this.margin + this.contentWidth / 2 + 15;
    
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...Colors.textMedium);
    
    // Left column
    this.addKeyMetric('System Size', `${showNumber(data.installationSizeKw)} kW`, col1X, startY);
    this.addKeyMetric('Annual Production', `${showNumber(yearlyEnergyKwh)} kWh`, col1X, startY + 15);
    this.addKeyMetric('Energy Coverage', `${Math.round(data.energyCovered * 100)}%`, col1X, startY + 30);
    
    // Right column
    this.addKeyMetric('Total Investment', showMoney(data.installationCostTotal), col2X, startY);
    this.addKeyMetric('20-Year Savings', showMoney(data.savings || 0), col2X, startY + 15);
    this.addKeyMetric('Payback Period', data.breakEvenYear >= 0 ? `${data.breakEvenYear + 1} years` : 'Not reached', col2X, startY + 30);
    
    this.currentY += boxHeight + 25;
  }
  
  private addKeyMetric(label: string, value: string, x: number, y: number) {
    this.doc.setTextColor(...Colors.textLight);
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(label, x, y);
    
    this.doc.setTextColor(...Colors.primary);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(value, x, y + 8);
  }

  private addLocationSection(data: PDFReportData) {
    this.addSectionTitle('📍 Location Information');
    
    // Property details subsection
    this.addSubsectionTitle('Property Details');
    this.addInfoRow('Address', data.location.address || 'N/A', true);
    this.addInfoRow('Coordinates', `${data.location.coordinates.lat.toFixed(6)}, ${data.location.coordinates.lng.toFixed(6)}`);
    this.addInfoRow('Postal Code', data.buildingInsights.postalCode || 'N/A');
    this.addInfoRow('Administrative Area', data.buildingInsights.administrativeArea || 'N/A');
    this.addInfoRow('Region Code', data.buildingInsights.regionCode || 'N/A');
    
    this.currentY += 5;
    
    // Imagery information subsection
    this.addSubsectionTitle('Satellite Imagery Information');
    this.addInfoRow('Imagery Date', `${data.buildingInsights.imageryDate.month}/${data.buildingInsights.imageryDate.day}/${data.buildingInsights.imageryDate.year}`);
    this.addInfoRow('Imagery Quality', data.buildingInsights.imageryQuality || 'N/A');
  }

  private addBuildingInsightsSection(data: PDFReportData) {
    this.addSectionTitle('🏠 Building Solar Potential');
    
    const solarPotential = data.buildingInsights.solarPotential;
    const panelConfig = solarPotential.solarPanelConfigs[data.configId];
    if (!panelConfig) {
      throw new Error('Solar panel configuration not found');
    }
    const panelCapacityRatio = data.panelCapacityWatts / solarPotential.panelCapacityWatts;

    // Roof analysis with visual enhancement
    this.addSubsectionTitle('Roof Analysis');
    this.addInfoRow('Total Roof Area', `${showNumber(solarPotential.wholeRoofStats.areaMeters2)} m²`, true);
    this.addInfoRow('Building Area', `${showNumber(solarPotential.buildingStats.areaMeters2)} m²`);
    this.addInfoRow('Max Sunshine Hours/Year', `${showNumber(solarPotential.maxSunshineHoursPerYear)} hours`);
    this.addInfoRow('Max Array Area', `${showNumber(solarPotential.maxArrayAreaMeters2)} m²`);
    this.addInfoRow('Max Panel Count', `${showNumber(solarPotential.maxArrayPanelsCount)} panels`);
    this.addInfoRow('CO₂ Offset Factor', `${showNumber(solarPotential.carbonOffsetFactorKgPerMwh)} kg/MWh`);
    
    this.currentY += 10;
    
    // Selected configuration with highlight
    this.addSubsectionTitle('Selected Configuration');
    this.addInfoRow('Panel Count', `${showNumber(panelConfig?.panelsCount || 0)} panels`, true);
    this.addInfoRow('Panel Capacity', `${showNumber(data.panelCapacityWatts || 0)} Watts`);
    this.addInfoRow('Yearly Energy Production', `${showNumber((panelConfig?.yearlyEnergyDcKwh || 0) * panelCapacityRatio)} kWh`, true);
    this.addInfoRow('Installation Size', `${showNumber(data.installationSizeKw || 0)} kW`, true);
    
    // Roof segments table
    if (panelConfig.roofSegmentSummaries.length > 0) {
      this.currentY += 15;
      this.addSubsectionTitle('Roof Segments Analysis');
      
      const headers = ['Segment', 'Pitch (°)', 'Azimuth (°)', 'Panels', 'Energy (kWh)'];
      const rows = (panelConfig?.roofSegmentSummaries || []).map((segment, index) => [
        `${index + 1}`,
        `${(segment.pitchDegrees || 0).toFixed(1)}`,
        `${(segment.azimuthDegrees || 0).toFixed(1)}`,
        `${segment.panelsCount || 0}`,
        `${showNumber((segment.yearlyEnergyDcKwh || 0) * panelCapacityRatio)}`
      ]);
      
      this.addDataTable(headers, rows);
    }
  }

  private addSolarPotentialSection(data: PDFReportData) {
    this.addSectionTitle('⚡ Solar Potential Analysis');
    
    const panelConfig = data.buildingInsights.solarPotential.solarPanelConfigs[data.configId];
    const panelCapacityRatio = data.panelCapacityWatts / data.buildingInsights.solarPotential.panelCapacityWatts;

    // Energy analysis with visual metrics
    this.addSubsectionTitle('Energy Performance');
    this.addInfoRow('Current Energy Consumption', `${showNumber(data.yearlyKwhEnergyConsumption)} kWh/year`, true);
    this.addInfoRow('Solar Energy Production', `${showNumber(data.yearlyProductionAcKwh)} kWh/year`, true);
    this.addInfoRow('Energy Coverage', `${Math.round(data.energyCovered * 100)}%`, true);
    this.addInfoRow('Monthly Energy Bill', showMoney(data.monthlyAverageEnergyBill));
    this.addInfoRow('Energy Cost per kWh', showMoney(data.energyCostPerKwh));
    
    // Add energy comparison chart (visual representation)
    this.addEnergyComparisonChart(data);
    
    this.currentY += 15;
    
    // Environmental impact with enhanced presentation
    this.addSubsectionTitle('🌱 Environmental Impact');
    const co2Offset = (data.yearlyProductionAcKwh / 1000) * data.buildingInsights.solarPotential.carbonOffsetFactorKgPerMwh;
    const treesEquivalent = Math.round(co2Offset / 22);
    const carsOffRoad = Math.round(co2Offset / 4600); // Average car emits ~4.6 tons CO2/year
    
    this.addInfoRow('CO₂ Offset per Year', `${showNumber(co2Offset)} kg`, true);
    this.addInfoRow('Equivalent Trees Planted', `${treesEquivalent} trees/year`);
    this.addInfoRow('Cars Taken Off Road', `${carsOffRoad} cars/year`);
    this.addInfoRow('20-Year CO₂ Reduction', `${showNumber(co2Offset * 20)} kg`);
  }

  private addFinancialAnalysisSection(data: PDFReportData) {
    this.addSectionTitle('💰 Financial Analysis');
    
    // Investment overview with visual emphasis
    this.addSubsectionTitle('Investment Overview');
    this.addInfoRow('Installation Size', `${showNumber(data.installationSizeKw)} kW`);
    this.addInfoRow('Cost per Watt', showMoney(data.installationCostPerWatt));
    this.addInfoRow('Total Installation Cost', showMoney(data.installationCostTotal), true);
    this.addInfoRow('Solar Incentives', `${(data.solarIncentivesPercent * 100).toFixed(1)}%`);
    this.addInfoRow('Incentive Amount', showMoney(data.installationCostTotal * data.solarIncentivesPercent), true);
    this.addInfoRow('Net Installation Cost', showMoney(data.installationCostTotal * (1 - data.solarIncentivesPercent)), true);
    
    this.currentY += 15;
    
    // Cost-benefit analysis with enhanced presentation
    this.addSubsectionTitle('20-Year Cost-Benefit Analysis');
    
    // Create a summary table
    const costHeaders = ['Scenario', 'Total Cost', 'Monthly Average'];
    const costRows = [
      ['Without Solar', showMoney(data.totalCostWithoutSolar), showMoney(data.totalCostWithoutSolar / (20 * 12))],
      ['With Solar', showMoney(data.totalCostWithSolar), showMoney(data.totalCostWithSolar / (20 * 12))],
      ['Savings', showMoney(data.savings), showMoney(data.savings / (20 * 12))]
    ];
    
    this.addDataTable(costHeaders, costRows);
    
    this.currentY += 10;
    
    // Key financial metrics
    this.addSubsectionTitle('Key Financial Metrics');
    const paybackPeriod = data.breakEvenYear >= 0 ? `${data.breakEvenYear + 1} years` : 'Not reached';
    const roi = data.savings > 0 ? `${((data.savings / (data.installationCostTotal * (1 - data.solarIncentivesPercent))) * 100).toFixed(1)}%` : 'N/A';
    
    this.addInfoRow('Payback Period', paybackPeriod, true);
    this.addInfoRow('20-Year ROI', roi, true);
    this.addInfoRow('Annual Savings (Avg)', showMoney(data.savings / 20), true);
    
    this.currentY += 15;
    
    // Financial assumptions
    this.addSubsectionTitle('Financial Assumptions & Parameters');
    this.addInfoRow('Installation Lifespan', `${data.installationLifeSpan} years`);
    this.addInfoRow('DC to AC Conversion Efficiency', `${(data.dcToAcDerate * 100).toFixed(1)}%`);
    this.addInfoRow('Annual Efficiency Decline', `${((1 - data.efficiencyDepreciationFactor) * 100).toFixed(2)}%`);
    this.addInfoRow('Annual Energy Cost Increase', `${((data.costIncreaseFactor - 1) * 100).toFixed(1)}%`);
    this.addInfoRow('Discount Rate', `${((data.discountRate - 1) * 100).toFixed(1)}%`);
  }

  private addTechnicalSpecificationsSection(data: PDFReportData) {
    this.addSectionTitle('⚙️ Technical Specifications');
    
    const solarPotential = data.buildingInsights.solarPotential;
    const panelConfig = solarPotential.solarPanelConfigs[data.configId];
    const panelCapacityRatio = data.panelCapacityWatts / solarPotential.panelCapacityWatts;
    
    // Panel specifications with enhanced layout
    this.addSubsectionTitle('Solar Panel Specifications');
    this.addInfoRow('Panel Capacity (Selected)', `${showNumber(data.panelCapacityWatts)} Watts`, true);
    this.addInfoRow('Panel Capacity (Standard)', `${showNumber(solarPotential.panelCapacityWatts)} Watts`);
    this.addInfoRow('Panel Dimensions', `${solarPotential.panelWidthMeters.toFixed(2)}m × ${solarPotential.panelHeightMeters.toFixed(2)}m`);
    this.addInfoRow('Panel Area', `${(solarPotential.panelWidthMeters * solarPotential.panelHeightMeters).toFixed(2)} m²`);
    this.addInfoRow('Panel Lifetime', `${solarPotential.panelLifetimeYears} years`);
    this.addInfoRow('DC to AC Conversion', `${(data.dcToAcDerate * 100).toFixed(1)}%`);
    
    this.currentY += 15;
    
    // System specifications with detailed metrics
    this.addSubsectionTitle('System Configuration');
    
    const systemHeaders = ['Metric', 'Value', 'Unit'];
    const systemRows = [
      ['Total Panels', `${showNumber(panelConfig?.panelsCount || 0)}`, 'panels'],
      ['System Capacity', `${showNumber(data.installationSizeKw || 0)}`, 'kW'],
      ['Annual Energy Production', `${showNumber((panelConfig?.yearlyEnergyDcKwh || 0) * panelCapacityRatio)}`, 'kWh'],
      ['Peak Power Output', `${showNumber((panelConfig?.panelsCount || 0) * (data.panelCapacityWatts || 0) / 1000)}`, 'kW'],
      ['Energy Density', `${showNumber(data.installationSizeKw / (solarPotential.wholeRoofStats.areaMeters2 || 1))}`, 'kW/m²'],
      ['Capacity Factor', `${((((panelConfig?.yearlyEnergyDcKwh || 0) * panelCapacityRatio) / (data.installationSizeKw * 8760)) * 100).toFixed(1)}`, '%']
    ];
    
    this.addDataTable(systemHeaders, systemRows);
    
    this.currentY += 15;
    
    // Performance expectations
    this.addSubsectionTitle('Performance Expectations');
    const monthlyProduction = ((panelConfig?.yearlyEnergyDcKwh || 0) * panelCapacityRatio) / 12;
    const dailyProduction = ((panelConfig?.yearlyEnergyDcKwh || 0) * panelCapacityRatio) / 365;
    
    this.addInfoRow('Monthly Production (Avg)', `${showNumber(monthlyProduction)} kWh`, true);
    this.addInfoRow('Daily Production (Avg)', `${showNumber(dailyProduction)} kWh`, true);
    this.addInfoRow('Peak Sun Hours', `${showNumber(solarPotential.maxSunshineHoursPerYear / 365)} hours/day`);
  }

  private addSectionTitle(title: string, icon?: string) {
    // Section header with background
    const headerHeight = 20;
    this.doc.setFillColor(...Colors.primary);
    this.doc.setGState(this.doc.GState({ opacity: 0.1 }));
    this.doc.roundedRect(this.margin, this.currentY - 5, this.contentWidth, headerHeight, 3, 3, 'F');
    this.doc.setGState(this.doc.GState({ opacity: 1 }));
    
    // Add accent line
    this.doc.setFillColor(...Colors.secondary);
    this.doc.rect(this.margin, this.currentY - 5, 4, headerHeight, 'F');
    
    // Title text
    this.doc.setTextColor(...Colors.primary);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin + 15, this.currentY + 5);
    
    this.currentY += 25;
  }

  private addInfoRow(label: string, value: string, isHighlight: boolean = false) {
    const safeLabel = label || 'Unknown';
    const safeValue = value || 'N/A';
    
    // Add subtle background for alternating rows
    if (Math.floor((this.currentY - 100) / 7) % 2 === 0) {
      this.doc.setFillColor(...Colors.background);
      this.doc.rect(this.margin, this.currentY - 3, this.contentWidth, 7, 'F');
    }
    
    // Label
    this.doc.setTextColor(...Colors.textMedium);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`${safeLabel}:`, this.margin + 5, this.currentY);
    
    // Value
    if (isHighlight) {
      this.doc.setTextColor(...Colors.primary);
      this.doc.setFont('helvetica', 'bold');
    } else {
      this.doc.setTextColor(...Colors.textDark);
      this.doc.setFont('helvetica', 'normal');
    }
    this.doc.text(safeValue, this.margin + 85, this.currentY);
    
    this.currentY += 7;
  }
  
  private addDataTable(headers: string[], rows: string[][], startY?: number) {
    if (startY) this.currentY = startY;
    
    const colWidth = this.contentWidth / headers.length;
    const rowHeight = 8;
    
    // Header row
    this.doc.setFillColor(...Colors.primary);
    this.doc.rect(this.margin, this.currentY, this.contentWidth, rowHeight, 'F');
    
    this.doc.setTextColor(...Colors.white);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    
    headers.forEach((header, i) => {
      this.doc.text(header, this.margin + (i * colWidth) + 5, this.currentY + 5);
    });
    
    this.currentY += rowHeight;
    
    // Data rows
    rows.forEach((row, rowIndex) => {
      // Alternating row colors
      if (rowIndex % 2 === 0) {
        this.doc.setFillColor(...Colors.background);
        this.doc.rect(this.margin, this.currentY, this.contentWidth, rowHeight, 'F');
      }
      
      this.doc.setTextColor(...Colors.textDark);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      
      row.forEach((cell, i) => {
        this.doc.text(cell, this.margin + (i * colWidth) + 5, this.currentY + 5);
      });
      
      this.currentY += rowHeight;
    });
    
    this.currentY += 5;
  }
  
  private addSubsectionTitle(title: string) {
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.primary);
    this.doc.text(title, this.margin + 5, this.currentY);
    
    // Add underline
    this.doc.setDrawColor(...Colors.secondary);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin + 5, this.currentY + 2, this.margin + 5 + this.doc.getTextWidth(title), this.currentY + 2);
    
    this.currentY += 10;
  }
  
  private addEnergyComparisonChart(data: PDFReportData) {
    this.currentY += 10;
    
    // Simple bar chart representation
    const chartWidth = this.contentWidth - 20;
    const chartHeight = 30;
    const maxEnergy = Math.max(data.yearlyKwhEnergyConsumption, data.yearlyProductionAcKwh);
    
    // Chart background
    this.doc.setFillColor(...Colors.background);
    this.doc.roundedRect(this.margin + 10, this.currentY, chartWidth, chartHeight, 2, 2, 'F');
    
    // Consumption bar
    const consumptionWidth = (data.yearlyKwhEnergyConsumption / maxEnergy) * (chartWidth - 10);
    this.doc.setFillColor(...Colors.tertiary);
    this.doc.rect(this.margin + 15, this.currentY + 5, consumptionWidth, 8, 'F');
    
    // Production bar
    const productionWidth = (data.yearlyProductionAcKwh / maxEnergy) * (chartWidth - 10);
    this.doc.setFillColor(...Colors.success);
    this.doc.rect(this.margin + 15, this.currentY + 17, productionWidth, 8, 'F');
    
    // Labels
    this.doc.setTextColor(...Colors.textDark);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Consumption', this.margin + 15 + consumptionWidth + 5, this.currentY + 10);
    this.doc.text('Production', this.margin + 15 + productionWidth + 5, this.currentY + 22);
    
    this.currentY += chartHeight + 5;
  }

  private addNewPage() {
    if (this.currentY > this.pageHeight - 50) {
      this.doc.addPage();
      this.currentY = 30;
      this.addPageFooter();
    }
  }
  
  private addPageFooter() {
    const pageNumber = this.doc.internal.pages.length - 1;
    if (pageNumber > 1) {
      this.doc.setTextColor(...Colors.textLight);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Page ${pageNumber}`, this.pageWidth - this.margin, this.pageHeight - 10, { align: 'right' });
      this.doc.text('Klaryo Solar Analysis Report', this.margin, this.pageHeight - 10);
      
      // Add subtle line
      this.doc.setDrawColor(...Colors.border);
      this.doc.setLineWidth(0.2);
      this.doc.line(this.margin, this.pageHeight - 15, this.pageWidth - this.margin, this.pageHeight - 15);
    }
  }

  async addMapScreenshot(mapElement: HTMLElement): Promise<void> {
    try {
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = this.contentWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      this.addNewPage();
      this.addSectionTitle('📍 Location Map');
      
      // Add map with border
      this.doc.setDrawColor(...Colors.border);
      this.doc.setLineWidth(1);
      this.doc.rect(this.margin + 10, this.currentY, imgWidth, imgHeight, 'S');
      
      this.doc.addImage(imgData, 'PNG', this.margin + 10, this.currentY, imgWidth, imgHeight);
      this.currentY += imgHeight + 20;
      
      // Add map caption
      this.doc.setTextColor(...Colors.textMedium);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'italic');
      this.doc.text('Satellite view showing the analyzed building and surrounding area', this.pageWidth / 2, this.currentY, { align: 'center' });
      this.currentY += 15;
    } catch (error) {
      console.error('Failed to capture map screenshot:', error);
      // Add placeholder if map capture fails
      this.addNewPage();
      this.addSectionTitle('📍 Location Map');
      
      this.doc.setFillColor(...Colors.background);
      this.doc.setDrawColor(...Colors.border);
      this.doc.roundedRect(this.margin + 10, this.currentY, this.contentWidth - 20, 100, 5, 5, 'FD');
      
      this.doc.setTextColor(...Colors.textMedium);
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text('Map screenshot not available', this.pageWidth / 2, this.currentY + 50, { align: 'center' });
      
      this.currentY += 120;
    }
  }
}

export async function generateAndDownloadPDF(data: PDFReportData, mapElement?: HTMLElement): Promise<void> {
  try {
    // Validate required data
    if (!data.buildingInsights || !data.buildingInsights.solarPotential) {
      throw new Error('Building insights data is missing');
    }

    if (data.configId === undefined || data.configId < 0 || 
        data.configId >= data.buildingInsights.solarPotential.solarPanelConfigs.length) {
      throw new Error('Invalid solar panel configuration');
    }

    const generator = new PDFGenerator();
    const pdf = await generator.generateSolarReport(data);
    
    if (mapElement) {
      await generator.addMapScreenshot(mapElement);
    }
    
    // Generate filename with better formatting
    const locationName = data.location.name || 'Unknown_Location';
    console.log('=== PDF Filename Generation ===');
    console.log('Original location name:', locationName);
    console.log('Location data:', data.location);
    
    const safeLocationName = locationName
      .replace(/[^a-zA-Z0-9\s\-]/g, '') // Remove special characters but keep spaces and hyphens
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .substring(0, 50); // Limit length to avoid filename issues
    
    console.log('Safe location name:', safeLocationName);
    
    const date = data.reportDate.toISOString().split('T')[0];
    const panelCount = data.buildingInsights.solarPotential.solarPanelConfigs[data.configId]?.panelsCount || 0;
    const filename = `Klaryo_Solar_Analysis_${safeLocationName}_${panelCount}panels_${date}.pdf`;
    
    console.log('Final filename:', filename);
    
    // Download the PDF
    pdf.save(filename);
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error;
  }
} 
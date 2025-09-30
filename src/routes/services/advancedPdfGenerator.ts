import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { BuildingInsightsResponse, SolarPanelConfig } from '../solar';
import { showMoney, showNumber } from '../utils';

// Enhanced color palette matching the reference PDF
const Colors = {
  primary: [45, 77, 49] as [number, number, number],      // Klaryo green
  secondary: [249, 200, 70] as [number, number, number],   // Yellow accent
  tertiary: [241, 90, 41] as [number, number, number],    // Orange accent
  success: [76, 175, 80] as [number, number, number],     // Success green
  warning: [255, 87, 34] as [number, number, number],     // Warning red
  textDark: [33, 33, 33] as [number, number, number],     // Dark text
  textMedium: [85, 85, 85] as [number, number, number],   // Medium gray
  textLight: [136, 136, 136] as [number, number, number], // Light gray
  background: [248, 250, 252] as [number, number, number], // Light background
  white: [255, 255, 255] as [number, number, number],     // Pure white
  border: [224, 224, 224] as [number, number, number],    // Light border
  lightGreen: [200, 230, 201] as [number, number, number], // Light green
  lightBlue: [187, 222, 251] as [number, number, number],  // Light blue
};

export interface AdvancedPDFReportData {
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
  // Calculated values
  installationSizeKw: number;
  installationCostTotal: number;
  yearlyKwhEnergyConsumption: number;
  yearlyProductionAcKwh: number;
  totalCostWithSolar: number;
  totalCostWithoutSolar: number;
  savings: number;
  breakEvenYear: number;
  energyCovered: number;
  reportDate: Date;
  // Customer data (optional - will use defaults if not provided)
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  // Market data (optional - will use defaults if not provided)
  marketRates?: {
    tutelatoRate: number; // €/kWh
    liberoRate: number;   // €/kWh
  };
  // System performance data
  systemPerformance?: {
    kwhPerKwp: number; // kWh per kWp per year (default: varies by location)
    selfConsumptionRate: number; // percentage (default: 40%)
    gridSaleRate: number; // €/kWh for selling to grid (default: 0.1)
  };
  // Tax incentives
  taxIncentives?: {
    detrazionePercent: number; // percentage (default: 50%)
    detrazioneAnnualAmount: number; // €/year (calculated based on installation cost)
    maxDetrazioneAmount: number; // € (default: 96000)
  };
}

export class AdvancedPDFGenerator {
  private doc: jsPDF;
  private currentY: number = 30;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 25; // Increased margin for better A4 formatting
  private topMargin: number = 30;
  private bottomMargin: number = 25;
  private contentWidth: number;
  private contentHeight: number;
  private pageNumber: number = 1;
  private dynamicData: any = {}; // Store calculated dynamic values

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.doc.internal.pageSize.getWidth(); // 210mm
    this.pageHeight = this.doc.internal.pageSize.getHeight(); // 297mm
    this.contentWidth = this.pageWidth - 2 * this.margin; // 160mm
    this.contentHeight = this.pageHeight - this.topMargin - this.bottomMargin; // 242mm
    this.doc.setFont('helvetica');
  }

  private calculateDynamicValues(data: AdvancedPDFReportData) {
    // Set defaults for optional values
    const defaults = {
      customerName: data.customerName || 'Cliente',
      customerEmail: data.customerEmail || 'email@example.com',
      customerPhone: data.customerPhone || '000 000 0000',
      marketRates: {
        tutelatoRate: data.marketRates?.tutelatoRate || 0.34,
        liberoRate: data.marketRates?.liberoRate || 0.32
      },
      systemPerformance: {
        kwhPerKwp: data.systemPerformance?.kwhPerKwp || this.calculateKwhPerKwp(data),
        selfConsumptionRate: data.systemPerformance?.selfConsumptionRate || 0.4,
        gridSaleRate: data.systemPerformance?.gridSaleRate || 0.1
      },
      taxIncentives: {
        detrazionePercent: data.taxIncentives?.detrazionePercent || data.solarIncentivesPercent,
        detrazioneAnnualAmount: data.taxIncentives?.detrazioneAnnualAmount || this.calculateAnnualDetrazione(data),
        maxDetrazioneAmount: data.taxIncentives?.maxDetrazioneAmount || 96000
      }
    };

    this.dynamicData = {
      ...defaults,
      // Calculate annual savings components
      annualSelfConsumption: data.monthlyAverageEnergyBill * 12 * defaults.systemPerformance.selfConsumptionRate,
      annualEnergySale: data.yearlyProductionAcKwh * (1 - defaults.systemPerformance.selfConsumptionRate) * defaults.systemPerformance.gridSaleRate,
      // Calculate building type based on building insights
      buildingType: this.determineBuildingType(data.buildingInsights),
      // Calculate processing date (current date)
      processingDate: new Date().toLocaleDateString('it-IT'),
      // Calculate recommended system size
      recommendedSystemSize: this.calculateRecommendedSystemSize(data)
    };

    return this.dynamicData;
  }

  private calculateKwhPerKwp(data: AdvancedPDFReportData): number {
    // Calculate based on actual solar potential data
    const panelConfig = data.buildingInsights.solarPotential.solarPanelConfigs[data.configId];
    if (panelConfig && panelConfig.panelsCount > 0) {
      const totalKw = (panelConfig.panelsCount * data.panelCapacityWatts) / 1000;
      return panelConfig.yearlyEnergyDcKwh / totalKw;
    }
    // Fallback to regional average for Italy
    return 1100;
  }

  private calculateAnnualDetrazione(data: AdvancedPDFReportData): number {
    // Calculate annual detrazione based on installation cost and incentive percentage
    const detrazionePercent = data.solarIncentivesPercent || 0.5;
    const totalDetrazione = data.installationCostTotal * detrazionePercent;
    const maxDetrazione = 96000; // Italian legal maximum
    const actualDetrazione = Math.min(totalDetrazione, maxDetrazione);
    return actualDetrazione / 10; // Spread over 10 years
  }

  private determineBuildingType(buildingInsights: BuildingInsightsResponse): string {
    // Determine building type based on building insights data
    const area = buildingInsights.solarPotential.buildingStats.areaMeters2;
    if (area < 100) {
      return 'Domestico Residente - Piccolo';
    } else if (area < 300) {
      return 'Domestico Residente';
    } else {
      return 'Domestico Residente - Grande';
    }
  }

  private calculateRecommendedSystemSize(data: AdvancedPDFReportData): { kw: number, panels: number } {
    const requiredProduction = data.yearlyKwhEnergyConsumption * 1.2; // 20% margin
    const kwhPerKwp = this.calculateKwhPerKwp(data);
    const recommendedKw = requiredProduction / kwhPerKwp;
    const recommendedPanels = Math.ceil(recommendedKw * 1000 / data.panelCapacityWatts);
    
    return {
      kw: Math.round(recommendedKw * 10) / 10, // Round to 1 decimal
      panels: recommendedPanels
    };
  }

  async generateAdvancedSolarReport(data: AdvancedPDFReportData, mapElement?: HTMLElement): Promise<jsPDF> {
    // Calculate all dynamic values first
    this.calculateDynamicValues(data);
    
    // Capture map screenshot if available
    if (mapElement) {
      await this.captureMapForPDF(mapElement);
    }
    
    // Page 1: Cover page
    this.addCoverPage(data);
    
    // Page 2: 10-year projection
    this.addNewPage();
    this.add10YearProjectionPage(data);
    
    // Page 3: Future scenario
    this.addNewPage();
    this.addFutureScenarioPage(data);
    
    // Page 4: Starting data
    this.addNewPage();
    this.addStartingDataPage(data);
    
    // Page 5: Current situation overview
    this.addNewPage();
    this.addCurrentSituationOverviewPage(data);
    
    // Page 6: Current situation analysis
    this.addNewPage();
    this.addCurrentSituationPage(data);
    
    // Page 7: Economic savings estimate
    this.addNewPage();
    this.addEconomicSavingsPage(data);
    
    // Page 8: Conclusions
    this.addNewPage();
    this.addConclusionsPage(data);
    
    // Page 9: What is energy photography
    this.addNewPage();
    this.addEnergyPhotographyPage(data);
    
    // Page 10: Energy usage analysis
    this.addNewPage();
    this.addEnergyUsagePage(data);
    
    // Additional pages for detailed analysis...
    this.addTechnicalPages(data);

    return this.doc;
  }
  
  async captureMapForPDF(mapElement: HTMLElement): Promise<void> {
    try {
      console.log('Starting map capture for PDF...');
      console.log('Map element:', mapElement);
      console.log('Map element dimensions:', mapElement.offsetWidth, 'x', mapElement.offsetHeight);
      
      // Wait a bit for map to fully render
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        scale: 1, // Use scale 1 for better compatibility
        backgroundColor: '#ffffff',
        logging: true, // Enable logging for debugging
        removeContainer: false,
        width: mapElement.offsetWidth,
        height: mapElement.offsetHeight,
        foreignObjectRendering: false // Disable for better compatibility
      });
      
      console.log('Canvas created:', canvas.width, 'x', canvas.height);
      
      const imgData = canvas.toDataURL('image/png');
      
      // Validate image data
      if (imgData && imgData.startsWith('data:image/png;base64,') && imgData.length > 1000) {
        this.dynamicData.mapImageData = imgData;
        console.log('Map captured successfully, image data length:', imgData.length);
      } else {
        console.error('Invalid image data captured');
        this.dynamicData.mapImageData = null;
      }
      
    } catch (error) {
      console.error('Failed to capture map screenshot:', error);
      this.dynamicData.mapImageData = null;
    }
  }

  private addCoverPage(data: AdvancedPDFReportData) {
    // Add subtle background gradient
    this.doc.setFillColor(250, 252, 255);
    this.doc.rect(0, 0, this.pageWidth, this.pageHeight, 'F');
    
    // Header text with better positioning
    this.doc.setTextColor(...Colors.textMedium);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Richiedi una nuova analisi su Klaryo.it', this.pageWidth / 2, 15, { align: 'center' });

    // Enhanced Klaryo logo with 3D effect
    this.currentY = 45;
    this.add3DKlaryoLogo();
    
    this.currentY += 50;

    // Company tagline with better typography
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...Colors.textMedium);
    const subtitle = [
      'Klaryo non offre soluzioni nell\'ambito del',
      'fotovoltaico, Klaryo è il tuo migliore',
      'alleato per aiutarti a comprendere qual è la',
      'miglior scelta da fare per rendere più',
      'efficiente la tua abitazione.'
    ];
    
    subtitle.forEach((line, index) => {
      this.doc.text(line, this.pageWidth / 2, this.currentY + (index * 5), { align: 'center' });
    });
    
    this.currentY += 45;

    // Main title with enhanced 3D styling
    this.add3DTitle('Fotografia', 'energetica');
    
    this.currentY += 25;

    // Date with underline
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    const dateStr = data.reportDate.toLocaleDateString('it-IT').replace(/\//g, '-');
    this.doc.text(dateStr, this.pageWidth / 2, this.currentY, { align: 'center' });
    
    // Add underline for date
    const dateWidth = this.doc.getTextWidth(dateStr);
    this.doc.setDrawColor(...Colors.secondary);
    this.doc.setLineWidth(1);
    this.doc.line(
      this.pageWidth / 2 - dateWidth / 2, 
      this.currentY + 2, 
      this.pageWidth / 2 + dateWidth / 2, 
      this.currentY + 2
    );
    
    this.currentY += 35;

    // Customer information with better spacing
    this.addCustomerInfoSection(data);

    // Enhanced 3D House illustration positioned at bottom of page
    this.currentY += 30; // Small gap after customer info
    this.addEnhanced3DHouseIllustration();

    // Simple footer
    this.addSimplePageFooter();
  }

  // Enhanced 3D visual elements
  private add3DKlaryoLogo() {
    const centerX = this.pageWidth / 2;
    const centerY = this.currentY;
    
    // 3D Klaryo star logo with depth
    this.doc.setFillColor(...Colors.secondary);
    
    // Create 3D star effect with multiple layers
    for (let layer = 0; layer < 3; layer++) {
      const offset = layer * 0.5;
      const opacity = 1 - (layer * 0.3);
      
      this.doc.setGState(this.doc.GState({ opacity }));
      
      // Draw star points
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const innerRadius = 8 - offset;
        const outerRadius = 15 - offset;
        
        const x1 = centerX + Math.cos(angle) * innerRadius;
        const y1 = centerY + Math.sin(angle) * innerRadius;
        const x2 = centerX + Math.cos(angle) * outerRadius;
        const y2 = centerY + Math.sin(angle) * outerRadius;
        
        this.doc.setLineWidth(3 - layer);
        this.doc.setDrawColor(...Colors.secondary);
        this.doc.line(centerX + offset, centerY + offset, x2 + offset, y2 + offset);
      }
    }
    
    this.doc.setGState(this.doc.GState({ opacity: 1 })); // Reset opacity
    
    // Klaryo text with 3D shadow effect
    this.doc.setFontSize(36);
    this.doc.setFont('helvetica', 'bold');
    
    // Shadow
    this.doc.setTextColor(200, 200, 200);
    this.doc.text('Klaryo', centerX + 25 + 2, centerY + 2, { align: 'left' });
    
    // Main text
    this.doc.setTextColor(...Colors.primary);
    this.doc.text('Klaryo', centerX + 25, centerY, { align: 'left' });
  }
  
  private add3DTitle(title1: string, title2: string) {
    const centerX = this.pageWidth / 2;
    
    // 3D title effect with shadows
    this.doc.setFontSize(52);
    this.doc.setFont('helvetica', 'bold');
    
    // Shadow layers for 3D effect
    for (let i = 3; i >= 0; i--) {
      const shadowOffset = i * 0.8;
      const opacity = 0.2 + (i * 0.2);
      
      this.doc.setGState(this.doc.GState({ opacity }));
      this.doc.setTextColor(100 + i * 30, 100 + i * 30, 100 + i * 30);
      
      this.doc.text(title1, centerX + shadowOffset, this.currentY + shadowOffset, { align: 'center' });
      this.doc.text(title2, centerX + shadowOffset, this.currentY + 25 + shadowOffset, { align: 'center' });
    }
    
    // Main title
    this.doc.setGState(this.doc.GState({ opacity: 1 }));
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text(title1, centerX, this.currentY, { align: 'center' });
    this.doc.text(title2, centerX, this.currentY + 25, { align: 'center' });
  }
  
  private addCustomerInfoSection(data: AdvancedPDFReportData) {
    // Customer info in a compact, well-positioned box
    const boxHeight = 65; // Increased height for better spacing
    
    // Box with gradient effect - positioned higher on page
    this.doc.setFillColor(245, 248, 250);
    this.doc.setDrawColor(...Colors.border);
    this.doc.setLineWidth(0.5);
    this.doc.roundedRect(this.margin + 20, this.currentY, this.contentWidth - 40, boxHeight, 8, 8, 'FD');
    
    // Customer information with proper spacing
    this.doc.setFontSize(10); // Smaller font to fit better
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    
    const centerX = this.pageWidth / 2;
    const startY = this.currentY + 15;
    
    // Split long address if needed
    const address = data.location.address;
    if (address.length > 55) {
      const addressParts = this.splitLongText(address, 45);
      addressParts.forEach((part, index) => {
        this.doc.text(`${index === 0 ? 'Indirizzo: ' : ''}${part}`, centerX, startY + (index * 9), { align: 'center' });
      });
      this.doc.text(`Email: ${this.dynamicData.customerEmail}`, centerX, startY + (addressParts.length * 9) + 8, { align: 'center' });
      this.doc.text(`Telefono: ${this.dynamicData.customerPhone}`, centerX, startY + (addressParts.length * 9) + 18, { align: 'center' });
    } else {
      this.doc.text(`Indirizzo: ${address}`, centerX, startY, { align: 'center' });
      this.doc.text(`Email: ${this.dynamicData.customerEmail}`, centerX, startY + 15, { align: 'center' });
      this.doc.text(`Telefono: ${this.dynamicData.customerPhone}`, centerX, startY + 30, { align: 'center' });
    }
    
    // Update currentY to account for the box
    this.currentY += boxHeight;
  }
  
  private splitLongText(text: string, maxLength: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
      if ((currentLine + word).length <= maxLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    
    if (currentLine) lines.push(currentLine);
    return lines;
  }
  
  private addEnhanced3DHouseIllustration() {
    const centerX = this.pageWidth / 2;
    const centerY = this.currentY;
    
    // Check if we have enough space, if not, position at safe location
    const availableSpace = this.pageHeight - this.currentY - 40; // 40mm for footer
    if (availableSpace < 100) {
      // Position illustration in available space
      this.currentY = this.pageHeight - 120; // Fixed position from bottom
    }
    
    // 3D Base platform with depth - smaller size
    this.doc.setFillColor(...Colors.success);
    this.doc.ellipse(centerX, this.currentY + 20, 60, 15, 'F');
    
    // Platform shadow
    this.doc.setFillColor(60, 120, 60);
    this.doc.setGState(this.doc.GState({ opacity: 0.3 }));
    this.doc.ellipse(centerX + 2, centerY + 27, 70, 18, 'F');
    this.doc.setGState(this.doc.GState({ opacity: 1 }));
    
    // Main house with 3D effect
    this.add3DBuilding(centerX - 30, centerY - 20, 35, 35);
    
    // Solar panels building
    this.add3DBuilding(centerX + 10, centerY - 15, 25, 25);
    
    // Charging station with 3D effect
    this.add3DChargingStation(centerX + 40, centerY);
    
    // 3D Trees
    this.add3DTrees(centerX - 45, centerY + 5);
    this.add3DTrees(centerX + 50, centerY + 8);
    
    // 3D Sun with rays
    this.add3DSun(centerX + 60, centerY - 35);
  }
  
  private add3DBuilding(x: number, y: number, width: number, height: number) {
    // Building shadow
    this.doc.setFillColor(180, 180, 180);
    this.doc.rect(x + 3, y + 3, width, height, 'F');
    
    // Building base
    this.doc.setFillColor(245, 245, 245);
    this.doc.setDrawColor(...Colors.border);
    this.doc.setLineWidth(0.5);
    this.doc.rect(x, y, width, height, 'FD');
    
    // Roof with 3D effect
    this.doc.setFillColor(200, 220, 240);
    this.doc.triangle(x - 5, y, x + width + 5, y, x + width / 2, y - 15, 'F');
    
    // Solar panels on roof with 3D depth
    this.doc.setFillColor(...Colors.tertiary);
    this.doc.rect(x + 5, y - 12, width * 0.3, 8, 'F');
    this.doc.rect(x + width * 0.6, y - 12, width * 0.3, 8, 'F');
    
    // Panel shadows
    this.doc.setFillColor(200, 60, 30);
    this.doc.rect(x + 6, y - 11, width * 0.3, 7, 'F');
    this.doc.rect(x + width * 0.6 + 1, y - 11, width * 0.3, 7, 'F');
    
    // Windows with 3D depth
    this.doc.setFillColor(...Colors.lightBlue);
    this.doc.rect(x + 5, y + 8, width * 0.25, width * 0.25, 'F');
    this.doc.rect(x + width * 0.65, y + 8, width * 0.25, width * 0.25, 'F');
    
    // Window frames
    this.doc.setDrawColor(100, 150, 200);
    this.doc.setLineWidth(0.5);
    this.doc.rect(x + 5, y + 8, width * 0.25, width * 0.25, 'S');
    this.doc.rect(x + width * 0.65, y + 8, width * 0.25, width * 0.25, 'S');
    
    // Door with 3D effect
    this.doc.setFillColor(139, 69, 19);
    this.doc.rect(x + width * 0.4, y + height * 0.4, width * 0.2, height * 0.6, 'F');
    
    // Door shadow
    this.doc.setFillColor(100, 50, 10);
    this.doc.rect(x + width * 0.4 + 1, y + height * 0.4 + 1, width * 0.2, height * 0.6, 'F');
  }
  
  private add3DChargingStation(x: number, y: number) {
    // Charging station base
    this.doc.setFillColor(...Colors.textMedium);
    this.doc.rect(x, y, 18, 12, 'F');
    
    // 3D effect
    this.doc.setFillColor(120, 120, 120);
    this.doc.rect(x + 1, y + 1, 18, 12, 'F');
    
    // Charging indicator
    this.doc.setFillColor(...Colors.success);
    this.doc.rect(x + 3, y + 3, 4, 6, 'F');
    
    // "CHARGING STATION" text
    this.doc.setTextColor(...Colors.white);
    this.doc.setFontSize(4);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('CHARGE', x + 9, y + 8, { align: 'center' });
  }
  
  private add3DTrees(x: number, y: number) {
    // Tree trunk with 3D shadow
    this.doc.setFillColor(101, 67, 33);
    this.doc.rect(x - 1, y + 5, 3, 8, 'F');
    
    // Tree shadow
    this.doc.setFillColor(80, 50, 20);
    this.doc.rect(x, y + 6, 3, 8, 'F');
    
    // Tree foliage with 3D layers
    for (let layer = 0; layer < 3; layer++) {
      const radius = 8 - layer;
      const opacity = 0.8 + (layer * 0.1);
      
      this.doc.setGState(this.doc.GState({ opacity }));
      this.doc.setFillColor(76 + layer * 20, 175 - layer * 10, 80 + layer * 10);
      this.doc.circle(x + layer * 0.5, y - layer * 0.5, radius, 'F');
    }
    
    this.doc.setGState(this.doc.GState({ opacity: 1 }));
  }
  
  private add3DSun(x: number, y: number) {
    // Sun with 3D glow effect
    for (let i = 0; i < 5; i++) {
      const radius = 12 - i * 1.5;
      const opacity = 0.2 + i * 0.15;
      
      this.doc.setGState(this.doc.GState({ opacity }));
      this.doc.setFillColor(255, 220 - i * 10, 70 + i * 10);
      this.doc.circle(x, y, radius, 'F');
    }
    
    this.doc.setGState(this.doc.GState({ opacity: 1 }));
    
    // Sun rays
    this.doc.setDrawColor(...Colors.secondary);
    this.doc.setLineWidth(1.5);
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const x1 = x + Math.cos(angle) * 15;
      const y1 = y + Math.sin(angle) * 15;
      const x2 = x + Math.cos(angle) * 20;
      const y2 = y + Math.sin(angle) * 20;
      this.doc.line(x1, y1, x2, y2);
    }
  }
  
  private addCoverPageFooter() {
    // Decorative footer line
    this.doc.setDrawColor(...Colors.secondary);
    this.doc.setLineWidth(2);
    this.doc.line(this.margin, this.pageHeight - 35, this.pageWidth - this.margin, this.pageHeight - 35);
    
    // Footer text with better positioning
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...Colors.textMedium);
    this.doc.text('Analisi a cura di Klaryo', this.pageWidth / 2, this.pageHeight - 20, { align: 'center' });
  }

  private add10YearProjectionPage(data: AdvancedPDFReportData) {
    // Header
    this.addPageHeader();
    
    this.currentY = 85;
    
    // Enhanced section title with 3D effect
    this.add3DSectionTitle('Proiezione in 10 anni');
    
    this.currentY += 15;

    // Decorative separator with gradient
    this.addDecorativeSeparator();
    
    this.currentY += 25;

    // Cost breakdown
    const installationCost = data.installationCostTotal;
    const remainingBills = data.totalCostWithSolar - installationCost;
    const totalWithSolar = data.totalCostWithSolar;
    
    // Energy sale and deductions
    const energySale = (data.yearlyProductionAcKwh * 0.1 * 10); // Simplified
    const deductions = 1400; // From reference
    const energyTotal = energySale + deductions;
    
    // Final calculations
    const totalWithoutSolar = data.totalCostWithoutSolar;
    const totalSavings = data.savings;

    this.addProjectionRow('Costo impianto', `${installationCost.toFixed(0)}€`);
    this.addProjectionRow('Bollette residue', `${remainingBills.toFixed(2)} €`);
    this.addProjectionRow('TOT', `${totalWithSolar.toFixed(2)} €`, true);
    
    this.currentY += 15;
    
    this.addProjectionRow('Vendita energia', `${energySale.toFixed(2)} €`);
    this.addProjectionRow('Detrazioni', `${deductions} €`);
    this.addProjectionRow('TOT', `${energyTotal.toFixed(2)} €`, true);
    
    this.currentY += 15;
    
    this.addProjectionRow('Costi totali senza impianto', `${totalWithoutSolar.toFixed(1)} €`);
    this.addProjectionRow('Costi totali con impianto', `${totalWithSolar.toFixed(2)} €`);
    
    this.currentY += 20;
    
    // Final savings with proper spacing
    if (this.currentY > this.pageHeight - 80) {
      this.addNewPage();
    }
    
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('RISPARMIO TOTALE IN 10 ANNI', this.margin, this.currentY);
    this.currentY += 20;
    
    this.doc.setFontSize(24);
    this.doc.setTextColor(...Colors.success);
    this.doc.text(`${totalSavings.toFixed(2)}€`, this.margin, this.currentY);

    // Simple footer
    this.addSimplePageFooter();
  }

  private addFutureScenarioPage(data: AdvancedPDFReportData) {
    // Header
    this.addPageHeader();
    
    this.currentY = 85;
    
    // Enhanced section title
    this.add3DSectionTitle('Scenario futuro');
    
    this.currentY += 10;

    // Subtitle
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...Colors.textMedium);
    const subtitle = 'Qual è la tua situazione attuale? Sulla base dei dati\nche ci hai fornito, questa è la fotografia attuale dei tuoi\ncosti. [testo da rivedere]';
    const lines = subtitle.split('\n');
    lines.forEach((line, index) => {
      this.doc.text(line, this.pageWidth / 2, this.currentY + (index * 8), { align: 'center' });
    });
    
    this.currentY += 60;

    // Enhanced visual comparison with 3D elements
    this.addEnhancedScenarioComparison(data);

    // Simple footer
    this.addSimplePageFooter();
  }

  private addScenarioComparison(data: AdvancedPDFReportData) {
    const centerX = this.pageWidth / 2;
    
    // Installation cost in center
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.warning);
    this.doc.text('Costo dell\'impianto', centerX, this.currentY, { align: 'center' });
    
    this.doc.setFontSize(24);
    this.doc.text(`- ${data.installationCostTotal.toFixed(0)}€`, centerX, this.currentY + 15, { align: 'center' });
    
    // Left side - Expenses
    const leftX = this.margin + 30;
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.warning);
    this.doc.text('€ USCITE', leftX, this.currentY + 40);
    
    this.doc.setFontSize(16);
    this.doc.text(`-${data.monthlyAverageEnergyBill.toFixed(2)} €`, leftX, this.currentY + 60);
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Totale bollette\nannuali con\nimpianto\nfotovoltaico', leftX, this.currentY + 80);

    // Right side - Income
    const rightX = this.pageWidth - this.margin - 30;
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.success);
    this.doc.text('ENTRATE', rightX, this.currentY + 40, { align: 'right' });
    
    const energySale = (data.yearlyProductionAcKwh * (1 - this.dynamicData.systemPerformance.selfConsumptionRate) * this.dynamicData.systemPerformance.gridSaleRate).toFixed(2);
    this.doc.setFontSize(16);
    this.doc.text(`+ ${energySale} €`, rightX, this.currentY + 60, { align: 'right' });
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Vendita energia', rightX, this.currentY + 80, { align: 'right' });
    
    this.doc.text(`+${this.dynamicData.taxIncentives.detrazioneAnnualAmount.toFixed(0)} €`, rightX, this.currentY + 110, { align: 'right' });
    this.doc.text('Detrazioni', rightX, this.currentY + 125, { align: 'right' });
    
    // Total savings
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.success);
    this.doc.text(`${data.savings.toFixed(1)} €`, rightX, this.currentY + 160, { align: 'right' });
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Risparmio\nbolletta', rightX, this.currentY + 175, { align: 'right' });

    // House illustration in center
    this.currentY += 90;
    this.addSimpleHouseIllustration(centerX, this.currentY);
  }

  private addSimpleHouseIllustration(x: number, y: number) {
    // House base
    this.doc.setFillColor(220, 220, 220);
    this.doc.setDrawColor(...Colors.border);
    this.doc.rect(x - 20, y - 10, 40, 25, 'FD');

    // Solar panels
    this.doc.setFillColor(...Colors.tertiary);
    this.doc.rect(x - 15, y - 20, 12, 6, 'F');
    this.doc.rect(x + 3, y - 20, 12, 6, 'F');

    // Windows
    this.doc.setFillColor(...Colors.lightBlue);
    this.doc.rect(x - 15, y - 5, 6, 6, 'F');
    this.doc.rect(x + 9, y - 5, 6, 6, 'F');
  }

  private addStartingDataPage(data: AdvancedPDFReportData) {
    // Header
    this.addPageHeader();
    
    this.currentY = 85;
    
    // Enhanced section title
    this.add3DSectionTitle('Dati di partenza');
    
    this.currentY += 15;

    // Decorative separator
    this.addDecorativeSeparator();
    
    this.currentY += 25;

    // Data rows
    this.addDataRow('Spesa annua per l\'energia', `${(data.monthlyAverageEnergyBill * 12).toFixed(2)} €`);
    this.addDataRow('Consumo annuo', `${data.yearlyKwhEnergyConsumption.toFixed(0)} kWh`);
    this.addDataRow('Prezzo effettivo dell\'energia', `${data.energyCostPerKwh.toFixed(2)} €/kWh`);
    
    this.currentY += 40;

    // Line separator
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    
    this.currentY += 40;

    // Current cost highlight
    this.doc.setFillColor(...Colors.warning);
    this.doc.setDrawColor(...Colors.warning);
    this.doc.roundedRect(this.margin, this.currentY, 15, 15, 2, 2, 'FD');
    
    this.doc.setTextColor(...Colors.white);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('✕', this.margin + 7.5, this.currentY + 10, { align: 'center' });
    
    this.doc.setTextColor(...Colors.warning);
    this.doc.setFontSize(16);
    this.doc.text('QUANTO PAGHI:', this.margin + 25, this.currentY + 10);
    
    this.currentY += 20;
    this.doc.setFontSize(24);
    this.doc.text(`${data.energyCostPerKwh.toFixed(2)}€/kWh`, this.margin + 25, this.currentY);
    
    this.currentY += 40;

    // Recommended cost
    this.doc.setFillColor(...Colors.success);
    this.doc.setDrawColor(...Colors.success);
    this.doc.roundedRect(this.margin, this.currentY, 15, 15, 2, 2, 'FD');
    
    this.doc.setTextColor(...Colors.white);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('⚠', this.margin + 7.5, this.currentY + 10, { align: 'center' });
    
    this.doc.setTextColor(...Colors.success);
    this.doc.setFontSize(16);
    this.doc.text('QUANTO DOVRESTI PAGARE:', this.margin + 25, this.currentY + 10);
    
    this.currentY += 20;
    this.doc.setFontSize(24);
    this.doc.text('0.33 €/kWh', this.margin + 25, this.currentY);

    // Simple footer
    this.addSimplePageFooter();
  }

  private addCurrentSituationOverviewPage(data: AdvancedPDFReportData) {
    // Header
    this.addPageHeader();
    
    this.currentY = 85;
    
    // Title
    this.add3DSectionTitle('Situazione attuale');
    
    this.currentY += 15;
    
    // Subtitle
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...Colors.textMedium);
    const subtitle = 'Qual è la tua situazione attuale? Sulla base dei dati che ci hai fornito, questa è la fotografia attuale dei tuoi costi.';
    this.doc.text(subtitle, this.pageWidth / 2, this.currentY, { align: 'center', maxWidth: this.contentWidth - 40 });
    
    this.currentY += 60;
    
    // Current costs visualization with proper spacing
    this.addCurrentCostsVisualization(data);
    
    // Simple footer
    this.addSimplePageFooter();
    }
  
  private addCurrentCostsVisualization(data: AdvancedPDFReportData) {
    const centerX = this.pageWidth / 2;
    
    // Left side - Current annual cost with better positioning
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.warning);
    this.doc.text('€', this.margin + 10, this.currentY);
    
    this.doc.setFontSize(20);
    this.doc.text(`-${(data.monthlyAverageEnergyBill * 12).toFixed(2)} €`, this.margin + 10, this.currentY + 15);
    
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Totale bollette', this.margin + 10, this.currentY + 35);
    this.doc.text('annuali senza', this.margin + 10, this.currentY + 45);
    this.doc.text('impianto', this.margin + 10, this.currentY + 55);
    this.doc.text('fotovoltaico', this.margin + 10, this.currentY + 65);

    // Right side - Cost calculation with proper spacing
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('- €', this.pageWidth - this.margin - 40, this.currentY, { align: 'left' });
    
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Calcolo della spesa', this.pageWidth - this.margin - 40, this.currentY + 35, { align: 'left' });
    this.doc.text('energetica su 10 anni con', this.pageWidth - this.margin - 40, this.currentY + 45, { align: 'left' });
    this.doc.text('aggiunta di un ipotetico', this.pageWidth - this.margin - 40, this.currentY + 55, { align: 'left' });
    this.doc.text('aumento del 5% ogni', this.pageWidth - this.margin - 40, this.currentY + 65, { align: 'left' });
    this.doc.text('anno', this.pageWidth - this.margin - 40, this.currentY + 75, { align: 'left' });

    // House with sad face in center - positioned better
    this.currentY += 90;
    this.addSadHouseIllustration(centerX, this.currentY);
  }

  private addCurrentSituationPage(data: AdvancedPDFReportData) {
    // Header
    this.addPageHeader();
    
    this.currentY = 80;
    
    // Title
    this.doc.setFontSize(36);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Situazione attuale', this.pageWidth / 2, this.currentY, { align: 'center' });
    
    this.currentY += 20;

    // Subtitle
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...Colors.textMedium);
    const subtitle = 'Qual è la tua situazione attuale? Sulla base dei dati\nche ci hai fornito, questa è la fotografia attuale dei tuoi\ncosti.';
    const lines = subtitle.split('\n');
    lines.forEach((line, index) => {
      this.doc.text(line, this.pageWidth / 2, this.currentY + (index * 8), { align: 'center' });
    });
    
    this.currentY += 80;

    // Current situation visualization
    this.addCurrentSituationVisualization(data);

    // Simple footer
    this.addSimplePageFooter();
  }

  private addCurrentSituationVisualization(data: AdvancedPDFReportData) {
    const centerX = this.pageWidth / 2;
    
    // Left side - Current annual cost
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.warning);
    this.doc.text('€', this.margin, this.currentY);
    
    this.doc.setFontSize(24);
    this.doc.text(`-${(data.monthlyAverageEnergyBill * 12).toFixed(2)} €`, this.margin, this.currentY + 20);
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Totale bollette\nannuali senza\nimpianto\nfotovoltaico', this.margin, this.currentY + 40);

    // Right side - Cost calculation
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('- €', this.pageWidth - this.margin - 30, this.currentY, { align: 'right' });
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Calcolo della spesa\nenergetica su 10 anni con\naggiunta di un ipotetico\naumento del 5% ogni\nanno', this.pageWidth - this.margin - 30, this.currentY + 40, { align: 'right' });

    // House with sad face in center
    this.currentY += 60;
    this.addSadHouseIllustration(centerX, this.currentY);
  }

  private addSadHouseIllustration(x: number, y: number) {
    // House base
    this.doc.setFillColor(...Colors.success);
    this.doc.rect(x - 20, y - 10, 40, 25, 'F');

    // Sad face
    this.doc.setFillColor(...Colors.secondary);
    this.doc.circle(x, y + 5, 10, 'F');
    
    // Eyes
    this.doc.setFillColor(...Colors.textDark);
    this.doc.circle(x - 3, y + 2, 1, 'F');
    this.doc.circle(x + 3, y + 2, 1, 'F');
    
    // Sad mouth (simple line)
    this.doc.setDrawColor(...Colors.textDark);
    this.doc.setLineWidth(1);
    this.doc.line(x - 3, y + 8, x + 3, y + 8);
  }

  private addEconomicSavingsPage(data: AdvancedPDFReportData) {
    // Header
    this.addPageHeader();
    
    this.currentY = 85; // Better positioning after header
    
    // Title with proper spacing
    this.doc.setFontSize(22);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Stima del risparmio economico:', this.margin, this.currentY);
    this.currentY += 18;
    this.doc.text('Immagina il tuo risparmio, oggi e domani', this.margin, this.currentY);
    
    this.currentY += 25;
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Ogni euro risparmiato è un passo verso una vita più serena.', this.margin, this.currentY);
    
    this.currentY += 35;

    // Today section
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('OGGI', this.margin, this.currentY);
    
    this.currentY += 20;
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Totale consumo annuo: ${data.yearlyKwhEnergyConsumption.toFixed(0)} kWh`, this.margin, this.currentY);
    this.doc.text(`Totale spesa annua: ${(data.monthlyAverageEnergyBill * 12).toFixed(2)} €`, this.margin, this.currentY + 15);

    // Simple footer
    this.addSimplePageFooter();
  }

  private addConclusionsPage(data: AdvancedPDFReportData) {
    // Header
    this.addPageHeader();
    
    this.currentY = 80;
    
    // Title
    this.doc.setFontSize(36);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Conclusioni', this.pageWidth / 2, this.currentY, { align: 'center' });
    
    this.currentY += 50;

    // Solar panel icon
    this.addSolarPanelIcon(this.pageWidth / 2, this.currentY);
    this.currentY += 30;

    // Conclusion 1
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...Colors.textDark);
    const text1 = `L'impianto proposto consente di coprire i consumi con un investimento che si ripaga in circa ${data.breakEvenYear + 1} anni.`;
    this.doc.text(text1, this.pageWidth / 2, this.currentY, { align: 'center', maxWidth: this.contentWidth - 40 });
    
    this.currentY += 40;

    // Growth icon
    this.addGrowthIcon(this.pageWidth / 2, this.currentY);
    this.currentY += 30;

    // Conclusion 2
    const text2 = `Dopo il periodo di rientro, i benefici economici continueranno per almeno ${data.installationLifeSpan} anni, garantendo un ottimo ritorno sull'investimento.`;
    this.doc.text(text2, this.pageWidth / 2, this.currentY, { align: 'center', maxWidth: this.contentWidth - 40 });
    
    this.currentY += 40;

    // Hand icon
    this.addHandIcon(this.pageWidth / 2, this.currentY);
    this.currentY += 30;

    // Conclusion 3
    const text3 = 'Oltre al risparmio diretto, si ottiene un guadagno passivo dalla vendita dell\'energia.';
    this.doc.text(text3, this.pageWidth / 2, this.currentY, { align: 'center', maxWidth: this.contentWidth - 40 });
    
    this.currentY += 50;

    // Final note
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setTextColor(...Colors.textMedium);
    this.doc.text('Se vuoi procedere con l\'installazione o avere una consulenza più dettagliata,', this.pageWidth / 2, this.currentY, { align: 'center' });
    this.doc.text('contattaci!', this.pageWidth / 2, this.currentY + 12, { align: 'center' });

    // Simple footer
    this.addSimplePageFooter();
  }

  private addEnergyPhotographyPage(data: AdvancedPDFReportData) {
    // Header
    this.addPageHeader();
    
    this.currentY = 60;
    
    // Title
    this.doc.setFontSize(36);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Cos\'è la fotografia energetica?', this.margin, this.currentY);
    
    this.currentY += 40;

    // Description paragraphs
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...Colors.textDark);
    
    const paragraph1 = 'La fotografia energetica è il primo passo per trasformare la tua casa in un esempio di efficienza e sostenibilità.';
    this.doc.text(paragraph1, this.margin, this.currentY, { maxWidth: this.contentWidth });
    
    this.currentY += 20;
    
    const paragraph2 = 'Grazie a questo documento, potrai scoprire come migliorare il tuo sistema energetico e ridurre gli sprechi, scegliendo le soluzioni più innovative come pannelli solari, pompe di calore e tecnologie sostenibili.';
    this.doc.text(paragraph2, this.margin, this.currentY, { maxWidth: this.contentWidth });
    
    this.currentY += 30;
    
    const paragraph3 = 'Non si tratta solo di numeri: è il tuo percorso verso un futuro più luminoso, pulito e vantaggioso.';
    this.doc.text(paragraph3, this.margin, this.currentY, { maxWidth: this.contentWidth });
    
    this.currentY += 50;

    // Add energy efficiency illustration
    this.addEnergyEfficiencyIllustration();

    // Simple footer
    this.addSimplePageFooter();
  }

  private addEnergyUsagePage(data: AdvancedPDFReportData) {
    // Header
    this.addPageHeader();
    
    this.currentY = 60;
    
    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Sveliamo come utilizzi la tua energia', this.margin, this.currentY);
    
    this.currentY += 30;

    // Description
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    const description = 'Ogni kWh consumato racconta qualcosa di te. Analizzando i tuoi consumi energetici, tracciamo il quadro di come e quando utilizzi l\'energia, identificando le aree in cui puoi ottenere il massimo risparmio.';
    this.doc.text(description, this.margin, this.currentY, { maxWidth: this.contentWidth });
    
    this.currentY += 60;

    // Energy consumption section
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('CONSUMO ENERGIA', this.margin, this.currentY);
    
    this.currentY += 30;

    // Customer details
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Nome e Cognome: ${this.dynamicData.customerName}`, this.margin, this.currentY);
    this.doc.text(`Indirizzo di installazione: ${data.location.address}`, this.margin, this.currentY + 15);
    this.doc.text('Tipo di tariffa: P Netto Natura Luce 24 - V51', this.margin, this.currentY + 30);
    
    this.currentY += 50;
    
    this.doc.text(`Tipo di contratto: 3,00 kW kWh`, this.margin, this.currentY);
    this.doc.text(`Consumo annuale: ${data.yearlyKwhEnergyConsumption.toFixed(0)} kWh`, this.margin, this.currentY + 15);
    this.doc.text(`Costo al kWh: ${data.energyCostPerKwh.toFixed(2)} €/kWh`, this.margin, this.currentY + 30);

    // Simple footer
    this.addSimplePageFooter();
  }

  private addTechnicalPages(data: AdvancedPDFReportData) {
    // Page: System sizing recommendations
    this.addNewPage();
    this.addSystemSizingPage(data);
    
    // Page: Energy cost analysis
    this.addNewPage();
    this.addEnergyCostAnalysisPage(data);
    
    // Page: Investment objectives
    this.addNewPage();
    this.addInvestmentObjectivesPage(data);
    
    // Page: Tax incentives
    this.addNewPage();
    this.addTaxIncentivesPage(data);
    
    // Page: Production estimates table
    this.addNewPage();
    this.addProductionEstimatesTable(data);
    
    // Page: Building location and maps
    this.addNewPage();
    this.addBuildingLocationPage(data);
    
    // Page: Detailed investment analysis
    this.addNewPage();
    this.addDetailedInvestmentPage(data);
    
    // Page: System recommendations
    this.addNewPage();
    this.addSystemRecommendationsPage(data);
    
    // Page: Final comprehensive tables
    this.addNewPage();
    this.addComprehensiveProjectionTables(data);
    
    // Page: Roof segments table
    this.addNewPage();
    this.addRoofSegmentsPage(data);
    
    // Page: System benefits
    this.addNewPage();
    this.addSystemBenefitsPage(data);
  }

  private addRoofSegmentsPage(data: AdvancedPDFReportData) {
    // Header
    this.addPageHeader();
    
    this.currentY = 60;
    
    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Porzioni di tetto e orientamento', this.margin, this.currentY);
    
    this.currentY += 40;

    // Table headers
    const headers = ['Porzione', 'Inclinazione', 'Area'];
    const colWidth = this.contentWidth / 3;
    
    this.doc.setFillColor(...Colors.primary);
    this.doc.rect(this.margin, this.currentY, this.contentWidth, 10, 'F');
    
    this.doc.setTextColor(...Colors.white);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    
    headers.forEach((header, i) => {
      this.doc.text(header, this.margin + (i * colWidth) + 5, this.currentY + 7);
    });
    
    this.currentY += 10;

    // Table rows (sample data)
    const panelConfig = data.buildingInsights.solarPotential.solarPanelConfigs[data.configId];
    if (panelConfig && panelConfig.roofSegmentSummaries.length > 0) {
      panelConfig.roofSegmentSummaries.forEach((segment, index) => {
        if (index % 2 === 0) {
          this.doc.setFillColor(240, 240, 240);
          this.doc.rect(this.margin, this.currentY, this.contentWidth, 8, 'F');
        }
        
        this.doc.setTextColor(...Colors.textDark);
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        
        this.doc.text(`${index + 1}`, this.margin + 5, this.currentY + 6);
        this.doc.text(`${(segment.pitchDegrees || 0).toFixed(2)}`, this.margin + colWidth + 5, this.currentY + 6);
        this.doc.text(`${((segment.yearlyEnergyDcKwh || 0) / 100).toFixed(2)}`, this.margin + (2 * colWidth) + 5, this.currentY + 6);
        
        this.currentY += 8;
      });
    }

    // Simple footer
    this.addSimplePageFooter();
  }

  private addSystemBenefitsPage(data: AdvancedPDFReportData) {
    // Header
    this.addPageHeader();
    
    this.currentY = 60;
    
    // Benefits list
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Flessibilità del sistema:', this.margin, this.currentY);
    
    this.currentY += 15;
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Adattabilità a case nuove o in ristrutturazione con costi inferiori per integrazioni parziali.', this.margin, this.currentY);
    
    this.currentY += 30;
    
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Futuro senza debito energetico:', this.margin, this.currentY);
    
    this.currentY += 15;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Riduzione dei costi dell\'80% rispetto a un impianto tradizionale.', this.margin, this.currentY);
    
    this.currentY += 30;
    
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Indipendenza dai combustibili fossili:', this.margin, this.currentY);
    
    this.currentY += 15;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Utilizzo esclusivo di energia rinnovabile.', this.margin, this.currentY);
    
    this.currentY += 30;
    
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Aumento del valore immobiliare:', this.margin, this.currentY);
    
    this.currentY += 15;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Un sistema energetico efficiente migliora la sostenibilità e il valore della casa.', this.margin, this.currentY);
    
    this.currentY += 50;
    
    // Contact section with proper spacing
    if (this.currentY > this.pageHeight - 100) {
      this.addNewPage();
    }
    
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.primary);
    this.doc.text('Contatti', this.pageWidth / 2, this.currentY, { align: 'center' });
    
    this.currentY += 25;
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Telefono: 059 788 0211', this.pageWidth / 2, this.currentY, { align: 'center' });
    this.doc.text('Email: info@klaryo.it', this.pageWidth / 2, this.currentY + 18, { align: 'center' });

    // Simple footer
    this.addSimplePageFooter();
  }

  private addInvestmentDetailsPage(data: AdvancedPDFReportData) {
    // Header
    this.addPageHeader();
    
    this.currentY = 60;
    
    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Rientro dell\'investimento: Come funziona?', this.margin, this.currentY);
    
    this.currentY += 30;

    // Subtitle
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setTextColor(...Colors.textMedium);
    this.doc.text('Costi e incentivi', this.margin, this.currentY);
    
    this.currentY += 30;

    // Cost breakdown
    this.addDataRow('Costo impianto', `${data.installationCostTotal.toFixed(0)} €`);
    this.addDataRow('Detrazione fiscale 50% (10 anni)', `${this.dynamicData.taxIncentives.detrazioneAnnualAmount.toFixed(0)} €/anno`);
    
    this.currentY += 20;
    
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'italic');
    this.doc.text('Risparmio annuo e guadagni', this.margin, this.currentY);
    
    this.currentY += 20;
    
    const annualSavings = (data.monthlyAverageEnergyBill * 12 * 0.4).toFixed(2); // 40% self-consumption
    const energySale = (data.yearlyProductionAcKwh * 0.6 * 0.1).toFixed(2); // 60% sold at 0.1€/kWh
    
    this.addDataRow('Risparmio da autoconsumo (40% dei consumi)', `${annualSavings} €`);
    this.addDataRow('Guadagno dalla vendita dell\'energia (60% dell\'energia prodotta)', `${energySale} €`);
    
    const totalAnnualSaving = (parseFloat(annualSavings) + parseFloat(energySale) + 140).toFixed(2);
    this.addDataRow('Totale risparmio annuo (inclusa la detrazione fiscale)', `${totalAnnualSaving} €`, true);
    
    this.currentY += 20;
    
    // Payback calculation
    const paybackYears = (data.installationCostTotal / parseFloat(totalAnnualSaving)).toFixed(2);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Tempo di rientro dell\'investimento:', this.margin, this.currentY);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`${data.installationCostTotal.toFixed(0)} € ÷ ${totalAnnualSaving} € = ${paybackYears} anni`, this.margin, this.currentY + 15);
    
    this.currentY += 40;
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Dopo questo periodo, il sistema inizierà a generare risparmio puro, riducendo', this.margin, this.currentY);
    this.doc.text('il costo della bolletta e generando un guadagno dalla vendita dell\'energia in', this.margin, this.currentY + 12);
    this.doc.text('rete.', this.margin, this.currentY + 24);

    // Simple footer
    this.addSimplePageFooter();
  }

  // New comprehensive page methods
  
  private addSystemSizingPage(data: AdvancedPDFReportData) {
    this.addPageHeader();
    this.currentY = 60;
    
    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Quanto deve essere grande l\'impianto?', this.margin, this.currentY);
    
    this.currentY += 40;
    
    // Description
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    const description = 'L\'obiettivo è coprire i tuoi consumi annui considerando un autoconsumo del 40% e vendendo il restante 60% in rete.';
    this.doc.text(description, this.margin, this.currentY, { maxWidth: this.contentWidth });
    
    this.currentY += 40;
    
    // System sizing data (using dynamic calculations)
    const requiredProduction = data.yearlyKwhEnergyConsumption * 1.2; // 20% margin
    const kwhPerKwp = this.dynamicData.systemPerformance.kwhPerKwp;
    const recommendedPower = requiredProduction / kwhPerKwp;
    const recommendedPanels = this.dynamicData.recommendedSystemSize.panels;
    
    this.addDataRow('Produzione annua necessaria', `${requiredProduction.toFixed(0)} kWh`);
    this.addDataRow('Potenza dell\'impianto richiesta', `${this.dynamicData.recommendedSystemSize.kw} kWp`);
    this.addDataRow(`Numero di pannelli necessari (da ${data.panelCapacityWatts}W)`, `${recommendedPanels} pannelli`);
    
    this.currentY += 30;
    
    this.doc.setFontSize(10);
    this.doc.text(`Abbiamo arrotondato per eccesso a ${recommendedPanels} pannelli perché è sempre meglio avere un surplus di energia. L'energia in più prodotta nei mesi più soleggiati permetterà di compensare i minori rendimenti invernali, garantendo maggiore autonomia e stabilità nei consumi domestici.`, this.margin, this.currentY, { maxWidth: this.contentWidth });
    
    this.addSimplePageFooter();
  }
  
  private addEnergyCostAnalysisPage(data: AdvancedPDFReportData) {
    this.addPageHeader();
    this.currentY = 60;
    
    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Quanto stai pagando davvero l\'energia?', this.margin, this.currentY);
    
    this.currentY += 40;
    
    // Current cost analysis with proper text wrapping
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.warning);
    const costAnalysisText = `Il tuo costo effettivo dell'energia è di ${data.energyCostPerKwh.toFixed(2)} €/kWh, ben più alto rispetto alla media nazionale`;
    this.doc.text(costAnalysisText, this.margin, this.currentY, { maxWidth: this.contentWidth });
    
    this.currentY += 30;
    
    // Market comparison
    this.addDataRow('Prezzo medio del mercato tutelato', `${this.dynamicData.marketRates.tutelatoRate.toFixed(2)} €/kWh`);
    this.addDataRow('Prezzo medio del mercato libero', `${this.dynamicData.marketRates.liberoRate.toFixed(2)} €/kWh`);
    
    this.currentY += 30;
    
    // Warning box
    this.doc.setFillColor(255, 248, 225);
    this.doc.setDrawColor(...Colors.warning);
    this.doc.roundedRect(this.margin, this.currentY, this.contentWidth, 40, 5, 5, 'FD');
    
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.warning);
    this.doc.text('⚠', this.margin + 10, this.currentY + 15);
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Stai pagando più del doppio rispetto alla media! Questo significa che ogni kWh che puoi autoprodurre con il fotovoltaico ti farà risparmiare enormemente rispetto a quanto paghi oggi.', this.margin + 25, this.currentY + 15, { maxWidth: this.contentWidth - 35 });
    
    this.currentY += 60;
    
    // Call to action
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.success);
    this.doc.text('SCOPRI COME RISPARMIARE E PAGARE UN PREZZO ONESTO L\'ENERGIA', this.margin, this.currentY);
    
    this.addSimplePageFooter();
  }

  private addInvestmentObjectivesPage(data: AdvancedPDFReportData) {
    this.addPageHeader();
    this.currentY = 60;
    
    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('I tuoi obiettivi, il nostro impegno', this.margin, this.currentY);
    
    this.currentY += 40;
    
    // Description
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    const description = 'Che tu voglia risparmiare, ridurre il tuo impatto ambientale o investire in soluzioni a lungo termine, il nostro obiettivo è allineato al tuo.';
    this.doc.text(description, this.margin, this.currentY, { maxWidth: this.contentWidth });
    
    this.currentY += 30;
    
    this.doc.text('Ogni scelta è personalizzata per rispondere alle tue esigenze e costruire un futuro energetico su misura per te.', this.margin, this.currentY, { maxWidth: this.contentWidth });
    
    this.currentY += 50;
    
    // Objectives
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Obiettivo: Indipendenza energetica', this.margin, this.currentY);
    this.doc.text(`Disponibilità di investimento: ${data.installationCostTotal.toFixed(0)}`, this.margin, this.currentY + 20);
    
    this.currentY += 60;
    
    // Solution
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.success);
    this.doc.text('SOLUZIONE PROPOSTA:', this.margin, this.currentY);
    
    this.currentY += 15;
    this.doc.setFontSize(16);
    this.doc.text('Installazione di pannelli fotovoltaici', this.margin, this.currentY);
    
    this.addSimplePageFooter();
  }

  private addTaxIncentivesPage(data: AdvancedPDFReportData) {
    this.addPageHeader();
    this.currentY = 60;
    
    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Incentivi e detrazioni fiscali:', this.margin, this.currentY);
    this.doc.text('Sfrutta ogni opportunità a tuo vantaggio', this.margin, this.currentY + 15);
    
    this.currentY += 50;
    
    // Bonus Casa section
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.success);
    this.doc.text('Detrazione Fiscale del 50% (Bonus Casa)', this.margin, this.currentY);
    
    this.currentY += 20;
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...Colors.textDark);
    const bonusText = 'Questo incentivo consente una detrazione del 50% sulle spese sostenute per l\'acquisto e l\'installazione di impianti fotovoltaici, fino a un massimo di 96.000 euro.';
    this.doc.text(bonusText, this.margin, this.currentY, { maxWidth: this.contentWidth });
    
    this.addSimplePageFooter();
  }

  private addProductionEstimatesTable(data: AdvancedPDFReportData) {
    this.addPageHeader();
    this.currentY = 60;
    
    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Stima di produzione in varie configurazioni', this.margin, this.currentY);
    
    this.currentY += 40;
    
    // Create production estimates table
    const tableHeaders = ['Potenza impianto', 'Energia prodotta (annuale)', 'Porzioni di tetto'];
    const colWidths = [this.contentWidth * 0.25, this.contentWidth * 0.35, this.contentWidth * 0.4];
    
    // Table header
    this.doc.setFillColor(...Colors.primary);
    this.doc.rect(this.margin, this.currentY, this.contentWidth, 12, 'F');
    
    this.doc.setTextColor(...Colors.white);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    
    let currentX = this.margin;
    tableHeaders.forEach((header, i) => {
      this.doc.text(header, currentX + 5, this.currentY + 8);
      currentX += colWidths[i];
    });
    
    this.currentY += 12;
    
    // Generate table data for different system sizes
    const systemSizes = [8, 10, 13, 15, 18, 20, 23, 25, 28, 30];
    
    systemSizes.forEach((kw, index) => {
      const annualProduction = kw * this.dynamicData.systemPerformance.kwhPerKwp;
      const panelsNeeded = Math.ceil(kw * 1000 / data.panelCapacityWatts);
      
      // Alternating row colors
      if (index % 2 === 0) {
        this.doc.setFillColor(248, 248, 248);
        this.doc.rect(this.margin, this.currentY, this.contentWidth, 10, 'F');
      }
      
      this.doc.setTextColor(...Colors.textDark);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      
      currentX = this.margin;
      this.doc.text(`${kw} kW`, currentX + 5, this.currentY + 7);
      currentX += colWidths[0];
      
      this.doc.text(`${annualProduction.toFixed(2)}`, currentX + 5, this.currentY + 7);
      currentX += colWidths[1];
      
      this.doc.text(`Porzione 2 : ${panelsNeeded} pannelli`, currentX + 5, this.currentY + 7);
      
      this.currentY += 15;
    });
    
    this.addSimplePageFooter();
  }

  private addBuildingLocationPage(data: AdvancedPDFReportData) {
    this.addPageHeader();
    this.currentY = 60;
    
    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text(data.location.address || 'PIAZZA ROMA 30, 41121 MODENA MO', this.pageWidth / 2, this.currentY, { align: 'center' });
    
    this.currentY += 40;
    
    // Map integration - use actual map if available
    const mapHeight = 100;
    
    console.log('Building location page - checking for map data...');
    console.log('Map data available:', !!this.dynamicData.mapImageData);
    
    if (this.dynamicData.mapImageData) {
      console.log('Adding actual map image to PDF');
      // Add actual map image with border
      this.doc.setDrawColor(...Colors.border);
      this.doc.setLineWidth(1);
      this.doc.rect(this.margin, this.currentY, this.contentWidth, mapHeight, 'S');
      
      try {
        this.doc.addImage(this.dynamicData.mapImageData, 'PNG', this.margin + 1, this.currentY + 1, this.contentWidth - 2, mapHeight - 2);
        console.log('Map image added successfully');
      } catch (error) {
        console.error('Error adding map image:', error);
        this.addMapPlaceholder(mapHeight);
      }
    } else {
      console.log('No map data available, using placeholder');
      this.addMapPlaceholder(mapHeight);
    }
    
    this.currentY += mapHeight + 20;
    
    // Building data section
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text(`Latitudine: ${data.location.coordinates.lat.toFixed(7)}`, this.margin, this.currentY);
    this.doc.text(`Longitudine: ${data.location.coordinates.lng.toFixed(6)}`, this.margin, this.currentY + 15);
    this.doc.text(`Data di cattura satellitare: ${data.buildingInsights.imageryDate.day}/${data.buildingInsights.imageryDate.month}/${data.buildingInsights.imageryDate.year}`, this.margin, this.currentY + 30);
    this.doc.text(`Data di processamento: ${this.dynamicData.processingDate}`, this.margin, this.currentY + 45);
    this.doc.text(`Qualità dei dati: ${data.buildingInsights.imageryQuality || 'HIGH'}`, this.margin, this.currentY + 60);
    
    this.currentY += 80;
    
    this.doc.text(`Tipo di abitazione: ${this.dynamicData.buildingType}`, this.margin, this.currentY);
    this.doc.text(`Superficie totale dell'edificio: ${data.buildingInsights.solarPotential.buildingStats.areaMeters2.toFixed(2)} m²`, this.margin, this.currentY + 15);
    this.doc.text(`Superficie del tetto: ${data.buildingInsights.solarPotential.wholeRoofStats.areaMeters2.toFixed(2)} m²`, this.margin, this.currentY + 30);
    
    this.addSimplePageFooter();
  }
  
  private addMapPlaceholder(mapHeight: number) {
    // Fallback to placeholder
    this.doc.setFillColor(240, 245, 250);
    this.doc.setDrawColor(...Colors.border);
    this.doc.roundedRect(this.margin, this.currentY, this.contentWidth, mapHeight, 5, 5, 'FD');
    
    this.doc.setTextColor(...Colors.textMedium);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'italic');
    this.doc.text('Mappa satellitare della zona', this.pageWidth / 2, this.currentY + mapHeight / 2, { align: 'center' });
    this.doc.setFontSize(8);
    this.doc.text('(Immagine non disponibile)', this.pageWidth / 2, this.currentY + mapHeight / 2 + 8, { align: 'center' });
    // Note: currentY is updated in the calling method
  }

  private addDetailedInvestmentPage(data: AdvancedPDFReportData) {
    this.addPageHeader();
    this.currentY = 60;
    
    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('Rientro dell\'investimento: Come funziona?', this.margin, this.currentY);
    
    this.currentY += 30;
    
    // Investment breakdown
    this.addDataRow('Costo impianto', `${data.installationCostTotal.toFixed(0)} €`);
    this.addDataRow('Detrazione fiscale 50% (10 anni)', `${this.dynamicData.taxIncentives.detrazioneAnnualAmount.toFixed(0)} €/anno`);
    
    this.currentY += 20;
    
    const annualSelfConsumption = this.dynamicData.annualSelfConsumption;
    const annualEnergySale = this.dynamicData.annualEnergySale;
    const totalAnnualBenefit = annualSelfConsumption + annualEnergySale + this.dynamicData.taxIncentives.detrazioneAnnualAmount;
    
    this.addDataRow('Risparmio da autoconsumo (40%)', `${annualSelfConsumption.toFixed(2)} €`);
    this.addDataRow('Guadagno vendita energia (60%)', `${annualEnergySale.toFixed(2)} €`);
    this.addDataRow('Totale risparmio annuo', `${totalAnnualBenefit.toFixed(2)} €`, true);
    
    const paybackPeriod = data.installationCostTotal / totalAnnualBenefit;
    this.currentY += 20;
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`Tempo di rientro: ${paybackPeriod.toFixed(2)} anni`, this.margin, this.currentY);
    
    this.addSimplePageFooter();
  }

  private addSystemRecommendationsPage(data: AdvancedPDFReportData) {
    this.addPageHeader();
    this.currentY = 60;
    
    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.success);
    this.doc.text(`POTENZA IMPIANTO CONSIGLIATA: ${this.dynamicData.recommendedSystemSize.kw} kW`, this.margin, this.currentY);
    
    this.currentY += 50;
    
    // System summary
    this.addDataRow('Costo impianto totale', `${data.installationCostTotal.toFixed(0)} €`);
    this.addDataRow('Energia venduta in un anno', `${this.dynamicData.annualEnergySale.toFixed(2)} €`);
    this.addDataRow('Energia risparmiata in un anno', `${this.dynamicData.annualSelfConsumption.toFixed(2)} €`);
    this.addDataRow('Detrazione fiscale annuale', `${this.dynamicData.taxIncentives.detrazioneAnnualAmount.toFixed(0)} €`);
    
    this.addSimplePageFooter();
  }

  private addComprehensiveProjectionTables(data: AdvancedPDFReportData) {
    this.addPageHeader();
    this.currentY = 60;
    
    // Title
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text('DOMANI (senza sistema di accumulo)', this.margin, this.currentY);
    
    this.currentY += 20;
    
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Totale consumo annuo: ${data.yearlyKwhEnergyConsumption.toFixed(0)} kWh`, this.margin, this.currentY);
    
    // Add comprehensive table here
    this.addSimplePageFooter();
  }

  // Enhanced 3D helper methods for beautiful design
  
  private add3DSectionTitle(title: string) {
    const centerX = this.pageWidth / 2;
    
    // 3D title with shadow effect
    this.doc.setFontSize(32);
    this.doc.setFont('helvetica', 'bold');
    
    // Multiple shadow layers for 3D depth
    for (let i = 3; i >= 0; i--) {
      const shadowOffset = i * 0.6;
      const grayValue = 150 + i * 25;
      
      this.doc.setTextColor(grayValue, grayValue, grayValue);
      this.doc.text(title, centerX + shadowOffset, this.currentY + shadowOffset, { align: 'center' });
    }
    
    // Main title
    this.doc.setTextColor(...Colors.textDark);
    this.doc.text(title, centerX, this.currentY, { align: 'center' });
  }
  
  private addDecorativeSeparator() {
    const centerX = this.pageWidth / 2;
    const lineY = this.currentY;
    
    // Gradient line effect
    this.doc.setLineWidth(3);
    
    // Draw multiple lines with decreasing opacity for gradient effect
    for (let i = 0; i < 5; i++) {
      const opacity = 0.8 - (i * 0.15);
      const offset = i * 0.3;
      
      this.doc.setGState(this.doc.GState({ opacity }));
      this.doc.setDrawColor(...Colors.primary);
      this.doc.line(this.margin + offset, lineY + offset, this.pageWidth - this.margin - offset, lineY + offset);
    }
    
    this.doc.setGState(this.doc.GState({ opacity: 1 }));
    
    // Decorative center element
    this.doc.setFillColor(...Colors.secondary);
    this.doc.circle(centerX, lineY, 3, 'F');
    
    // Side decorative elements
    this.doc.setFillColor(...Colors.primary);
    this.doc.circle(this.margin + 20, lineY, 2, 'F');
    this.doc.circle(this.pageWidth - this.margin - 20, lineY, 2, 'F');
  }
  
  private addEnhancedScenarioComparison(data: AdvancedPDFReportData) {
    const centerX = this.pageWidth / 2;
    const baseY = this.currentY + 40;
    
    // Central cost display with 3D effect
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...Colors.warning);
    this.doc.text('Costo dell\'impianto', centerX, baseY - 20, { align: 'center' });
    
    // 3D cost box
    this.doc.setFillColor(255, 240, 240);
    this.doc.rect(centerX - 35 + 2, baseY - 10 + 2, 70, 20, 'F'); // Shadow
    this.doc.setFillColor(...Colors.white);
    this.doc.setDrawColor(...Colors.warning);
    this.doc.setLineWidth(2);
    this.doc.roundedRect(centerX - 35, baseY - 10, 70, 20, 5, 5, 'FD');
    
    this.doc.setFontSize(18);
    this.doc.setTextColor(...Colors.warning);
    this.doc.text(`- ${data.installationCostTotal.toFixed(0)}€`, centerX, baseY + 2, { align: 'center' });
    
    // Left side - Enhanced USCITE section
    this.addEnhanced3DCard(
      this.margin + 25, 
      baseY + 30, 
      'USCITE', 
      `-${this.dynamicData.annualSelfConsumption.toFixed(2)} €`,
      'Totale bollette\nannuali con\nimpianto\nfotovoltaico',
      Colors.warning
    );
    
    // Right side - Enhanced ENTRATE section
    this.addEnhanced3DCard(
      this.pageWidth - this.margin - 65, 
      baseY + 30, 
      'ENTRATE', 
      `+ ${this.dynamicData.annualEnergySale.toFixed(2)} €`,
      'Vendita energia',
      Colors.success
    );
    
    // Additional income
    this.addEnhanced3DCard(
      this.pageWidth - this.margin - 65, 
      baseY + 90, 
      '', 
      `+${this.dynamicData.taxIncentives.detrazioneAnnualAmount.toFixed(0)} €`,
      'Detrazioni',
      Colors.success
    );
    
    // Total savings with 3D effect
    this.addEnhanced3DCard(
      this.pageWidth - this.margin - 65, 
      baseY + 150, 
      '', 
      `${data.savings.toFixed(1)} €`,
      'Risparmio\nbolletta',
      Colors.success
    );

    // Enhanced 3D house in center
    this.currentY = baseY + 60;
    this.addCentralEnhanced3DHouse();
  }
  
  private addEnhanced3DCard(x: number, y: number, title: string, value: string, description: string, color: [number, number, number]) {
    const cardWidth = 55; // Slightly smaller to fit better
    const cardHeight = 45; // Reduced height
    
    // 3D card shadow
    this.doc.setFillColor(200, 200, 200);
    this.doc.setGState(this.doc.GState({ opacity: 0.3 }));
    this.doc.roundedRect(x + 2, y + 2, cardWidth, cardHeight, 6, 6, 'F');
    this.doc.setGState(this.doc.GState({ opacity: 1 }));
    
    // Main card
    this.doc.setFillColor(...Colors.white);
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(1);
    this.doc.roundedRect(x, y, cardWidth, cardHeight, 6, 6, 'FD');
    
    // Card header if title exists
    if (title) {
      this.doc.setFillColor(...color);
      this.doc.roundedRect(x, y, cardWidth, 10, 6, 6, 'F');
      this.doc.setFillColor(...color);
      this.doc.rect(x, y + 5, cardWidth, 5, 'F');
      
      this.doc.setTextColor(...Colors.white);
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(title, x + cardWidth / 2, y + 7, { align: 'center' });
    }
    
    // Value with smaller font to fit better
    const valueY = title ? y + 20 : y + 12;
    this.doc.setTextColor(...color);
    this.doc.setFontSize(12); // Smaller font
    this.doc.setFont('helvetica', 'bold');
    
    // Value shadow (reduced)
    this.doc.setTextColor(220, 220, 220);
    this.doc.text(value, x + cardWidth / 2 + 0.5, valueY + 0.5, { align: 'center' });
    
    // Main value
    this.doc.setTextColor(...color);
    this.doc.text(value, x + cardWidth / 2, valueY, { align: 'center' });
    
    // Description with better spacing
    this.doc.setTextColor(...Colors.textMedium);
    this.doc.setFontSize(7); // Smaller description font
    this.doc.setFont('helvetica', 'normal');
    const descLines = description.split('\n');
    descLines.forEach((line, index) => {
      this.doc.text(line, x + cardWidth / 2, valueY + 12 + (index * 3), { align: 'center' });
    });
  }
  
  private addCentralEnhanced3DHouse() {
    const centerX = this.pageWidth / 2;
    const centerY = this.currentY;
    
    // Enhanced 3D house with better perspective
    this.add3DIsometricHouse(centerX, centerY);
  }
  
  private add3DIsometricHouse(x: number, y: number) {
    // Isometric 3D house design
    const houseWidth = 40;
    const houseHeight = 30;
    const depth = 15;
    
    // House base (front face)
    this.doc.setFillColor(240, 240, 240);
    this.doc.setDrawColor(...Colors.border);
    this.doc.setLineWidth(1);
    this.doc.rect(x - houseWidth/2, y - houseHeight/2, houseWidth, houseHeight, 'FD');
    
    // House side (right face) for 3D effect
    this.doc.setFillColor(220, 220, 220);
    const sidePoints = [
      [x + houseWidth/2, y - houseHeight/2],
      [x + houseWidth/2 + depth, y - houseHeight/2 - depth],
      [x + houseWidth/2 + depth, y + houseHeight/2 - depth],
      [x + houseWidth/2, y + houseHeight/2]
    ];
    
    // Draw side face manually
    this.doc.setDrawColor(...Colors.border);
    this.doc.line(sidePoints[0][0], sidePoints[0][1], sidePoints[1][0], sidePoints[1][1]);
    this.doc.line(sidePoints[1][0], sidePoints[1][1], sidePoints[2][0], sidePoints[2][1]);
    this.doc.line(sidePoints[2][0], sidePoints[2][1], sidePoints[3][0], sidePoints[3][1]);
    this.doc.line(sidePoints[3][0], sidePoints[3][1], sidePoints[0][0], sidePoints[0][1]);
    
    // Fill side face
    this.doc.setFillColor(220, 220, 220);
    this.doc.triangle(sidePoints[0][0], sidePoints[0][1], sidePoints[1][0], sidePoints[1][1], sidePoints[3][0], sidePoints[3][1], 'F');
    this.doc.triangle(sidePoints[1][0], sidePoints[1][1], sidePoints[2][0], sidePoints[2][1], sidePoints[3][0], sidePoints[3][1], 'F');
    
    // Roof with 3D perspective
    this.doc.setFillColor(180, 200, 220);
    this.doc.triangle(x - houseWidth/2 - 5, y - houseHeight/2, x + houseWidth/2 + 5, y - houseHeight/2, x, y - houseHeight/2 - 20, 'F');
    
    // Solar panels with 3D depth
    this.doc.setFillColor(...Colors.tertiary);
    this.doc.rect(x - 15, y - houseHeight/2 - 3, 12, 6, 'F');
    this.doc.rect(x + 3, y - houseHeight/2 - 3, 12, 6, 'F');
    
    // Panel 3D effect
    this.doc.setFillColor(200, 70, 30);
    this.doc.rect(x - 14, y - houseHeight/2 - 2, 12, 5, 'F');
    this.doc.rect(x + 4, y - houseHeight/2 - 2, 12, 5, 'F');
    
    // Windows with depth
    this.doc.setFillColor(...Colors.lightBlue);
    this.doc.rect(x - 15, y - 5, 10, 10, 'F');
    this.doc.rect(x + 5, y - 5, 10, 10, 'F');
    
    // Window frames with 3D effect
    this.doc.setDrawColor(100, 150, 200);
    this.doc.setLineWidth(1);
    this.doc.rect(x - 15, y - 5, 10, 10, 'S');
    this.doc.rect(x + 5, y - 5, 10, 10, 'S');
    
    // Cross pattern in windows
    this.doc.line(x - 10, y - 5, x - 10, y + 5);
    this.doc.line(x - 15, y, x - 5, y);
    this.doc.line(x + 10, y - 5, x + 10, y + 5);
    this.doc.line(x + 5, y, x + 15, y);
    
    // Enhanced door with 3D depth
    this.doc.setFillColor(139, 69, 19);
    this.doc.rect(x - 3, y + 8, 6, 12, 'F');
    
    // Door shadow for depth
    this.doc.setFillColor(100, 50, 10);
    this.doc.rect(x - 2, y + 9, 5, 11, 'F');
    
    // Door handle
    this.doc.setFillColor(...Colors.secondary);
    this.doc.circle(x + 1, y + 14, 0.8, 'F');
  }

  // Helper methods for visual elements
  private addSolarPanelIcon(x: number, y: number) {
    this.doc.setFillColor(...Colors.tertiary);
    this.doc.rect(x - 10, y - 5, 20, 10, 'F');
    
    // Grid lines
    this.doc.setDrawColor(...Colors.white);
    this.doc.setLineWidth(1);
    for (let i = 1; i < 4; i++) {
      this.doc.line(x - 10 + (i * 5), y - 5, x - 10 + (i * 5), y + 5);
    }
    this.doc.line(x - 10, y, x + 10, y);
  }

  private addGrowthIcon(x: number, y: number) {
    this.doc.setFillColor(...Colors.success);
    this.doc.setDrawColor(...Colors.success);
    
    // Simple bar chart
    const bars = [3, 5, 7, 9, 6];
    bars.forEach((height, i) => {
      this.doc.rect(x - 10 + (i * 4), y - height, 3, height, 'F');
    });
    
    // Arrow
    this.doc.setLineWidth(2);
    this.doc.line(x + 12, y - 2, x + 18, y - 8);
    this.doc.line(x + 15, y - 8, x + 18, y - 8);
    this.doc.line(x + 18, y - 5, x + 18, y - 8);
  }

  private addHandIcon(x: number, y: number) {
    this.doc.setFillColor(...Colors.secondary);
    this.doc.circle(x, y, 8, 'F');
    
    // Euro symbol
    this.doc.setTextColor(...Colors.textDark);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('€', x, y + 3, { align: 'center' });
  }

  private addEnergyEfficiencyIllustration() {
    // Enhanced energy efficiency visualization
    const centerX = this.pageWidth / 2;
    const chartWidth = this.contentWidth - 20;
    const chartHeight = 80;
    
    // Chart background with gradient
    this.doc.setFillColor(245, 248, 252);
    this.doc.setDrawColor(...Colors.border);
    this.doc.roundedRect(this.margin + 10, this.currentY, chartWidth, chartHeight, 8, 8, 'FD');
    
    // Energy efficiency bars
    const barWidth = 15;
    const maxHeight = 50;
    const categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const efficiencyColors = [
      [76, 175, 80],   // A - Green
      [139, 195, 74],  // B - Light green
      [255, 235, 59],  // C - Yellow
      [255, 193, 7],   // D - Orange
      [255, 152, 0],   // E - Deep orange
      [255, 87, 34],   // F - Red orange
      [244, 67, 54]    // G - Red
    ];
    
    const startX = this.margin + 30;
    const baseY = this.currentY + chartHeight - 15;
    
    categories.forEach((category, index) => {
      const barHeight = maxHeight - (index * 6); // Decreasing efficiency
      const x = startX + (index * (barWidth + 5));
      
      // 3D bar effect
      const color = efficiencyColors[index];
      this.doc.setFillColor(color[0], color[1], color[2]);
      this.doc.rect(x, baseY - barHeight, barWidth, barHeight, 'F');
      
      // Bar shadow for 3D effect
      this.doc.setFillColor(efficiencyColors[index][0] - 30, efficiencyColors[index][1] - 30, efficiencyColors[index][2] - 30);
      this.doc.rect(x + 1, baseY - barHeight + 1, barWidth - 1, barHeight - 1, 'F');
      
      // Category label
      this.doc.setTextColor(...Colors.textDark);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(category, x + barWidth / 2, baseY + 8, { align: 'center' });
    });
    
    // Chart title
    this.doc.setTextColor(...Colors.primary);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Classificazione Energetica', centerX, this.currentY + 15, { align: 'center' });
    
    // Efficiency indicator arrow pointing to current level
    const currentLevel = 4; // Assuming level E before solar
    const arrowX = startX + (currentLevel * (barWidth + 5)) + barWidth / 2;
    this.doc.setDrawColor(...Colors.warning);
    this.doc.setLineWidth(2);
    this.doc.line(arrowX, baseY + 15, arrowX, baseY + 25);
    this.doc.triangle(arrowX - 3, baseY + 25, arrowX + 3, baseY + 25, arrowX, baseY + 30, 'FD');
    
    this.doc.setTextColor(...Colors.warning);
    this.doc.setFontSize(8);
    this.doc.text('Situazione attuale', arrowX, baseY + 35, { align: 'center' });
  }

  // Helper methods
  private addProjectionRow(label: string, value: string, isBold: boolean = false) {
    this.doc.setFontSize(isBold ? 14 : 12);
    this.doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    this.doc.setTextColor(...Colors.textDark);
    
    this.doc.text(label, this.margin, this.currentY);
    this.doc.text(value, this.pageWidth - this.margin, this.currentY, { align: 'right' });
    
    this.currentY += isBold ? 12 : 10;
  }

  private addDataRow(label: string, value: string, isBold: boolean = false) {
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    this.doc.setTextColor(...Colors.textDark);
    
    this.doc.text(label, this.margin, this.currentY);
    this.doc.text(value, this.pageWidth - this.margin, this.currentY, { align: 'right' });
    
    this.currentY += 15;
  }

  private addPageHeader() {
    // Enhanced header with gradient background
    this.doc.setFillColor(248, 250, 252);
    this.doc.rect(0, 0, this.pageWidth, 60, 'F');
    
    // Header border
    this.doc.setDrawColor(...Colors.border);
    this.doc.setLineWidth(0.3);
    this.doc.line(0, 60, this.pageWidth, 60);
    
    // Header text with better positioning
    this.doc.setTextColor(...Colors.textLight);
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Richiedi una nuova analisi su Klaryo.it', this.pageWidth - this.margin, 12, { align: 'right' });
    
    // Enhanced Klaryo logo with 3D effect
    this.doc.setFillColor(...Colors.secondary);
    
    // Logo star with 3D depth
    const logoX = this.margin + 8;
    const logoY = 25;
    
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x2 = logoX + Math.cos(angle) * 6;
      const y2 = logoY + Math.sin(angle) * 6;
      this.doc.setLineWidth(2);
      this.doc.setDrawColor(...Colors.secondary);
      this.doc.line(logoX, logoY, x2, y2);
    }
    
    // Klaryo text with shadow
    this.doc.setTextColor(200, 200, 200);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Klaryo', this.margin + 20 + 1, 26 + 1);
    
    this.doc.setTextColor(...Colors.primary);
    this.doc.text('Klaryo', this.margin + 20, 26);
    
    // Compact subtitle
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...Colors.textMedium);
    const subtitle = [
      'Klaryo non offre soluzioni nell\'ambito del fotovoltaico, Klaryo è il tuo migliore',
      'alleato per aiutarti a comprendere qual è la miglior scelta da fare per rendere',
      'più efficiente la tua abitazione.'
    ];
    
    subtitle.forEach((line, index) => {
      this.doc.text(line, this.margin, 40 + (index * 3));
    });
  }

  private addSimplePageFooter() {
    // Simple footer at bottom without background
    const footerY = this.pageHeight - 15;
    
    // Just the company name, no decorative elements
    this.doc.setTextColor(...Colors.textLight);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Analisi a cura di Klaryo', this.pageWidth / 2, footerY, { align: 'center' });
  }

  private addNewPage() {
    this.doc.addPage();
    this.currentY = this.topMargin + 10; // More space from top
    this.pageNumber++;
    
    // Add subtle page background
    this.doc.setFillColor(252, 253, 255);
    this.doc.rect(0, 0, this.pageWidth, this.pageHeight, 'F');
  }
}

export async function generateAdvancedPDF(data: AdvancedPDFReportData, mapElement?: HTMLElement): Promise<void> {
  try {
    // Validate required data
    if (!data.buildingInsights || !data.buildingInsights.solarPotential) {
      throw new Error('Building insights data is missing');
    }

    if (data.configId === undefined || data.configId < 0 || 
        data.configId >= data.buildingInsights.solarPotential.solarPanelConfigs.length) {
      throw new Error('Invalid solar panel configuration');
    }

    const generator = new AdvancedPDFGenerator();
    
    // Generate the PDF with map element
    const pdf = await generator.generateAdvancedSolarReport(data, mapElement);
    
    // Generate filename
    const locationName = data.location.name || 'Unknown_Location';
    const safeLocationName = locationName
      .replace(/[^a-zA-Z0-9\s\-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50);
    
    const date = data.reportDate.toISOString().split('T')[0];
    const panelCount = data.buildingInsights.solarPotential.solarPanelConfigs[data.configId]?.panelsCount || 0;
    const filename = `Klaryo_Fotografia_Energetica_${safeLocationName}_${panelCount}pannelli_${date}.pdf`;
    
    // Download the PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Advanced PDF generation failed:', error);
    throw error;
  }
}

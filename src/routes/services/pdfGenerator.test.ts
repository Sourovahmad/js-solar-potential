import { describe, it, expect } from 'vitest';
import { PDFGenerator, type PDFReportData } from './pdfGenerator';

describe('PDFGenerator', () => {
  it('should create a PDF document', () => {
    const generator = new PDFGenerator();
    expect(generator).toBeDefined();
  });

  it('should generate PDF with sample data', async () => {
    const mockData: PDFReportData = {
      location: {
        name: 'Test Location',
        address: '123 Test Street',
        coordinates: { lat: 44.6471, lng: 10.9252 }
      },
      buildingInsights: {
        name: 'Test Building',
        center: { latitude: 44.6471, longitude: 10.9252 },
        boundingBox: {
          sw: { latitude: 44.6461, longitude: 10.9242 },
          ne: { latitude: 44.6481, longitude: 10.9262 }
        },
        imageryDate: { year: 2023, month: 6, day: 15 },
        imageryProcessedDate: { year: 2023, month: 6, day: 15 },
        postalCode: '41121',
        administrativeArea: 'Modena',
        statisticalArea: 'Italy',
        regionCode: 'IT',
        imageryQuality: 'HIGH',
        solarPotential: {
          maxArrayPanelsCount: 20,
          panelCapacityWatts: 400,
          panelHeightMeters: 1.7,
          panelWidthMeters: 1.0,
          panelLifetimeYears: 25,
          maxArrayAreaMeters2: 34,
          maxSunshineHoursPerYear: 2000,
          carbonOffsetFactorKgPerMwh: 400,
          wholeRoofStats: {
            areaMeters2: 100,
            sunshineQuantiles: [1800, 1900, 2000, 2100, 2200],
            groundAreaMeters2: 80
          },
          buildingStats: {
            areaMeters2: 80,
            sunshineQuantiles: [1800, 1900, 2000, 2100, 2200],
            groundAreaMeters2: 80
          },
          roofSegmentStats: [],
          solarPanels: [],
          solarPanelConfigs: [{
            panelsCount: 10,
            yearlyEnergyDcKwh: 4000,
            roofSegmentSummaries: []
          }],
          financialAnalyses: {}
        }
      },
      configId: 0,
      panelCapacityWatts: 400,
      monthlyAverageEnergyBill: 120,
      energyCostPerKwh: 0.3,
      dcToAcDerate: 0.85,
      solarIncentivesPercent: 0.5,
      installationCostPerWatt: 2.5,
      installationLifeSpan: 20,
      efficiencyDepreciationFactor: 0.995,
      costIncreaseFactor: 1.025,
      discountRate: 1.03,
      installationSizeKw: 4,
      installationCostTotal: 10000,
      yearlyKwhEnergyConsumption: 4800,
      yearlyProductionAcKwh: 3400,
      totalCostWithSolar: 15000,
      totalCostWithoutSolar: 25000,
      savings: 10000,
      breakEvenYear: 5,
      energyCovered: 0.7,
      reportDate: new Date()
    };

    const generator = new PDFGenerator();
    const pdf = await generator.generateSolarReport(mockData);
    
    expect(pdf).toBeDefined();
    expect(typeof pdf.save).toBe('function');
  });
}); 
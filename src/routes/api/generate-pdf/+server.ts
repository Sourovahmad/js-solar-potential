import type { AdvancedPDFReportData } from "../../services/advancedPdfGenerator";
import type { BuildingInsightsResponse } from "../../solar";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

function calculateKwhPerKwp(data: AdvancedPDFReportData): number {
    const panelConfig = data.buildingInsights.solarPotential.solarPanelConfigs[data.configId];
    if (panelConfig && panelConfig.panelsCount > 0) {
        const totalKw = (panelConfig.panelsCount * data.panelCapacityWatts) / 1000;
        return panelConfig.yearlyEnergyDcKwh / totalKw;
    }
    return 1100;
}

function calculateRecommendedSystemSize(data: AdvancedPDFReportData): { kw: number, panels: number } {
    const requiredProduction = data.yearlyKwhEnergyConsumption * 1.2; // 20% margin
    const kwhPerKwp = calculateKwhPerKwp(data);
    const recommendedKw = requiredProduction / kwhPerKwp;
    const recommendedPanels = Math.ceil(recommendedKw * 1000 / data.panelCapacityWatts);

    return {
        kw: Math.round(recommendedKw * 10) / 10, // Round to 1 decimal
        panels: recommendedPanels
    };
}

function determineBuildingType(buildingInsights: BuildingInsightsResponse): string {
    const area = buildingInsights.solarPotential.buildingStats.areaMeters2;
    if (area < 100) {
        return 'Domestico Residente - Piccolo';
    } else if (area < 300) {
        return 'Domestico Residente';
    } else {
        return 'Domestico Residente - Grande';
    }
}

function calculateAnnualDetrazione(data: AdvancedPDFReportData): number {
    // Calculate annual detrazione based on installation cost and incentive percentage
    const detrazionePercent = data.solarIncentivesPercent || 0.5;
    const totalDetrazione = data.installationCostTotal * detrazionePercent;
    const maxDetrazione = 96000; // Italian legal maximum
    const actualDetrazione = Math.min(totalDetrazione, maxDetrazione);
    return actualDetrazione / 10; // Spread over 10 years
}
export async function POST({ request }) {
    try {
        const body = await request.json();
        const data = body?.advancedPdfData

        const defaults = {
            customerName: data.customerName || 'Cliente',
            customerEmail: data.customerEmail || 'email@example.com',
            customerPhone: data.customerPhone || '000 000 0000',
            marketRates: {
                tutelatoRate: data.marketRates?.tutelatoRate || 0.34,
                liberoRate: data.marketRates?.liberoRate || 0.32
            },
            systemPerformance: {
                kwhPerKwp: data.systemPerformance?.kwhPerKwp || calculateKwhPerKwp(data),
                selfConsumptionRate: data.systemPerformance?.selfConsumptionRate || 0.4,
                gridSaleRate: data.systemPerformance?.gridSaleRate || 0.1
            },
            taxIncentives: {
                detrazionePercent: data.taxIncentives?.detrazionePercent || data.solarIncentivesPercent,
                detrazioneAnnualAmount: data.taxIncentives?.detrazioneAnnualAmount || calculateAnnualDetrazione(data),
                maxDetrazioneAmount: data.taxIncentives?.maxDetrazioneAmount || 96000
            },
            annualSelfConsumption: data.monthlyAverageEnergyBill * 12 * data?.systemPerformance?.selfConsumptionRate,
            annualEnergySale: data.yearlyProductionAcKwh * (1 - data?.systemPerformance?.selfConsumptionRate) * data?.systemPerformance?.gridSaleRate,
            buildingType: determineBuildingType(data.buildingInsights),
            processingDate: new Date().toLocaleDateString('it-IT'),
            recommendedSystemSize: calculateRecommendedSystemSize(data)
        };

        const templateUrl = `${import.meta.env.VITE_APP_URL || process.env.VITE_APP_URL}/templates/invoice.html`;
        console.log(process.env)

        const res = await fetch(templateUrl);
        let html = await res.text();

        const installationCost = data.installationCostTotal;
        const remainingBills = data.totalCostWithSolar - installationCost;

        const energySale = (data.yearlyProductionAcKwh * 0.1 * 10); // Simplified
        const deductions = 1400; // From reference
        const energyTotal = energySale + deductions;
        const totalWithoutSolar = data.totalCostWithoutSolar;
        const totalSavings = data.savings;
        const totalWithSolar = data.totalCostWithSolar;
        const costAnalysisText = `Il tuo costo effettivo dell'energia è di ${data.energyCostPerKwh.toFixed(2)} €/kWh, ben più alto rispetto alla media nazionale`;
        const annualSavings = (data.monthlyAverageEnergyBill * 12 * 0.4).toFixed(2); // 40% self-consumption
        const energySale2 = (data.yearlyProductionAcKwh * 0.6 * 0.1).toFixed(2);
        const totalAnnualSaving = (parseFloat(annualSavings) + parseFloat(energySale2) + 140).toFixed(2);
        const requiredProduction = data.yearlyKwhEnergyConsumption * 1.2; //
        const recommendedPanels = defaults.recommendedSystemSize.panels;
        const paybackYears = (data.installationCostTotal / parseFloat(totalAnnualSaving)).toFixed(2);
        const panelConfig = data.buildingInsights.solarPotential.solarPanelConfigs[data.configId];
        const systemSizes = [8, 10, 13, 15, 18, 20, 23, 25, 28, 30];
        const systemSizes2 = [3.2 , 4, 5.2, 6, 7.2, 8, 9.2, 10, 11.2, 12,13.2,14,15.2,16,17.2,18,19.2,20];




        let tableRowsHTML: unknown = "";
        let tableRowsHTML2: unknown = "";
        let tableRowsHTML3: unknown = "";

        tableRowsHTML2 = systemSizes.map((kw) => {
            const annualProduction = kw * defaults.systemPerformance.kwhPerKwp;
            const panelsNeeded = Math.ceil(kw * 1000 / data.panelCapacityWatts);
            return `
             <tr>
                    <td style="border: 2px solid black; border-collapse: collapse;  padding: 12px 15px;text-align: left;font-size: 16px;font-weight: 600;color: #333333;">${`${kw} kW`}</td>
                    <td style="border: 2px solid black; border-collapse: collapse;  padding: 12px 15px;text-align: left;font-size: 16px;font-weight: 600;color: #333333;">${annualProduction.toFixed(2)}</td>
                    <td style="border: 2px solid black; border-collapse: collapse;  padding: 12px 15px;text-align: left;font-size: 16px;font-weight: 600;color: #333333;">${`Porzione 2 : ${panelsNeeded} pannelli`}</td>
            </tr>
            `
        })
        .join("");

        tableRowsHTML3 = systemSizes2.map((kw) => {
            return `
             <tr>
                    <td style="border: 2px solid black; border-collapse: collapse;  padding: 8px;text-align: left;font-size: 12px;font-weight: 600;color: #333333;">${`${kw} kW`}</td>
                    <td style="border: 2px solid black; border-collapse: collapse;  padding: 8px;text-align: left;font-size: 12px;font-weight: 600;color: #333333;">4427.54</td>
                    <td style="border: 2px solid black; border-collapse: collapse;  padding: 8px;text-align: left;font-size: 12px;font-weight: 600;color: #333333;">-1030.65 €</td>
                    <td style="border: 2px solid black; border-collapse: collapse;  padding: 8px;text-align: left;font-size: 12px;font-weight: 600;color: #333333;">-1638.19 €</td>
                    <td style="border: 2px solid black; border-collapse: collapse;  padding: 8px;text-align: left;font-size: 12px;font-weight: 600;color: #333333;">-2240 €</td>
                    <td style="border: 2px solid black; border-collapse: collapse;  padding: 8px;text-align: left;font-size: 12px;font-weight: 600;color: #333333;">-2240 €</td>
                    <td style="border: 2px solid black; border-collapse: collapse;  padding: 8px;text-align: left;font-size: 12px;font-weight: 600;color: #333333;">-1.37 anni</td>
            </tr>
            `
        })
        .join("");

        if (panelConfig && panelConfig.roofSegmentSummaries.length > 0) {
            tableRowsHTML = panelConfig.roofSegmentSummaries
                .map((segment: unknown, index: number) => {
                    return `
                    <tr>
                    <td style="border: 2px solid black; border-collapse: collapse;  padding: 0px 8px;text-align: center;font-size: 16px;font-weight: 600;color: #333333;">${index + 1}</td>
                    <td style="border: 2px solid black; border-collapse: collapse;  padding: 0px 8px;text-align: center;font-size: 16px;font-weight: 600;color: #333333;">${(segment.pitchDegrees || 0).toFixed(2)}°</td>
                    <td style="border: 2px solid black; border-collapse: collapse;  padding: 0px 8px;text-align: center;font-size: 16px;font-weight: 600;color: #333333;">${((segment.yearlyEnergyDcKwh || 0) / 100).toFixed(2)} kWh</td>
                    </tr>
                `;
                })
                .join("");
        } else {
            tableRowsHTML = `
                <tr>
                <td colspan="3" style="text-align:center;">Nessun dato disponibile</td>
                </tr>
            `;
        }

        // 2. Replace placeholders with dynamic data
        html = html
            .replace("{{name}}", data.customerName)
            .replace("{{email}}", data.customerEmail)
            .replace("{{phone}}", data.customerPhone)
            .replace("{{date}}", new Date(data.reportDate).toLocaleDateString('it-IT').replace(/\//g, '-'))
            .replace("{{address}}", data.location.address)
            .replace("{{address1}}", data.location.address)
            .replace("{{address2}}", data.location.address)
            .replace("{{installationCost}}", `${installationCost.toFixed(0)} €`)
            .replace("{{remainingBills}}", `${remainingBills.toFixed(2)} €`)
            .replace("{{installationCostTotal}}", `- ${data.installationCostTotal.toFixed(0)}€`)
            .replace("{{uscite}}", `-${defaults.annualSelfConsumption.toFixed(2)} €`)
            .replace("{{entrate}}", `+ ${defaults.annualEnergySale.toFixed(2)} €`)
            .replace("{{detrazioneAnnualAmount}}", `+${defaults.taxIncentives.detrazioneAnnualAmount.toFixed(0)} €`,)
            .replace("{{savings}}", `${data.savings.toFixed(1)} €`,)
            .replace("{{costoImpianto}}", `${data.installationCostTotal.toFixed(0)} €`)
            .replace("{{bolletteResidue}}", `${remainingBills.toFixed(2)} €`)
            .replace("{{tot}}", `${data.totalCostWithSolar.toFixed(2)} €`)
            .replace("{{costoImpianto2}}", `${energySale.toFixed(2)} €`)
            .replace("{{bolletteResidue2}}", `${deductions} €`)
            .replace("{{tot2}}", `${energyTotal.toFixed(2)} €`)
            .replace("{{costiTotali}}", `${totalWithoutSolar.toFixed(1)} €`)
            .replace("{{costiTotali2}}", `${totalWithSolar.toFixed(2)} €`)
            .replace("{{totalSaving}}", `${totalSavings.toFixed(2)}€`)
            .replace("{{spesa}}", `${(data.monthlyAverageEnergyBill * 12).toFixed(2)} €`)
            .replace("{{consumo}}", `${data.yearlyKwhEnergyConsumption.toFixed(0)} kWh`)
            .replace("{{prezzo}}", `${data.energyCostPerKwh.toFixed(2)} €/kWh`)
            .replace("{{quanto}}", `${data.energyCostPerKwh.toFixed(2)}€/kWh`)
            .replace("{{quanto2}}", '0.33 €/kWh')
            .replace("{{costAnalysisText}}", costAnalysisText)
            .replace("{{prezzoMedio}}", `${defaults.marketRates.tutelatoRate.toFixed(2)} €/kWh`)
            .replace("{{prezzoMedio2}}", `${defaults.marketRates.liberoRate.toFixed(2)} €/kWh`)
            .replace("{{potenzia}}", `${defaults.recommendedSystemSize.kw} kW`)
            .replace("{{costoImpianto3}}", `${data.installationCostTotal.toFixed(0)} €`)
            .replace("{{energiaVenduta}}", `${defaults.annualEnergySale.toFixed(2)} €`)
            .replace("{{energiaRisparmiata}}", `${defaults.annualSelfConsumption.toFixed(2)} €`)
            .replace("{{detrazione}}", `${defaults.taxIncentives.detrazioneAnnualAmount.toFixed(0)} €`)
            .replace("{{spesaAnnua}}", `${(data.monthlyAverageEnergyBill * 12).toFixed(2)} €`)
            .replace("{{totaleRisparmio}}", `${totalAnnualSaving} €`)
            .replace("{{rientro}}", `${defaults.annualSelfConsumption.toFixed(2)} €`)
            .replace("{{mapview}}", body.imgData)
            .replace("{{produzione}}", `${requiredProduction.toFixed(0)} kWh`)
            .replace("{{potenzaDell}}", `${defaults.recommendedSystemSize.kw} kWp`)
            .replace("{{panelCapacityWatts}}", `${data.panelCapacityWatts}W)`)
            .replace("{{recommendedSystemSize}}", `${recommendedPanels}`)
            .replace("{{recommendedSystemSize2}}", `${recommendedPanels}`)
            .replace("{{installationCostTotal}}", `${data.installationCostTotal.toFixed(0)} €`)
            .replace("{{taxIncentivesDetrazioneAnnualAmount}}", `${defaults.taxIncentives.detrazioneAnnualAmount.toFixed(0)} €/anno`)
            .replace("{{annualSavings}}", `${annualSavings} €`)
            .replace("{{energySale}}", `${energySale} €`)
            .replace("{{totalAnnualSaving}}", `${totalAnnualSaving} €`)
            .replace("{{installationCostTotalPaybackYears}}", `${data.installationCostTotal.toFixed(0)} € ÷ ${totalAnnualSaving} € = ${paybackYears} anni`)
            .replace("{{mapview1}}", body.imgData)
            .replace("{{lat}}", `${data.location.coordinates.lat.toFixed(7)}`)
            .replace("{{lng}}", `${data.location.coordinates.lng.toFixed(6)}`)
            .replace("{{date}}", ` ${data.buildingInsights.imageryDate.day}/${data.buildingInsights.imageryDate.month}/${data.buildingInsights.imageryDate.year}`)
            .replace("{{processingDate}}", defaults.processingDate)
            .replace("{{imageryQuality}}", `${data.buildingInsights.imageryQuality || "HIGH"}`)
            .replace("{{buildingType}}", defaults.buildingType)
            .replace("{{areaMeters2}}", `${data.buildingInsights.solarPotential.buildingStats.areaMeters2.toFixed(2)} m²`)
            .replace("{{areaMeters}}", `${data.buildingInsights.solarPotential.wholeRoofStats.areaMeters2.toFixed(2)} m²`)
            .replace("{{tableRows}}", tableRowsHTML)
            .replace("{{customerName}}", defaults.customerName)
            .replace("{{yearlyKwhEnergyConsumption}}", ` ${data.yearlyKwhEnergyConsumption.toFixed(0)} kWh`)
            .replace("{{energyCostPerKwh}}", ` ${data.energyCostPerKwh.toFixed(2)} €/kWh`)
            .replace("{{investimento}}", data.installationCostTotal.toFixed(0))
            .replace("{{tableRows2}}", tableRowsHTML2)
            .replace("{{tableRows3}}", tableRowsHTML3)
            .replace("{{totaleConsumo}}", `${data.yearlyKwhEnergyConsumption.toFixed(0)} kWh`)
            .replace("{{monthlyAverageEnergyBill}}", `${(data.monthlyAverageEnergyBill * 12).toFixed(2)} €`)
            .replace("{{yearlyKwhEnergyConsumption1}}", `${data.yearlyKwhEnergyConsumption.toFixed(0)} kWh`)

        const isVercel = !!process.env.VERCEL;
        console.log(isVercel)
        const executablePath = isVercel
            ? await chromium.executablePath()
            : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

        const browser = await puppeteer.launch({
            executablePath,
            args: isVercel ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true,
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1130 });
        await page.setContent(html, { waitUntil: "networkidle0", timeout: 90_000 });


        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
        }); 

        await browser.close();

        return new Response(pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "attachment; filename=invoice.pdf",
            },
        });
    } catch (error) {
        console.log(error)
    }
}



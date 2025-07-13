export interface EcoReportRequest {
    model: string;
    year: number;
}

export interface EcoReportResponse {
    overallGrade: string;
    fuelEfficiency: string;
    emissions: string;
    powerType: string;
    range: string;
    batteryCapacity?: string;
    energyConsumption?: string;
    ecoModeAvailable?: boolean;
    chargeTime?: string;
    renewableSource?: boolean;
    co2: string;
    recyclability: string;
    greenRating: string;

    tips: {
        speed: number;
        tirePressure: number;
        passengers: string;
        idling: number;
        regenBraking: boolean;
        funFact: string;
    };

    cost?: string;
    fallback?: boolean;
}

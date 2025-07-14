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
    chargeTime?: string;
    co2: string;
    recyclability: string;
    greenRating: string;

    tips: {
        speed: number;
        tirePressure: number;
        idling: number;
        funFact: string;
    };

    cost?: string;
    fallback?: boolean;
}

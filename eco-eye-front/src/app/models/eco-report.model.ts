export interface EcoReportRequest {
    model: string;
    year: number;
}

export interface EcoReportResponse {
    overallGrade: string;
    fuelEfficiency: string;
    emissions: string;
    powerType: string;
    batteryCapacity?: string;
    energyConsumption?: string;
    chargeTime?: string;
    co2: string;
    recyclability: string;

    tips: {
        speed: number;
        tirePressure: number;
        idling: number;
        passengers: number;
        funFact: string;
    };

    cost?: string;
    fallback?: boolean;
}

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
    co2: string;
    recyclability: string;

    estimatedRange?: string;
    chargingTime?: string;
    energySaved?: string;
    

    tips: {
        speed: string;
        tirePressure: string;
        idling: string;
        passengers: string;
        funFact: string;
    };

    cost?: string;
    fallback?: boolean;
}

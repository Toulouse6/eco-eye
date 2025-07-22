// Vehicle interface
export interface EcoReportRequest {
    model: string;
    year: number;
}

export interface EcoReportResponse {

    // Values
    overallGrade: string;

    fuelEfficiency: string;
    emissions: string;
    co2: string;
    recyclability: string;

    powerType: string;
    batteryCapacity?: string;
    energyConsumption?: string;
    estimatedRange?: string;
    chargingTime?: string;

    energySaved?: string;

    // Tips
    tips: {
        speed: string;
        tirePressure: string;
        idling: string;
        passengers: string;
        funFact: string;
    };

    // Fallback & GPT COST
    cost?: string;
    fallback?: boolean;
}

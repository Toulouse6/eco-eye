import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EcoReportService } from '../services/report.service';
import { HttpClientModule } from '@angular/common/http';
import { toast } from 'sonner'

export interface CarFeatures {
    fuelEfficiency: string;
    emissions: string;
    powerType: string;
    batteryCapacity: string;
    energyConsumption: string;
    co2: string;
    recyclability: string;
    estimatedRange?: string;
    chargingTime?: string;
}

export interface EcoTips {
    speed: string;
    tirePressure: string;
    idling: string;
    passengers: string;
    funFact: string;
}

@Component({
    selector: 'app-eco-report',
    standalone: true,
    imports: [CommonModule, HttpClientModule, RouterModule],
    templateUrl: './eco-report.component.html',
    styleUrls: ['./eco-report.component.css']
})

export class EcoReportComponent implements OnInit, OnDestroy {

    // Geo Location
    watchId: number | null = null;
    lastPosition: GeolocationPosition | null = null;

    private firstUpdateDone = false;
    isLoading = true;

    // Car profile
    model = '';
    year = 0;

    userSpeed = '0 km/h';
    estimatedRange = '';
    chargingTime = '';

    totalDistance = 0;
    carbonFootprint = 0;
    co2Saved = 0;
    fuelSaved = 0;

    // Car features
    features: CarFeatures = {
        fuelEfficiency: '',
        emissions: '',
        powerType: '',
        batteryCapacity: '',
        energyConsumption: '',
        co2: '',
        recyclability: ''
    };

    // Eco tips
    tips: EcoTips = {
        speed: '',
        tirePressure: '',
        idling: '',
        passengers: '',
        funFact: ''
    };

    // Constructor
    constructor(private router: Router, private ecoService: EcoReportService) { }

    // Header video
    public selectedVideo = 'assets/videos/road-banner.mp4';

    // On Init
    ngOnInit(): void {
        const state = this.router.getCurrentNavigation()?.extras?.state ?? {};

        if (state?.['model'] && state?.['year']) {
            this.model = state['model'];
            this.year = state['year'];
            this.ecoService.setSelectedVehicle(this.model, this.year);
        } else {
            const stored = this.ecoService.getSelectedVehicle();
            this.model = stored.model;
            this.year = stored.year;

            if (!this.model || !this.year) {
                this.router.navigate(['/']);
                return;
            }
        }

        console.log('Selected vehicle:', this.model, this.year);

        this.ecoService.fetchAndTrackReport(this.model, this.year, this.updateStats.bind(this)).subscribe({
            next: (data) => {
                this.features = data.features;
                this.tips = data.tips;
                this.estimatedRange = data.features.estimatedRange ?? '';
                this.chargingTime = data.features.chargingTime ?? '';

                if (!data.fallback) {
                    toast.success('Eco report ready!', { id: 'loading' });
                } else {
                    toast.warning('Using fallback.', { id: 'loading' });
                }

                // Pending Response
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        if (!this.firstUpdateDone) {
                            this.firstUpdateDone = true;
                            this.isLoading = false;
                            this.ecoService.setReportReady(true);
                            toast.dismiss('loading');
                            toast.warning('GPS update not received. Showing static report.');
                        }
                    }, 5000);
                });
            },
            error: () => {
                this.isLoading = false;
                toast.error('Report failed to load.');
            }
        });

        if (!this.watchId) {
            this.watchId = navigator.geolocation.watchPosition(
                pos => {
                    this.updateStats(pos, this.features);

                },
                err => {
                    console.warn("GPS error:", err.message);
                    this.isLoading = false;
                    toast.dismiss('loading');
                    toast.error("Unable to get location. Using Fallback.");
                },
                { enableHighAccuracy: true }
            );
        }
    }

    // On Destroy
    ngOnDestroy(): void {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
        }
    }

    // Condition setup

    get isElectric(): boolean {
        return this.features.powerType === 'Electric';
    }

    get isHybrid(): boolean {
        return this.features.powerType === 'Hybrid';
    }

    get isCombustion(): boolean {
        return this.features.powerType !== 'Electric' && this.features.powerType !== 'Hybrid';
    }


    // Battery setup

    get batteryRange(): number {
        const capacity = parseFloat(this.features.batteryCapacity || '');
        const efficiency = parseFloat(this.features.energyConsumption || '15');

        if (!capacity || !efficiency) return 0;

        const baseRange = (capacity / efficiency) * 100;
        const numericSpeed = parseFloat(this.userSpeed.replace(/[^\d.]/g, '')) || 80;
        const speedFactor = numericSpeed < 80 ? 1.05 : numericSpeed > 100 ? 0.85 : 1;
        const drivenDistance = this.totalDistance / 1000;
        const adjustedRange = baseRange * speedFactor;

        return Math.max(0, Math.round(adjustedRange - drivenDistance));
    }

    get displayBatteryRange(): string {
        if (this.isElectric || this.isHybrid) {
            const range = this.batteryRange;
            return range ? `${range} km` : 'N/A';
        }
        return '';
    }


    // Emission setup

    get showCo2(): boolean {
        return !this.isElectric;
    }

    get showEmissionRating(): boolean {
        return true;
    }


    // Update User State
    private updateStats(position: GeolocationPosition, features: CarFeatures): void {

        if (!this.firstUpdateDone) {

            this.isLoading = false;
            this.firstUpdateDone = true;

            toast.dismiss('loading');
            toast.success('Eco report ready!');
        }

        const speedMps = position.coords.speed ?? 0;
        this.userSpeed = `${(speedMps * 3.6).toFixed(1)} km/h`;

        if (this.lastPosition) {
            const dist = this.getDistanceFromLatLonInKm(
                this.lastPosition.coords.latitude,
                this.lastPosition.coords.longitude,
                position.coords.latitude,
                position.coords.longitude
            );
            this.totalDistance += dist * 1000;

            const userEmission = parseFloat(features.co2) || 120;
            const fuelEfficiency = parseFloat(features.fuelEfficiency.split(' ')[0]) || 15;
            const avgEmission = 180;
            
            const battery = parseFloat(this.features.batteryCapacity || '0');
            const consumption = parseFloat(this.features.energyConsumption || '15');

            if (!battery || !consumption) {
                toast.error('Missing battery or consumption values.');
                return;
            }


            this.carbonFootprint = (this.totalDistance / 1000) * userEmission;
            this.co2Saved = (this.totalDistance / 1000) * (avgEmission - userEmission);
            this.fuelSaved = this.isElectric ? 0 : (this.totalDistance / 1000) / fuelEfficiency;

        }

        this.lastPosition = position;
    }

    // Get Geo Location Distance 
    private getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371;
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Calculate Grade
    public calculateLiveGreenGrade(): string {
        const score = this.getDrivingScore();
        return score >= 90 ? 'A+' :
            score >= 80 ? 'A' :
                score >= 70 ? 'B' :
                    score >= 60 ? 'C' : 'D';
    }

    // Grade bar
    gradeSegments = [
        { label: 'D', color: '#2d4b32' },
        { label: 'C', color: '#367b41' },
        { label: 'B', color: '#4fa95c' },
        { label: 'A', color: '#6cd876' },
        { label: 'A+', color: '#9fecaeff' }
    ];

    // Calculate score
    private getDrivingScore(): number {
        let score = 100;

        const currentSpeed = parseFloat(this.userSpeed) || 0;
        const recommended = parseFloat(this.tips.speed) || 0;

        const co2Output = this.carbonFootprint;
        const co2Saved = this.co2Saved;

        if (Math.abs(currentSpeed - recommended) > 15) score -= 20;
        else if (Math.abs(currentSpeed - recommended) > 5) score -= 10;

        if (co2Saved > 1000) score += 10;

        if (co2Output > 3000) score -= 15;

        return Math.max(0, Math.min(score, 100));
    }

    private deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }

}

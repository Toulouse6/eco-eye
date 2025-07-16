import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import html2canvas from 'html2canvas';
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
    model = '';
    year = 0;
    userSpeed = '0 km/h';

    watchId: number | null = null;
    lastPosition: GeolocationPosition | null = null;
    totalDistance = 0;
    carbonFootprint = 0;
    co2Saved = 0;
    fuelSaved = 0;

    private geoErrorShown = false;
    isLoading = true;
    isStatsReady = false;
    isSharing = false;

    features: CarFeatures = {
        fuelEfficiency: '',
        emissions: '',
        powerType: '',
        batteryCapacity: '',
        energyConsumption: '',
        co2: '',
        recyclability: ''
    };
    tips: EcoTips = {
        speed: '',
        tirePressure: '',
        idling: '',
        passengers: '',
        funFact: ''
    };

    constructor(private router: Router, private ecoService: EcoReportService) {
        const state = this.router.getCurrentNavigation()?.extras?.state;
        this.model = state?.['model'] ?? 'Unknown';
        this.year = state?.['year'] || new Date().getFullYear();
    }

    ngOnInit(): void {
        toast.loading('Generating your eco report...');
        const requestStart = Date.now();

        this.ecoService.fetchAndTrackReport(this.model, this.year, this.updateStats.bind(this)).subscribe({
            next: (data) => {
                this.features = data.features;
                this.tips = data.tips;

                const elapsed = Date.now() - requestStart;
                const minDuration = data.fallback ? 5000 : 1000;
                const delay = Math.max(0, minDuration - elapsed);

                if (data.fallback) {
                    toast.warning('Using fallback data.', { id: 'loading' });
                    this.isLoading = true;
                } else {
                    toast.success('Eco report ready!', { id: 'loading' });
                }

                setTimeout(() => {
                    this.isStatsReady = true;
                    this.isLoading = false;
                }, delay);

            },
            error: (err) => {
                console.error('Report loading failed completely.', err);
                this.isLoading = false;
                toast.error('Failed to load report.');
            }
        });

        this.watchId = navigator.geolocation.watchPosition(
            pos => this.updateStats(pos, this.features),
            err => {
                if (!this.geoErrorShown) {
                    toast.warning('Location access denied or unavailable.');
                    this.geoErrorShown = true;
                }
            },
            { enableHighAccuracy: true, maximumAge: 5000 }
        );
    }

    ngOnDestroy(): void {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
        }
    }

    get isElectric(): boolean {
        return this.features.powerType === 'Electric';
    }

    get isHybrid(): boolean {
        return this.features.powerType === 'Hybrid';
    }

    get estimatedRange(): string {
        if (!this.isElectric && !this.isHybrid) return '';
        const cap = parseFloat(this.features.batteryCapacity || '');
        const cons = parseFloat(this.features.energyConsumption || '');
        if (!cap || !cons) return '';
        return `${Math.round((cap / cons) * 100)} km`;
    }

    get chargingTime(): string {
        if (!this.isElectric && !this.isHybrid) return '';
        const cap = parseFloat(this.features.batteryCapacity || '') || 0;
        const chargePower = 11;
        if (!cap) return '';
        return `${Math.round(cap / chargePower)} hours`;
    }

    private updateStats(position: GeolocationPosition, features: CarFeatures): void {
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

            this.carbonFootprint = (this.totalDistance / 1000) * userEmission;
            this.co2Saved = (this.totalDistance / 1000) * (avgEmission - userEmission);
            this.fuelSaved = (this.totalDistance / 1000) / fuelEfficiency;

            if (this.isElectric) {
                this.fuelSaved = 0;
            } else {
                this.fuelSaved = (this.totalDistance / 1000) / fuelEfficiency;
            }
        }

        this.lastPosition = position;
    }

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

    public calculateLiveGreenGrade(): string {
        const score = this.getDrivingScore();
        return score >= 90 ? 'A+' :
            score >= 80 ? 'A' :
                score >= 70 ? 'B' :
                    score >= 60 ? 'C' : 'D';
    }

    gradeSegments = [
        { label: 'D', color: '#1b3d2f' },
        { label: 'C', color: '#2f5f3f' },
        { label: 'B', color: '#4f8f5f' },
        { label: 'A', color: '#6fcf7f' },
        { label: 'A+', color: '#7bd575ff' }
    ];

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

    // Screenshot and share
    shareReportScreenshot() {
        if (this.isSharing) return;
        this.isSharing = true;
        toast.loading('Capturing screenshot...', { id: 'loading' });

        const element = document.getElementById('eco-report-container');
        if (!element) {
            this.isSharing = false;
            toast.error('Report area not found.');
            return;
        }

        element.classList.add('screenshot-mode');

        html2canvas(element, {
            logging: false,
            backgroundColor: null,
            width: 1080,
            height: 1920,
            scale: 1,
            useCORS: true,
            allowTaint: true,
            onclone: (clonedDoc) => {
                const container = clonedDoc.getElementById('eco-report-container');
                if (!container) return;
                container.classList.add('screenshot-mode');
                Object.assign(container.style, {
                    width: '1080px',
                    height: '1920px',
                    margin: '0',
                    padding: '0',
                    position: 'relative',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    background: 'linear-gradient(135deg, #2f2b4d 0%, #393466 20%, #403971 35%, #453676 50%, #342b5b 65%, #2c254e 80%, #221d3a 100%)'
                });

                container.querySelectorAll('*').forEach(el => {
                    const htmlEl = el as HTMLElement;
                    if (htmlEl.style) {
                        htmlEl.style.animation = 'none';
                        htmlEl.style.transition = 'none';
                        htmlEl.style.transform = 'none';
                        htmlEl.style.opacity = '0.8';
                        htmlEl.style.visibility = 'visible';
                    }
                });
            }
        }).then(canvas => {
            element.classList.remove('screenshot-mode');

            canvas.toBlob(blob => {
                if (!blob) {
                    this.isSharing = false;
                    toast.error('Failed to generate screenshot.');
                    return;
                }

                const file = new File([blob], 'eco-eye-report.png', { type: 'image/png' });

                if (navigator.canShare?.({ files: [file] })) {
                    navigator.share({
                        title: 'My EcoEye Report',
                        files: [file],
                        text: 'Check out my EcoEye report!'
                    }).finally(() => {
                        this.isSharing = false;
                        toast.success('Report shared!');
                    });
                } else {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = 'eco-eye-report.png';
                    link.click();
                    this.isSharing = false;
                    toast.success('Screenshot downloaded!');
                }
            }, 'image/png', 0.95);
        }).catch(err => {
            element.classList.remove('screenshot-mode');
            console.error('Screenshot error:', err);
            this.isSharing = false;
            toast.error('Screenshot failed.');
        });
    }

    copyToClipboard() {
        const text = this.getEcoReportText();
        navigator.clipboard.writeText(text)
            .then(() => toast.success('Report copied to clipboard!'))
            .catch(err => toast.error('Copy failed.'));
    }

    private getEcoReportText(): string {
        return `EcoEye Report for ${this.model} (${this.year}):

Top Features:
• Fuel Efficiency: ${this.features.fuelEfficiency}
• Emissions: ${this.features.emissions}
• Power Type: ${this.features.powerType}

Eco-Friendly Tips:
• Recommended Speed: ${this.tips.speed} km/h
• Tire Pressure: ${this.tips.tirePressure} PSI
• Avoid Idling Over: ${this.tips.idling} minutes
• Optimal Passengers: ${this.tips.passengers}

Fun Fact:
${this.tips.funFact}

Try your own at: https://eco-eye.web.app/`.trim();
    }
}

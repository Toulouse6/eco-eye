import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import html2canvas from 'html2canvas';
import { HttpClient, HttpClientModule } from '@angular/common/http';



// Interfaces
interface CarFeatures {
    fuelEfficiency: string;
    emissions: string;
    powerType: string;
    range: string;
    batteryCapacity: string;
    energyConsumption: string;
    chargeTime: string;
    co2: string;
    recyclability: string;
    greenRating: string;
}

interface EcoTips {
    speed: number;
    tirePressure: number;
    idling: number;
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

    model: string = '';
    overallGrade: string = '';
    year: number = 0;
    userSpeed: string = '0 km/h';

    watchId: number | null = null;
    lastPosition: GeolocationPosition | null = null;
    totalDistance: number = 0;
    carbonFootprint = 0;
    co2Saved = 0;

    isLoading = true;
    isSharing = false;

    features: CarFeatures = {
        fuelEfficiency: '',
        emissions: '',
        powerType: '',
        range: '',
        batteryCapacity: '',
        energyConsumption: '',
        chargeTime: '',
        co2: '',
        recyclability: '',
        greenRating: ''
    };

    tips: EcoTips = {
        speed: 0,
        tirePressure: 0,
        idling: 0,
        funFact: ''
    };

    constructor(private router: Router, private http: HttpClient) {
        const state = this.router.getCurrentNavigation()?.extras?.state;
        this.model = state?.['model'] ?? 'Unknown';
        this.year = state?.['year'] || new Date().getFullYear();
    }

    ngOnInit(): void {
        this.http.get<any>('assets/fallback.json').subscribe({
            next: (data) => {
                this.features = data.features || this.features;
                this.tips = data.tips || this.tips;
                this.overallGrade = this.features.greenRating || '';
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Failed to load fallback.json:', err);
                this.isLoading = false;
            }
        });

        if (!navigator.geolocation) {
            this.userSpeed = 'Not supported';
            return;
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.updateStats(position),
            (err) => {
                console.warn('Geolocation error:', err.message);
                this.userSpeed = 'Error';
            },
            { enableHighAccuracy: true }
        );
    }

    // On Destroy
    ngOnDestroy(): void {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
        }
    }

    // Distance calculation
    getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

    deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    private updateStats(position: GeolocationPosition): void {
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

            const userEmission = parseFloat(this.features.co2) || 120;
            const avgEmission = 180;

            this.carbonFootprint = (this.totalDistance / 1000) * userEmission;
            this.co2Saved = (this.totalDistance / 1000) * (avgEmission - userEmission);
        }

        this.lastPosition = position;
    }


    // Screenshot functionality
    shareReportScreenshot() {
        if (this.isSharing) return;
        this.isSharing = true;

        const element = document.getElementById('eco-report-container');
        if (!element) {
            this.isSharing = false;
            alert('Report area not found.');
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

                const all = container.querySelectorAll('*');
                all.forEach((el) => {
                    const htmlEl = el as HTMLElement;
                    if (htmlEl.style) {
                        htmlEl.style.animation = 'none';
                        htmlEl.style.transition = 'none';
                        htmlEl.style.transform = 'none';
                        htmlEl.style.opacity = '1';
                        htmlEl.style.visibility = 'visible';
                    }
                });
            }
        }).then(canvas => {
            element.classList.remove('screenshot-mode');

            canvas.toBlob(blob => {
                if (!blob) {
                    this.isSharing = false;
                    return;
                }

                const file = new File([blob], 'eco-eye-report.png', { type: 'image/png' });

                if (navigator.canShare?.({ files: [file] })) {
                    navigator.share({
                        title: 'My EcoEye Report',
                        files: [file],
                        text: 'Check out my EcoEye report!'
                    }).finally(() => this.isSharing = false);
                } else {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = 'eco-eye-report.png';
                    link.click();
                    this.isSharing = false;
                }
            }, 'image/png', 0.95);
        }).catch(err => {
            element.classList.remove('screenshot-mode');
            console.error('Screenshot error:', err);
            this.isSharing = false;
        });
    }

    copyToClipboard() {
        const text = this.getEcoReportText();
        navigator.clipboard.writeText(text)
            .then(() => console.info('Report copied.'))
            .catch(err => console.error('Copy failed:', err));
    }

    private getEcoReportText(): string {
        return `🚗 EcoEye Report for ${this.model} (${this.year}):

Top Features:
• Fuel Efficiency: ${this.features.fuelEfficiency}
• Emissions: ${this.features.emissions}
• Power Type: ${this.features.powerType}
• Range: ${this.features.range}

Eco-Friendly Tips:
• Recommended Speed: ${this.tips.speed} km/h
• Tire Pressure: ${this.tips.tirePressure} PSI
• Avoid Idling Over: ${this.tips.idling} minutes

Fun Fact:
${this.tips.funFact}

Try your own at: https://eco-eye.web.app/`.trim();
    }
}

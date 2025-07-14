import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import html2canvas from 'html2canvas';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
    selector: 'app-eco-report',
    standalone: true,
    imports: [CommonModule, HttpClientModule],
    templateUrl: './eco-report.component.html',
    styleUrls: ['./eco-report.component.css']
})
export class EcoReportComponenet implements OnInit {

    @ViewChild('smokeVideo') smokeVideo!: ElementRef<HTMLVideoElement>;

    model: string = '';
    overallGrade: string = '';
    year: number = 0;
    userSpeed: string = '0 km/h';

    isLoading = true;
    isSharing = false;

    features = {
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

    tips = {
        speed: 0,
        tirePressure: 0,
        idling: 0,
        funFact: ''
    };


    constructor(private router: Router, private http: HttpClient) {
        const state = this.router.getCurrentNavigation()?.extras?.state;
        this.model = state?.['model'] || 'Unknown Model';
        this.year = state?.['year'] || 0;
    }

    ngOnInit(): void {

        // User Speed
        if (navigator.geolocation) {
            navigator.geolocation.watchPosition(
                (position) => {
                    const speedMps = position.coords.speed;
                    if (speedMps !== null && speedMps >= 0) {
                        const speedKph = (speedMps * 3.6).toFixed(1);
                        this.userSpeed = `${speedKph} km/h`;
                    } else {
                        this.userSpeed = '0 km/h';
                    }
                },
                (err) => {
                    console.warn('Geolocation error:', err.message);
                    this.userSpeed = '0 km/h';
                },
                { enableHighAccuracy: true }
            );
        } else {
            this.userSpeed = 'Not supported';
        }

        // Fallback
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
    }

    // Screenshot functionality
    shareReportScreenshot() {
        if (this.isSharing) return;
        this.isSharing = true;

        const element = document.getElementById('eco-report-containe');
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
                const container = clonedDoc.getElementById('eco-report-containe');
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

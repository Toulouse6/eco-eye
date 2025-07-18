import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toast } from 'sonner';
import { EcoReportService } from '../services/report.service';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

    showConsent = true;
    selectedYear: number | null = null;
    selectedModel: string | null = null;
    yearDropdownOpen = false;
    availableYears: number[] = [];

    modelSearch = '';
    dropdownOpen = false;
    filteredModels: string[] = [];

    isLoading = false;

    private allModels: string[] = [];
    private backgroundAudio = new Audio('assets/audio/nova-notes.mp3');

    constructor(
        private router: Router,
        private reportService: EcoReportService
    ) { }

    ngOnInit() {

        this.checkConsentDaily();
        this.loadModels();

        this.backgroundAudio.loop = true;
        this.backgroundAudio.volume = 0.3;

        this.backgroundAudio.play().catch(() => {
            window.addEventListener('click', this.playBackgroundAudio.bind(this), { once: true });
        });
    }

    private playBackgroundAudio(): void {
        if (this.backgroundAudio.paused) {
            this.backgroundAudio.play().catch(err => {
                console.warn('Background audio failed to play.', err);
            });
        }
    }

    acknowledgeConsent(): void {
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem('ecoConsentDate', today);
        this.showConsent = false;
    }

    private checkConsentDaily(): void {
        const lastConsentDate = localStorage.getItem('ecoConsentDate');
        const today = new Date().toISOString().split('T')[0];

        this.showConsent = lastConsentDate !== today;
    }

    private loadModels(): void {
        if (this.allModels.length > 0) {
            this.filteredModels = this.allModels;
            return;
        }

        this.reportService.getModelsFromJson().subscribe({
            next: models => {
                if (!models.length) {
                    toast.warning('No models available.');
                }
                this.allModels = models;
                this.filteredModels = models;
            },
            error: () => {
                toast.error('Failed to load car models.');
            }
        });

    }

    toggleDropdown(): void {
        this.dropdownOpen = !this.dropdownOpen;
        if (this.dropdownOpen) {
            this.modelSearch = '';
            this.loadModels();
        }
    }

    onModelSearchChange(): void {
        const query = this.modelSearch.toLowerCase();
        this.filteredModels = this.allModels.filter(model =>
            model.toLowerCase().includes(query)
        );
    }

    selectModel(model: string): void {
        this.selectedModel = model;
        this.modelSearch = model;
        this.dropdownOpen = false;
        this.filteredModels = [];

        this.reportService.getAvailableYearsFromJson(model).subscribe({
            next: years => {
                this.availableYears = years;
                this.selectedYear = null;
            },
            error: () => {
                this.availableYears = [];
                toast.error('Failed to load available years.');
            }
        });

    }

    toggleYearDropdown() {
        this.yearDropdownOpen = !this.yearDropdownOpen;
    }

    selectYear(year: number) {
        this.selectedYear = year;
        this.yearDropdownOpen = false;
    }

    generateReport(): void {

        if (!this.selectedModel || !this.selectedYear) {
            return;
        }

        this.isLoading = true;
        toast.loading('Generating your report...');

        this.reportService.getEcoReport(this.selectedModel, this.selectedYear).subscribe({
            next: (report) => {
                setTimeout(() => {
                    this.isLoading = false;
                    toast.success('Report ready!');

                    this.router.navigate(['/eco-report'], {
                        state: {
                            model: this.selectedModel,
                            year: this.selectedYear,
                            report: report
                        }
                    });
                }, 5000);
            },
            error: (error) => {
                this.isLoading = false;

                if (error.status === 429) {
                    toast.error('Rate limit hit. Try again soon.');
                } else {
                    toast.error('Report failed to generate.');
                }
            }
        });
    }


}

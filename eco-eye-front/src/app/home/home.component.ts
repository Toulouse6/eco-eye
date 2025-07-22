import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toast } from 'sonner';
import { EcoReportService } from '../services/report.service';
import { BackgroundAudioService } from '../services/audio.service';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

    showConsent = true;
    isLoading = false;

    selectedYear: number | null = null;
    selectedModel: string | null = null;

    yearDropdownOpen = false;
    availableYears: number[] = [];

    modelSearch = '';
    dropdownOpen = false;
    filteredModels: string[] = [];
    private allModels: string[] = [];

    constructor(
        private router: Router,
        private reportService: EcoReportService,
        private backgroundAudioService: BackgroundAudioService
    ) { }

    ngOnInit() {
 
        this.loadModels();

        this.backgroundAudioService.play();
        window.addEventListener('click', this.playBackgroundAudio.bind(this), { once: true });
    }

    // Background Music
    private playBackgroundAudio(): void {
        this.backgroundAudioService.playOnUserGesture();
    }

    // Driver Consent
    private checkConsentOncePerDay(): void {
        const lastConsentDate = localStorage.getItem('ecoConsentDate');
        const today = new Date().toISOString().split('T')[0];

        this.showConsent = lastConsentDate !== today;
    }

    acknowledgeConsent(): void {
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem('ecoConsentDate', today);
        this.showConsent = false;
    }

    // Load Models
    private loadModels(): void {
        this.reportService.getAvailableModels().subscribe({
            next: (models: string[]) => {
                if (!models.length) toast.warning('No models available.');
                this.allModels = models;
                this.filteredModels = models;
            },
            error: () => toast.error('Failed to load car models.')
        });
    }

    // Search Model
    toggleDropdown(): void {
        this.dropdownOpen = !this.dropdownOpen;
        if (this.dropdownOpen) {
            this.modelSearch = '';
            this.filteredModels = this.allModels;
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

        this.reportService.getAvailableYears(model).subscribe({
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

    // Search Year
    toggleYearDropdown(): void {
        this.yearDropdownOpen = !this.yearDropdownOpen;
    }

    selectYear(year: number): void {
        this.selectedYear = year;
        this.yearDropdownOpen = false;
    }

    // Generate Report
    generateReport(): void {
        if (!this.selectedModel || !this.selectedYear) return;
        this.isLoading = true;
        toast.loading('Generating your report...');

        this.reportService.setSelectedVehicle(this.selectedModel, this.selectedYear);

        this.router.navigate(['/eco-report'], {
            state: {
                model: this.selectedModel,
                year: this.selectedYear
            }
        });
    }
}

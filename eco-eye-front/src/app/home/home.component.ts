import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EcoReportService } from '../services/report.service';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

    selectedYear: number | null = null;
    selectedModel: string | null = null;
    yearDropdownOpen = false;
    availableYears: number[] = [];

    modelSearch = '';
    dropdownOpen = false;
    filteredModels: string[] = [];

    isLoading = false;
    errorMessage: string | null = null;

    private backgroundAudio = new Audio('assets/audio/nova-notes.mp3');

    constructor(
        private router: Router,
        private reportService: EcoReportService
    ) { }

    ngOnInit() {
        this.loadModels();

        this.backgroundAudio.currentTime = 0;
        this.backgroundAudio.loop = true;
        this.backgroundAudio.volume = 0.3;

        this.backgroundAudio.play().catch(() => {
            document.body.addEventListener('click', () => {
                this.playBackgroundAudio();
            }, { once: true });
        });
    }

    private playBackgroundAudio(): void {
        if (this.backgroundAudio.paused) {
            this.backgroundAudio.play().catch(err => {
                console.warn('Background audio failed to play.', err);
            });
        }
    }

    private loadModels(): void {
        this.reportService.getModelsFromJson().subscribe(models => {
            this.filteredModels = models;
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
        this.reportService.getModelsFromJson().subscribe(models => {
            this.filteredModels = models.filter(model =>
                model.toLowerCase().includes(query)
            );
        });
    }

    selectModel(model: string): void {
        this.selectedModel = model;
        this.modelSearch = model;
        this.dropdownOpen = false;
        this.filteredModels = [];

        this.reportService.getAvailableYearsFromJson(model).subscribe(years => {
            this.availableYears = years;
            this.selectedYear = null;
        });
    }

    onModelSelect(event: Event): void {
        this.selectedModel = (event.target as HTMLSelectElement).value;
        this.reportService.getAvailableYearsFromJson(this.selectedModel).subscribe(years => {
            this.availableYears = years;
            this.selectedYear = null;
        });
    }

    toggleYearDropdown() {
        this.yearDropdownOpen = !this.yearDropdownOpen;
    }

    selectYear(year: number) {
        this.selectedYear = year;
        this.yearDropdownOpen = false;
    }

    onYearChange(event: Event): void {
        this.selectedYear = +(event.target as HTMLSelectElement).value;
    }

    generateReport(): void {
        if (!this.selectedModel || !this.selectedYear) {
            this.errorMessage = 'Please select both model and year';
            return;
        }

        this.isLoading = true;
        this.errorMessage = null;

        this.reportService.getEcoReport(this.selectedModel, this.selectedYear).subscribe({
            next: (report) => {
                this.isLoading = false;
                this.router.navigate(['/eco-report'], {
                    state: {
                        model: this.selectedModel,
                        year: this.selectedYear,
                        report: report
                    }
                });
            },
            error: (error) => {
                this.isLoading = false;
                this.errorMessage = 'Failed to generate report. Please try again.';
                console.error('Report generation error:', error);
            }
        });
    }

}

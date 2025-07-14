import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
    models: string[] = [
        'Tesla Model Y',
        'Toyota Prius',
        'Ford Mustang Mach-E',
        'Honda Civic',
        'Hyundai Ioniq',
        'Chevy Bolt'
    ];
    filteredModels: string[] = [...this.models]; 

    isLoading = true;
    errorMessage: string | null = null;

    private backgroundAudio = new Audio('assets/audio/realm-of-fairy.mp3');
    private spinnerAudio = new Audio('assets/audio/invisibility-spell.mp3');

    constructor(private router: Router) { }

    ngOnInit() {
        this.backgroundAudio.currentTime = 0;
        this.backgroundAudio.loop = true;
        this.backgroundAudio.volume = 0.4;

        this.spinnerAudio.loop = true;
        this.spinnerAudio.volume = 0.8;

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

    // Toggle the dropdown open/closed
    toggleDropdown(): void {
        this.dropdownOpen = !this.dropdownOpen;
        // Reset the search filter when opening the dropdown
        if (this.dropdownOpen) {
            this.modelSearch = '';
            this.filteredModels = [...this.models];
        }
    }

    // Filter models based on search input
    onModelSearchChange(): void {
        const query = this.modelSearch.toLowerCase();
        this.filteredModels = this.models.filter(model =>
            model.toLowerCase().includes(query)
        );
    }

    // Handle model selection from the dropdown
    selectModel(model: string): void {
        this.selectedModel = model;
        this.modelSearch = model;
        this.dropdownOpen = false;
        this.filteredModels = [];

        this.populateYears(model);
    }

    // In case you have another (fallback) <select> for models
    onModelSelect(event: Event): void {
        this.selectedModel = (event.target as HTMLSelectElement).value;
        this.populateYears(this.selectedModel);
    }

    // Populate available years based on model
    populateYears(model: string): void {
        const currentYear = new Date().getFullYear();
        switch (model) {
            case 'Tesla Model Y':
                this.availableYears = [2025, 2024, 2023];
                break;
            case 'Toyota Prius':
                this.availableYears = [2025, 2024, 2023, 2022];
                break;
            case 'Ford Mustang Mach-E':
                this.availableYears = [2025, 2023];
                break;
            default:
                this.availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
        }

        this.selectedYear = null;
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
        if (!this.selectedModel || !this.selectedYear) return;

        this.playBackgroundAudio();
        this.isLoading = true;
        this.fadeBackgroundDuringLoading();
        this.spinnerAudio.currentTime = 0;
        this.spinnerAudio.play();

        setTimeout(() => {
            this.restoreBackgroundAfterLoading();
            this.spinnerAudio.pause();
            this.isLoading = false;

            this.router.navigate(['/eco-report'], {
                state: {
                    model: this.selectedModel,
                    year: this.selectedYear
                }
            });
        }, 1500);
    }

    private fadeBackgroundDuringLoading() {
        this.backgroundAudio.volume = 0.2;
    }

    private restoreBackgroundAfterLoading() {
        this.backgroundAudio.volume = 0.2;
        this.backgroundAudio.currentTime = 17.5;

        const targetVolume = 0.8;
        const step = 0.05;
        const interval = setInterval(() => {
            if (this.backgroundAudio.volume < targetVolume) {
                this.backgroundAudio.volume = Math.min(this.backgroundAudio.volume + step, targetVolume);
            } else {
                clearInterval(interval);
            }
        }, 60);
    }
}

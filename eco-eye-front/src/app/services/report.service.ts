
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, EMPTY, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { EcoReportResponse, EcoReportRequest } from '../models/eco-report.model';
import { CarFeatures, EcoTips } from '../eco-report/eco-report.component';

@Injectable({ providedIn: 'root' })
export class EcoReportService {
    public apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    // Get models
    getModelsFromJson(): Observable<string[]> {
        return this.http.get<any>('assets/fallback.json').pipe(map(data => data.models));
    }

    // Get years
    getAvailableYearsFromJson(model: string): Observable<number[]> {
        return this.http.get<any>('assets/fallback.json').pipe(
            map(data => {
                const currentYear = new Date().getFullYear();
                return data.modelYearMap[model] ?? Array.from({ length: 5 }, (_, i) => currentYear - i);
            })
        );
    }

    // API Health
    checkApiStatus(): Observable<boolean> {
        return this.http.get(environment.statusUrl).pipe(
            map(() => true),
            catchError(() => of(false))
        );
    }

    // Load Fallback
    private loadFallback(): Observable<EcoReportResponse> {
        return this.http.get<EcoReportResponse>('assets/fallback.json').pipe(
            map(data => {
                console.warn("Using fallback eco report.");
                return { ...data, fallback: true };
            }),
            catchError(err => {
                console.error("Failed to load fallback report:", err);
                throw new Error("Fallback load failed.");
            })
        );
    }

    // Fetch Report
    fetchAndTrackReport(
        model: string,
        year: number,
        updateStats: (position: GeolocationPosition, features: CarFeatures) => void
    ): Observable<{
        features: CarFeatures;
        tips: EcoTips;
        fallback: boolean;
    }> {
        // Subscribe
        return new Observable(observer => {
            this.getEcoReport(model, year).subscribe({
                next: report => {
                    if (navigator.geolocation) {
                        navigator.geolocation.watchPosition(
                            position => updateStats(position, {
                                fuelEfficiency: report.fuelEfficiency ?? '',
                                emissions: report.emissions ?? '',
                                powerType: report.powerType ?? '',
                                batteryCapacity: report.batteryCapacity ?? '',
                                energyConsumption: report.energyConsumption ?? '',
                                co2: report.co2 ?? '',
                                recyclability: report.recyclability ?? ''
                            }),
                            err => console.warn("Geolocation error:", err.message),
                            { enableHighAccuracy: true }
                        );
                    }
                    // Next
                    observer.next({
                        features: {
                            fuelEfficiency: report.fuelEfficiency ?? '',
                            emissions: report.emissions ?? '',
                            powerType: report.powerType ?? '',
                            batteryCapacity: report.batteryCapacity ?? '',
                            energyConsumption: report.energyConsumption ?? '',
                            co2: report.co2 ?? '',
                            recyclability: report.recyclability ?? '',
                            estimatedRange: report.estimatedRange ?? '',
                            chargingTime: report.chargingTime ?? ''
                        },
                        tips: {
                            speed: report.tips?.speed ?? 0,
                            tirePressure: report.tips?.tirePressure ?? 0,
                            idling: report.tips?.idling ?? 0,
                            funFact: report.tips?.funFact ?? '',
                            passengers: report.tips?.passengers ?? 1
                        },
                        fallback: report.fallback ?? false
                    });
                    // Complete
                    observer.complete();
                },
                error: err => observer.error(err)
            });
        });
    }

    // Get Eco Report
    getEcoReport(model: string, year: number): Observable<EcoReportResponse> {
        const payload: EcoReportRequest = { model, year };
        const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

        return new Observable(observer => {
            this.checkApiStatus().subscribe(isOnline => {
                if (!isOnline) {
                    this.loadFallback().subscribe({
                        next: report => {
                            observer.next(report);
                            observer.complete();
                        },
                        error: err => observer.error(err)
                    });
                    return;
                }

                // Post
                this.http.post<{ report: EcoReportResponse | string; cost?: string }>(this.apiUrl, payload, { headers }).pipe(
                    catchError(err => {
                        console.warn("API call failed. Using fallback.", err);
                        this.loadFallback().subscribe({
                            next: report => {
                                observer.next(report);
                                observer.complete();
                            },
                            error: fallbackErr => observer.error(fallbackErr)
                        });
                        return EMPTY;
                    })
                    // Subscribe
                ).subscribe({
                    next: ({ report, cost }) => {
                        let parsed: any = report;
                        if (typeof report === 'string') {
                            try {
                                parsed = JSON.parse(report);
                            } catch (err) {
                                console.warn("Could not parse GPT report. Using fallback.");
                                this.loadFallback().subscribe({
                                    next: fallback => {
                                        observer.next(fallback);
                                        observer.complete();
                                    },
                                    error: fallbackErr => observer.error(fallbackErr)
                                });
                                return;
                            }
                        }
                        // Using Fallback
                        if (!parsed || typeof parsed !== 'object') {
                            console.warn("Invalid report structure. Using fallback.");
                            this.loadFallback().subscribe({
                                next: fallback => {
                                    observer.next(fallback);
                                    observer.complete();
                                },
                                error: fallbackErr => observer.error(fallbackErr)
                            });
                            return;
                        }
                        // Report received
                        console.info("GPT report received.");
                        if (cost) console.log(`GPT Cost: $${parseFloat(cost).toFixed(6)}`);
                        observer.next({ ...parsed, cost, fallback: false });
                        observer.complete();
                    },
                    error: err => observer.error(err)
                });
            });
        });
    }
}
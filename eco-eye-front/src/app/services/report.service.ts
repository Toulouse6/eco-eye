import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, EMPTY, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { EcoReportResponse, EcoReportRequest } from '../models/eco-report.model';
import { CarFeatures, EcoTips } from '../eco-report/eco-report.component';

@Injectable({ providedIn: 'root' })

export class EcoReportService {

    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    getModelsFromJson(): Observable<string[]> {
        return this.http.get<any>('assets/fallback.json').pipe(map(data => data.models));
    }

    getAvailableYearsFromJson(model: string): Observable<number[]> {
        return this.http.get<any>('assets/fallback.json').pipe(
            map(data => {
                const currentYear = new Date().getFullYear();
                return data.modelYearMap[model] ?? Array.from({ length: 5 }, (_, i) => currentYear - i);
            })
        );
    }

    checkApiStatus(): Observable<boolean> {
        return this.http.get(this.apiUrl + '/', { responseType: 'text' }).pipe(
            map(() => true),
            catchError(err => {
                console.warn("🔌 API unreachable:", err.message);
                return of(false);
            })
        );
    }

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

    fetchAndTrackReport(
        model: string,
        year: number,
        updateStats: (position: GeolocationPosition, features: CarFeatures) => void
    ): Observable<{
        features: CarFeatures;
        tips: EcoTips;
        fallback: boolean;
    }> {
        return new Observable(observer => {
            this.getEcoReport(model, year).subscribe({
                next: (report) => {
                    // Start GPS tracking
                    if (navigator.geolocation) {

                        navigator.geolocation.watchPosition(
                            (position) => updateStats(position, {
                                fuelEfficiency: report.fuelEfficiency ?? '',
                                emissions: report.emissions ?? '',
                                powerType: report.powerType ?? '',
                                batteryCapacity: report.batteryCapacity ?? '',
                                energyConsumption: report.energyConsumption ?? '',
                                chargeTime: report.chargeTime ?? '',
                                co2: report.co2 ?? '',
                                recyclability: report.recyclability ?? '',
                                greenRating: report.greenRating ?? ''
                            }),
                            (err) => {
                                console.warn("Geolocation error:", err.message);
                            },
                            { enableHighAccuracy: true }
                        );
                    }

                    observer.next({
                        features: {
                            fuelEfficiency: report.fuelEfficiency ?? '',
                            emissions: report.emissions ?? '',
                            powerType: report.powerType ?? '',
                            batteryCapacity: report.batteryCapacity ?? '',
                            energyConsumption: report.energyConsumption ?? '',
                            chargeTime: report.chargeTime ?? '',
                            co2: report.co2 ?? '',
                            recyclability: report.recyclability ?? '',
                            greenRating: report.greenRating ?? ''
                        },
                        tips: report.tips,
                        fallback: report.fallback ?? false
                    });

                    observer.complete();
                },
                error: (err) => {
                    observer.error(err);
                }
            });
        });
    }


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

                this.http.post<{ report: EcoReportResponse | string; cost?: string }>(
                    `${this.apiUrl}/generateReport`,
                    payload,
                    { headers }
                ).pipe(
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
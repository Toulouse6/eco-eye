
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, EMPTY, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { EcoReportResponse, EcoReportRequest } from '../models/eco-report.model';
import { CarFeatures, EcoTips } from '../eco-report/eco-report.component';
import { toast } from 'sonner';
import { BehaviorSubject } from 'rxjs';


@Injectable({ providedIn: 'root' })
export class EcoReportService {

    // Backend URL
    public apiUrl = environment.apiUrl;

    // Model & Year
    private selectedModel = '';
    private selectedYear = 0;

    // Check report status
    private reportReadySubject = new BehaviorSubject<boolean>(false);
    public reportReady$ = this.reportReadySubject.asObservable();

    // Set report status
    public setReportReady(isReady: boolean): void {
        this.reportReadySubject.next(isReady);
    }

    // Ccnstructor
    constructor(private http: HttpClient) { }


    // Get models & Years
    getAvailableModels(): Observable<string[]> {
        return this.http.get<{ models: string[] }>('assets/fallback.json').pipe(
            map(data => data.models),
            catchError(err => {
                console.error('Failed to load models:', err);
                return of([]);
            })
        );
    }

    getAvailableYears(model: string): Observable<number[]> {
        return this.http.get<{ modelYearMap: { [key: string]: number[] } }>('assets/fallback.json').pipe(
            map(data => data.modelYearMap[model] || []),
            catchError(err => {
                console.error('Failed to load years:', err);
                return of([]);
            })
        );
    }


    // Set / Get Selected Vehicle
    setSelectedVehicle(model: string, year: number): void {
        this.selectedModel = model;
        this.selectedYear = year;
    }

    getSelectedVehicle(): { model: string; year: number } {
        return {
            model: this.selectedModel,
            year: this.selectedYear
        };
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
                console.warn("Using fallback.");
                return { ...data, fallback: true };
            }),
            catchError(err => {
                console.error("Failed to load fallback:", err);
                throw new Error("Failed to load fallback.");
            })
        );
    }


    /////// Fetch Report ///////

    fetchAndTrackReport(

        model: string,
        year: number,

    ): Observable<{
        features: CarFeatures;
        tips: EcoTips;
        fallback: boolean;
    }> {
        // Subscribe
        return new Observable(observer => {
            this.getEcoReport(model, year).subscribe({
                next: report => {

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

        console.log('Sending data to GPT:', payload);

        return new Observable(observer => {
            this.checkApiStatus().subscribe({
                next: isOnline => {
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
                        this.apiUrl, payload, { headers }
                    ).pipe(
                        catchError(err => {
                            console.warn("API call failed. Using fallback.", err);
                            toast.warning("Data unavailable. Using fallback.");

                            this.loadFallback().subscribe({
                                next: fallback => {
                                    observer.next(fallback);
                                    observer.complete();
                                },
                                error: fallbackErr => {
                                    toast.error("Fallback failed. Try again.");
                                    observer.error(fallbackErr);
                                }
                            });

                            return EMPTY;
                        })
                    ).subscribe({
                        next: ({ report, cost }) => {
                            toast.success("ECOfriendly report loaded!");

                            let parsed = report;
                            if (typeof report === 'string') {
                                try {
                                    parsed = JSON.parse(report);
                                } catch (err) {
                                    toast.warning("Malformed report. Loading fallback.");
                                    this.loadFallback().subscribe({
                                        next: fallback => {
                                            observer.next(fallback);
                                            observer.complete();
                                        },
                                        error: fallbackErr => {
                                            toast.error("Fallback unavailable.");
                                            observer.error(fallbackErr);
                                        }
                                    });
                                    return;
                                }
                            }

                            if (!parsed || typeof parsed !== 'object') {
                                toast.warning("Invalid report format. Showing fallback.");
                                this.loadFallback().subscribe({
                                    next: fallback => {
                                        observer.next(fallback);
                                        observer.complete();
                                    },
                                    error: fallbackErr => {
                                        toast.error("Unable to display fallback.");
                                        observer.error(fallbackErr);
                                    }
                                });
                                return;
                            }

                            observer.next({ ...parsed, cost, fallback: false });
                            observer.complete();
                        },
                        error: err => {
                            toast.error("Failed to load report.");
                            observer.error(err);
                        }
                    });
                }
            });
        });
    }
}
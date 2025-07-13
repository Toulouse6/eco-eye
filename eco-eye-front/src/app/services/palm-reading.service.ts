import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { EcoReportResponse, EcoReportRequest } from '../models/eco-report.model';

@Injectable({
    providedIn: 'root'
})
export class EcoReportService {

    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    getEcoReport(model: string, year: number): Observable<EcoReportResponse> {
        const payload: EcoReportRequest = { model, year };
        const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

        return new Observable(observer => {
            this.http.post<{ report: EcoReportResponse; cost?: string }>(`${this.apiUrl}/generateReport`, payload, { headers }).pipe(
                catchError(err => {
                    console.warn('API failed. Using fallback.', err);
                    this.loadFallbackReport(observer);
                    return EMPTY;
                })
            ).subscribe({
                next: response => {
                    const report = response?.report;
                    const cost = response?.cost;

                    if (!report || typeof report !== 'object') {
                        console.warn("Invalid or missing report, loading fallback.");
                        this.loadFallbackReport(observer);
                        return;
                    }

                    console.info("✅ Eco report received successfully.");
                    if (cost) console.log(`GPT Cost: $${parseFloat(cost).toFixed(6)}`);

                    observer.next({ ...report, cost });
                    observer.complete();
                },
                error: err => {
                    console.error("Request error:", err);
                    this.loadFallbackReport(observer);
                }
            });
        });
    }

    private loadFallbackReport(observer: any) {
        this.http.get<EcoReportResponse>('assets/fallback-eco.json').subscribe({
            next: data => {
                console.warn("Using local fallback eco report.");
                observer.next({ ...data, fallback: true });
                observer.complete();
            },
            error: err => {
                console.error("Failed to load fallback eco report:", err);
                observer.error("Fallback load failed.");
            }
        });
    }
}
